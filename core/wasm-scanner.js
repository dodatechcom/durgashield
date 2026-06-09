/* ---------- WASM Aho-Corasick Scanner Module ----------
   Loads and wraps WebAssembly binary for ultrafast substring matching.
   Falls back to JS automaton if WASM unavailable.

   Usage:
     const scanner = await WasmScanner.create(jsAutomaton);
     const matches = scanner.scan("https://example.com/ad-banner-123.js");
     // → [{ index: 24, pattern: "/ad" }]
*/

class WasmScanner {
  constructor(wasmInstance, patternList) {
    this.instance = wasmInstance;
    this.exports = wasmInstance.exports;
    this.patternList = patternList;
    this.memory = this.exports.memory;

    // Allocate fixed-size buffers in WASM linear memory
    const mem = new Uint32Array(this.memory.buffer);
    this.textOffset = 1_000_000;  // reserve 1MB for automaton data
    this.resultOffset = 3_000_000; // result buffer
    this.maxResults = 4096;
    this.textMaxLen = 1_000_000;   // max URL length we'll scan
  }

  /* ---------- Build dense edge table from JS automaton ---------- */
  static buildEdgeTable(trie) {
    const N = trie.length;
    const table = new Uint32Array(N * 256);
    for (let i = 0; i < N; i++) {
      const node = trie[i];
      const base = i * 256;
      for (const [ch, target] of Object.entries(node.next)) {
        if (ch.length === 1) {
          table[base + ch.charCodeAt(0)] = target;
        }
      }
    }
    return table;
  }

  /* ---------- Initialize WASM with automaton ---------- */
  static async create(jsTrie, patternList) {
    try {
      const url = _b.runtime.getURL('resources/dgs_ac_wasm.wasm');
      const response = await fetch(url);
      const wasmBytes = await response.arrayBuffer();
      const wasmModule = await WebAssembly.compile(wasmBytes);
      const wasmInstance = await WebAssembly.instantiate(wasmModule);
      return new WasmScanner(wasmInstance, patternList);
    } catch (e) {
      console.warn('DurgaShield: WASM init failed, falling back to JS:', e.message);
      return null;
    }
  }

  /* ---------- Serialize automaton to WASM memory ---------- */
  initAutomaton(trie, patternList) {
    this.patternList = patternList;
    const N = trie.length;
    if (N === 0) return;

    // Build dense edge table
    const edgeTable = WasmScanner.buildEdgeTable(trie);

    // Count total outputs
    let totalOutputs = 0;
    for (let i = 0; i < N; i++) {
      totalOutputs += trie[i].outputs.length;
    }

    // Compute sizes (all in u32)
    const headerSize = 1; // num_nodes
    const failSize = N;
    const outputCountSize = N;
    const outputDataSize = totalOutputs;
    const edgeTableSize = N * 256;

    const totalSize = headerSize + failSize + outputCountSize + outputDataSize + edgeTableSize;
    const BYTES_PER_U32 = 4;

    // Ensure WASM memory is large enough
    const neededPages = Math.ceil((totalSize * BYTES_PER_U32 + this.textMaxLen + this.maxResults * 2 + 4096) / 65536);
    const currentPages = this.memory.buffer.byteLength / 65536;
    if (neededPages > currentPages) {
      this.exports.memory.grow(neededPages - currentPages);
    }

    const mem = new Uint32Array(this.memory.buffer);

    // Write header
    mem[0] = N;

    // Write fail links
    let offset = headerSize;
    for (let i = 0; i < N; i++) {
      mem[offset + i] = trie[i].fail;
    }

    // Write output counts
    offset += failSize;
    for (let i = 0; i < N; i++) {
      mem[offset + i] = trie[i].outputs.length;
    }

    // Write output pattern indices
    offset += outputCountSize;
    let outIdx = 0;
    for (let i = 0; i < N; i++) {
      for (const patIdx of trie[i].outputs) {
        mem[offset + outIdx] = patIdx;
        outIdx++;
      }
    }

    // Write edge table
    offset += outputDataSize;
    mem.set(edgeTable, offset);

    this.automatonSizeBytes = totalSize * BYTES_PER_U32;
  }

  /* ---------- Scan text ----------
     Returns array of { index, pattern } matches.
  */
  scan(text) {
    if (!this.exports || !text) return [];

    const byteLength = Math.min(text.length, this.textMaxLen);
    const textBytes = new TextEncoder().encode(text).slice(0, byteLength);

    // Write text to WASM memory
    const textMem = new Uint8Array(this.memory.buffer);
    textMem.set(textBytes, this.textOffset);

    // Set up result buffer (zeroed)
    const resultMem = new Uint32Array(this.memory.buffer);
    const resultWords = 1 + this.maxResults * 2; // count + pairs
    for (let i = 0; i < resultWords; i++) {
      resultMem[this.resultOffset / 4 + i] = 0;
    }

    // Call WASM scan
    const count = this.exports.ac_scan(
      0,               // automaton at offset 0
      this.textOffset, // text pointer
      textBytes.length,
      this.resultOffset / 4 // result pointer (in u32 units)
    );

    if (!count) return [];

    // Read results
    const matches = [];
    const base = this.resultOffset / 4;
    for (let i = 0; i < count && i < this.maxResults; i++) {
      const patIdx = resultMem[base + 1 + i * 2];
      if (patIdx < this.patternList.length) {
        matches.push({
          index: resultMem[base + 1 + i * 2 + 1],
          pattern: this.patternList[patIdx]
        });
      }
    }
    return matches;
  }

  /* ---------- Batch scan ---------- */
  scanBatch(urls) {
    return urls.map(url => this.scan(url));
  }
}
