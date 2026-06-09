/* ---------- Pattern Matcher Module ----------
   Efficient multi-pattern matching using Aho-Corasick automaton.
   Also includes domain trie (prefix tree) for fast domain lookups.

   Loaded via background.html before background.js.
   Depends on no globals – fully self-contained.
*/

/* ---------- Aho-Corasick Automaton ----------
   Builds a finite state machine from a set of patterns.
   O(n + m + k) search where n = text length, m = total pattern length, k = matches.
*/
function buildAhoCorasick(patterns) {
  const trie = [{ next: {}, fail: 0, outputs: [] }];
  const patternMap = new Map();

  patterns.forEach((p, idx) => {
    if (!p || typeof p !== 'string') return;
    patternMap.set(idx, p);
    let node = 0;
    for (const ch of p) {
      if (!trie[node].next[ch]) {
        trie[node].next[ch] = trie.length;
        trie.push({ next: {}, fail: 0, outputs: [] });
      }
      node = trie[node].next[ch];
    }
    trie[node].outputs.push(idx);
  });

  // Build failure links (BFS)
  const queue = [];
  for (const ch in trie[0].next) {
    const n = trie[0].next[ch];
    trie[n].fail = 0;
    queue.push(n);
  }
  while (queue.length) {
    const cur = queue.shift();
    for (const ch in trie[cur].next) {
      const n = trie[cur].next[ch];
      let f = trie[cur].fail;
      while (f !== 0 && !trie[f].next[ch]) f = trie[f].fail;
      trie[n].fail = trie[f].next[ch] || 0;
      trie[n].outputs.push(...trie[trie[n].fail].outputs);
      queue.push(n);
    }
  }

  return { trie, patternMap };
}

function searchAhoCorasick(text, automaton) {
  if (!text || !automaton) return [];
  const { trie, patternMap } = automaton;
  let node = 0;
  const matches = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    while (node !== 0 && !trie[node].next[ch]) node = trie[node].fail;
    node = trie[node].next[ch] || 0;
    if (trie[node].outputs.length) {
      for (const idx of trie[node].outputs) {
        matches.push({ index: i, pattern: patternMap.get(idx) });
      }
    }
  }
  return matches;
}

/* ---------- Early-exit matches() ----------
   Returns true/false as soon as ANY pattern matches.
   Avoids collecting all matches — ~2–5x faster for URL filtering.
*/
function matchesAhoCorasick(text, automaton) {
  if (!text || !automaton) return false;
  const { trie } = automaton;
  let node = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    while (node !== 0 && !trie[node].next[ch]) node = trie[node].fail;
    node = trie[node].next[ch] || 0;
    if (trie[node].outputs.length) return true;
  }
  return false;
}

/* ---------- Domain Trie ----------
   Fast prefix matching for domain filters.
   Supports wildcard domains like "ads.*.example.com".
*/
function buildDomainTrie(domains) {
  const root = { children: {}, value: null };
  for (const [domain, data] of Object.entries(domains)) {
    const parts = domain.split('.').reverse();
    let node = root;
    for (const part of parts) {
      if (!node.children[part]) node.children[part] = { children: {}, value: null };
      node = node.children[part];
    }
    node.value = data;
  }
  return root;
}

function matchDomainTrie(hostname, trie) {
  if (!hostname || !trie) return null;
  const parts = hostname.split('.').reverse();
  let node = trie;
  // Check exact match
  for (const part of parts) {
    if (node.children[part]) {
      node = node.children[part];
      if (node.value) return node.value;
    } else {
      break;
    }
  }
  // Check wildcard match (e.g., *.example.com)
  node = trie;
  let wildcardMatch = null;
  for (const part of parts) {
    if (node.children['*']) {
      const wc = node.children['*'];
      if (wc.value) wildcardMatch = wc.value;
    }
    if (node.children[part]) {
      node = node.children[part];
      if (node.value) wildcardMatch = node.value;
    } else {
      break;
    }
  }
  return wildcardMatch;
}

/* ---------- Compiled Filter Index ----------
   Merges multiple filter sources into a unified compiled index.
   Supports serialization to/from plain objects for storage.local.
*/
function createCompiledIndex() {
  return {
    version: 2,
    domains: {},       // { "domain.com": { action: "block"|"allow", types: [...] } }
    substrings: [],    // [{ pattern: "str", action: "block"|"allow" }]
    hostWildcards: [], // [{ pattern: "||...^", action: "block"|"allow", condition: {...} }]
    cosmetics: [],     // [{ domain, selector, exception }]
    compiledAt: 0,
    automaton: null,   // Aho-Corasick automaton (built lazily)
    domainTrie: null   // Domain trie (built lazily)
  };
}

