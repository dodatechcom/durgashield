/* ---------- Filter Engine Module ----------
   Loaded via background.html before background.js.
   Depends on globals: _b, MSG, FILTER_LISTS, FILTER_RULE_START, FILTER_RULE_MAX,
   FILTER_STORAGE_KEY, FILTER_META_KEY, FILTER_LIST_SETTINGS_KEY,
   COSMETICS_PREFIX, getFilterMeta, saveFilterMeta, getStoredFilterRules,
   saveStoredFilterRules, getFilterListSettings, saveFilterListSettings,
   loadFilterListEnabledStates
   Also depends on core/pattern-matcher.js (loaded first).
*/

let _reconcileCallback = null;
function setReconcileCallback(fn) { _reconcileCallback = fn; }

/* ---------- Compiled Filter Storage Format (v2) ----------
   Instead of storing raw DNR rules, we store typed buckets:
   {
     version: 2,
     domains: { "doubleclick.net": { action: "block" }, ... },
     substrings: [{ pattern: "/ad", action: "block" }, ...],
     hostWildcards: [{ pattern: "||...^", action: "block", condition: {...} }, ...],
     cosmetics: [{ domain, selector, exception }, ...],
     compiledAt: timestamp
   }
   This enables O(1) domain lookups, Aho-Corasick substring matching,
   and efficient DNR rule generation.
*/

const COMPILED_KEY = 'durgashield_compiled_v2';

async function getCompiledIndex() {
  const r = await _b.storage.local.get(COMPILED_KEY);
  const data = r[COMPILED_KEY];
  if (data && data.version === 2) return fromPlainObject(data);
  return null;
}

async function saveCompiledIndex(index) {
  const plain = toPlainObject(index);
  await _b.storage.local.set({ [COMPILED_KEY]: plain });
}

/* ---------- Filter Line Helpers ---------- */
function isHostsLine(line) {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s+/.test(line) || line.startsWith('0.0.0.0') || line.startsWith('127.0.0.1') || line.startsWith('255.255.255.255') || /^::1?\s+/.test(line);
}
function extractHostFromHostsLine(line) {
  const m = line.match(/^\S+\s+(\S+)/);
  return m ? m[1] : null;
}
function isBareDomain(line) {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(line);
}

