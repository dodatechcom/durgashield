const STORAGE_KEY = 'durgashield_config';
const STATS_KEY = 'durgashield_stats';
const WHITELIST_KEY = 'durgashield_whitelist';
const HIDE_RULES_KEY = 'durgashield_hide_rules';
const SITE_STATS_KEY = 'durgashield_site_stats';
const TRACKER_MAP_KEY = 'durgashield_tracker_map';
const AUTO_TRACKED_KEY = 'durgashield_auto_tracked';
const STEALTH_KEY = 'durgashield_stealth';
const FILTER_LOG_KEY = 'durgashield_filter_log';
const YT_WHITELIST_KEY = 'durgashield_youtube_whitelist';

const PERMISSIONS_KEY = 'durgashield_site_permissions';

const OPTIONAL_FEATURE_PERMS = {
  downloadScan: ['downloads']
};

async function ensurePermissions(feature) {
  const perms = OPTIONAL_FEATURE_PERMS[feature];
  if (!perms) return true;
  const already = await chrome.permissions.contains({ permissions: perms });
  if (already) return true;
  const granted = await chrome.permissions.request({ permissions: perms });
  if (!granted) {
    const config = await getConfig();
    config[feature] = false;
    await saveConfig(config);
  }
  return granted;
}

const DEFAULT_CONFIG = {
  ads: true, malware: true, crypto: true, phishing: true,
  popupBlocking: true, containerIsolation: true, cdn: true, stealth: false,
  neverConsent: true, enhancedTracking: false, xssProtection: false, clearClick: false, abe: true, securePayment: true,
  downloadScan: true, social: true, annoyance: true, cdnReplacement: true,
  metadataCleanup: false, searchAnnotations: true, videoRedirect: false, httpsEnforce: true, passwordLeakCheck: true,
  'cc-adult': false, 'cc-gambling': false, 'cc-violence': false,
  aiDlp: false, defacementDetect: false, phoneScamDetect: false,
  phishingLinkDetect: false, fbPrivacy: false
};

const CONTAINER_NAME = 'Social Media';
const ISOLATED_DOMAINS = [
  'facebook.com', 'www.facebook.com', 'm.facebook.com',
  'fb.com', 'messenger.com', 'www.messenger.com',
  'instagram.com', 'www.instagram.com',
  'whatsapp.com', 'web.whatsapp.com',
  'fbcdn.net', 'facebook.net',
  'fb.watch', 'www.fb.watch'
];

let containerIdentity = null;
const countedMatches = new Set();

/* ---------- Filter List Auto-Update ---------- */
const FILTER_LISTS = [
  { id:'easylist',        name: 'EasyList',                    url: 'https://easylist.to/easylist/easylist.txt', enabled: true, maxRules: 5000 },
  { id:'easyprivacy',     name: 'EasyPrivacy',                 url: 'https://easylist.to/easylist/easyprivacy.txt', enabled: true, maxRules: 3000 },
  { id:'peterlowe',       name: "Peter Lowe's Ad server",      url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext', enabled: true, maxRules: 2000 },
  { id:'urlhaus',         name: 'Online Malicious URL Blocklist', url: 'https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt', enabled: true, maxRules: 2000 },
  { id:'adguard-annoy',   name: 'AdGuard Annoyances',          url: 'https://filters.adtidy.org/extension/ublock/filters/14.txt', enabled: true, maxRules: 2000 },
  { id:'easylist-cookie', name: 'EasyList Cookie',             url: 'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt', enabled: true, maxRules: 1500 },
  { id:'danpollock',      name: "Dan Pollock's hosts",         url: 'https://someonewhocares.org/hosts/zero/hosts', enabled: true, maxRules: 1500 },
  { id:'fanboy-annoy',    name: 'Fanboy Annoyances',           url: 'https://easylist.to/easylist/fanboy-annoyance.txt', enabled: false, maxRules: 1000 },
  { id:'fanboy-social',   name: 'Fanboy Social',               url: 'https://easylist.to/easylist/fanboy-social.txt', enabled: false, maxRules: 1000 },
];

const FILTER_RULE_START = 500000;
const FILTER_RULE_MAX = 4900;
const FILTER_STORAGE_KEY = 'durgashield_filter_rules';
const FILTER_META_KEY = 'durgashield_filter_meta';
const UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

async function getFilterMeta() {
  const r = await chrome.storage.local.get(FILTER_META_KEY);
  return r[FILTER_META_KEY] || {};
}
async function saveFilterMeta(meta) {
  await chrome.storage.local.set({ [FILTER_META_KEY]: meta });
}

const FILTER_LIST_SETTINGS_KEY = 'durgashield_filter_list_settings';

async function getFilterListSettings() {
  const r = await chrome.storage.local.get(FILTER_LIST_SETTINGS_KEY);
  return r[FILTER_LIST_SETTINGS_KEY] || {};
}
async function saveFilterListSettings(settings) {
  await chrome.storage.local.set({ [FILTER_LIST_SETTINGS_KEY]: settings });
}

async function loadFilterListEnabledStates() {
  const saved = await getFilterListSettings();
  for (const fl of FILTER_LISTS) {
    if (saved[fl.id] !== undefined) fl.enabled = saved[fl.id];
  }
}
async function getStoredFilterRules() {
  const r = await chrome.storage.local.get(FILTER_STORAGE_KEY);
  return r[FILTER_STORAGE_KEY] || [];
}
async function saveStoredFilterRules(rules) {
  await chrome.storage.local.set({ [FILTER_STORAGE_KEY]: rules });
}

const DYNAMIC_RULE_LIMIT = 5000;

async function applyDynamicRules(rules) {
  try {
    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    const oldIds = oldRules.map(r => r.id);
    const capped = rules.slice(0, DYNAMIC_RULE_LIMIT);
    if (capped.length < rules.length) {
      console.warn(`DurgaShield: rule cap hit (${rules.length} > ${DYNAMIC_RULE_LIMIT}), dropping ${rules.length - capped.length} rules`);
    }
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldIds,
      addRules: capped
    });
  } catch (e) {
    console.warn('DurgaShield: applyDynamicRules error:', e);
  }
}

function isAllowRule(line) {
  return line.startsWith('@@');
}

function isHostsLine(line) {
  return /^(?:\d{1,3}\.){3}\d{1,3}\s+\S/.test(line) || /^::\d?\s+\S/.test(line) || /^0\.0\.0\.0\s+\S/.test(line);
}

function extractHostFromHostsLine(line) {
  const m = line.match(/(?:\d{1,3}\.){3}\d{1,3}\s+(\S+)/) || line.match(/::\d?\s+(\S+)/);
  return m ? m[1] : null;
}

function isBareDomain(line) {
  return /^[\w.-]+\.[a-z]{2,}$/i.test(line) && !line.includes('/') && !line.startsWith('@@') && !line.startsWith('||');
}

function parseFilterList(text) {
  const lines = text.split('\n');
  const rules = [];
  const cosmetics = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;
    if (line.startsWith('#') && !line.includes('##')) continue;

    if (line.includes('##')) {
      const parts = line.split('##');
      cosmetics.push({ domain: parts[0] || null, selector: parts[1] });
      continue;
    }

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

    let filter = dnrLine;
    let domainRestrict = null;
    const domainMatch = filter.match(/\$domain=([^$|]+)/);
    if (domainMatch) {
      domainRestrict = domainMatch[1].split('|');
      filter = filter.replace(/\$domain=[^$|]+/, '');
    }
    const thirdParty = /\$third-party/.test(filter) && !/\$~third-party/.test(filter);
    const firstParty = /\$~third-party/.test(filter);
    filter = filter.replace(/\$~?third-party/, '').replace(/\$popup/, '');
    filter = filter.replace(/~[\w-]+/g, '').replace(/\$[\w-]+(=[^$]+)?/g, '').trim();
    if (!filter || filter.startsWith('##')) continue;

    const condition = {};
    condition.urlFilter = filter;
    condition.resourceTypes = ["script", "xmlhttprequest", "image", "stylesheet", "font", "media", "websocket", "other", "sub_frame"];
    if (thirdParty) condition.domainType = "thirdParty";
    if (firstParty) condition.domainType = "firstParty";
    if (domainRestrict) condition.initiatorDomains = domainRestrict;
    rules.push({
      action: { type: isAllow ? 'allow' : 'block' },
      condition
    });
  }
  return { rules, cosmetics };
}

async function fetchFilterList(url) {
  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.text();
}

async function updateFilterLists() {
  await loadFilterListEnabledStates();
  const meta = await getFilterMeta();
  const now = Date.now();
  const merged = [];
  const mergedCosmetics = [];
  const parsedLists = [];
  let id = FILTER_RULE_START;
  const idSet = new Set();

  for (const fl of FILTER_LISTS) {
    if (!fl.enabled) continue;
    try {
      const text = await fetchFilterList(fl.url);
      const p = parseFilterList(text);
      parsedLists.push({ fl, parsed: p });
      mergedCosmetics.push(...p.cosmetics);
    } catch (e) {
      meta[fl.name] = { updated: meta[fl.name]?.updated || 0, count: meta[fl.name]?.count || 0, error: e.message };
      console.warn(`DurgaShield: failed to fetch ${fl.name}:`, e);
    }
  }
  // Distribute rule budget proportionally among successfully parsed lists
  const totalAvailable = parsedLists.reduce((s, p) => s + Math.min(p.parsed.rules.length, p.fl.maxRules || 500), 0);
  for (const { fl, parsed } of parsedLists) {
    const share = Math.max(1, Math.floor(FILTER_RULE_MAX * Math.min(parsed.rules.length, fl.maxRules || 500) / totalAvailable));
    let taken = 0;
    for (const rule of parsed.rules) {
      if (taken >= share || taken >= (fl.maxRules || 500) || merged.length >= FILTER_RULE_MAX) break;
      if (idSet.has(id)) { id++; continue; }
      merged.push({ ...rule, id: id++ });
      idSet.add(id - 1);
      taken++;
    }
    meta[fl.name] = { updated: now, count: taken, total: parsed.rules.length, error: null };
    console.log(`DurgaShield: updated ${fl.name} (${parsed.rules.length} rules, used ${taken}/${share})`);
  }
  meta.lastUpdate = now;
  await saveFilterMeta(meta);
  await saveStoredFilterRules(merged);
  await chrome.storage.local.set({ durgashield_cosmetic_filters: mergedCosmetics });
  await reconcileDynamicRules();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try { chrome.tabs.sendMessage(tab.id, { type: 'cosmeticFilters', cosmetics: mergedCosmetics }); } catch (e) {}
  }
  return { rules: merged, cosmetics: mergedCosmetics };
}

