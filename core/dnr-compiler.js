/* ---------- DNR Compiler Module ----------
   Converts Adblock-style filter lists → declarativeNetRequest rules.
   Handles full syntax: ||domain^, @@exceptions, $options, |exact|.
   Hybrid engine: simple rules → DNR (fast path), overflow → JS Aho-Corasick.
   Loaded via background.html; no dependencies on other modules.
*/

/* ---------- 4.1 Resource Type Mapping ---------- */
const RESOURCE_MAP = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  xmlhttprequest: 'xmlhttprequest',
  subdocument: 'sub_frame',
  document: 'main_frame',
  font: 'font',
  media: 'media',
  websocket: 'websocket',
  ping: 'ping',
  other: 'other',
  object: 'object',
  object_subrequest: 'other'
};

const DNR_RULE_ACTIONS = ['block', 'allow', 'allowAllRequests', 'redirect', 'upgradeScheme', 'modifyHeaders'];

const DEFAULT_RESOURCE_TYPES = ['script', 'xmlhttprequest', 'image', 'stylesheet', 'font', 'media', 'websocket', 'other', 'sub_frame'];

const ALL_RESOURCE_TYPES = ['script', 'xmlhttprequest', 'image', 'stylesheet', 'font', 'media', 'websocket', 'other', 'sub_frame', 'main_frame', 'ping', 'object'];

/* ---------- 4.2 Filter Parser ---------- */
function parseFilter(line) {
  line = line.trim();

  if (!line || line.startsWith('!') || line.startsWith('[')) return null;

  const isException = line.startsWith('@@');
  let work = line;
  if (isException) work = work.slice(2);

  let pattern = work;
  let options = {};

  if (work.includes('$')) {
    const dollarIdx = work.lastIndexOf('$');
    const afterDollar = work.slice(dollarIdx + 1);
    if (afterDollar && afterDollar.length <= 80) {
      const maybeOpts = afterDollar.split(',').map(s => s.trim());
      const hasKnownOption = maybeOpts.some(o => {
        const eqIdx = o.indexOf('=');
        const base = eqIdx >= 0 ? o.slice(0, eqIdx) : o;
        const clean = base.replace(/^~/, '');
        return RESOURCE_MAP[clean] || clean === 'third-party' || clean === 'domain' || clean === 'match-case' || clean === 'csp' || clean === 'redirect' || clean === 'redirect-rule';
      });
      if (hasKnownOption) {
        pattern = work.slice(0, dollarIdx);
        options = parseOptions(afterDollar);
      }
    }
  }

  if (!pattern) return null;

  return { pattern, isException, options };
}

/* ---------- 4.3 Options Parser ---------- */
function parseOptions(optionStr) {
  const opts = {};
  if (!optionStr) return opts;

  const parts = optionStr.split(',');
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    if (part === 'third-party') {
      opts.thirdParty = true;
      continue;
    }
    if (part === '~third-party') {
      opts.firstParty = true;
      continue;
    }
    if (part === 'match-case') {
      opts.matchCase = true;
      continue;
    }

    const RESOURCE_MAP_KEYS = Object.keys(RESOURCE_MAP);
    const resourceKey = RESOURCE_MAP_KEYS.find(k => part === k || part === '~' + k);
    if (resourceKey) {
      if (!opts.resourceTypes) opts.resourceTypes = [];
      if (part.startsWith('~')) {
        if (!opts.excludedResourceTypes) opts.excludedResourceTypes = [];
        opts.excludedResourceTypes.push(RESOURCE_MAP[resourceKey]);
      } else {
        opts.resourceTypes.push(RESOURCE_MAP[resourceKey]);
      }
      continue;
    }

    if (part.startsWith('domain=')) {
      const raw = part.slice(7);
      const domains = raw.split('|');
      const incl = [], excl = [];
      for (const d of domains) {
        if (d.startsWith('~')) excl.push(d.slice(1));
        else incl.push(d);
      }
      if (incl.length) opts.domains = incl;
      if (excl.length) opts.excludedDomains = excl;
      continue;
    }

    if (part === 'csp') {
      opts.csp = true;
    }
  }

  return opts;
}

