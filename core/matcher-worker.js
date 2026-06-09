/* ---------- Matcher Worker ----------
   Off-main-thread Aho-Corasick matching (7.4).
   Receives compiled automaton data, processes match requests.
   Communicates via postMessage – no DOM access needed.

   Message protocol:
     { type: "init", patterns: string[] }
     { type: "match", url: string, id: number }     → { type: "result", matched: bool, id: number }
     { type: "matchBatch", urls: string[], id: number } → { type: "batchResult", results: object[], id: number }
     { type: "reset" }
*/

let automaton = null;
let patternList = null;

/* ---------- Aho-Corasick (compact, worker-only) ---------- */
function buildAC(patterns) {
  const trie = [{ next: {}, fail: 0, outputs: [] }];
  patterns.forEach((p, idx) => {
    if (!p) return;
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
  return trie;
}

function searchAC(text, trie) {
  if (!text || !trie) return [];
  let node = 0;
  const matches = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    while (node !== 0 && !trie[node].next[ch]) node = trie[node].fail;
    node = trie[node].next[ch] || 0;
    if (trie[node].outputs.length) {
      for (const idx of trie[node].outputs) {
        matches.push({ index: i, pattern: patternList[idx] });
      }
    }
  }
  return matches;
}

/* ---------- Message Handler ---------- */
self.onmessage = function(e) {
  const msg = e.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'init':
      patternList = msg.patterns || [];
      automaton = buildAC(patternList);
      self.postMessage({ type: 'ready' });
      break;

    case 'match':
      if (!automaton) break;
      const result = searchAC(msg.url, automaton);
      self.postMessage({
        type: 'result',
        matched: result.length > 0,
        id: msg.id,
        pattern: result.length ? result[0].pattern : null
      });
      break;

    case 'matchBatch':
      if (!automaton) break;
      const results = (msg.urls || []).map(url => {
        const r = searchAC(url, automaton);
        return { matched: r.length > 0, pattern: r.length ? r[0].pattern : null };
      });
      self.postMessage({ type: 'batchResult', results, id: msg.id });
      break;

    case 'reset':
      automaton = null;
      patternList = null;
      break;
  }
};