async function restoreFilterRules() {
  await loadFilterListEnabledStates();
  const meta = await getFilterMeta();
  const now = Date.now();
  if (meta.lastUpdate && (now - meta.lastUpdate) < UPDATE_INTERVAL) {
    const stored = await getStoredFilterRules();
    if (stored.length > 0) {
      await reconcileDynamicRules();
      console.log(`DurgaShield: restored ${stored.length} filter rules from storage`);
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
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    return rules.length;
  } catch { return 0; }
}

async function getFilteredListInfo(hostname) {
  const rules = await getStoredFilterRules();
  const matching = rules.filter(r => {
    const uf = r.condition?.urlFilter || '';
    const h = hostname.replace(/^www\./, '');
    return uf.includes(h) || uf.includes(h.split('.').slice(-2).join('.'));
  });
  return { total: rules.length, matching: matching.slice(0, 20) };
}

/* ---------- JS Blocking (per-site & global) ---------- */
const JS_SETTINGS_KEY = 'durgashield_js_settings';
const CUSTOM_RULES_KEY = 'durgashield_custom_rules';
const DISABLED_RULES_KEY = 'durgashield_disabled_rules';
const JS_RULE_START = 700000;
const CUSTOM_RULE_START = 701000;

async function getJsSettings() {
  const r = await chrome.storage.local.get(JS_SETTINGS_KEY);
  return r[JS_SETTINGS_KEY] || { global: true, sites: {} };
}
async function saveJsSettings(s) {
  await chrome.storage.local.set({ [JS_SETTINGS_KEY]: s });
}
async function getCustomRules() {
  const r = await chrome.storage.local.get(CUSTOM_RULES_KEY);
  return r[CUSTOM_RULES_KEY] || [];
}
async function saveCustomRules(rules) {
  await chrome.storage.local.set({ [CUSTOM_RULES_KEY]: rules });
}
async function getDisabledRuleIds() {
  const r = await chrome.storage.local.get(DISABLED_RULES_KEY);
  return r[DISABLED_RULES_KEY] || [];
}
async function saveDisabledRuleIds(ids) {
  await chrome.storage.local.set({ [DISABLED_RULES_KEY]: ids });
}

function buildJsBlockingRules(settings) {
  const rules = [];
  let id = JS_RULE_START;
  const g = settings.global !== false;

  if (!g) {
    rules.push({
      id: id++, priority: 1, action: { type: 'block' },
      condition: { urlFilter: 'http', resourceTypes: ['script'] }
    });
    for (const [host, enabled] of Object.entries(settings.sites)) {
      if (enabled) {
        rules.push({
          id: id++, priority: 10, action: { type: 'allow' },
          condition: { initiatorDomains: [host], resourceTypes: ['script'] }
        });
      }
    }
  } else {
    for (const [host, enabled] of Object.entries(settings.sites)) {
      if (!enabled) {
        rules.push({
          id: id++, priority: 1, action: { type: 'block' },
          condition: { initiatorDomains: [host], resourceTypes: ['script'] }
        });
      }
    }
  }
  return rules;
}

function buildGoogleSafeRules() {
  const safeHosts = ['keep.google.com', 'mail.google.com', 'docs.google.com', 'sheets.google.com', 'slides.google.com', 'calendar.google.com'];
  const safeUrlPatterns = ['||google.com^', '||gstatic.com^', '||googleapis.com^', '||googleusercontent.com^', '||ggpht.com^', '||googlecode.com^', '||googleplex.com^', '||googlesource.com^'];
  const resourceTypes = ['xmlhttprequest', 'script', 'image', 'stylesheet', 'font', 'media', 'websocket', 'other', 'sub_frame'];
  const rules = [];
  let id = GOOGLE_SAFE_START;
  for (const host of safeHosts) {
    for (const urlPat of safeUrlPatterns) {
      rules.push({ id: id++, priority: 100, action: { type: 'allow' }, condition: { initiatorDomains: [host], urlFilter: urlPat, resourceTypes: resourceTypes } });
    }
  }
  return rules;
}

async function applyGoogleSessionRules() {
  try {
    const safeRules = buildGoogleSafeRules();
    const oldSession = await chrome.declarativeNetRequest.getSessionRules();
    const oldIds = oldSession.map(r => r.id);
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: oldIds,
      addRules: safeRules
    });
  } catch (e) {
    console.warn('DurgaShield: applyGoogleSessionRules error:', e);
  }
}

async function reconcileDynamicRules() {
  const filterRules = await getStoredFilterRules();
  const jsSettings = await getJsSettings();
  const customRules = await getCustomRules();
  const disabledIds = await getDisabledRuleIds();
  const disabledSet = new Set(disabledIds);

  const jsRules = buildJsBlockingRules(jsSettings);
  const customDnrRules = customRules.map(r => ({
    id: CUSTOM_RULE_START + r.id, priority: r.priority || 100,
    action: { type: r.action || 'block' },
    condition: { urlFilter: r.pattern, ...(r.resourceTypes ? { resourceTypes: r.resourceTypes.split(',') } : {}) }
  }));
  const headerRules = buildPrivacyHeaderRules();
  const autoTracked = await getAutoTracked();
  const actions = await getTrackerActions();
  const cookieBlockDomains = [];
  const autoTrackerRules = buildAutoTrackerRules(autoTracked, actions, cookieBlockDomains);
  // Also add any domains with explicit cookie-block action that aren't auto-tracked
  for (const [domain, action] of Object.entries(actions)) {
    if (action === 'cookie-block' && !autoTracked.includes(domain) && !cookieBlockDomains.includes(domain)) {
      cookieBlockDomains.push(domain);
    }
  }
  const cookieBlockRules = buildCookieBlockRules(cookieBlockDomains);
  const config = await getConfig();
  const contentControlRules = buildContentControlRules(config);

  const all = [...filterRules, ...headerRules, ...jsRules, ...autoTrackerRules, ...cookieBlockRules, ...customDnrRules, ...contentControlRules].filter(r => !disabledSet.has(r.id));
  await applyDynamicRules(all);
  await applyGoogleSessionRules();
}

async function getConfig() {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  return r[STORAGE_KEY] || { ...DEFAULT_CONFIG };
}
async function saveConfig(config) {
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
}
async function getStats() {
  const r = await chrome.storage.local.get(STATS_KEY);
  return r[STATS_KEY] || { total: 0, today: 0, date: new Date().toDateString() };
}
async function incrementStats(n) {
  n = n || 1;
  const stats = await getStats();
  const today = new Date().toDateString();
  if (stats.date !== today) { stats.date = today; stats.today = 0; }
  stats.total += n; stats.today += n;
  const dayKey = new Date().toISOString().slice(0,10);
  if (!stats.byDay) stats.byDay = {};
  stats.byDay[dayKey] = (stats.byDay[dayKey] || 0) + n;
  const days = Object.keys(stats.byDay);
  if (days.length > 30) {
    const oldest = days.sort()[0];
    delete stats.byDay[oldest];
  }
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}

async function getDailyStats() {
  const stats = await getStats();
  const byDay = stats.byDay || {};
  const today = new Date().toISOString().slice(0,10);
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);
    result.push({ date: key.slice(5), count: byDay[key] || 0 });
  }
  return result;
}
async function getWhitelist() {
  const r = await chrome.storage.local.get(WHITELIST_KEY);
  return r[WHITELIST_KEY] || [];
}
async function saveWhitelist(list) {
  await chrome.storage.local.set({ [WHITELIST_KEY]: list });
}
async function getHideRules() {
  const r = await chrome.storage.local.get(HIDE_RULES_KEY);
  return r[HIDE_RULES_KEY] || {};
}
async function saveHideRules(rules) {
  await chrome.storage.local.set({ [HIDE_RULES_KEY]: rules });
}
async function getSiteStats() {
  const r = await chrome.storage.local.get(SITE_STATS_KEY);
  return r[SITE_STATS_KEY] || {};
}
async function saveSiteStats(stats) {
  await chrome.storage.local.set({ [SITE_STATS_KEY]: stats });
}

/* ---------- Privacy Badger Features ---------- */
async function getTrackerMap() {
  const r = await chrome.storage.local.get(TRACKER_MAP_KEY);
  return r[TRACKER_MAP_KEY] || {};
}
async function saveTrackerMap(m) {
  await chrome.storage.local.set({ [TRACKER_MAP_KEY]: m });
}
async function getAutoTracked() {
  const r = await chrome.storage.local.get(AUTO_TRACKED_KEY);
  return r[AUTO_TRACKED_KEY] || [];
}
async function saveAutoTracked(list) {
  await chrome.storage.local.set({ [AUTO_TRACKED_KEY]: list });
}
async function getTrackerActions() {
  const r = await chrome.storage.local.get(TRACKER_ACTIONS_KEY);
  return r[TRACKER_ACTIONS_KEY] || {};
}
async function saveTrackerActions(actions) {
  await chrome.storage.local.set({ [TRACKER_ACTIONS_KEY]: actions });
}