/* ---------- 4.4 Pattern → DNR Condition ---------- */
function patternToCondition(pattern) {
  if (!pattern) return null;

  let urlFilter;
  let isRegex = false;

  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
    const body = pattern.slice(1, -1);
    if (/[.+*?^${}()|[\]\\]/.test(body)) {
      isRegex = true;
      return { regexFilter: body };
    }
    return { urlFilter: pattern };
  }

  if (pattern.startsWith('||')) {
    const domain = pattern.slice(2).replace(/\^/g, '');
    urlFilter = domain;
    const anchorStart = true;
    return { urlFilter, anchor: { type: 'domain', start: anchorStart } };
  }

  if (pattern.startsWith('|')) {
    const rest = pattern.slice(1);
    if (rest.endsWith('|')) {
      urlFilter = rest.slice(0, -1);
      return { urlFilter, anchor: { start: true, end: true } };
    }
    return { urlFilter: rest, anchor: { start: true } };
  }

  if (pattern.endsWith('|')) {
    return { urlFilter: pattern.slice(0, -1), anchor: { end: true } };
  }

  urlFilter = pattern.replace(/\^/g, '');

  return { urlFilter };
}

/* ---------- Condition Key (for deduplication) ---------- */
function conditionKey(cond) {
  const p = cond.urlFilter || cond.regexFilter || '';
  const rts = cond.resourceTypes ? cond.resourceTypes.sort().join(',') : '';
  const dts = cond.domainType || '';
  const id = cond.initiatorDomains ? cond.initiatorDomains.sort().join(',') : '';
  const eid = cond.excludedInitiatorDomains ? cond.excludedInitiatorDomains.sort().join(',') : '';
  const dm = cond.domains ? cond.domains.sort().join(',') : '';
  const edm = cond.excludedDomains ? cond.excludedDomains.sort().join(',') : '';
  const anch = cond.anchor ? JSON.stringify(cond.anchor) : '';
  return p + '|' + rts + '|' + dts + '|' + id + '|' + eid + '|' + dm + '|' + edm + '|' + anch;
}

/* ---------- 4.5 Rule Builder ---------- */
let RULE_ID_GLOBAL = 1;

function buildDNRRule(parsed) {
  const condition = patternToCondition(parsed.pattern);
  if (!condition) return null;

  if (parsed.options.resourceTypes && parsed.options.resourceTypes.length > 0) {
    const types = [...new Set(parsed.options.resourceTypes)];
    condition.resourceTypes = types;
  }

  if (parsed.options.excludedResourceTypes && parsed.options.excludedResourceTypes.length > 0) {
    condition.excludedResourceTypes = [...new Set(parsed.options.excludedResourceTypes)];
  }

  if (parsed.options.thirdParty) {
    condition.domainType = 'thirdParty';
  }
  if (parsed.options.firstParty) {
    condition.domainType = 'firstParty';
  }

  if (parsed.options.matchCase) {
    condition.isUrlFilterCaseSensitive = true;
  }

  if (parsed.options.domains && parsed.options.domains.length > 0) {
    condition.initiatorDomains = parsed.options.domains;
  }
  if (parsed.options.excludedDomains && parsed.options.excludedDomains.length > 0) {
    condition.excludedInitiatorDomains = parsed.options.excludedDomains;
  }

  if (!condition.resourceTypes || condition.resourceTypes.length === 0) {
    condition.resourceTypes = DEFAULT_RESOURCE_TYPES;
  }

  return {
    id: RULE_ID_GLOBAL++,
    priority: parsed.isException ? 100 : 1,
    condition,
    action: {
      type: parsed.isException ? 'allow' : 'block'
    }
  };
}

/* ---------- 4.6 Deduplication ---------- */
function deduplicateRules(rules) {
  const seen = new Set();
  const result = [];

  for (const rule of rules) {
    const key = conditionKey(rule.condition);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(rule);
  }

  return result;
}

/* ---------- Prioritization ---------- */
function prioritizeRulesByScore(rules, maxRules) {
  if (rules.length <= maxRules) return { kept: rules, overflow: [] };

  const scored = rules.map(rule => {
    let score = rule.priority || 0;
    const cond = rule.condition;

    if (cond.urlFilter) {
      const p = cond.urlFilter;
      if (p.startsWith('||')) score += 10;
      if (cond.anchor && cond.anchor.start && cond.anchor.end) score += 5;
      if (cond.resourceTypes && cond.resourceTypes.length < 3) score += 3;
      if (cond.initiatorDomains) score += 2;
    }

    if (rule.action.type === 'allow') score += 20;

    if (cond.domainType === 'thirdParty') score += 2;

    const length = cond.urlFilter ? cond.urlFilter.length : 0;
    if (length > 5 && length < 30) score += 1;

    return { rule, score };
  });

  scored.sort((a, b) => b.score - a.score || (a.rule.id || 0) - (b.rule.id || 0));

  const kept = scored.slice(0, maxRules);
  const overflow = scored.slice(maxRules);

  return {
    kept: kept.map(s => s.rule),
    overflow: overflow.map(s => s.rule)
  };
}

