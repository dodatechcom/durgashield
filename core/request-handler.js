/* ---------- Request Handler Module ----------
   Optimized shouldBlock() pipeline with lazy filter loading.
   Loaded via background.html after pattern-matcher.js and filter-engine.js.

   Flow:
     1. Deny list check (fastest, ~90% exit)
     2. Suffix / parent domain check
     3. Token match (fast Set lookup)
     4. Aho-Corasick substring scan
     5. Regex wildcard fallback (slowest, <1%)
   Cached per normalized URL – many requests repeat.
*/

let _compiledIndex = null;
let _matcher = null;
let _coreLoaded = false;    // core filters loaded?
let _regionalLoaded = false; // regional filters loaded?
let _worker = null;          // optional matcher worker (7.4)
let _workerReady = false;
let _workerMsgId = 0;
const _workerCbs = new Map();
const _pendingLoads = [];

/* ---------- Worker Thread (7.4) ----------
   If Workers are available, spawn matcher-worker.js for off-main-thread
   Aho-Corasick scanning. Falls back silently to main-thread matching.
*/
function spawnMatcherWorker(patterns) {
  try {
    const url = _b.runtime.getURL('core/matcher-worker.js');
    const w = new Worker(url);
    _worker = w;
    _worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        _workerReady = true;
        return;
      }
      if (msg.type === 'result') {
        const cb = _workerCbs.get(msg.id);
        if (cb) { _workerCbs.delete(msg.id); cb(msg); }
        return;
      }
      if (msg.type === 'batchResult') {
        const cb = _workerCbs.get(msg.id);
        if (cb) { _workerCbs.delete(msg.id); cb(msg); }
      }
    };
    _worker.postMessage({ type: 'init', patterns });
  } catch (e) {
    _worker = null;
    _workerReady = false;
  }
}

function terminateMatcherWorker() {
  if (_worker) { _worker.terminate(); _worker = null; _workerReady = false; _workerCbs.clear(); }
}

/* ---------- Init ---------- */
async function initRequestHandler(compiledIndex) {
  _compiledIndex = compiledIndex;
  _matcher = createMatcher(compiledIndex);
  _coreLoaded = true;

  // Spawn worker with substring patterns for off-thread scanning
  if (compiledIndex && compiledIndex.substrings && compiledIndex.substrings.length) {
    spawnMatcherWorker(compiledIndex.substrings.map(s => s.pattern));
  }

  // Flush any pending shouldBlock calls queued before matcher was ready
  const pending = _pendingLoads.slice();
  _pendingLoads.length = 0;
  for (const { resolve, url } of pending) {
    resolve(shouldBlock(url));
  }
}

function setCompiledIndex(compiledIndex, overflowPatterns) {
  // Merge overflow patterns (from DNR rule limit) into substrings for AC fallback
  if (overflowPatterns && overflowPatterns.length > 0) {
    if (!compiledIndex.substrings) compiledIndex.substrings = [];
    const existingSet = new Set(compiledIndex.substrings.map(s => s.pattern));
    for (const p of overflowPatterns) {
      if (p && !existingSet.has(p)) {
        compiledIndex.substrings.push({ pattern: p, action: 'block' });
        existingSet.add(p);
      }
    }
  }
  _compiledIndex = compiledIndex;
  if (_matcher) resetMatcherCache(_matcher);
  _matcher = createMatcher(compiledIndex);
  _coreLoaded = true;
  terminateMatcherWorker();
  if (compiledIndex && compiledIndex.substrings && compiledIndex.substrings.length) {
    spawnMatcherWorker(compiledIndex.substrings.map(s => s.pattern));
  }
}

/* ---------- Lazy Loading (7.2) ----------
   Core filter lists (EasyList, EasyPrivacy, malware) are loaded first.
   Regional / optional lists are deferred via requestIdleCallback.
*/
async function ensureCoreFilters() {
  if (_coreLoaded) return;
  // Core filters already loaded during updateFilterLists / restoreFilterRules
  _coreLoaded = true;
}

async function loadRegionalFilters() {
  if (_regionalLoaded) return;
  _regionalLoaded = true;
  try {
    // Reconcile triggers filter list update – regional lists are loaded
    // as part of the full update cycle but lower priority.
    if (typeof reconcileDynamicRules === 'function') {
      await reconcileDynamicRules();
    }
  } catch (e) {
    console.warn('DurgaShield: regional filter load deferred:', e.message);
  }
}

/* ---------- Worker-based substring match (async, optional) ---------- */
function matchViaWorker(url) {
  return new Promise((resolve) => {
    if (!_worker || !_workerReady) { resolve(null); return; }
    const id = ++_workerMsgId;
    _workerCbs.set(id, (msg) => {
      resolve(msg.matched ? { matched: true, source: 'worker', pattern: msg.pattern } : null);
    });
    _worker.postMessage({ type: 'match', url, id });
  });
}

function matchBatchViaWorker(urls) {
  return new Promise((resolve) => {
    if (!_worker || !_workerReady) { resolve(urls.map(() => null)); return; }
    const id = ++_workerMsgId;
    _workerCbs.set(id, (msg) => {
      resolve(msg.results.map((r, i) => r.matched ? { url: urls[i], matched: true, source: 'worker', pattern: r.pattern } : null));
    });
    _worker.postMessage({ type: 'matchBatch', urls, id });
  });
}

/* ---------- Optimized shouldBlock ----------
   Primary path: main-thread matchUrl (fast pipeline with cache).
   Worker fallback available for heavy async scanning.
*/
function shouldBlock(url) {
  if (!_matcher || !_coreLoaded) {
    return new Promise((resolve) => {
      _pendingLoads.push({ resolve, url });
    });
  }
  return matchUrl(url, _matcher);
}

/* ---------- Batch shouldBlock ---------- */
function shouldBlockUrls(urls) {
  if (!_matcher || !_coreLoaded) return urls.map(() => null);
  return matchUrls(urls, _matcher);
}

/* ---------- Convenience wrappers ---------- */
function isThirdParty(requestUrl, tabUrl) {
  try {
    const reqHost = new URL(requestUrl).hostname.replace(/^www\./, '');
    const pageHost = new URL(tabUrl).hostname.replace(/^www\./, '');
    return reqHost !== pageHost && !reqHost.endsWith('.' + pageHost);
  } catch { return false; }
}

function getBaseDomain(hostname) {
  const parts = hostname.replace(/\.$/, '').split('.');
  if (parts.length <= 2) return hostname;
  // Return last 2 parts for known TLDs, otherwise last 2 parts
  const tld = parts.slice(-2).join('.');
  return tld;
}