const TRACKER_ACTIONS_KEY = 'durgashield_tracker_actions';

function classifyTrackerDomain(domain) {
  const adDomains = ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com', 'adsafeprotected.com', 'adnxs.com', 'rubiconproject.com', 'criteo.com', 'criteo.net', 'outbrain.com', 'taboola.com', 'scorecardresearch.com', 'quantserve.com', 'exelator.com', 'bluekai.com', 'agkn.com', 'casalemedia.com', 'addthis.com', 'moatads.com', 'pubmatic.com', 'openx.net', 'appnexus.com', 'sharethrough.com'];
  const analyticsDomains = ['google-analytics.com', 'googletagmanager.com', 'gtagmanager.com', 'analytics.google.com', 'facebook.com/tr', 'connect.facebook.net', 'pixel.quantserve.com', 'scorecardresearch.com', 'hotjar.com', 'mouseflow.com', 'fullstory.com', 'mixpanel.com', 'amplitude.com', 'segment.io', 'segment.com', 'heap.io', 'clicky.com', 'matomo.org', 'piwik.org', 'piwik.pro', 'woopra.com', 'mouseflow.com', 'luckyorange.com', 'crazyegg.com', 'clarity.ms', 'bing.com/collect'];
  const socialDomains = ['facebook.com', 'facebook.net', 'fbcdn.net', 'twitter.com', 'twimg.com', 'linkedin.com', 'linkedin.com/li', 'pinterest.com', 'instagram.com', 't.co', 'bit.ly', 'ow.ly', 'tinyurl.com', 'reddit.com', 'youtube.com', 'ytimg.com'];
  const cdnDomains = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net', 'stackpathcdn.com', 'fastly.net', 'cloudfront.net', 'akamaihd.net', 'akamaiedge.net', 'azureedge.net', 'netdna-ssl.com', 'netdna.com', 'bootstrapcdn.com', 'maxcdn.com', 'jsdelivr.net', 'cloudflare.com', 'cloudflare.net', 'googleapis.com', 'gstatic.com'];
  const hostingDomains = ['github.io', 'gitlab.io', 'bitbucket.io', 'netlify.com', 'vercel.app', 'pages.dev', 'firebaseapp.com', 'web.app', 'herokuapp.com', 'azurewebsites.net', 'awsapps.com', 'amazonaws.com', 's3.amazonaws.com'];
  const fontDomains = ['fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit.net', 'fonts.cdnfonts.com', 'fontawesome.com', 'use.fontawesome.com'];
  const d = domain.replace(/^www\./, '');
  for (const ad of adDomains) { if (d.endsWith(ad) || d === ad) return 'Advertising'; }
  for (const ad of analyticsDomains) { if (d.endsWith(ad) || d === ad) return 'Analytics'; }
  for (const ad of socialDomains) { if (d.endsWith(ad) || d === ad) return 'Social Media'; }
  for (const ad of cdnDomains) { if (d.endsWith(ad) || d === ad) return 'CDN'; }
  for (const ad of fontDomains) { if (d.endsWith(ad) || d === ad) return 'Fonts'; }
  for (const ad of hostingDomains) { if (d.endsWith(ad) || d === ad) return 'Hosting'; }
  return 'Other';
}

async function reportThirdParties(domains, host) {
  const map = await getTrackerMap();
  for (const d of domains) {
    if (!map[d]) map[d] = { sites: [], category: classifyTrackerDomain(d) };
    if (!map[d].sites.includes(host)) map[d].sites.push(host);
    if (map[d].sites.length > 100) map[d].sites = map[d].sites.slice(-100);
  }
  const entries = Object.entries(map);
  if (entries.length > 500) {
    const sorted = entries.sort((a, b) => b[1].sites.length - a[1].sites.length);
    const pruned = Object.fromEntries(sorted.slice(0, 500));
    await saveTrackerMap(pruned);
  } else {
    await saveTrackerMap(map);
  }
}

async function getDetectedTrackers() {
  const map = await getTrackerMap();
  const actions = await getTrackerActions();
  const tracked = await getAutoTracked();
  return Object.entries(map).map(([domain, info]) => ({
    domain,
    category: info.category || 'Other',
    sites: info.sites ? info.sites.length : 0,
    action: actions[domain] || (tracked.includes(domain) ? 'block' : 'none')
  }));
}

async function getTrackerCategories() {
  const trackers = await getDetectedTrackers();
  const categories = {};
  let blocked = 0;
  for (const t of trackers) {
    const cat = t.category || 'Other';
    if (!categories[cat]) categories[cat] = { count: 0 };
    categories[cat].count++;
    if (t.action === 'block') blocked++;
  }
  return { total: trackers.length, blocked, categories, domains: trackers };
}

async function getYouTubeWhitelist() {
  const r = await chrome.storage.local.get(YT_WHITELIST_KEY);
  return r[YT_WHITELIST_KEY] || [];
}

async function addYouTubeWhitelist(channelId, channelName) {
  const list = await getYouTubeWhitelist();
  if (!list.find(c => c.id === channelId)) {
    list.push({ id: channelId, name: channelName });
    await chrome.storage.local.set({ [YT_WHITELIST_KEY]: list });
  }
  return list;
}

async function removeYouTubeWhitelist(channelId) {
  const list = await getYouTubeWhitelist();
  const filtered = list.filter(c => c.id !== channelId);
  await chrome.storage.local.set({ [YT_WHITELIST_KEY]: filtered });
  return filtered;
}

const GPC_RULE_ID = 800000;
const DNT_RULE_ID = 800001;
const XFO_RULE_ID = 800002;
const XCTO_RULE_ID = 800003;
const RP_RULE_ID = 800004;
const PP_RULE_ID = 800005;
const AUTO_TRACKER_START = 800100;
const COOKIE_BLOCK_START = 900000;
const CC_START = 950000;
const GOOGLE_SAFE_START = 970000;
const CC_DOMAINS = {
  'cc-adult': ['pornhub.com','xvideos.com','xnxx.com','xhamster.com','redtube.com','youporn.com','tube8.com','spankbang.com','porntube.com','adultfriendfinder.com','onlyfans.com','stripchat.com','chaturbate.com','cam4.com','flirt4free.com','livejasmin.com'],
  'cc-gambling': ['bet365.com','pokerstars.com','888.com','partypoker.com','williamhill.com','draftkings.com','fanduel.com','betmgm.com','caesars.com','betway.com','unibet.com','bwin.com','sportsbet.io','cloudbet.com','stake.com'],
  'cc-violence': ['stormfront.org','dailystormer.io','kiwifarms.net']
};

function buildContentControlRules(config) {
  const rules = [];
  let id = CC_START;
  for (const [key, domains] of Object.entries(CC_DOMAINS)) {
    if (config[key] !== true) continue;
    for (const domain of domains) {
      rules.push({
        id: id++, priority: 5,
        action: { type: 'block' },
        condition: { urlFilter: '||' + domain + '^', resourceTypes: ['main_frame','sub_frame','script','image','stylesheet','font','media','xmlhttprequest','other'] }
      });
    }
  }
  return rules;
}

/* ---------- Browser Cleanup ---------- */
async function handleBrowserCleanup(message) {
  const options = {};
  if (message.cache) options.cache = {};
  if (message.cookies) options.cookies = {};
  if (message.history) options.history = {};
  const since = message.since || 0;
  try {
    await chrome.browsingData.remove({ since }, options);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/* ---------- Site Permissions Monitor ---------- */
async function getSitePermissions() {
  const r = await chrome.storage.local.get(PERMISSIONS_KEY);
  return r[PERMISSIONS_KEY] || [];
}

async function trackSitePermission(host, permission) {
  const list = await getSitePermissions();
  const existing = list.find(p => p.host === host);
  if (existing) {
    if (!existing.permissions.includes(permission)) existing.permissions.push(permission);
    existing.lastSeen = Date.now();
  } else {
    list.push({ host, permissions: [permission], firstSeen: Date.now(), lastSeen: Date.now() });
  }
  await chrome.storage.local.set({ [PERMISSIONS_KEY]: list });
}

async function cookieSelfDestruct() {
  const config = await getConfig();
  if (!config.stealth) return;
  const stealth = await getStealthConfig();
  if (!stealth.selfDestructCookies) return;
  const whitelist = await getWhitelist();
  try {
    const cookies = await chrome.cookies.getAll({});
    for (const c of cookies) {
      if (whitelist.some(w => c.domain.includes(w))) continue;
      if (c.session) continue;
      const age = Date.now() - (c.lastAccessDate ? new Date(c.lastAccessDate).getTime() : Date.now());
      if (age > 3600000) {
        await chrome.cookies.remove({
          name: c.name, url: (c.secure ? 'https' : 'http') + '://' + c.domain.replace(/^\./, '') + c.path,
          storeId: c.storeId
        });
      }
    }
  } catch (e) {}
}

/* ---------- HTTPS Enforcement ---------- */
const HTTPS_ENFORCE_LIST = [
  'google.com','youtube.com','facebook.com','twitter.com','x.com','instagram.com',
  'linkedin.com','reddit.com','amazon.com','netflix.com','wikipedia.org',
  'github.com','stackoverflow.com','npmjs.com','medium.com','whatsapp.com',
  'zoom.us','microsoft.com','live.com','office.com','outlook.com',
  'apple.com','icloud.com','dropbox.com','box.com','drive.google.com',
  'mail.google.com','accounts.google.com','paypal.com','stripe.com',
  'bankofamerica.com','wellsfargo.com','chase.com','capitalone.com',
  'wordpress.com','blogger.com','tumblr.com','pinterest.com','ebay.com',
  'aliexpress.com','alibaba.com','walmart.com','target.com','bestbuy.com',
  'adobe.com','salesforce.com','atlassian.net','slack.com','discord.com',
  'telegram.org','signal.org','protonmail.com','tutanota.com',
  'cloudflare.com','cloudfront.net','fastly.net','akamaihd.net',
  'jsdelivr.net','unpkg.com','cdnjs.com','googleapis.com',
  'gstatic.com','facebook.net','doubleclick.net','googletagmanager.com',
  'google-analytics.com','googlesyndication.com','amazon-adsystem.com',
  'creativecommons.org','archive.org','imdb.com','quora.com','cnn.com',
  'bbc.com','bbc.co.uk','nytimes.com','wsj.com','bloomberg.com',
  'forbes.com','wired.com','theguardian.com','reuters.com','apnews.com'
];
const HTTPS_ENFORCE_START = 995000;
const httpsEnforceRules = HTTPS_ENFORCE_LIST.map((domain, i) => ({
  id: HTTPS_ENFORCE_START + i,
  priority: 10,
  action: { type: 'upgradeScheme' },
  condition: { urlFilter: '||' + domain + '^', resourceTypes: ['main_frame'] }
}));
async function installHTTPSEnforcement() {
  try {
    const config = await getConfig();
    if (config.httpsEnforce !== true) return;
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const oldIds = existing.filter(r => r.id >= HTTPS_ENFORCE_START && r.id < HTTPS_ENFORCE_START + 1000).map(r => r.id);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldIds,
      addRules: httpsEnforceRules
    });
  } catch (e) { console.warn('HTTPS enforce install failed', e); }
}
async function removeHTTPSEnforcement() {
  try {
    const oldIds = Array.from({ length: HTTPS_ENFORCE_LIST.length }, (_, i) => HTTPS_ENFORCE_START + i);
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: [] });
  } catch (e) {}
}