function buildAutomaton(index) {
  if (!index.substrings.length) return null;
  const patterns = index.substrings.map(s => s.pattern);
  return buildAhoCorasick(patterns);
}

function buildTrie(index) {
  if (!Object.keys(index.domains).length) return null;
  return buildDomainTrie(index.domains);
}

function ensureAutomaton(index) {
  if (!index.automaton && index.substrings.length) {
    index.automaton = buildAutomaton(index);
  }
  return index.automaton;
}

function ensureTrie(index) {
  if (!index.domainTrie && Object.keys(index.domains).length) {
    index.domainTrie = buildTrie(index);
  }
  return index.domainTrie;
}

function toPlainObject(index) {
  return {
    version: index.version,
    domains: index.domains,
    substrings: index.substrings,
    hostWildcards: index.hostWildcards,
    cosmetics: index.cosmetics,
    compiledAt: index.compiledAt
  };
}

function fromPlainObject(obj) {
  const idx = createCompiledIndex();
  if (!obj || obj.version !== 2) return idx;
  idx.domains = obj.domains || {};
  idx.substrings = obj.substrings || [];
  idx.hostWildcards = obj.hostWildcards || [];
  idx.cosmetics = obj.cosmetics || [];
  idx.compiledAt = obj.compiledAt || 0;
  return idx;
}

/* ========== Tokenization (7.1) ==========
   Split URL into tokens delimited by / . - _ ? = & and match
   against a pre-built token index. Catches patterns like
   /banner-123.js → token "banner" matches before AC scan.
*/

function buildTokenIndex(substrings) {
  const tokenSet = new Set();
  for (const entry of substrings) {
    const tokens = tokenize(entry.pattern);
    for (const t of tokens) tokenSet.add(t);
  }
  return tokenSet;
}

function tokenize(str) {
  if (!str) return [];
  return str.toLowerCase().split(/[\/.\-_?=&]+/).filter(t => t.length >= 2);
}

function matchTokens(text, tokenIndex) {
  if (!tokenIndex || !tokenIndex.size || !text) return false;
  const tokens = tokenize(text);
  for (let i = 0; i < tokens.length; i++) {
    if (tokenIndex.has(tokens[i])) return true;
  }
  return false;
}

/* ========== Fast Matching Pipeline ==========
   Five-step strategy:
     1. Extract hostname from URL
     2. Domain map O(1) lookup  → ~90% exit here
     3. Suffix variations        → check parent domains
     4. Aho-Corasick substring   → O(n) multi-pattern on URL
     5. Host wildcard / regex    → only when necessary
   Caches results per URL (bounded LRU Map) – many requests repeat.
*/

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.hash = '';
    // Lowercase protocol + hostname
    const proto = u.protocol.toLowerCase();
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    const path = u.pathname;
    const search = u.search;
    return proto + '//' + host + path + search;
  } catch {
    return url.toLowerCase().trim();
  }
}

function extractHostname(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/\.$/, ''); }
  catch { return ''; }
}

function suffixVariations(hostname) {
  const parts = hostname.replace(/\.$/, '').split('.');
  const variants = [];
  for (let i = 1; i < parts.length; i++) {
    variants.push(parts.slice(i).join('.'));
  }
  // Also push dot-prefixed form for direct lookup: ".example.com"
  for (let i = 1; i < parts.length; i++) {
    variants.push('.' + parts.slice(i).join('.'));
  }
  return variants;
}

function createMatchCache(maxSize) {
  const map = new Map();
  const _max = maxSize || 5000;
  return {
    get(url) { return map.get(url); },
    set(url, result) {
      if (map.size >= _max) {
        const first = map.keys().next().value;
        if (first !== undefined) map.delete(first);
      }
      map.set(url, result);
    },
    clear() { map.clear(); },
    get size() { return map.size; }
  };
}

function createMatcher(compiledIndex) {
  const matcher = {
    index: compiledIndex,
    cache: createMatchCache(5000),
    automaton: null,
    compiledWildcards: null,
    tokenIndex: null,
    wasm: null        // initialized lazily
  };

  if (compiledIndex && compiledIndex.substrings.length) {
    matcher.automaton = buildAutomaton(compiledIndex);
    matcher.tokenIndex = buildTokenIndex(compiledIndex.substrings);
    // Initiate WASM scanner initialization (non-blocking)
    initWasmScannerForMatcher(matcher, compiledIndex);
  }
  if (compiledIndex && compiledIndex.hostWildcards.length) {
    matcher.compiledWildcards = precompileWildcards(compiledIndex.hostWildcards);
  }

  return matcher;
}