/* ---------- Parser: text → typed buckets ---------- */
function parseFilterList(text) {
  const lines = text.split('\n');
  const index = createCompiledIndex();
  const seenCosmetics = new Set();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;
    if (line.startsWith('#') && !line.includes('##') && !line.includes('#@#')) continue;

    // Cosmetic filters
    if (line.includes('##') || line.includes('#@#')) {
      const isException = line.includes('#@#');
      const sep = isException ? '#@#' : '##';
      const parts = line.split(sep);
      const c = { domain: parts[0] || null, selector: parts[1], exception: isException };
      const key = c.domain + '|' + c.selector + '|' + (c.exception ? 'E' : '');
      if (!seenCosmetics.has(key)) {
        seenCosmetics.add(key);
        index.cosmetics.push(c);
      }
      continue;
    }

    // Skip unsupported options
    if (/\$redirect(?:-rule)?=/.test(line) || /\$removeparam=/.test(line) || /\$replace=/.test(line)) continue;
    if (line.startsWith('/') && (line.includes('/') > 1)) continue;

    let dnrLine = line;
    let isAllow = false;

    if (isHostsLine(line)) {
      const host = extractHostFromHostsLine(line);
      if (!host) continue;
      dnrLine = '||' + host + '^';
    } else if (isBareDomain(line)) {
      dnrLine = '||' + line + '^';
    } else if (line.startsWith('@@')) {
      isAllow = true;
      dnrLine = line.slice(2).trim();
    } else if (line.startsWith('||')) {
      dnrLine = line;
    } else if (line.includes('^')) {
      dnrLine = line;
    } else {
      dnrLine = '||' + line + '^';
    }

    // Extract options from the filter
    let filter = dnrLine;
    let domainRestrict = null;
    let excludedInitiatorDomains = null;
    const domainMatch = filter.match(/\$domain=([^$|]+)/);
    if (domainMatch) {
      const rawDomains = domainMatch[1].split('|');
      const incl = [], excl = [];
      for (const d of rawDomains) {
        if (d.startsWith('~')) excl.push(d.slice(1));
        else incl.push(d);
      }
      if (incl.length > 0) domainRestrict = incl;
      if (excl.length > 0) excludedInitiatorDomains = excl;
      filter = filter.replace(/\$domain=[^$|]+/, '');
    }
    const thirdParty = /\$third-party/.test(filter) && !/\$~third-party/.test(filter);
    const firstParty = /\$~third-party/.test(filter);
    const excludedResourceTypes = [];
    const exclMatch = filter.match(/~([\w-]+)/g);
    if (exclMatch) {
      const typeMap = { 'script': 'script', 'image': 'image', 'stylesheet': 'stylesheet', 'font': 'font', 'media': 'media', 'subdocument': 'sub_frame', 'xmlhttprequest': 'xmlhttprequest', 'xhr': 'xmlhttprequest', 'document': 'main_frame', 'object': 'object', 'other': 'other' };
      for (const ex of exclMatch) {
        const t = ex.slice(1);
        if (typeMap[t]) excludedResourceTypes.push(typeMap[t]);
      }
    }
    filter = filter.replace(/\$~?third-party/, '').replace(/\$popup/, '').replace(/\$~?websocket/, '').replace(/\$~?important/, '');
    filter = filter.replace(/~[\w-]+/g, '');
    filter = filter.replace(/\$(?:[\w-]+(?:=[^$,]+)?(?:,[\w-]+(?:=[^$,]+)?)*)/, '').trim();
    if (!filter || filter.startsWith('##')) continue;

    // Classify into bucket
    const action = isAllow ? 'allow' : 'block';
    const condition = {};
    if (excludedResourceTypes.length > 0) {
      const allTypes = ["script", "xmlhttprequest", "image", "stylesheet", "font", "media", "websocket", "other", "sub_frame"];
      const inclTypes = allTypes.filter(t => !excludedResourceTypes.includes(t));
      if (inclTypes.length > 0) condition.resourceTypes = inclTypes;
    }
    if (thirdParty) condition.domainType = "thirdParty";
    if (firstParty) condition.domainType = "firstParty";
    if (domainRestrict) condition.initiatorDomains = domainRestrict;
    if (excludedInitiatorDomains) condition.excludedInitiatorDomains = excludedInitiatorDomains;

    // Pure domain pattern: ||domain.com^ → store in domain map for O(1) lookup
    // MUST lowercase the domain key to match normalized hostnames in the matcher.
    const domainMatchExact = filter.match(/^\|\|([\w.-]+)\^$/);
    if (domainMatchExact && !condition.resourceTypes && !condition.domainType && !condition.initiatorDomains) {
      const domain = domainMatchExact[1].toLowerCase().replace(/\.$/, '');
      index.domains[domain] = { action };
      continue;
    }

    // Simple substring pattern (no domain/party/domainRestrict) → substring bucket
    if (!condition.resourceTypes && !condition.domainType && !condition.initiatorDomains && !excludedInitiatorDomains) {
      index.substrings.push({ pattern: filter.replace(/^\|\|/, '').replace(/\^$/g, ''), action });
      continue;
    }

    // Everything else → host wildcards with full condition
    index.hostWildcards.push({ pattern: filter, action, condition });
  }

  return index;
}