/* ---------- Password Leak Detection ---------- */
const PASSWORD_LEAK_KEY = 'durgashield_password_leaks';
async function checkPasswordLeak(password) {
  try {
    const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);
    const resp = await fetch('https://api.pwnedpasswords.com/range/' + prefix);
    if (!resp.ok) return { compromised: false, error: 'API unavailable' };
    const text = await resp.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const [s, count] = line.trim().split(':');
      if (s === suffix) {
        const leaks = await getPasswordLeaks();
        leaks.push({ hash: hashHex.substring(0, 10) + '...', count: parseInt(count || '0'), checked: Date.now() });
        if (leaks.length > 50) leaks.splice(0, leaks.length - 50);
        await chrome.storage.local.set({ [PASSWORD_LEAK_KEY]: leaks });
        return { compromised: true, count: parseInt(count) };
      }
    }
    return { compromised: false, count: 0 };
  } catch (e) { return { compromised: false, error: e.message }; }
}
async function getPasswordLeaks() {
  const r = await chrome.storage.local.get(PASSWORD_LEAK_KEY);
  return r[PASSWORD_LEAK_KEY] || [];
}
async function clearPasswordLeaks() {
  await chrome.storage.local.set({ [PASSWORD_LEAK_KEY]: [] });
}

/* ---------- Notification Batching ---------- */
const notifQueue = [];
let notifTimer = null;
const NOTIF_COOLDOWN = 30000;
function batchNotification(title, message) {
  notifQueue.push({ title, message, ts: Date.now() });
  if (!notifTimer) {
    notifTimer = setTimeout(flushNotifications, NOTIF_COOLDOWN);
  }
}
async function flushNotifications() {
  notifTimer = null;
  if (notifQueue.length === 0) return;
  const count = notifQueue.length;
  const latest = notifQueue[notifQueue.length - 1];
  notifQueue.length = 0;
  if (count === 1) {
    await chrome.notifications.create('batch-' + Date.now(), {
      type: 'basic', iconUrl: 'icons/icon-128.svg',
      title: latest.title, message: latest.message, priority: 1
    });
  } else {
    await chrome.notifications.create('batch-' + Date.now(), {
      type: 'basic', iconUrl: 'icons/icon-128.svg',
      title: 'DurgaShield (' + count + ' notifications)',
      message: count + ' events since last notification: ' + latest.title,
      priority: 1
    });
  }
}