function precompileWildcards(entries) {
  return entries.map(e => {
    let reStr = e.pattern
      .replace(/\|\|/g, '')
      .replace(/\^/g, '(?:[^\\w\\d.-]|$)')
      .replace(/\*/g, '.*')
      .replace(/\./g, '\\.');
    try { return { regex: new RegExp(reStr, 'i'), action: e.action, condition: e.condition, pattern: e.pattern }; }
    catch { return null; }
  }).filter(Boolean);
}

function resetMatcherCache(matcher) {
  matcher.cache.clear();
  // Keep wasm scanner active (no need to re-init)
}

/* ---------- Core match pipeline ----------
   Returns { matched: true, action: "block"|"allow", source: string } or null
   Always normalizes URLs before matching (lowercase, strip fragment, punycode).
*/
function matchUrl(url, matcher) {
  if (!url || !matcher || !matcher.index) return null;

  const normalized = normalizeUrl(url);
  if (!normalized) return null;

  // Step 0: consult cache (keyed on normalized URL)
  const cached = matcher.cache.get(normalized);
  if (cached !== undefined) return cached;

  const result = matchUrlImpl(normalized, matcher);

  matcher.cache.set(normalized, result);
  return result;
}

function matchUrlImpl(normalizedUrl, matcher) {
  const index = matcher.index;
  const hostname = extractHostname(normalizedUrl);
  if (!hostname) return null;

  // Step 1: Domain map O(1) hash lookup
  const domainEntry = index.domains[hostname];
  if (domainEntry) return { matched: true, action: domainEntry.action, source: 'domain' };

  // Step 2: Suffix variations (cdn.ads.example.com → check ads.example.com, .ads.example.com, example.com, .example.com)
  const suffixes = suffixVariations(hostname);
  for (const suff of suffixes) {
    const entry = index.domains[suff];
    if (entry) return { matched: true, action: entry.action, source: 'suffix' };
  }

  // Step 3: Domain trie (wildcard domain matches like *.example.com)
  const trie = ensureTrie(index);
  if (trie) {
    const trieResult = matchDomainTrie(hostname, trie);
    if (trieResult) return { matched: true, action: trieResult.action, source: 'domainTrie' };
  }

  // Step 4: Token-based fast check (split URL tokens, check intersection with blocked token set)
  if (matcher.tokenIndex && matchTokens(normalizedUrl, matcher.tokenIndex)) {
    return { matched: true, action: 'block', source: 'token' };
  }

  // Step 4.5: WASM Aho-Corasick (if initialized – non-blocking, ~10x faster on large pattern sets)
  if (matcher.wasm) {
    const wasmMatches = searchWithWasm(normalizedUrl, matcher.wasm);
    if (wasmMatches && wasmMatches.length) {
      return { matched: true, action: 'block', source: 'wasm', pattern: wasmMatches[0].pattern };
    }
  }

  // Step 5: Aho-Corasick substring matcher on normalized URL (early exit)
  const auto = matcher.automaton || ensureAutomaton(index);
  if (auto) {
    if (matchesAhoCorasick(normalizedUrl, auto)) {
      return { matched: true, action: 'block', source: 'substring' };
    }
    if (matchesAhoCorasick(hostname, auto)) {
      return { matched: true, action: 'block', source: 'substring' };
    }
  }

  // Step 6: Host wildcard / regex fallback (only when necessary – ~1% of requests)
  if (matcher.compiledWildcards) {
    for (const wc of matcher.compiledWildcards) {
      if (wc.regex.test(normalizedUrl)) {
        return { matched: true, action: wc.action, source: 'wildcard', pattern: wc.pattern };
      }
    }
  }

  return null;
}

/* ---------- Batch match ---------- */
function matchUrls(urls, matcher) {
  const results = [];
  for (const url of urls) {
    const r = matchUrl(url, matcher);
    if (r) results.push({ url, ...r });
  }
  return results;
}

/* ---------- WASM Scanner (lazy, optional) ----------
   Initialized asynchronously to avoid blocking the main thread.
   Falls back silently to JS Aho-Corasick if WASM unavailable.
*/
function initWasmScannerForMatcher(matcher, compiledIndex) {
  if (typeof WebAssembly === 'undefined' || typeof _b === 'undefined') return;
  if (matcher.wasm) return;

  // Lazy load: defer WASM fetch to after critical init path
  const patternList = (compiledIndex.substrings || []).map(s => s.pattern);
  if (!patternList.length) return;

  setTimeout(async () => {
    try {
      const url = _b.runtime.getURL('resources/dgs_ac_wasm.wasm');
      const resp = await fetch(url);
      const bytes = await resp.arrayBuffer();
      const mod = await WebAssembly.compile(bytes);
      const inst = await WebAssembly.instantiate(mod);
      const wasm = {
        exports: inst.exports,
        memory: inst.exports.memory,
        patternList,
        textOffset: 1_000_000,
        resultOffset: 3_000_000,
        maxResults: 4096,
        initialized: false
      };
      // Serialize automaton
      const trie = matcher.automaton;
      if (trie && trie.length) {
        initWasmAutomaton(wasm, trie);
        wasm.initialized = true;
        matcher.wasm = wasm;
      }
    } catch (e) {
      // WASM unavailable – continue with JS
    }
  }, 0);
}