/* ---------- Compile typed buckets → DNR rules ---------- */
function compileDNRFromBuckets(index, startId, maxRules) {
  const dnrRules = [];
  let id = startId;
  const usedConditions = new Set();
  const MAX = maxRules || FILTER_RULE_MAX;

  // 1. Domain exact matches → ||domain^ rules
  for (const [domain, info] of Object.entries(index.domains)) {
    if (dnrRules.length >= MAX) break;
    const cKey = 'd:' + domain;
    if (usedConditions.has(cKey)) continue;
    usedConditions.add(cKey);
    dnrRules.push({
      id: id++,
      priority: info.action === 'allow' ? 100 : 1,
      action: { type: info.action },
      condition: {
        urlFilter: '||' + domain + '^',
        resourceTypes: ["script", "xmlhttprequest", "image", "stylesheet", "font", "media", "websocket", "other", "sub_frame"]
      }
    });
  }

  // 2. Substring patterns → urlFilter = pattern
  for (const entry of index.substrings) {
    if (dnrRules.length >= MAX) break;
    const cKey = 's:' + entry.pattern;
    if (usedConditions.has(cKey)) continue;
    usedConditions.add(cKey);
    dnrRules.push({
      id: id++,
      priority: entry.action === 'allow' ? 100 : 1,
      action: { type: entry.action },
      condition: {
        urlFilter: entry.pattern,
        resourceTypes: ["script", "xmlhttprequest", "image", "stylesheet", "font", "media", "websocket", "other", "sub_frame"]
      }
    });
  }

  // 3. Host wildcards with full condition
  for (const entry of index.hostWildcards) {
    if (dnrRules.length >= MAX) break;
    const cKey = 'w:' + entry.pattern + JSON.stringify(entry.condition);
    if (usedConditions.has(cKey)) continue;
    usedConditions.add(cKey);
    dnrRules.push({
      id: id++,
      priority: entry.action === 'allow' ? 100 : 1,
      action: { type: entry.action },
      condition: {
        urlFilter: entry.pattern,
        resourceTypes: entry.condition.resourceTypes || ["script", "xmlhttprequest", "image", "stylesheet", "font", "media", "websocket", "other", "sub_frame"],
        ...(entry.condition.domainType ? { domainType: entry.condition.domainType } : {}),
        ...(entry.condition.initiatorDomains ? { initiatorDomains: entry.condition.initiatorDomains } : {}),
        ...(entry.condition.excludedInitiatorDomains ? { excludedInitiatorDomains: entry.condition.excludedInitiatorDomains } : {})
      }
    });
  }

  return dnrRules;
}

/* ---------- Fetch, Parse, Update ---------- */
async function fetchFilterList(fl, meta) {
  const url = fl.url;
  const retries = 2;
  const headers = {};
  const flMeta = meta[fl.name] || {};
  if (flMeta.etag) headers['If-None-Match'] = flMeta.etag;
  if (flMeta.lastModified) headers['If-Modified-Since'] = flMeta.lastModified;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const resp = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(timeoutId);
      if (resp.status === 304) {
        return { text: null, etag: flMeta.etag, lastModified: flMeta.lastModified, notModified: true };
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const etag = resp.headers.get('ETag') || flMeta.etag;
      const lastModified = resp.headers.get('Last-Modified') || flMeta.lastModified;
      const text = await resp.text();
      const checksumMatch = text.match(/^!\s*checksum:\s*([a-f0-9]{32})/im);
      if (checksumMatch) {
        const expected = checksumMatch[1];
        const body = text.replace(/^!\s*checksum:\s*[a-f0-9]{32}\s*\n?/im, '');
        const hash = await sha256Prefix(body, 32);
        if (hash !== expected) {
          console.warn(`DurgaShield: checksum mismatch for ${url}, retrying...`);
          clearTimeout(timeoutId);
          if (attempt < retries) { headers['If-None-Match'] = ''; headers['If-Modified-Since'] = ''; continue; }
          throw new Error('Checksum mismatch');
        }
      }
      return { text, etag, lastModified, notModified: false };
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        console.warn(`DurgaShield: request timed out for ${url}`);
      }
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`DurgaShield: fetch attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms:`, e.message);
        await new Promise(r => setTimeout(r, delay));
        headers['If-None-Match'] = '';
        headers['If-Modified-Since'] = '';
      } else {
        throw e;
      }
    }
  }
}