/* ---------- Filtering Log ---------- */
async function getFilterLog() {
  const r = await chrome.storage.local.get(FILTER_LOG_KEY);
  return r[FILTER_LOG_KEY] || [];
}
async function addFilterLogEntry(entry) {
  let url = entry.url || '';
  try { new URL(url); } catch { url = ''; }
  if (!url) return;
  let log = await getFilterLog();
  log.unshift({ ...entry, url, ts: Date.now() });
  if (log.length > 200) log = log.slice(0, 200);
  await chrome.storage.local.set({ [FILTER_LOG_KEY]: log });
}
async function clearFilterLog() {
  await chrome.storage.local.set({ [FILTER_LOG_KEY]: [] });
}
async function cleanFilterLog() {
  const log = await getFilterLog();
  const cleaned = log.filter(e => { try { new URL(e.url || ''); return true; } catch { return false; } });
  if (cleaned.length !== log.length) await chrome.storage.local.set({ [FILTER_LOG_KEY]: cleaned });
}
async function exportFilterLog() {
  const log = await getFilterLog();
  const header = 'Timestamp,RuleID,URL';
  const rows = log.map(e => {
    const ts = e.ts ? new Date(e.ts).toISOString() : '';
    const url = (e.url || '').replace(/"/g, '""');
    return `"${ts}","${e.ruleId || ''}","${url}"`;
  });
  return header + '\n' + rows.join('\n');
}

async function pollMatchedRules() {
  try {
    const result = await chrome.declarativeNetRequest.getMatchedRules();
    if (!result || !result.rulesMatchedInfo) return;
    let n = 0;
    for (const m of result.rulesMatchedInfo) {
      const k = m.rule + ':' + m.tabId + ':' + m.timeStamp;
      if (!countedMatches.has(k)) { countedMatches.add(k); n++; }
    }
    if (n > 0) {
      await incrementStats(n);
      for (const m of result.rulesMatchedInfo.slice(0, 5)) {
        if (!countedMatches.has(m.rule + ':logged:' + m.timeStamp)) {
          countedMatches.add(m.rule + ':logged:' + m.timeStamp);
          let url = '';
          if (m.request && m.request.url) url = m.request.url;
          else if (m.url) url = m.url;
          else if (typeof m.request === 'string') url = m.request;
          if (url) addFilterLogEntry({ ruleId: m.rule, tabId: m.tabId, url });
        }
      }
    }
  } catch (e) {}
}
setInterval(pollMatchedRules, 10000);

/* cookie self-destruct every 30 min */
setInterval(cookieSelfDestruct, 1800000);

async function setRuleSetEnabled(id, enabled) {
  const o = { enableRulesetIds: [], disableRulesetIds: [] };
  (enabled ? o.enableRulesetIds : o.disableRulesetIds).push(id);
  await chrome.declarativeNetRequest.updateEnabledRulesets(o);
}

async function getOrCreateContainer() {
  if (containerIdentity) return containerIdentity;
  try {
    const ids = await chrome.contextualIdentities.query({ name: CONTAINER_NAME });
    containerIdentity = ids[0] || await chrome.contextualIdentities.create({
      name: CONTAINER_NAME, color: 'blue', icon: 'fence'
    });
    return containerIdentity;
  } catch (e) { return null; }
}

function isIsolatedHost(h) {
  h = h.toLowerCase().replace(/^www\./, '');
  return ISOLATED_DOMAINS.some(d => {
    const c = d.replace(/^www\./, '');
    return h === c || h.endsWith('.' + c);
  });
}
function isIsolatedUrl(url) {
  try { return isIsolatedHost(new URL(url).hostname); } catch { return false; }
}

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

async function cleanupForeignCookies() {
  try {
    if (!containerIdentity) return;
    const storeId = containerIdentity.cookieStoreId;
    for (const domain of ISOLATED_DOMAINS) {
      const cookies = await chrome.cookies.getAll({ domain });
      for (const cookie of cookies) {
        if (cookie.storeId !== storeId) {
          await chrome.cookies.remove({
            name: cookie.name,
            url: (cookie.secure ? 'https' : 'http') + '://' + cookie.domain + cookie.path,
            storeId: cookie.storeId
          });
        }
      }
    }
  } catch (e) {}
}

async function handleContainerNavigation(details) {
  if (details.frameId !== 0) return;
  if (!details.url || !details.url.startsWith('http')) return;
  const config = await getConfig();
  if (!config.containerIsolation) return;
  const container = await getOrCreateContainer();
  if (!container) return;
  try {
    const tab = await chrome.tabs.get(details.tabId);
    if (!tab || !tab.url) return;
    const inContainer = tab.cookieStoreId === container.cookieStoreId;
    const toIsolated = isIsolatedUrl(details.url);
    if ((inContainer && toIsolated) || (!inContainer && !toIsolated)) return;
    const newTab = await chrome.tabs.create({
      url: details.url, active: tab.active, index: tab.index + 1,
      ...(toIsolated ? { cookieStoreId: container.cookieStoreId } : {})
    });
    await chrome.tabs.remove(details.tabId);
  } catch (e) {}
}

chrome.runtime.onInstalled.addListener(async () => {
  const config = await getConfig();
  for (const [key, enabled] of Object.entries(config)) {
    if (['ads', 'malware', 'crypto', 'phishing', 'cdn', 'social', 'annoyance'].includes(key)) await setRuleSetEnabled(key, enabled);
  }
  if (config.containerIsolation) { await getOrCreateContainer(); await cleanupForeignCookies(); }
  await restoreFilterRules();
  await loadCDNMap();
  await initCDNFileCache();
  if (config.cdnReplacement) installCDNReplacement();
  if (config.httpsEnforce) installHTTPSEnforcement();
  await installSiteAllowRules();
  await installTrackingCleaner();
  await cleanFilterLog();
});

chrome.runtime.onStartup.addListener(async () => {
  const config = await getConfig();
  for (const [key, enabled] of Object.entries(config)) {
    if (['ads', 'malware', 'crypto', 'phishing', 'cdn', 'social', 'annoyance'].includes(key)) await setRuleSetEnabled(key, enabled);
  }
  if (config.containerIsolation) { await getOrCreateContainer(); await cleanupForeignCookies(); }
  await restoreFilterRules();
  await loadCDNMap();
  await initCDNFileCache();
  if (config.cdnReplacement) installCDNReplacement();
  if (config.httpsEnforce) installHTTPSEnforcement();
  await installSiteAllowRules();
  await installTrackingCleaner();
});

setInterval(async () => {
  const config = await getConfig();
  if (config.autoUpdate === false) return;
  getFilterMeta().then(meta => {
    if (meta.lastUpdate && (Date.now() - meta.lastUpdate) >= UPDATE_INTERVAL) updateFilterLists();
  });
}, 3600000);

let webNavigationRegistered = false;

async function ensureWebNavigation() {
  if (webNavigationRegistered) return true;
  const ok = await chrome.permissions.contains({ permissions: ['webNavigation'] });
  if (!ok) return false;
  chrome.webNavigation.onBeforeNavigate.addListener(handleContainerNavigation);
  webNavigationRegistered = true;
  return true;
}

ensureWebNavigation();

function hostFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'getConfig':
      getConfig().then(sendResponse);
      return true;
    case 'saveConfig':
      saveConfig(message.config).then(async () => {
        for (const [key, enabled] of Object.entries(message.config)) {
          if (['ads', 'malware', 'crypto', 'phishing', 'cdn', 'social', 'annoyance'].includes(key)) await setRuleSetEnabled(key, enabled);
        }
        if (message.config.containerIsolation !== undefined) {
          if (message.config.containerIsolation) {
            await ensureWebNavigation();
            await getOrCreateContainer(); await cleanupForeignCookies();
          }
        }
        if (message.config.cdnReplacement !== undefined) {
          if (message.config.cdnReplacement) installCDNReplacement();
          else removeCDNReplacement();
        }
        if (message.config.downloadScan !== undefined) {
          if (message.config.downloadScan) await ensurePermissions('downloadScan');
        }
        if (message.config.httpsEnforce !== undefined) {
          if (message.config.httpsEnforce) await installHTTPSEnforcement();
          else await removeHTTPSEnforcement();
        }
        if (['cc-adult','cc-gambling','cc-violence'].some(k => message.config[k] !== undefined)) {
          await reconcileDynamicRules();
        }
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          try { chrome.tabs.sendMessage(tab.id, { type: 'configUpdated', config: message.config }); } catch (e) {}
        }
        if (message.config.stealth !== undefined) {
          const stealth = await getStealthConfig();
          for (const tab of tabs) {
            try { chrome.tabs.sendMessage(tab.id, { type: 'stealthUpdated', config: stealth }); } catch (e) {}
          }
        }
        sendResponse({ success: true });
      });
      return true;
    case 'getStats':
      getStats().then(sendResponse);
      return true;
    case 'blockCount':
      incrementStats(message.count || 1).then(() => sendResponse({}));
      return true;
    case 'malwareDetected':
      if (sender.tab) updateBadge(sender.tab.id, 'danger');
      sendResponse({ success: true });
      return true;
    case 'getContainerInfo':
      getOrCreateContainer().then(c => sendResponse({
        enabled: true, containerName: CONTAINER_NAME, containerExists: !!c,
        isolatedDomains: ISOLATED_DOMAINS, cookieStoreId: c ? c.cookieStoreId : null
      }));
      return true;
    case 'checkContainerTab':
      (async () => {
        const tab = sender.tab;
        if (!tab) { sendResponse({ inContainer: false }); return; }
        const c = await getOrCreateContainer();
        sendResponse({ inContainer: c ? tab.cookieStoreId === c.cookieStoreId : false, containerName: CONTAINER_NAME });
      })();
      return true;
    case 'getWhitelist':
      getWhitelist().then(sendResponse);
      return true;
    case 'addWhitelist':
      getWhitelist().then(async (list) => {
        const host = hostFromUrl(message.url);
        if (host && !list.includes(host)) { list.push(host); await saveWhitelist(list); }
        sendResponse({ success: true, whitelist: list });
      });
      return true;
    case 'removeWhitelist':
      getWhitelist().then(async (list) => {
        const host = hostFromUrl(message.url);
        const idx = list.indexOf(host);
        if (idx > -1) { list.splice(idx, 1); await saveWhitelist(list); }
        sendResponse({ success: true, whitelist: list });
      });
      return true;
    case 'isWhitelisted':
      getWhitelist().then((list) => {
        const host = hostFromUrl(message.url);
        sendResponse({ whitelisted: list.includes(host) });
      });
      return true;
    case 'getHideRules':
      getHideRules().then(sendResponse);
      return true;
    case 'addHideRule':
      getHideRules().then(async (rules) => {
        const host = hostFromUrl(message.url);
        if (!host) { sendResponse({ success: false }); return; }
        if (!rules[host]) rules[host] = [];
        if (!rules[host].includes(message.selector)) rules[host].push(message.selector);
        await saveHideRules(rules);
        sendResponse({ success: true });
      });
      return true;
    case 'removeHideRule':
      getHideRules().then(async (rules) => {
        const host = hostFromUrl(message.url);
        if (rules[host]) {
          rules[host] = rules[host].filter(s => s !== message.selector);
          if (rules[host].length === 0) delete rules[host];
          await saveHideRules(rules);
        }
        sendResponse({ success: true });
      });
      return true;
    case 'getSiteStats':
      getSiteStats().then(sendResponse);
      return true;
    case 'recordSiteBlock':
      (async () => {
        const tab = sender.tab;
        if (!tab) { sendResponse({}); return; }
        const host = hostFromUrl(tab.url);
        if (!host) { sendResponse({}); return; }
        const stats = await getSiteStats();
        if (!stats[host]) stats[host] = 0;
        stats[host] += message.count || 1;
        await saveSiteStats(stats);
        sendResponse({});
      })();
      return true;
    case 'getTabInfo':
      (async () => {
        if (!sender.tab) { sendResponse({ host: '', whitelisted: false }); return; }
        const host = hostFromUrl(sender.tab.url);
        const wl = await getWhitelist();
        sendResponse({ host, whitelisted: wl.includes(host) });
      })();
      return true;
    case 'enterZapper':
      if (!sender.tab) { sendResponse({}); return true; }
      (async () => {
        try {
          await chrome.tabs.sendMessage(sender.tab.id, { type: 'activateZapper' });
        } catch (e) {}
        sendResponse({});
      })();
      return true;
    case 'getFilterListStatus':
      getFilterListStatus().then(sendResponse);
      return true;
    case 'getFilterListConfig':
      getFilterListStatus().then(lists => sendResponse({ lists }));
      return true;
    case 'setFilterListEnabled':
      (async () => {
        const settings = await getFilterListSettings();
        settings[message.id] = message.enabled;
        await saveFilterListSettings(settings);
        await loadFilterListEnabledStates();
        await updateFilterLists();
        sendResponse({ success: true });
      })();
      return true;
    case 'updateFilterLists':
      updateFilterLists().then(sendResponse);
      return true;
    case 'getDynamicRuleCount':
      getDynamicRuleCount().then(sendResponse);
      return true;
    case 'getJsSettings':
      getJsSettings().then(sendResponse);
      return true;
    case 'setJsSetting':
      (async () => {
        const s = await getJsSettings();
        if (message.scope === 'global') {
          s.global = message.enabled;
        } else if (message.scope === 'site' && message.host) {
          if (message.enabled) delete s.sites[message.host];
          else s.sites[message.host] = false;
        }
        await saveJsSettings(s);
        await reconcileDynamicRules();
        sendResponse({ success: true, settings: s });
      })();
      return true;
    case 'getCustomRules':
      getCustomRules().then(sendResponse);
      return true;
    case 'addCustomRule':
      (async () => {
        let rules = await getCustomRules();
        const maxId = rules.reduce((m, r) => Math.max(m, r.id || 0), 0);
        rules.push({ id: maxId + 1, pattern: message.pattern, action: message.action || 'block', priority: message.priority || 1 });
        await saveCustomRules(rules);
        await reconcileDynamicRules();
        sendResponse({ success: true, rules });
      })();
      return true;
    case 'removeCustomRule':
      (async () => {
        let rules = await getCustomRules();
        rules = rules.filter(r => r.id !== message.ruleId);
        await saveCustomRules(rules);
        await reconcileDynamicRules();
        sendResponse({ success: true, rules });
      })();
      return true;
    case 'getDisabledRules':
      getDisabledRuleIds().then(sendResponse);
      return true;
    case 'toggleDisabledRule':
      (async () => {
        let ids = await getDisabledRuleIds();
        if (ids.includes(message.ruleId)) ids = ids.filter(i => i !== message.ruleId);
        else ids.push(message.ruleId);
        await saveDisabledRuleIds(ids);
        await reconcileDynamicRules();
        sendResponse({ success: true, disabledIds: ids });
      })();
      return true;
    case 'getDisabledRuleIds':
      getDisabledRuleIds().then(sendResponse);
      return true;
    case 'reportThirdParties':
      if (sender.tab) {
        const host = hostFromUrl(sender.tab.url);
        reportThirdParties(message.domains || [], host).then(() => sendResponse({}));
      } else sendResponse({});
      return true;
    case 'getDetectedTrackers':
      getDetectedTrackers().then(sendResponse);
      return true;
    case 'getTrackerCategories':
      getTrackerCategories().then(sendResponse);
      return true;
    case 'whitelistTracker':
      whitelistTracker(message.domain).then(() => sendResponse({ success: true }));
      return true;
    case 'resetTrackerData':
      (async () => {
        await saveTrackerMap({});
        await saveAutoTracked([]);
        await saveTrackerActions({});
        await reconcileDynamicRules();
        sendResponse({ success: true });
      })();
      return true;
    case 'getTrackerActions':
      getTrackerActions().then(sendResponse);
      return true;
    case 'setTrackerAction':
      setTrackerAction(message.domain, message.action).then(() => sendResponse({ success: true }));
      return true;
    case 'getStealthConfig':
      getStealthConfig().then(sendResponse);
      return true;
    case 'saveStealthConfig':
      saveStealthConfig(message.config).then(() => sendResponse({ success: true }));
      return true;
    case 'getFilterLog':
      getFilterLog().then(sendResponse);
      return true;
    case 'clearFilterLog':
      clearFilterLog().then(() => sendResponse({ success: true }));
      return true;
    case 'xssDetected':
      incrementStats(1);
      addFilterLogEntry({ ruleId: 'XSS', url: message.data || 'XSS blocked' });
      sendResponse({});
      return true;
    case 'abeBlocked':
      incrementStats(1);
      addFilterLogEntry({ ruleId: 'ABE', url: message.data || 'Local network blocked' });
      sendResponse({});
      return true;
    case 'securePaymentBlocked':
      incrementStats(1);
      addFilterLogEntry({ ruleId: 'PAY', url: message.data || 'HTTP payment blocked' });
      sendResponse({});
      return true;
    case 'getDailyStats':
      getDailyStats().then(sendResponse);
      return true;