/* ---------- 4.6 Full Compiler ---------- */
function compileFiltersToDNR(filters, options) {
  const opts = options || {};
  const maxRules = opts.maxRules || 5000;
  const startId = opts.startId || 1;
  const allowCosmetics = opts.allowCosmetics !== false;

  RULE_ID_GLOBAL = startId;

  const activeRules = [];
  const cosmetics = [];
  const overflowPatterns = [];
  const invalid = [];

  for (const line of filters) {
    if (!line || typeof line !== 'string') continue;

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) continue;

    if (trimmed.includes('##') || trimmed.includes('#@#')) {
      if (allowCosmetics) {
        const isException = trimmed.includes('#@#');
        const sep = isException ? '#@#' : '##';
        const parts = trimmed.split(sep);
        cosmetics.push({
          domain: parts[0] || null,
          selector: parts[1],
          exception: isException
        });
      }
      continue;
    }

    if (trimmed.includes('#%#') || trimmed.includes('#$#')) {
      cosmetics.push({ scriptlet: true, raw: trimmed });
      continue;
    }

    const parsed = parseFilter(trimmed);
    if (!parsed) {
      invalid.push(trimmed);
      continue;
    }

    const rule = buildDNRRule(parsed);
    if (rule) {
      activeRules.push(rule);
    } else {
      overflowPatterns.push(parsed.pattern);
    }
  }

  const deduplicated = deduplicateRules(activeRules);

  const result = prioritizeRulesByScore(deduplicated, maxRules);

  const overflowFromRules = result.overflow.map(r => r.condition.urlFilter || r.condition.regexFilter || '').filter(Boolean);

  return {
    rules: result.kept,
    overflowPatterns: [...overflowPatterns, ...overflowFromRules],
    cosmetics,
    totalParsed: filters.length,
    totalRules: activeRules.length,
    keptRules: result.kept.length,
    overflowCount: overflowPatterns.length + overflowFromRules.length,
    invalidCount: invalid.length
  };
}

/* ---------- Reset ID counter (for testing) ---------- */
function resetRuleId(nextId) {
  RULE_ID_GLOBAL = nextId || 1;
}

/* ---------- 5. Load into Browser ---------- */
async function updateDNRRules(rules) {
  try {
    const ruleIds = rules.map(r => r.id);
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds,
      addRules: rules
    });
    return true;
  } catch (e) {
    console.warn('DurgaShield: updateDNRRules error:', e);
    return false;
  }
}

/* ---------- 7. Hybrid Engine Splitter ----------
   Splits filter output into:
   - dnrRules: simple rules → declarativeNetRequest fast path
   - jsPatterns: complex/overflow patterns → Aho-Corasick engine
*/
function splitDNRvsJS(compileResult, maxDNR) {
  const max = maxDNR || 5000;

  if (compileResult.rules.length <= max) {
    return {
      dnrRules: compileResult.rules,
      jsPatterns: compileResult.overflowPatterns || []
    };
  }

  const sorted = [...compileResult.rules].sort((a, b) => {
    const pri = (b.priority || 0) - (a.priority || 0);
    if (pri !== 0) return pri;
    const aLen = a.condition.urlFilter ? a.condition.urlFilter.length : 0;
    const bLen = b.condition.urlFilter ? b.condition.urlFilter.length : 0;
    return bLen - aLen;
  });

  const dnrRules = sorted.slice(0, max);
  const overflow = sorted.slice(max);

  const extraJS = overflow
    .map(r => r.condition.urlFilter || r.condition.regexFilter || '')
    .filter(Boolean);

  return {
    dnrRules,
    jsPatterns: [...(compileResult.overflowPatterns || []), ...extraJS]
  };
}

/* ---------- Error Recovery ---------- */
const DNR_ERROR_TYPES = {
  TOO_MANY_RULES: 'tooManyRules',
  INVALID_RULE: 'invalidRule',
  RULE_ID_CONFLICT: 'ruleIdConflict'
};

async function safeUpdateDNR(rules, batchSize) {
  const batch = batchSize || 1000;
  const results = { applied: 0, failed: 0, errors: [] };

  for (let i = 0; i < rules.length; i += batch) {
    const chunk = rules.slice(i, i + batch);
    try {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: chunk.map(r => r.id),
        addRules: chunk
      });
      results.applied += chunk.length;
    } catch (e) {
      results.failed += chunk.length;
      results.errors.push({ chunk: i / batch, error: e.message });
    }
  }

  return results;
}

/* ---------- Rule ID Range Management ---------- */
function claimRuleIdRange(start, count) {
  if (RULE_ID_GLOBAL <= start) {
    RULE_ID_GLOBAL = start;
  }
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(RULE_ID_GLOBAL++);
  }
  return ids;
}