async function updateFilterLists() {
  await loadFilterListEnabledStates();
  const meta = await getFilterMeta();
  const now = Date.now();
  const mergedIndex = createCompiledIndex();
  const mergedCosmetics = [];
  const parsedSources = [];
  const seenCosmetics = new Set();
  let anyUpdated = false;

  const sourceTexts = [];

  const results = await Promise.all(
    FILTER_LISTS.filter(fl => fl.enabled).map(async (fl) => {
      try {
        const result = await fetchFilterList(fl, meta);
        return { fl, result, error: null };
      } catch (err) {
        return { fl, result: null, error: err };
      }
    })
  );

  for (const r of results) {
    if (r.error) {
      meta[r.fl.name] = { updated: meta[r.fl.name]?.updated || 0, count: meta[r.fl.name]?.count || 0, error: r.error.message || 'fetch failed' };
      console.warn(`DurgaShield: failed to fetch ${r.fl.name}:`, r.error);
      continue;
    }
    const { fl, result } = r;
    if (!meta[fl.name]) meta[fl.name] = {};
    if (result.etag) meta[fl.name].etag = result.etag;
    if (result.lastModified) meta[fl.name].lastModified = result.lastModified;

    if (result.notModified) {
      console.log(`DurgaShield: ${fl.name} unchanged (304)`);
      meta[fl.name].updated = meta[fl.name]?.updated || now;
      meta[fl.name].error = null;
      continue;
    }
    anyUpdated = true;
    try {
      sourceTexts.push(result.text);
      const parsed = parseFilterList(result.text);
      parsedSources.push({ fl, parsed });
      // Merge cosmetics with dedup
      for (const c of parsed.cosmetics) {
        const key = c.domain + '|' + c.selector + '|' + (c.exception ? 'E' : '');
        if (!seenCosmetics.has(key)) {
          seenCosmetics.add(key);
          mergedCosmetics.push(c);
        }
      }
    } catch (e) {
      meta[fl.name] = { updated: meta[fl.name]?.updated || 0, count: meta[fl.name]?.count || 0, error: e.message };
      console.warn(`DurgaShield: failed to parse ${fl.name}:`, e);
    }
  }

  if (!anyUpdated && parsedSources.length === 0) {
    console.log('DurgaShield: all filter lists unchanged, skipping rebuild');
    meta.lastUpdate = Date.now();
    await saveFilterMeta(meta);
    const existing = await getCompiledIndex();
    if (existing) return { compiled: existing, cosmetics: mergedCosmetics, dnrRules: null, overflowPatterns: [] };
    return { compiled: mergedIndex, cosmetics: mergedCosmetics, dnrRules: null, overflowPatterns: [] };
  }

  // Merge all parsed indexes into one compiled index
  for (const { fl, parsed } of parsedSources) {
    // Merge domains
    const domainCount = Object.keys(parsed.domains).length;
    let taken = 0;
    for (const [domain, info] of Object.entries(parsed.domains)) {
      if (!mergedIndex.domains[domain]) {
        mergedIndex.domains[domain] = info;
        taken++;
      }
    }
    // Merge substrings
    for (const entry of parsed.substrings) {
      const exists = mergedIndex.substrings.some(e => e.pattern === entry.pattern && e.action === entry.action);
      if (!exists) mergedIndex.substrings.push(entry);
    }
    // Merge hostWildcards
    for (const entry of parsed.hostWildcards) {
      mergedIndex.hostWildcards.push(entry);
    }
    meta[fl.name] = { ...meta[fl.name], updated: now, count: taken, total: domainCount, error: null };
    console.log(`DurgaShield: updated ${fl.name} (${domainCount} domains, ${parsed.substrings.length} substrings)`);
  }

  mergedIndex.compiledAt = now;
  mergedIndex.cosmetics = mergedCosmetics;
  meta.lastUpdate = now;
  await saveFilterMeta(meta);
  await saveCompiledIndex(mergedIndex);
  await saveCosmeticsPartitioned(mergedCosmetics);

  if (_reconcileCallback) await _reconcileCallback();

  // Send domain-filtered cosmetics to tabs
  const tabs = await _b.tabs.query({});
  for (const tab of tabs) {
    try {
      const url = tab.url ? new URL(tab.url) : null;
      const host = url ? url.hostname : '';
      const filtered = filterCosmeticsForDomain(mergedCosmetics, host);
      if (filtered.length > 0) {
        _b.tabs.sendMessage(tab.id, { type: MSG.COSMETIC_FILTERS, cosmetics: filtered });
      }
    } catch (e) {}
  }
  // Also compile DNR rules from all source texts
  let dnrResult = null;
  try {
    if (sourceTexts.length > 0 && typeof compileFiltersToDNR === 'function') {
      const combinedText = sourceTexts.join('\n');
      dnrResult = compileFiltersToDNR(combinedText.split('\n'), { startId: 500001, maxRules: 5000 });
    }
  } catch (e) {
    console.warn('DurgaShield: DNR compilation error:', e);
  }

  return { compiled: mergedIndex, cosmetics: mergedCosmetics, dnrRules: dnrResult ? dnrResult.rules : null, overflowPatterns: dnrResult ? dnrResult.overflowPatterns : [] };
}