function initWasmAutomaton(wasm, trie) {
  const N = trie.length;
  if (N === 0) return;

  // Build dense edge table
  const edgeTable = new Uint32Array(N * 256);
  for (let i = 0; i < N; i++) {
    const node = trie[i];
    const base = i * 256;
    for (const [ch, target] of Object.entries(node.next)) {
      if (ch.length === 1) edgeTable[base + ch.charCodeAt(0)] = target;
    }
  }

  // Count total outputs
  let totalOutputs = 0;
  for (let i = 0; i < N; i++) totalOutputs += trie[i].outputs.length;

  // Sizes (u32)
  const headerSize = 1;
  const failSize = N;
  const outputCountSize = N;
  const outputDataSize = totalOutputs;
  const edgeTableSize = N * 256;
  const BYTES_PER_U32 = 4;

  // Ensure WASM memory is large enough
  const totalBytes = (headerSize + failSize + outputCountSize + outputDataSize + edgeTableSize) * BYTES_PER_U32;
  const neededPages = Math.ceil((totalBytes + wasm.textOffset + wasm.maxResults * 8 + 4096) / 65536);
  const currentPages = wasm.memory.buffer.byteLength / 65536;
  if (neededPages > currentPages) {
    wasm.exports.memory.grow(neededPages - currentPages);
  }

  const mem = new Uint32Array(wasm.memory.buffer);

  // Write header
  mem[0] = N;

  // Write fail links
  let offset = headerSize;
  for (let i = 0; i < N; i++) mem[offset + i] = trie[i].fail;

  // Write output counts
  offset += failSize;
  for (let i = 0; i < N; i++) mem[offset + i] = trie[i].outputs.length;

  // Write output pattern indices
  offset += outputCountSize;
  let outIdx = 0;
  for (let i = 0; i < N; i++) {
    for (const patIdx of trie[i].outputs) {
      mem[offset + outIdx++] = patIdx;
    }
  }

  // Write edge table
  offset += outputDataSize;
  mem.set(edgeTable, offset);
}

/* ---------- WASM scan wrapper ---------- */
function searchWithWasm(text, wasm) {
  if (!wasm || !wasm.initialized || !text) return [];

  const byteLength = Math.min(text.length, 1_000_000);
  const textBytes = new TextEncoder().encode(text).slice(0, byteLength);

  // Write text to WASM memory
  new Uint8Array(wasm.memory.buffer).set(textBytes, wasm.textOffset);

  // Zero result buffer
  const resultMem = new Uint32Array(wasm.memory.buffer);
  const resultWords = 1 + wasm.maxResults * 2;
  const resultBase = wasm.resultOffset / 4;
  for (let i = 0; i < resultWords; i++) resultMem[resultBase + i] = 0;

  // Call WASM scan
  const count = wasm.exports.ac_scan(0, wasm.textOffset, textBytes.length, resultBase);
  if (!count) return [];

  const matches = [];
  for (let i = 0; i < count && i < wasm.maxResults; i++) {
    const patIdx = resultMem[resultBase + 1 + i * 2];
    if (patIdx < wasm.patternList.length) {
      matches.push({ index: resultMem[resultBase + 1 + i * 2 + 1], pattern: wasm.patternList[patIdx] });
    }
  }
  return matches;
}

/* ---------- AhoCorasick Class (convenience wrapper) ----------
   Usage:
     const ac = new AhoCorasick(['ads', 'banner', 'track']);
     ac.matches(url);     // → true/false (early exit)
     ac.search(url);      // → [{ index, pattern }]
*/
class AhoCorasick {
  constructor(patterns = []) {
    const built = buildAhoCorasick(patterns);
    this._trie = built.trie;
    this._patternMap = built.patternMap;
    // Expose goto/output/fail for compatibility with user's API expectations
    this.goto = this._trie;
    this.output = {};
    this.fail = {};
    for (let i = 0; i < this._trie.length; i++) {
      this.fail[i] = this._trie[i].fail;
      if (this._trie[i].outputs.length) {
        this.output[i] = this._trie[i].outputs.map(idx => this._patternMap.get(idx));
      }
    }
  }

  search(text) {
    return searchAhoCorasick(text, { trie: this._trie, patternMap: this._patternMap });
  }

  matches(text) {
    return matchesAhoCorasick(text, { trie: this._trie, patternMap: this._patternMap });
  }
}