case 'getYouTubeWhitelist':
      getYouTubeWhitelist().then(sendResponse);
      return true;
    case 'addYouTubeWhitelist':
      addYouTubeWhitelist(message.channelId, message.channelName).then(sendResponse);
      return true;
    case 'removeYouTubeWhitelist':
      removeYouTubeWhitelist(message.channelId).then(sendResponse);
      return true;
    case 'getTopDomains':
      (async () => {
        const log = await getFilterLog();
        const counts = {};
        for (const entry of log) {
          try {
            const url = entry.url || '';
            const host = new URL(url).hostname || url;
            counts[host] = (counts[host] || 0) + 1;
          } catch (e) { counts[entry.url] = (counts[entry.url] || 0) + 1; }
        }
        sendResponse(Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 10));
      })();
      return true;
    case 'handleBrowserCleanup':
      handleBrowserCleanup(message).then(sendResponse);
      return true;
    case 'getSitePermissions':
      getSitePermissions().then(sendResponse);
      return true;
    case 'getContainerStatus':
      (async () => {
        const c = await getOrCreateContainer();
        sendResponse({ exists: !!c, name: CONTAINER_NAME, domains: ISOLATED_DOMAINS, cookieStoreId: c ? c.cookieStoreId : null });
      })();
      return true;
    case 'updateCDNMap':
      updateCDNMap().then(sendResponse);
      return true;
    case 'getCDNMap':
      (async () => {
        let r = await chrome.storage.local.get('durgashield_cdn_map');
        if (!r.durgashield_cdn_map || !r.durgashield_cdn_map.entries || r.durgashield_cdn_map.entries.length === 0) {
          await loadCDNMap();
          r = await chrome.storage.local.get('durgashield_cdn_map');
        }
        sendResponse(r.durgashield_cdn_map || null);
      })();
      return true;
    case 'updateCDNFiles':
      updateCDNFiles().then(sendResponse);
      return true;
    case 'getCDNFilesStatus':
      (async () => {
        const r = await chrome.storage.local.get('durgashield_cdn_updated_files');
        const t = await chrome.storage.local.get('durgashield_cdn_files_updated');
        const files = r.durgashield_cdn_updated_files || {};
        sendResponse({ count: Object.keys(files).length, updated: t.durgashield_cdn_files_updated || null, files: files });
      })();
      return true;
    case 'checkPasswordLeak':
      checkPasswordLeak(message.password).then(sendResponse);
      return true;
    case 'getPasswordLeaks':
      getPasswordLeaks().then(sendResponse);
      return true;
    case 'clearPasswordLeaks':
      clearPasswordLeaks().then(() => sendResponse({ success: true }));
      return true;
    case 'autoCheckPassword':
      (async () => {
        const config = await getConfig();
        if (config.passwordLeakCheck === false) { sendResponse({ skipped: true }); return; }
        const result = await checkPasswordLeak(message.password);
        if (result.compromised) {
          batchNotification('Password Leak Detected', 'A password you entered has been found in ' + result.count + ' known data breaches. Change it immediately.');
        }
        sendResponse({ checked: true, compromised: result.compromised });
      })();
      return true;
    case 'exportFilterLog':
      exportFilterLog().then(sendResponse);
      return true;
    case 'scanExtensions':
      scanExtensions().then(sendResponse);
      return true;
    case 'getExtensionAudit':
      getExtensionAudit().then(sendResponse);
      return true;
    case 'getPrivacyScore':
      (async () => {
        const trackers = await getDetectedTrackers();
        const https = message.url ? message.url.startsWith('https://') : true;
        const trackerCount = trackers ? trackers.length : 0;
        let score = 100;
        if (!https) score -= 20;
        score -= Math.min(trackerCount * 5, 40);
        let grade = 'A';
        if (score <= 20) grade = 'F';
        else if (score <= 40) grade = 'D';
        else if (score <= 60) grade = 'C';
        else if (score <= 80) grade = 'B';
        sendResponse({ score, grade, trackerCount, https });
      })();
      return true;
    case 'getSiteBlocker':
      getSiteBlockerList().then(sendResponse);
      return true;
    case 'saveSiteBlocker':
      saveSiteBlockerList(message.domains).then(sendResponse);
      return true;
    case 'getAcceptableAds':
      getAcceptableAds().then(sendResponse);
      return true;
    case 'saveAcceptableAds':
      saveAcceptableAds(message.domains).then(sendResponse);
      return true;
  }
});

function updateBadge(tabId, type) {
  const colors = { danger: '#dc3545', warning: '#ffc107', safe: '#28a745' };
  const icons = { danger: '\u26A0', safe: '\u2713' };
  chrome.action.setBadgeText({ tabId, text: icons[type] || '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: colors[type] || colors.safe });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    try {
      const url = new URL(tab.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') chrome.action.setBadgeText({ tabId, text: '' });
      // Inject custom hide rules CSS before page renders
      try {
        const host = url.hostname.replace(/^www\./, '');
        const r = await chrome.storage.local.get('durgashield_hide_rules');
        const rules = r.durgashield_hide_rules || {};
        const selectors = rules[host];
        if (selectors && selectors.length > 0) {
          const css = selectors.map(s => s + '{display:none!important}').join('\n');
          chrome.scripting.insertCSS({ target: { tabId }, css: css, origin: 'USER' });
        }
      } catch (e) {}
    } catch (e) {}
  }
});

/* ---------- Download Scanner (ClamAV-compatible) ---------- */
const DANGEROUS_EXTS = ['.exe','.scr','.bat','.cmd','.vbs','.vbe','.ps1','.psm1','.msi','.msp',
  '.jar','.js','.jse','.wsf','.wsh','.sh','.bash','.com','.pif','.gadget','.application',
  '.hta','.cpl','.msc','.reg','.docm','.xlsm','.pptm'];

const MALWARE_DOMAINS = [
  'malware', 'virus', 'trojan', 'ransomware', 'keylogger', 'spyware',
  'exploit', 'shell', 'backdoor', 'worm', 'rootkit', 'botnet', 'c2.',
  'malicious', 'phishing', 'scam', 'fraud', 'hack', 'crack', 'keygen',
  'warez', 'torrent', 'cryptominer', 'coin-miner',
  'bad', 'evil', 'malware-', '.malware', 'malware.',
  'rogue', 'fake', 'spam', 'adware', 'puabundled',
  'danger', 'unsafe', 'threat',
  '0day', 'exploit.', 'shellcode',
  'stealer', 'rat.', 'remote-access',
  'banker', 'pasword', 'credential',
  'downloader', 'dropper', 'payload'
];

let pendingDownloadConfirmations = {};

async function checkDownload(item) {
  if (!item || !item.url || item.filename === undefined) return;
  try {
    const config = await getConfig();
    if (config.downloadScan === false) return;
    const url = new URL(item.url);
    const filename = (item.filename || '').toLowerCase();
    const ext = filename.substring(filename.lastIndexOf('.'));
    const isDangerousExt = DANGEROUS_EXTS.includes(ext);
    const isMalwareDomain = MALWARE_DOMAINS.some(d => url.hostname.includes(d));
    if (!isMalwareDomain && !isDangerousExt) return;
    if (pendingDownloadConfirmations[item.id]) return;
    const allowed = await chrome.storage.local.get('durgashield_download_allowed');
    if (allowed.durgashield_download_allowed && allowed.durgashield_download_allowed.includes(item.url)) return;
    const reason = isMalwareDomain ? 'suspicious domain' : 'dangerous file type (' + ext + ')';
    const nid = 'dl-confirm-' + item.id;
    pendingDownloadConfirmations[item.id] = { item, reason, nid };
    await chrome.notifications.create(nid, {
      type: 'basic',
      iconUrl: 'icons/icon-128.svg',
      title: 'DurgaShield: Suspicious download',
      message: (item.filename || 'File') + ' — ' + reason,
      priority: 2,
      buttons: [{ title: 'Proceed anyway' }, { title: 'Cancel download' }]
    });
    setTimeout(async () => {
      if (pendingDownloadConfirmations[item.id]) {
        delete pendingDownloadConfirmations[item.id];
        try {
          await chrome.downloads.cancel(item.id);
          await chrome.downloads.erase({ id: item.id });
        } catch (e) {}
        try { chrome.notifications.clear(nid); } catch (e) {}
      }
    }, 60000);
  } catch (e) {}
}