/* ---------- Partitioned Cosmetics Storage ---------- */
async function saveCosmeticsPartitioned(cosmetics) {
  const buckets = {};
  for (const c of cosmetics) {
    const key = c.domain ? c.domain[0].toLowerCase() : '0';
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(c);
  }
  const entries = Object.entries(buckets);
  const oldKeys = await _b.storage.local.get(null);
  const toRemove = Object.keys(oldKeys).filter(k => k.startsWith(COSMETICS_PREFIX));
  for (const k of toRemove) await _b.storage.local.remove(k);
  for (const [key, list] of entries) {
    await _b.storage.local.set({ [COSMETICS_PREFIX + key]: list });
  }
  await _b.storage.local.set({ [COSMETICS_PREFIX + 'index']: entries.map(([k]) => k) });
}

async function getCosmeticsForDomain(host) {
  if (!host) return [];
  const prefix = host[0].toLowerCase();
  const keys = [COSMETICS_PREFIX + '0', COSMETICS_PREFIX + prefix];
  const data = await _b.storage.local.get(keys);
  const global = data[COSMETICS_PREFIX + '0'] || [];
  const domainBucket = data[COSMETICS_PREFIX + prefix] || [];
  return [...global, ...domainBucket];
}

function filterCosmeticsForDomain(cosmetics, host) {
  if (!host || !cosmetics || !cosmetics.length) return [];
  const hostParts = host.split('.');
  return cosmetics.filter(c => {
    if (!c.domain) return true;
    const domains = c.domain.split(',').map(d => d.trim()).filter(Boolean);
    return domains.some(d => {
      if (d === '*' || d === host) return true;
      return hostParts.some((_, i) => d === hostParts.slice(i).join('.'));
    });
  });
}

async function restoreFilterRules() {
  await loadFilterListEnabledStates();
  const meta = await getFilterMeta();
  const now = Date.now();
  if (meta.lastUpdate && (now - meta.lastUpdate) < UPDATE_INTERVAL) {
    const stored = await getCompiledIndex();
    if (stored && Object.keys(stored.domains).length > 0) {
      if (_reconcileCallback) await _reconcileCallback();
      console.log(`DurgaShield: restored compiled index (${Object.keys(stored.domains).length} domains, ${stored.substrings.length} substrings)`);
      return stored;
    }
  }
  return await updateFilterLists();
}

async function getFilterListStatus() {
  await loadFilterListEnabledStates();
  const meta = await getFilterMeta();
  return FILTER_LISTS.map(fl => ({
    id: fl.id,
    name: fl.name,
    url: fl.url,
    enabled: fl.enabled,
    updated: meta[fl.name]?.updated || 0,
    count: meta[fl.name]?.count || 0,
    total: meta[fl.name]?.total || 0,
    maxRules: fl.maxRules || 0,
    error: meta[fl.name]?.error || null
  }));
}

async function getDynamicRuleCount() {
  try {
    const rules = await _b.declarativeNetRequest.getDynamicRules();
    return rules.length;
  } catch { return 0; }
}

async function getFilteredListInfo(hostname) {
  const compiled = await getCompiledIndex();
  if (!compiled) return { total: 0, matching: [] };
  const matching = [];
  for (const domain of Object.keys(compiled.domains)) {
    if (hostname.includes(domain) || domain.includes(hostname.split('.').slice(-2).join('.'))) {
      matching.push({ domain, action: compiled.domains[domain].action });
    }
  }
  const total = Object.keys(compiled.domains).length + compiled.substrings.length + compiled.hostWildcards.length;
  return { total, matching: matching.slice(0, 20) };
}

async function sha256Prefix(text, length) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

/* ---------- Helper: compile stored index → DNR rules on demand ---------- */
async function getDNRFilterRules() {
  const compiled = await getCompiledIndex();
  if (!compiled) return [];
  return compileDNRFromBuckets(compiled, FILTER_RULE_START, FILTER_RULE_MAX);
}