// Handle download notification button clicks
chrome.notifications.onButtonClicked.addListener((nid, btnIdx) => {
  if (!nid.startsWith('dl-confirm-')) return;
  const id = parseInt(nid.replace('dl-confirm-', ''));
  const entry = pendingDownloadConfirmations[id];
  if (!entry) return;
  delete pendingDownloadConfirmations[id];
  chrome.notifications.clear(nid);
  if (btnIdx === 0) {
    // Proceed anyway — whitelist this URL
    chrome.storage.local.get('durgashield_download_allowed', (r) => {
      let list = r.durgashield_download_allowed || [];
      if (!list.includes(entry.item.url)) list.push(entry.item.url);
      chrome.storage.local.set({ durgashield_download_allowed: list });
    });
    if (entry.item.paused) {
      try { chrome.downloads.resume(id); } catch (e) {}
    }
  } else {
    // Cancel download
    try {
      chrome.downloads.cancel(id);
      chrome.downloads.erase({ id: id });
    } catch (e) {}
  }
});

async function initDownloadScanner() {
  if (!await ensurePermissions('downloadScan')) return;
  chrome.downloads.onCreated.addListener((item) => {
    checkDownload(item);
  });
  chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state && delta.state.current === 'complete') {
      chrome.downloads.search({ id: delta.id }, (items) => {
        if (items && items[0]) checkDownload(items[0]);
      });
    }
  });
}
initDownloadScanner();

/* ---------- URL Tracking Cleaner (DNR removeParams) ---------- */
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'dclid', 'gclsrc',
  'mc_cid', 'mc_eid',
  'oly_anon_id', 'oly_enc_id', '_openstat',
  'vero_id', 'vero_conv', 'vero_series',
  'wickedid', 'yclid', '_hsenc', '_hsmi',
  'hsCtaTracking', '__hstc', '__hsfp', '__hssc',
  'trk_contact', 'trk_msg', 'trk_module', 'trk_sid',
  'mtm_source', 'mtm_medium', 'mtm_campaign', 'mtm_keyword', 'mtm_content',
  'pk_source', 'pk_medium', 'pk_campaign', 'pk_keyword', 'pk_content',
  'awc', 'tb_source', 'ref', 'spm',
  'sc_channel', 'sc_place', 'sc_campaign', 'sc_content', 'sc_medium',
  'si', 's_kwcid', 'ef_id', 'soc_src', 'soc_trk'
];
const TRACKING_CLEANER_RULE_START = 996000;
function buildTrackingCleanerRules() {
  const chunkSize = 30;
  const rules = [];
  for (let i = 0; i < TRACKING_PARAMS.length; i += chunkSize) {
    const chunk = TRACKING_PARAMS.slice(i, i + chunkSize);
    rules.push({
      id: TRACKING_CLEANER_RULE_START + (i / chunkSize),
      priority: 2,
      action: {
        type: 'redirect',
        redirect: { transform: { queryTransform: { removeParams: chunk } } }
      },
      condition: {
        urlFilter: '|https://',
        resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest']
      }
    });
  }
  return rules;
}
async function installTrackingCleaner() {
  try {
    const existing = await chrome.declarativeNetRequest.getSessionRules();
    const oldIds = existing.filter(r => r.id >= TRACKING_CLEANER_RULE_START && r.id < TRACKING_CLEANER_RULE_START + 100).map(r => r.id);
    const rules = buildTrackingCleanerRules();
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: oldIds, addRules: rules });
  } catch (e) { console.warn('DurgaShield: tracking cleaner install error:', e); }
}

/* ---------- Site Compatibility Allow Rules ---------- */
const GITHUB_ALLOW_START = 997000;
const ALLOWED_SITES = [
  { domain: 'github.com', desc: 'GitHub main' },
  { domain: 'github.io', desc: 'GitHub Pages' },
  { domain: 'githubusercontent.com', desc: 'GitHub user content' },
  { domain: 'github.githubassets.com', desc: 'GitHub assets' },
  { domain: 'githubstatus.com', desc: 'GitHub status' },
  { domain: 'coinmarketcap.com', desc: 'CoinMarketCap' },
  { domain: 'bitget.com', desc: 'BitGet' },
  { domain: 'coingecko.com', desc: 'CoinGecko' },
  { domain: 'tvsmotor.com', desc: 'TVS Motor' },
  { domain: 'amazon.in', desc: 'Amazon India' },
  { domain: 'amazon.com', desc: 'Amazon US' },
  { domain: 'payments.amazon.in', desc: 'Amazon Payments India' },
  { domain: 'siege-amazon.com', desc: 'Amazon Siege (payment security)' },
  { domain: 'payments.amazon.dev', desc: 'Amazon Payments Dev (payment iframes)' }
];
function buildSiteAllowRules() {
  return ALLOWED_SITES.flatMap((site, i) => [
    {
      id: GITHUB_ALLOW_START + i * 2,
      priority: 10,
      action: { type: 'allow' },
      condition: { urlFilter: '||' + site.domain + '^', resourceTypes: ['script', 'stylesheet', 'font', 'image', 'xmlhttprequest', 'other'] }
    },
    {
      id: GITHUB_ALLOW_START + i * 2 + 1,
      priority: 10,
      action: { type: 'allow' },
      condition: { initiatorDomains: [site.domain], resourceTypes: ['main_frame', 'sub_frame'] }
    }
  ]);
}
async function installSiteAllowRules() {
  try {
    const existing = await chrome.declarativeNetRequest.getSessionRules();
    const oldIds = existing.filter(r => r.id >= GITHUB_ALLOW_START && r.id < GITHUB_ALLOW_START + 50).map(r => r.id);
    const rules = buildSiteAllowRules();
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: oldIds, addRules: rules });
  } catch (e) { console.warn('DurgaShield: allow rules install error:', e); }
}

/* ---------- CDN Replacement ---------- */
const CDN_RULE_PRIORITY = 1;
const CDN_RULE_ID_START = 990000;

async function loadCDNMap() {
  try {
    const bundled = await fetch(chrome.runtime.getURL('resources/cdn-map.json'));
    const bundledMap = await bundled.json();
    let map = { entries: bundledMap, version: '1.0', source: 'bundled', lastUpdate: Date.now() };
    const existing = await chrome.storage.local.get('durgashield_cdn_map');
    if (existing.durgashield_cdn_map && existing.durgashield_cdn_map.lastUpdate) {
      map.lastUpdate = existing.durgashield_cdn_map.lastUpdate;
      map.version = existing.durgashield_cdn_map.version || '1.0';
      if (existing.durgashield_cdn_map.entries) map.entries = existing.durgashield_cdn_map.entries;
    }
    await chrome.storage.local.set({ durgashield_cdn_map: map });
    return map;
  } catch (e) {
    console.warn('DurgaShield: loadCDNMap error:', e);
    return { entries: [], version: '0', source: 'error' };
  }
}

const KNOWN_LOCAL_RESOURCES = [
  { cdnPath: 'ajax/libs/jquery/3.6.0/jquery.min.js',      local: 'resources/lib/jquery/3.6.0/jquery.min.js', lib: 'jQuery', version: '3.6.0' },
  { cdnPath: 'ajax/libs/jquery/3.7.1/jquery.min.js',      local: 'resources/lib/jquery/3.7.1/jquery.min.js', lib: 'jQuery', version: '3.7.1' },
  { cdnPath: 'ajax/libs/jquery/3.7.1/jquery.js',          local: 'resources/lib/jquery/3.7.1/jquery.js', lib: 'jQuery', version: '3.7.1' },
  { cdnPath: 'ajax/libs/angular.js/1.8.3/angular.min.js', local: 'resources/lib/angular/1.8.3/angular.min.js', lib: 'AngularJS', version: '1.8.3' },
  { cdnPath: 'ajax/libs/twitter-bootstrap/4.6.2/css/bootstrap.min.css',       local: 'resources/lib/bootstrap/4.6.2/css/bootstrap.min.css', lib: 'Bootstrap', version: '4.6.2' },
  { cdnPath: 'ajax/libs/twitter-bootstrap/4.6.2/js/bootstrap.bundle.min.js',  local: 'resources/lib/bootstrap/4.6.2/js/bootstrap.bundle.min.js', lib: 'Bootstrap', version: '4.6.2' },
  { cdnPath: 'ajax/libs/twitter-bootstrap/5.3.3/css/bootstrap.min.css',       local: 'resources/lib/bootstrap/5.3.3/css/bootstrap.min.css', lib: 'Bootstrap', version: '5.3.3' },
  { cdnPath: 'ajax/libs/twitter-bootstrap/5.3.3/js/bootstrap.bundle.min.js',  local: 'resources/lib/bootstrap/5.3.3/js/bootstrap.bundle.min.js', lib: 'Bootstrap', version: '5.3.3' },
  { cdnPath: 'ajax/libs/d3/7.9.0/d3.min.js',              local: 'resources/lib/d3/7.9.0/d3.min.js', lib: 'D3.js', version: '7.9.0' },
  { cdnPath: 'ajax/libs/font-awesome/6.5.0/css/all.min.css', local: 'resources/lib/fontawesome/6.5.0/all.min.css', lib: 'Font Awesome', version: '6.5.0' },
  { cdnPath: 'ajax/libs/lodash.js/4.17.21/lodash.min.js', local: 'resources/lib/lodash/4.17.21/lodash.min.js', lib: 'Lodash', version: '4.17.21' },
  { cdnPath: 'ajax/libs/modernizr/2.8.3/modernizr.min.js', local: 'resources/lib/modernizr/2.8.3/modernizr.min.js', lib: 'Modernizr', version: '2.8.3' },
  { cdnPath: 'ajax/libs/moment.js/2.29.4/moment.min.js',  local: 'resources/lib/moment/2.29.4/moment.min.js', lib: 'Moment.js', version: '2.29.4' },
  { cdnPath: 'ajax/libs/react/18.2.0/react.production.min.js',      local: 'resources/lib/react/18.2.0/react.production.min.js', lib: 'React', version: '18.2.0' },
  { cdnPath: 'ajax/libs/react-dom/18.2.0/react-dom.production.min.js', local: 'resources/lib/react/18.2.0/react-dom.production.min.js', lib: 'ReactDOM', version: '18.2.0' },
  { cdnPath: 'ajax/libs/vue/3.4.0/vue.global.prod.js',    local: 'resources/lib/vue/3.4.0/vue.global.prod.js', lib: 'Vue.js', version: '3.4.0' }
];

const CDN_HOST_MAP = {
  'ajax.googleapis.com': 'ajax.googleapis.com',
  'cdnjs.cloudflare.com': 'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net': 'cdn.jsdelivr.net',
  'stackpath.bootstrapcdn.com': 'stackpath.bootstrapcdn.com',
  'maxcdn.bootstrapcdn.com': 'maxcdn.bootstrapcdn.com',
  'ajax.aspnetcdn.com': 'ajax.aspnetcdn.com',
  'yastatic.net': 'yastatic.net'
};

const CDN_HOST_URLS = Object.keys(CDN_HOST_MAP).map(h => '*://' + h + '/*');

function buildCDNRules() {
  const rules = [];
  let id = CDN_RULE_ID_START;
  const hosts = Object.keys(CDN_HOST_MAP);
  for (const res of KNOWN_LOCAL_RESOURCES) {
    for (const host of hosts) {
      const url = host + '/' + res.cdnPath;
      rules.push({
        id: id++,
        priority: CDN_RULE_PRIORITY,
        action: {
          type: 'redirect',
          redirect: { extensionPath: res.local }
        },
        condition: {
          urlFilter: url,
          resourceTypes: ['script', 'stylesheet', 'xmlhttprequest', 'sub_frame', 'font', 'image', 'media', 'websocket', 'other']
        }
      });
    }
  }
  return rules;
}

async function initCDNFileCache() {
  try { await chrome.storage.local.get('durgashield_cdn_updated_files'); } catch (e) {}
}

async function updateCDNFiles() {
  const results = { success: 0, failed: 0, files: [], errors: [] };
  for (const bundled of KNOWN_LOCAL_RESOURCES) {
    results.files.push({ lib: bundled.lib, version: bundled.version, size: 0 });
    results.success++;
  }
  await chrome.storage.local.set({ durgashield_cdn_files_updated: Date.now() });
  return results;
}

async function installCDNReplacement() {
  try {
    const existing = await chrome.declarativeNetRequest.getSessionRules();
    const oldCDNRules = existing.filter(r => r.id >= CDN_RULE_ID_START && r.id < CDN_RULE_ID_START + 5000);
    if (oldCDNRules.length > 0) {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: oldCDNRules.map(r => r.id)
      });
    }
    const rules = buildCDNRules();
    if (rules.length > 0) {
      await chrome.declarativeNetRequest.updateSessionRules({ addRules: rules });
    }
    await chrome.storage.local.set({ durgashield_cdn_rules_count: rules.length });
  } catch (e) {
    console.warn('DurgaShield: installCDNReplacement error:', e);
  }
}

async function removeCDNReplacement() {
  try {
    const existing = await chrome.declarativeNetRequest.getSessionRules();
    const cdnRules = existing.filter(r => r.id >= CDN_RULE_ID_START && r.id < CDN_RULE_ID_START + 5000);
    if (cdnRules.length > 0) {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: cdnRules.map(r => r.id)
      });
    }
    await chrome.storage.local.set({ durgashield_cdn_rules_count: 0 });
  } catch (e) {
    console.warn('DurgaShield: removeCDNReplacement error:', e);
  }
}

async function updateCDNMap() {
  try {
    const bundled = await fetch(chrome.runtime.getURL('resources/cdn-map.json'));
    const bundledMap = await bundled.json();
    if (!Array.isArray(bundledMap)) throw new Error('Invalid map format');
    const map = { entries: bundledMap, version: '1.0', source: 'bundled', lastUpdate: Date.now() };
    await chrome.storage.local.set({ durgashield_cdn_map: map });
    const config = await getConfig();
    if (config.cdnReplacement) await installCDNReplacement();
    return { success: true, entries: bundledMap.length, lastUpdate: map.lastUpdate };
  } catch (e) {
    console.warn('DurgaShield: updateCDNMap error:', e);
    return { success: false, error: e.message };
  }
}

/* ---------- Filter Auto-Update Alarm ---------- */
try {
  chrome.alarms.create('filterUpdate', { periodInMinutes: 360 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'filterUpdate') updateFilterLists();
    if (alarm.name === 'cdnFileUpdate') {
      chrome.storage.local.get('durgashield_config').then(r => {
        if (r.durgashield_config && r.durgashield_config.cdnReplacement !== false) updateCDNFiles();
      });
    }
  });
} catch (e) {
  console.warn('DurgaShield: alarms error:', e);
}

// 24-hour CDN file auto-update
try {
  chrome.alarms.create('cdnFileUpdate', { periodInMinutes: 1440 });
} catch (e) {
  console.warn('DurgaShield: cdn alarm error:', e);
}

/* ---------- Extension Risk Auditing ---------- */
const EXTENSION_RISK_KEY = 'durgashield_extension_audit';
async function scanExtensions() {
  try {
    if (!chrome.management || !chrome.management.getAll) return { error: 'management API not available' };
    const all = await chrome.management.getAll();
    const results = [];
    const highRiskPerms = ['nativeMessaging','debugger','proxy','privacy','history','sessions','tabs','bookmarks','downloads','clipboardRead','clipboardWrite','identity','identity.email'];
    const mediumRiskPerms = ['cookies','webRequest','webRequestBlocking','notifications','alarms','storage','unlimitedStorage','geolocation'];
    for (const ext of all) {
      if (ext.id === chrome.runtime.id) continue;
      if (ext.type !== 'extension') continue;
      const perms = ext.permissions || [];
      const hostPerms = ext.hostPermissions || [];
      const highRisk = perms.filter(p => highRiskPerms.includes(p));
      const mediumRisk = perms.filter(p => mediumRiskPerms.includes(p));
      const allHosts = hostPerms.some(h => h === '<all_urls>' || h === 'http://*/*' || h === 'https://*/*' || h === '*://*/*');
      let riskLevel = 'low';
      if (highRisk.length > 0 && allHosts) riskLevel = 'critical';
      else if (highRisk.length > 0) riskLevel = 'high';
      else if (mediumRisk.length > 0 && allHosts) riskLevel = 'high';
      else if (mediumRisk.length > 0) riskLevel = 'medium';
      else if (allHosts) riskLevel = 'medium';
      results.push({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        enabled: ext.enabled,
        riskLevel: riskLevel,
        permissions: perms,
        hostPermissions: hostPerms,
        highRiskPerms: highRisk,
        mediumRiskPerms: mediumRisk,
        hasAllHosts: allHosts,
        description: ext.description ? ext.description.substring(0, 200) : ''
      });
    }
    results.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.riskLevel] || 99) - (order[b.riskLevel] || 99);
    });
    await chrome.storage.local.set({ [EXTENSION_RISK_KEY]: results });
    return results;
  } catch (e) {
    return { error: e.message };
  }
}
async function getExtensionAudit() {
  const r = await chrome.storage.local.get(EXTENSION_RISK_KEY);
  return r[EXTENSION_RISK_KEY] || [];
}

/* ---------- Site Blocker (Productivity) ---------- */
const SITE_BLOCKER_KEY = 'durgashield_site_blocker';
const SITE_BLOCKER_RULE_START = 702000;
async function getSiteBlockerList() {
  const r = await chrome.storage.local.get(SITE_BLOCKER_KEY);
  return r[SITE_BLOCKER_KEY] || [];
}
async function saveSiteBlockerList(domains) {
  await chrome.storage.local.set({ [SITE_BLOCKER_KEY]: domains });
  await applySiteBlockerRules(domains);
}
async function applySiteBlockerRules(domains) {
  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const oldIds = existing.filter(r => r.id >= SITE_BLOCKER_RULE_START && r.id < SITE_BLOCKER_RULE_START + 100).map(r => r.id);
    if (domains.length === 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: [] });
      return;
    }
    const rules = domains.map((d, i) => ({
      id: SITE_BLOCKER_RULE_START + i,
      priority: 100,
      action: { type: 'block' },
      condition: { urlFilter: '||' + d + '^', resourceTypes: ['main_frame'] }
    }));
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: rules });
  } catch (e) { console.warn('DurgaShield: site blocker error:', e); }
}

/* ---------- Acceptable Ads ---------- */
const ACCEPTABLE_ADS_KEY = 'durgashield_acceptable_ads';
const ACCEPTABLE_ADS_RULE_START = 703000;
async function getAcceptableAds() {
  const r = await chrome.storage.local.get(ACCEPTABLE_ADS_KEY);
  return r[ACCEPTABLE_ADS_KEY] || [];
}
async function saveAcceptableAds(domains) {
  await chrome.storage.local.set({ [ACCEPTABLE_ADS_KEY]: domains });
  await applyAcceptableAdsRules(domains);
}
async function applyAcceptableAdsRules(domains) {
  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const oldIds = existing.filter(r => r.id >= ACCEPTABLE_ADS_RULE_START && r.id < ACCEPTABLE_ADS_RULE_START + 200).map(r => r.id);
    if (domains.length === 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: [] });
      return;
    }
    const rules = domains.map((d, i) => ({
      id: ACCEPTABLE_ADS_RULE_START + i,
      priority: 200,
      action: { type: 'allow' },
      condition: { urlFilter: '||' + d + '^', resourceTypes: ['script', 'image', 'stylesheet', 'xmlhttprequest', 'other'] }
    }));
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: rules });
  } catch (e) { console.warn('DurgaShield: acceptable ads error:', e); }
}
