const _b = typeof browser !== 'undefined' ? browser : chrome;
const MSG = {
  GET_CONFIG: 'getConfig',
  SAVE_CONFIG: 'saveConfig',
  CONFIG_UPDATED: 'configUpdated',
  STEALTH_UPDATED: 'stealthUpdated',
  COSMETIC_FILTERS: 'cosmeticFilters',
  GET_STATS: 'getStats',
  BLOCK_COUNT: 'blockCount',
  MALWARE_DETECTED: 'malwareDetected',
  GET_CONTAINER_INFO: 'getContainerInfo',
  CHECK_CONTAINER_TAB: 'checkContainerTab',
  GET_WHITELIST: 'getWhitelist',
  ADD_WHITELIST: 'addWhitelist',
  REMOVE_WHITELIST: 'removeWhitelist',
  IS_WHITELISTED: 'isWhitelisted',
  GET_HIDE_RULES: 'getHideRules',
  ADD_HIDE_RULE: 'addHideRule',
  REMOVE_HIDE_RULE: 'removeHideRule',
  GET_SITE_STATS: 'getSiteStats',
  RECORD_SITE_BLOCK: 'recordSiteBlock',
  GET_TAB_INFO: 'getTabInfo',
  ENTER_ZAPPER: 'enterZapper',
  ACTIVATE_ZAPPER: 'activateZapper',
  GET_FILTER_LIST_STATUS: 'getFilterListStatus',
  GET_FILTER_LIST_CONFIG: 'getFilterListConfig',
  SET_FILTER_LIST_ENABLED: 'setFilterListEnabled',
  UPDATE_FILTER_LISTS: 'updateFilterLists',
  GET_DYNAMIC_RULE_COUNT: 'getDynamicRuleCount',
  GET_JS_SETTINGS: 'getJsSettings',
  SET_JS_SETTING: 'setJsSetting',
  GET_CUSTOM_RULES: 'getCustomRules',
  ADD_CUSTOM_RULE: 'addCustomRule',
  REMOVE_CUSTOM_RULE: 'removeCustomRule',
  GET_DISABLED_RULES: 'getDisabledRules',
  TOGGLE_DISABLED_RULE: 'toggleDisabledRule',
  GET_DISABLED_RULE_IDS: 'getDisabledRuleIds',
  REPORT_THIRD_PARTIES: 'reportThirdParties',
  GET_DETECTED_TRACKERS: 'getDetectedTrackers',
  GET_TRACKERS_FOR_HOST: 'getTrackersForHost',
  GET_TRACKER_CATEGORIES: 'getTrackerCategories',
  WHITELIST_TRACKER: 'whitelistTracker',
  RESET_TRACKER_DATA: 'resetTrackerData',
  GET_TRACKER_ACTIONS: 'getTrackerActions',
  SET_TRACKER_ACTION: 'setTrackerAction',
  GET_STEALTH_CONFIG: 'getStealthConfig',
  SAVE_STEALTH_CONFIG: 'saveStealthConfig',
  GET_FILTER_LOG: 'getFilterLog',
  CLEAR_FILTER_LOG: 'clearFilterLog',
  XSS_DETECTED: 'xssDetected',
  ABE_BLOCKED: 'abeBlocked',
  SECURE_PAYMENT_BLOCKED: 'securePaymentBlocked',
  GET_DAILY_STATS: 'getDailyStats',
  GET_YOUTUBE_WHITELIST: 'getYouTubeWhitelist',
  ADD_YOUTUBE_WHITELIST: 'addYouTubeWhitelist',
  REMOVE_YOUTUBE_WHITELIST: 'removeYouTubeWhitelist',
  GET_TOP_DOMAINS: 'getTopDomains',
  HANDLE_BROWSER_CLEANUP: 'handleBrowserCleanup',
  GET_SITE_PERMISSIONS: 'getSitePermissions',
  GET_CONTAINER_STATUS: 'getContainerStatus',
  UPDATE_CDN_MAP: 'updateCDNMap',
  GET_CDN_MAP: 'getCDNMap',
  UPDATE_CDN_FILES: 'updateCDNFiles',
  GET_CDN_FILES_STATUS: 'getCDNFilesStatus',
  CHECK_PASSWORD_LEAK: 'checkPasswordLeak',
  GET_PASSWORD_LEAKS: 'getPasswordLeaks',
  CLEAR_PASSWORD_LEAKS: 'clearPasswordLeaks',
  AUTO_CHECK_PASSWORD: 'autoCheckPassword',
  EXPORT_FILTER_LOG: 'exportFilterLog',
  GET_LOG_COUNT: 'getLogCount',
  GET_FILTER_LOG_RANGE: 'getFilterLogRange',
  SCAN_EXTENSIONS: 'scanExtensions',
  GET_EXTENSION_AUDIT: 'getExtensionAudit',
  GET_PRIVACY_SCORE: 'getPrivacyScore',
  GET_SITE_BLOCKER: 'getSiteBlocker',
  SAVE_SITE_BLOCKER: 'saveSiteBlocker',
  GET_ACCEPTABLE_ADS: 'getAcceptableAds',
  SAVE_ACCEPTABLE_ADS: 'saveAcceptableAds',
  GET_SITE_PREFS: 'getSitePrefs',
  SET_SITE_PREFS: 'setSitePrefs',
  GET_PERF_MODE: 'getPerfMode',
  SET_PERF_MODE: 'setPerfMode',
  SET_ENABLED: 'setEnabled'
};
const STORAGE_KEY = 'durgashield_config';
const STATS_KEY = 'durgashield_stats';
const WHITELIST_KEY = 'durgashield_whitelist';
const HIDE_RULES_KEY = 'durgashield_hide_rules';
const SITE_STATS_KEY = 'durgashield_site_stats';
const STEALTH_KEY = 'durgashield_stealth';
const FILTER_LOG_KEY = 'durgashield_filter_log';
const YT_WHITELIST_KEY = 'durgashield_youtube_whitelist';
const SITE_PREFS_KEY = 'durgashield_site_prefs';

const PERMISSIONS_KEY = 'durgashield_site_permissions';

const OPTIONAL_FEATURE_PERMS = {
  downloadScan: ['downloads']
};

async function ensurePermissions(feature) {
  const perms = OPTIONAL_FEATURE_PERMS[feature];
  if (!perms) return true;
  const already = await _b.permissions.contains({ permissions: perms });
  if (already) return true;
  const granted = await _b.permissions.request({ permissions: perms });
  if (!granted) {
    const config = await getConfig();
    config[feature] = false;
    await saveConfig(config);
  }
  return granted;
}

const DEFAULT_CONFIG = {
  ads: true, malware: true, crypto: true, phishing: true,
  popupBlocking: true, containerIsolation: true, cdn: true, stealth: true,
  neverConsent: true, enhancedTracking: true, xssProtection: true, clearClick: true, abe: true, securePayment: true,
  downloadScan: true, social: true, annoyance: true, cdnReplacement: true,
  metadataCleanup: false, searchAnnotations: true, videoRedirect: true, httpsEnforce: true, passwordLeakCheck: true,
  'cc-adult': true, 'cc-gambling': true, 'cc-violence': true,
  aiDlp: true, defacementDetect: true, phoneScamDetect: true,
  phishingLinkDetect: true, fbPrivacy: true,
  perfMode: 'balanced' // lite | balanced | aggressive
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

/* ---------- Rule Priority Tiers ---------- */
const PRIORITY = {
  CRITICAL: 1000,
  MALWARE: 500,
  PHISHING: 400,
  PRIVACY: 200,
  ADS: 100,
  COSMETIC: 50,
  DEFAULT: 10
};

/* ---------- ID Ranges ---------- */
const HEADER_RULE_START = 600000;
const AUTO_TRACKER_START = 620000;
const COOKIE_BLOCK_START = 640000;
const FILTER_STORAGE_KEY = 'durgashield_filter_rules';
const UPDATE_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
/* ---------- Platform check (Chrome vs Firefox) ---------- */
const _hasContainers = typeof _b.contextualIdentities !== 'undefined';
const _maxDynamicRules = typeof _b.declarativeNetRequest !== 'undefined' &&
  _b.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES
  ? _b.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES : 5000;

const DYNAMIC_RULE_LIMIT = _maxDynamicRules;

async function applyDynamicRules(rules) {
  try {
    const capped = prioritizeRules(rules, DYNAMIC_RULE_LIMIT);
    if (capped.length < rules.length) {
      console.warn(`DurgaShield: rule cap hit (${rules.length} > ${DYNAMIC_RULE_LIMIT}), dropped ${rules.length - capped.length} low-priority rules`);
    }
    const oldRules = await _b.declarativeNetRequest.getDynamicRules();
    const oldIds = new Set(oldRules.map(r => r.id));
    const newIds = new Set(capped.map(r => r.id));
    if (oldIds.size === newIds.size && [...oldIds].every(id => newIds.has(id))) {
      return;
    }
    await _b.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [...oldIds],
      addRules: capped
    });
  } catch (e) {
    console.warn('DurgaShield: applyDynamicRules error:', e);
  }
}

function prioritizeRules(rules, limit) {
  // Sort by priority descending, then by ID ascending for stability
  const sorted = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.id || 0) - (b.id || 0));
  if (sorted.length <= limit) return sorted;
  return sorted.slice(0, limit);
}



/* ---------- JS Blocking (per-site & global) ---------- */
const JS_SETTINGS_KEY = 'durgashield_js_settings';
const CUSTOM_RULES_KEY = 'durgashield_custom_rules';
const DISABLED_RULES_KEY = 'durgashield_disabled_rules';
const JS_RULE_START = 700000;
const JS_RULE_MAX = 1800;
const CUSTOM_RULE_START = 800000;

async function getJsSettings() {
  const r = await _b.storage.local.get(JS_SETTINGS_KEY);
  return r[JS_SETTINGS_KEY] || { global: true, sites: {} };
}
async function saveJsSettings(s) {
  await _b.storage.local.set({ [JS_SETTINGS_KEY]: s });
}
async function getCustomRules() {
  const r = await _b.storage.local.get(CUSTOM_RULES_KEY);
  return r[CUSTOM_RULES_KEY] || [];
}
async function saveCustomRules(rules) {
  await _b.storage.local.set({ [CUSTOM_RULES_KEY]: rules });
}
async function getDisabledRuleIds() {
  const r = await _b.storage.local.get(DISABLED_RULES_KEY);
  return r[DISABLED_RULES_KEY] || [];
}
async function saveDisabledRuleIds(ids) {
  await _b.storage.local.set({ [DISABLED_RULES_KEY]: ids });
}

function buildJsBlockingRules(settings) {
  const rules = [];
  let id = JS_RULE_START;
  const g = settings.global !== false;
  const maxSiteRules = JS_RULE_MAX;

  if (!g) {
    rules.push({
      id: id++, priority: PRIORITY.DEFAULT, action: { type: 'block' },
      condition: { urlFilter: 'http', resourceTypes: ['script'] }
    });
    let siteCount = 0;
    for (const [host, enabled] of Object.entries(settings.sites)) {
      if (siteCount >= maxSiteRules) break;
      if (enabled) {
        rules.push({
          id: id++, priority: PRIORITY.DEFAULT + 1, action: { type: 'allow' },
          condition: { initiatorDomains: [host], resourceTypes: ['script'] }
        });
        siteCount++;
      }
    }
  } else {
    let siteCount = 0;
    for (const [host, enabled] of Object.entries(settings.sites)) {
      if (siteCount >= maxSiteRules) break;
      if (!enabled) {
        rules.push({
          id: id++, priority: PRIORITY.DEFAULT, action: { type: 'block' },
          condition: { initiatorDomains: [host], resourceTypes: ['script'] }
        });
        siteCount++;
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

async function applySessionRules() {
  try {
    const safeRules = buildGoogleSafeRules();
    const existing = await _b.declarativeNetRequest.getDynamicRules();
    const oldSafeIds = existing.filter(r => r.id >= GOOGLE_SAFE_START && r.id < GOOGLE_SAFE_START + 200).map(r => r.id);
    await _b.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldSafeIds,
      addRules: safeRules
    });
  } catch (e) {
    console.warn('DurgaShield: applySessionRules error:', e);
  }
}

let _reconcileTimer = 0;
let _reconcilePromise = null;

async function reconcileDynamicRules() {
  // Debounce: cancel pending reconciliation on rapid toggles
  if (_reconcileTimer) clearTimeout(_reconcileTimer);
  if (!_reconcilePromise) {
    _reconcilePromise = new Promise(resolve => {
      _reconcileTimer = setTimeout(async () => {
        _reconcileTimer = 0;
        try {
          const jsSettings = await getJsSettings();
          const customRules = await getCustomRules();
          const disabledIds = await getDisabledRuleIds();
          const disabledSet = new Set(disabledIds);
          const config = await getConfig();
          const perfMode = config.perfMode || 'balanced';

          const all = [];

          // Privacy header rules – respect enhancedTracking feature flag
          if (config.enhancedTracking !== false) {
            const headerRules = buildPrivacyHeaderRules();
            all.push(...headerRules);
          }

          // JS blocking rules – always applied
          const jsRules = buildJsBlockingRules(jsSettings);
          all.push(...jsRules);

          // Auto-tracker & cookie blocking – respect enhancedTracking + perfMode
          if (config.enhancedTracking !== false) {
            const autoTracked = await getAutoTracked();
            const actions = await getTrackerActions();
            const cookieBlockDomains = [];
            let maxTrackerRules = 5000;
            if (perfMode === 'lite') maxTrackerRules = 500;
            else if (perfMode === 'balanced') maxTrackerRules = 2500;
            const autoTrackerRules = buildAutoTrackerRules(autoTracked, actions, cookieBlockDomains, maxTrackerRules);
            for (const [domain, action] of Object.entries(actions)) {
              if (action === 'cookie-block' && !autoTracked.includes(domain) && !cookieBlockDomains.includes(domain)) {
                cookieBlockDomains.push(domain);
              }
            }
            const cookieBlockRules = buildCookieBlockRules(cookieBlockDomains);
            all.push(...autoTrackerRules);
            all.push(...cookieBlockRules);
          }

          // Content control (adult/gambling/violence)
          if (config['cc-adult'] || config['cc-gambling'] || config['cc-violence']) {
            const contentControlRules = buildContentControlRules(config);
            all.push(...contentControlRules);
          }

          // Custom DNR rules
          const customDnrRules = customRules.map(r => ({
            id: CUSTOM_RULE_START + r.id, priority: r.priority || 100,
            action: { type: r.action || 'block' },
            condition: { urlFilter: r.pattern, ...(r.resourceTypes ? { resourceTypes: r.resourceTypes.split(',') } : {}) }
          }));
          all.push(...customDnrRules);

          const finalRules = all.filter(r => !disabledSet.has(r.id));
          await applyDynamicRules(finalRules);
          await applySessionRules();
        } finally {
          _reconcilePromise = null;
          resolve();
        }
      }, 100);
    });
  }
  return _reconcilePromise;
}

// Register reconcile callback with filter engine module
setReconcileCallback(reconcileDynamicRules);

async function getConfig() {
  const r = await _b.storage.local.get(STORAGE_KEY);
  return r[STORAGE_KEY] || { ...DEFAULT_CONFIG };
}
async function saveConfig(config) {
  await _b.storage.local.set({ [STORAGE_KEY]: config });
}
async function getStats() {
  const r = await _b.storage.local.get(STATS_KEY);
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
  await _b.storage.local.set({ [STATS_KEY]: stats });
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
  const r = await _b.storage.local.get(WHITELIST_KEY);
  return r[WHITELIST_KEY] || [];
}
async function saveWhitelist(list) {
  await _b.storage.local.set({ [WHITELIST_KEY]: list });
}
async function getHideRules() {
  const r = await _b.storage.local.get(HIDE_RULES_KEY);
  return r[HIDE_RULES_KEY] || {};
}
async function saveHideRules(rules) {
  await _b.storage.local.set({ [HIDE_RULES_KEY]: rules });
}
async function getSiteStats() {
  const r = await _b.storage.local.get(SITE_STATS_KEY);
  return r[SITE_STATS_KEY] || {};
}
async function saveSiteStats(stats) {
  await _b.storage.local.set({ [SITE_STATS_KEY]: stats });
}

async function getYouTubeWhitelist() {
  const r = await _b.storage.local.get(YT_WHITELIST_KEY);
  return r[YT_WHITELIST_KEY] || [];
}

async function addYouTubeWhitelist(channelId, channelName) {
  const list = await getYouTubeWhitelist();
  if (!list.find(c => c.id === channelId)) {
    list.push({ id: channelId, name: channelName });
    await _b.storage.local.set({ [YT_WHITELIST_KEY]: list });
  }
  return list;
}

async function removeYouTubeWhitelist(channelId) {
  const list = await getYouTubeWhitelist();
  const filtered = list.filter(c => c.id !== channelId);
  await _b.storage.local.set({ [YT_WHITELIST_KEY]: filtered });
  return filtered;
}

const GPC_RULE_ID = 999000;
const DNT_RULE_ID = 999001;
const XFO_RULE_ID = 999002;
const XCTO_RULE_ID = 999003;
const RP_RULE_ID = 999004;
const PP_RULE_ID = 999005;
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
  const DOMAIN_CAP = 200;
  let count = 0;
  for (const [key, domains] of Object.entries(CC_DOMAINS)) {
    if (config[key] !== true) continue;
    for (const domain of domains) {
      if (count >= DOMAIN_CAP) break;
      rules.push({
        id: id++, priority: 5,
        action: { type: 'block' },
        condition: { urlFilter: '||' + domain + '^', resourceTypes: ['main_frame','sub_frame','script','image','stylesheet','font','media','xmlhttprequest','other'] }
      });
      count++;
    }
    if (count >= DOMAIN_CAP) break;
  }
  return rules;
}

function buildPrivacyHeaderRules() {
  const rules = [];
  let id = HEADER_RULE_START;
  const headerSites = [
    'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com',
    'instagram.com', 'linkedin.com', 'reddit.com', 'amazon.com',
    'stackoverflow.com', 'github.com', 'gitlab.com', 'bitbucket.org'
  ];
  for (const site of headerSites) {
    rules.push({
      id: id++, priority: 30,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'x-forwarded-for', operation: 'remove' },
          { header: 'via', operation: 'remove' }
        ]
      },
      condition: {
        urlFilter: '||' + site + '^',
        resourceTypes: ['main_frame', 'xmlhttprequest']
      }
    });
    rules.push({
      id: id++, priority: 30,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'server', operation: 'remove' },
          { header: 'x-powered-by', operation: 'remove' }
        ]
      },
      condition: {
        urlFilter: '||' + site + '^',
        resourceTypes: ['main_frame', 'xmlhttprequest']
      }
    });
  }
  return rules;
}

function buildAutoTrackerRules(autoTracked, actions, cookieBlockDomains, maxRules) {
  const rules = [];
  let id = AUTO_TRACKER_START;
  const limit = maxRules || 5000;
  for (const domain of autoTracked) {
    const action = actions[domain] || 'block';
    if (action === 'cookie-block') {
      if (!cookieBlockDomains.includes(domain)) cookieBlockDomains.push(domain);
      continue;
    }
    if (action === 'block') {
      if (rules.length >= limit) break;
      rules.push({
        id: id++, priority: PRIORITY.PRIVACY,
        action: { type: 'block' },
        condition: {
          urlFilter: '||' + domain + '^',
          resourceTypes: ['script', 'xmlhttprequest', 'image', 'media', 'font', 'other']
        }
      });
    }
  }
  return rules;
}

function buildCookieBlockRules(domains) {
  const rules = [];
  let id = COOKIE_BLOCK_START;
  for (const domain of domains) {
    if (rules.length >= 1000) break;
    rules.push({
      id: id++, priority: 25,
      action: { type: 'block' },
      condition: {
        urlFilter: '||' + domain + '^',
        resourceTypes: ['script', 'xmlhttprequest', 'image', 'other']
      }
    });
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
    await _b.browsingData.remove({ since }, options);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/* ---------- Site Permissions Monitor ---------- */
async function getSitePermissions() {
  const r = await _b.storage.local.get(PERMISSIONS_KEY);
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
  await _b.storage.local.set({ [PERMISSIONS_KEY]: list });
}

async function cookieSelfDestruct() {
  const config = await getConfig();
  if (!config.stealth) return;
  const stealth = await getStealthConfig();
  if (!stealth.selfDestructCookies) return;
  const whitelist = await getWhitelist();
  try {
    const cookies = await _b.cookies.getAll({});
    for (const c of cookies) {
      if (whitelist.some(w => c.domain.includes(w))) continue;
      if (c.session) continue;
      const age = Date.now() - (c.lastAccessDate ? new Date(c.lastAccessDate).getTime() : Date.now());
      if (age > 3600000) {
        await _b.cookies.remove({
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
    const existing = await _b.declarativeNetRequest.getDynamicRules();
    const oldIds = existing.filter(r => r.id >= HTTPS_ENFORCE_START && r.id < HTTPS_ENFORCE_START + 1000).map(r => r.id);
    await _b.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldIds,
      addRules: httpsEnforceRules
    });
  } catch (e) { console.warn('HTTPS enforce install failed', e); }
}
async function removeHTTPSEnforcement() {
  try {
    const oldIds = Array.from({ length: HTTPS_ENFORCE_LIST.length }, (_, i) => HTTPS_ENFORCE_START + i);
    await _b.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: [] });
  } catch (e) {}
}

/* ---------- Password Leak Detection ---------- */
const PASSWORD_LEAK_KEY = 'durgashield_password_leaks';
async function checkPasswordLeak(hashHex) {
  try {
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
        await _b.storage.local.set({ [PASSWORD_LEAK_KEY]: leaks });
        return { compromised: true, count: parseInt(count) };
      }
    }
    return { compromised: false, count: 0 };
  } catch (e) { return { compromised: false, error: e.message }; }
}
async function getPasswordLeaks() {
  const r = await _b.storage.local.get(PASSWORD_LEAK_KEY);
  return r[PASSWORD_LEAK_KEY] || [];
}
async function clearPasswordLeaks() {
  await _b.storage.local.set({ [PASSWORD_LEAK_KEY]: [] });
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
    await _b.notifications.create('batch-' + Date.now(), {
      type: 'basic', iconUrl: 'icons/icon-128.svg',
      title: latest.title, message: latest.message, priority: 1
    });
  } else {
    await _b.notifications.create('batch-' + Date.now(), {
      type: 'basic', iconUrl: 'icons/icon-128.svg',
      title: 'DurgaShield (' + count + ' notifications)',
      message: count + ' events since last notification: ' + latest.title,
      priority: 1
    });
  }
}

/* ---------- Smart Rule Pruning ---------- */
const RULE_USAGE_KEY = 'durgashield_rule_usage';
const PRUNE_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getRuleUsage() {
  const r = await _b.storage.local.get(RULE_USAGE_KEY);
  return r[RULE_USAGE_KEY] || {};
}
async function saveRuleUsage(usage) {
  await _b.storage.local.set({ [RULE_USAGE_KEY]: usage });
}

async function recordRuleHit(ruleId) {
  const usage = await getRuleUsage();
  usage[ruleId] = (usage[ruleId] || 0) + 1;
  await saveRuleUsage(usage);
}

async function pruneUnusedRules() {
  const now = Date.now();
  const meta = await getFilterMeta();
  const lastPrune = meta.lastPrune || 0;
  if (now - lastPrune < PRUNE_INTERVAL) return;
  meta.lastPrune = now;
  await saveFilterMeta(meta);
  // DNR rules are generated dynamically from the compiled index.
  // Pruning individual DNR rule IDs is no longer applicable since
  // rules are regenerated on each reconcile. Future optimization:
  // remove unused patterns from the compiled index based on usage stats.
}

/* ---------- Filtering Log ---------- */
async function getFilterLog() {
  return getLogsIDB(2000, 0);
}
async function clearFilterLog() {
  await clearLogsIDB();
}
async function cleanFilterLog() {
  const log = await getFilterLog();
  const cleaned = log.filter(e => { try { new URL(e.url || ''); return true; } catch { return false; } });
  if (cleaned.length !== log.length) {
    await clearLogsIDB();
    for (const entry of cleaned) await addLogEntryIDB(entry);
  }
}
async function exportFilterLog() {
  return exportLogsIDB();
}
async function addFilterLogEntry(entry) {
  let url = entry.url || '';
  try { new URL(url); } catch { url = ''; }
  if (!url) return;
  entry = { ...entry, url, ts: Date.now() };
  await addLogEntryIDB(entry);
}
async function clearFilterLog() {
  await _b.storage.local.set({ [FILTER_LOG_KEY]: [] });
}
async function cleanFilterLog() {
  const log = await getFilterLog();
  const cleaned = log.filter(e => { try { new URL(e.url || ''); return true; } catch { return false; } });
  if (cleaned.length !== log.length) await _b.storage.local.set({ [FILTER_LOG_KEY]: cleaned });
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

/* ---------- IndexedDB Log Store ---------- */
const DB_NAME = 'DurgaShieldLogs';
const DB_VERSION = 1;
const STORE_NAME = 'filterLog';

function openLogDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('ts', 'ts', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.warn('DurgaShield: IndexedDB unavailable, falling back to storage.local');
      resolve(null);
    };
  });
}

async function addLogEntryIDB(entry) {
  const db = await openLogDB();
  if (!db) {
    let log = (await _b.storage.local.get(FILTER_LOG_KEY))[FILTER_LOG_KEY] || [];
    log.unshift(entry);
    if (log.length > 200) log = log.slice(0, 200);
    await _b.storage.local.set({ [FILTER_LOG_KEY]: log });
    return;
  }
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.add({ url: entry.url || '', ruleId: entry.ruleId || '', ts: Date.now() });
  const countReq = store.count();
  countReq.onsuccess = () => {
    if (countReq.result > 2000) {
      const cursorReq = store.openCursor();
      let deleted = 0;
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && deleted < countReq.result - 2000) {
          store.delete(cursor.primaryKey);
          deleted++;
          cursor.continue();
        }
      };
    }
  };
  return new Promise(resolve => { tx.oncomplete = () => resolve(); });
}

async function getLogsIDB(limit, offset) {
  const db = await openLogDB();
  if (!db) return (await getFilterLog()).slice(0, limit);
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.index('ts').openCursor(null, 'prev');
    const results = [];
    let skipped = 0;
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || results.length >= limit) { resolve(results); return; }
      if (skipped < offset) { skipped++; cursor.continue(); return; }
      results.push({ url: cursor.value.url, ruleId: cursor.value.ruleId, ts: cursor.value.ts });
      cursor.continue();
    };
  });
}

async function getLogCountIDB() {
  const db = await openLogDB();
  if (!db) return (await getFilterLog()).length;
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
  });
}

async function getTopDomainsIDB(limit) {
  const db = await openLogDB();
  if (!db) {
    const log = await getFilterLog();
    return computeTopDomains(log, limit);
  }
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(computeTopDomains(req.result, limit));
  });
}

function computeTopDomains(entries, limit) {
  const counts = {};
  for (const entry of entries) {
    try { const host = new URL(entry.url || '').hostname || entry.url; counts[host] = (counts[host] || 0) + 1; }
    catch { counts[entry.url] = (counts[entry.url] || 0) + 1; }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit || 10);
}

async function clearLogsIDB() {
  const db = await openLogDB();
  if (!db) { clearFilterLog(); return; }
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
  });
}

async function exportLogsIDB() {
  const db = await openLogDB();
  if (!db) return exportFilterLog();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const header = 'Timestamp,RuleID,URL';
      const rows = (req.result || []).map(e => {
        const ts = e.ts ? new Date(e.ts).toISOString() : '';
        const url = (e.url || '').replace(/"/g, '""');
        return `"${ts}","${e.ruleId || ''}","${url}"`;
      });
      resolve(header + '\n' + rows.join('\n'));
    };
  });
}

async function migrateLogsToIDB() {
  const db = await openLogDB();
  if (!db) return;
  try {
    const r = await _b.storage.local.get(FILTER_LOG_KEY);
    const oldLogs = r[FILTER_LOG_KEY] || [];
    if (oldLogs.length === 0) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const entry of oldLogs) {
      store.add({ url: entry.url || '', ruleId: entry.ruleId || '', ts: entry.ts || Date.now() });
    }
    await new Promise(resolve => { tx.oncomplete = () => resolve(); });
    await _b.storage.local.remove(FILTER_LOG_KEY);
    console.log(`DurgaShield: migrated ${oldLogs.length} log entries to IndexedDB`);
  } catch (e) { console.warn('DurgaShield: log migration error:', e); }
}

async function pollMatchedRules() {
  try {
    const result = await _b.declarativeNetRequest.getMatchedRules();
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
/* ---------- Scheduled background tasks via alarms ---------- */
// pollMatchedRules moved to alarm (reduces polling rate, survives SW restart)
// cookieSelfDestruct moved to alarm
// See alarm listener in the alarm setup section below

async function setRuleSetEnabled(id, enabled) {
  const o = { enableRulesetIds: [], disableRulesetIds: [] };
  (enabled ? o.enableRulesetIds : o.disableRulesetIds).push(id);
  await _b.declarativeNetRequest.updateEnabledRulesets(o);
}

async function getOrCreateContainer() {
  if (!_hasContainers) return null;
  if (containerIdentity) return containerIdentity;
  try {
    const ids = await _b.contextualIdentities.query({ name: CONTAINER_NAME });
    containerIdentity = ids[0] || await _b.contextualIdentities.create({
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
  if (!_hasContainers) return;
  try {
    if (!containerIdentity) return;
    const storeId = containerIdentity.cookieStoreId;
    for (const domain of ISOLATED_DOMAINS) {
      const cookies = await _b.cookies.getAll({ domain });
      for (const cookie of cookies) {
        if (cookie.storeId !== storeId) {
          await _b.cookies.remove({
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
  if (!_hasContainers) return;
  if (details.frameId !== 0) return;
  if (!details.url || !details.url.startsWith('http')) return;
  const config = await getConfig();
  if (!config.containerIsolation) return;
  const container = await getOrCreateContainer();
  if (!container) return;
  try {
    const tab = await _b.tabs.get(details.tabId);
    if (!tab || !tab.url) return;
    const inContainer = tab.cookieStoreId === container.cookieStoreId;
    const toIsolated = isIsolatedUrl(details.url);
    if ((inContainer && toIsolated) || (!inContainer && !toIsolated)) return;
    // Show a notification suggesting the user switch containers rather than destroying the tab
    const siteName = new URL(details.url).hostname;
    const nid = 'container-hint-' + details.tabId;
    await _b.notifications.create(nid, {
      type: 'basic', iconUrl: 'icons/icon-128.svg',
      title: 'Container suggestion',
      message: siteName + ' is better suited for a different container. Open the extension popup to switch.',
      priority: 1
    });
  } catch (e) {}
}

_b.runtime.onInstalled.addListener(async () => {
  const config = await getConfig();
  for (const [key, enabled] of Object.entries(config)) {
    if (['ads', 'malware', 'crypto', 'phishing', 'cdn', 'social', 'annoyance'].includes(key)) await setRuleSetEnabled(key, enabled);
  }
  if (config.containerIsolation && _hasContainers) { await getOrCreateContainer(); await cleanupForeignCookies(); }
  const installedIndex = await restoreFilterRules();
  if (installedIndex) initRequestHandler(installedIndex);
  await loadCDNMap();
  await initCDNFileCache();
  if (config.cdnReplacement) installCDNReplacement();
  if (config.httpsEnforce) installHTTPSEnforcement();
  await installSiteAllowRules();
  await installTrackingCleaner();
  await cleanFilterLog();
  migrateLogsToIDB(); // fire & forget
  // Deferred regional filter loading
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => loadRegionalFilters().catch(() => {}), { timeout: 30000 });
  } else {
    setTimeout(() => loadRegionalFilters().catch(() => {}), 30000);
  }
});

_b.runtime.onStartup.addListener(async () => {
  const config = await getConfig();
  for (const [key, enabled] of Object.entries(config)) {
    if (['ads', 'malware', 'crypto', 'phishing', 'cdn', 'social', 'annoyance'].includes(key)) await setRuleSetEnabled(key, enabled);
  }
  if (config.containerIsolation && _hasContainers) { await getOrCreateContainer(); await cleanupForeignCookies(); }
  const startupIndex = await restoreFilterRules();
  if (startupIndex) initRequestHandler(startupIndex);
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
    if (meta.lastUpdate && (Date.now() - meta.lastUpdate) >= UPDATE_INTERVAL) {
      updateFilterLists().then(result => {
        if (result && result.compiled) setCompiledIndex(result.compiled, result.overflowPatterns);
      });
    }
  });
}, 3600000);

let webNavigationRegistered = false;

async function ensureWebNavigation() {
  if (webNavigationRegistered) return true;
  const ok = await _b.permissions.contains({ permissions: ['webNavigation'] });
  if (!ok) return false;
  _b.webNavigation.onBeforeNavigate.addListener(handleContainerNavigation);
  webNavigationRegistered = true;
  return true;
}

ensureWebNavigation();

function hostFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

_b.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== _b.runtime.id) return;
  switch (message.type) {
    case MSG.GET_CONFIG:
      getConfig().then(sendResponse);
      return true;
    case MSG.SAVE_CONFIG:
      saveConfig(message.config).then(async () => {
        for (const [key, enabled] of Object.entries(message.config)) {
          if (['ads', 'malware', 'crypto', 'phishing', 'cdn', 'social', 'annoyance'].includes(key)) await setRuleSetEnabled(key, enabled);
        }
        if (message.config.containerIsolation !== undefined) {
          if (message.config.containerIsolation && _hasContainers) {
            await ensureWebNavigation();
            await getOrCreateContainer(); await cleanupForeignCookies();
          }
        }
        if (message.config.cdnReplacement !== undefined) {
          if (message.config.cdnReplacement) installCDNReplacement();
          else removeCDNReplacement();
        }
        if (message.config.downloadScan !== undefined) {
          if (message.config.downloadScan) {
            const granted = await ensurePermissions('downloadScan');
            if (granted) await registerDownloadListeners();
          }
        }
        if (message.config.httpsEnforce !== undefined) {
          if (message.config.httpsEnforce) await installHTTPSEnforcement();
          else await removeHTTPSEnforcement();
        }
        if (message.config.perfMode !== undefined) {
          await reconcileDynamicRules();
        }
        if (['cc-adult','cc-gambling','cc-violence'].some(k => message.config[k] !== undefined)) {
          await reconcileDynamicRules();
        }
        const tabs = await _b.tabs.query({});
        for (const tab of tabs) {
          try { _b.tabs.sendMessage(tab.id, { type: MSG.CONFIG_UPDATED, config: message.config }); } catch (e) {}
        }
        if (message.config.stealth !== undefined) {
          const stealth = await getStealthConfig();
          for (const tab of tabs) {
            try { _b.tabs.sendMessage(tab.id, { type: MSG.STEALTH_UPDATED, config: stealth }); } catch (e) {}
          }
        }
        sendResponse({ success: true });
      });
      return true;
    case MSG.SET_ENABLED:
      (async () => {
        const ruleSets = ['ads', 'malware', 'crypto', 'phishing', 'cdn', 'social', 'annoyance'];
        for (const id of ruleSets) await setRuleSetEnabled(id, message.enabled);
        const tabs = await _b.tabs.query({});
        for (const tab of tabs) {
          try { _b.tabs.sendMessage(tab.id, { type: MSG.SET_ENABLED, enabled: message.enabled }); } catch (e) {}
        }
        sendResponse({ success: true });
      })();
      return true;
    case MSG.GET_STATS:
      pollMatchedRules().then(() => getStats()).then(sendResponse);
      return true;
    case MSG.BLOCK_COUNT:
      incrementStats(message.count || 1).then(() => sendResponse({}));
      return true;
    case MSG.INCREMENT_BLOCKED:
      incrementStats(message.count || 1).then(() => sendResponse({}));
      return true;
    case MSG.MALWARE_DETECTED:
      if (sender.tab) updateBadge(sender.tab.id, 'danger');
      sendResponse({ success: true });
      return true;
    case MSG.GET_CONTAINER_INFO:
      getOrCreateContainer().then(c => sendResponse({
        enabled: true, containerName: CONTAINER_NAME, containerExists: !!c,
        isolatedDomains: ISOLATED_DOMAINS, cookieStoreId: c ? c.cookieStoreId : null
      }));
      return true;
    case MSG.CHECK_CONTAINER_TAB:
      (async () => {
        const tab = sender.tab;
        if (!tab) { sendResponse({ inContainer: false }); return; }
        const c = await getOrCreateContainer();
        sendResponse({ inContainer: c ? tab.cookieStoreId === c.cookieStoreId : false, containerName: CONTAINER_NAME });
      })();
      return true;
    case MSG.GET_WHITELIST:
      getWhitelist().then(sendResponse);
      return true;
    case MSG.ADD_WHITELIST:
      getWhitelist().then(async (list) => {
        const host = hostFromUrl(message.url);
        if (host && !list.includes(host)) { list.push(host); await saveWhitelist(list); }
        sendResponse({ success: true, whitelist: list });
      });
      return true;
    case MSG.REMOVE_WHITELIST:
      getWhitelist().then(async (list) => {
        const host = hostFromUrl(message.url);
        const idx = list.indexOf(host);
        if (idx > -1) { list.splice(idx, 1); await saveWhitelist(list); }
        sendResponse({ success: true, whitelist: list });
      });
      return true;
    case MSG.IS_WHITELISTED:
      getWhitelist().then((list) => {
        const host = hostFromUrl(message.url);
        sendResponse({ whitelisted: list.includes(host) });
      });
      return true;
    case MSG.GET_HIDE_RULES:
      getHideRules().then(sendResponse);
      return true;
    case MSG.ADD_HIDE_RULE:
      getHideRules().then(async (rules) => {
        const host = hostFromUrl(message.url);
        if (!host) { sendResponse({ success: false }); return; }
        if (!rules[host]) rules[host] = [];
        if (!rules[host].includes(message.selector)) rules[host].push(message.selector);
        await saveHideRules(rules);
        sendResponse({ success: true });
      });
      return true;
    case MSG.REMOVE_HIDE_RULE:
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
    case MSG.GET_SITE_STATS:
      getSiteStats().then(sendResponse);
      return true;
    case MSG.RECORD_SITE_BLOCK:
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
    case MSG.GET_TAB_INFO:
      (async () => {
        if (!sender.tab) { sendResponse({ host: '', whitelisted: false }); return; }
        const host = hostFromUrl(sender.tab.url);
        const wl = await getWhitelist();
        sendResponse({ host, whitelisted: wl.includes(host) });
      })();
      return true;
    case MSG.ENTER_ZAPPER:
      if (!sender.tab) { sendResponse({}); return true; }
      (async () => {
        try {
          await _b.tabs.sendMessage(sender.tab.id, { type: MSG.ACTIVATE_ZAPPER });
        } catch (e) {}
        sendResponse({});
      })();
      return true;
    case MSG.GET_FILTER_LIST_STATUS:
      sendResponse([]);
      return false;
    case MSG.GET_FILTER_LIST_CONFIG:
      sendResponse({ lists: [] });
      return false;
    case MSG.SET_FILTER_LIST_ENABLED:
      (async () => {
        const settings = await getFilterListSettings();
        settings[message.id] = message.enabled;
        await saveFilterListSettings(settings);
        await loadFilterListEnabledStates();
        const result = await updateFilterLists();
        if (result && result.compiled) setCompiledIndex(result.compiled, result.overflowPatterns);
        sendResponse({ success: true });
      })();
      return true;
    case MSG.UPDATE_FILTER_LISTS:
      (async () => {
        try {
          const result = await updateFilterLists();
          if (result && result.compiled) setCompiledIndex(result.compiled, result.overflowPatterns);
          sendResponse({ success: true });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    case MSG.GET_DYNAMIC_RULE_COUNT:
      getDynamicRuleCount().then(sendResponse);
      return true;
    case 'reconcilePolicy':
      (async () => {
        try { await reconcileDynamicRules(); sendResponse({ success: true }); } catch (err) { sendResponse({ success: false, error: err.message }); }
      })();
      return true;
    case MSG.GET_JS_SETTINGS:
      getJsSettings().then(sendResponse);
      return true;
    case MSG.SET_JS_SETTING:
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
    case MSG.GET_CUSTOM_RULES:
      getCustomRules().then(sendResponse);
      return true;
    case MSG.ADD_CUSTOM_RULE:
      (async () => {
        let rules = await getCustomRules();
        const maxId = rules.reduce((m, r) => Math.max(m, r.id || 0), 0);
        rules.push({ id: maxId + 1, pattern: message.pattern, action: message.action || 'block', priority: message.priority || 1 });
        await saveCustomRules(rules);
        await reconcileDynamicRules();
        sendResponse({ success: true, rules });
      })();
      return true;
    case MSG.REMOVE_CUSTOM_RULE:
      (async () => {
        let rules = await getCustomRules();
        rules = rules.filter(r => r.id !== message.ruleId);
        await saveCustomRules(rules);
        await reconcileDynamicRules();
        sendResponse({ success: true, rules });
      })();
      return true;
    case MSG.GET_DISABLED_RULES:
      getDisabledRuleIds().then(sendResponse);
      return true;
    case MSG.TOGGLE_DISABLED_RULE:
      (async () => {
        let ids = await getDisabledRuleIds();
        if (ids.includes(message.ruleId)) ids = ids.filter(i => i !== message.ruleId);
        else ids.push(message.ruleId);
        await saveDisabledRuleIds(ids);
        await reconcileDynamicRules();
        sendResponse({ success: true, disabledIds: ids });
      })();
      return true;
    case MSG.GET_DISABLED_RULE_IDS:
      getDisabledRuleIds().then(sendResponse);
      return true;
    case MSG.REPORT_THIRD_PARTIES:
      if (sender.tab) {
        const host = hostFromUrl(sender.tab.url);
        reportThirdParties(message.domains || [], host).then(() => sendResponse({}));
      } else sendResponse({});
      return true;
    case MSG.GET_DETECTED_TRACKERS:
      getDetectedTrackers().then(sendResponse);
      return true;
    case MSG.GET_TRACKERS_FOR_HOST:
      (async () => {
        const map = await getTrackerMap();
        const actions = await getTrackerActions();
        const tracked = await getAutoTracked();
        const host = message.host;
        const siteMap = new Map();
        for (const [domain, info] of Object.entries(map)) {
          if (info.sites) {
            for (const site of info.sites) {
              if (!siteMap.has(site)) siteMap.set(site, []);
              siteMap.get(site).push(domain);
            }
          }
        }
        const domains = siteMap.get(host) || [];
        sendResponse(domains.map(domain => ({
          domain,
          category: map[domain].category || 'Other',
          sites: map[domain].sites ? map[domain].sites.length : 0,
          action: actions[domain] || (tracked.includes(domain) ? 'block' : 'none')
        })));
      })();
      return true;
    case MSG.GET_TRACKER_CATEGORIES:
      getTrackerCategories().then(sendResponse);
      return true;
    case MSG.WHITELIST_TRACKER:
      whitelistTracker(message.domain).then(() => sendResponse({ success: true }));
      return true;
    case MSG.RESET_TRACKER_DATA:
      (async () => {
        await saveTrackerMap({});
        await saveAutoTracked([]);
        await saveTrackerActions({});
        await reconcileDynamicRules();
        sendResponse({ success: true });
      })();
      return true;
    case MSG.GET_TRACKER_ACTIONS:
      getTrackerActions().then(sendResponse);
      return true;
    case MSG.SET_TRACKER_ACTION:
      setTrackerAction(message.domain, message.action).then(() => sendResponse({ success: true }));
      return true;
    case MSG.GET_STEALTH_CONFIG:
      getStealthConfig().then(sendResponse);
      return true;
    case MSG.SAVE_STEALTH_CONFIG:
      saveStealthConfig(message.config).then(() => sendResponse({ success: true }));
      return true;
    case MSG.GET_FILTER_LOG:
      getLogsIDB(2000, 0).then(sendResponse);
      return true;
    case MSG.CLEAR_FILTER_LOG:
      clearFilterLog().then(() => sendResponse({ success: true }));
      return true;
    case MSG.GET_LOG_COUNT:
      getLogCountIDB().then(sendResponse);
      return true;
    case MSG.GET_FILTER_LOG_RANGE:
      getLogsIDB(message.limit || 50, message.offset || 0).then(function(logs) {
        sendResponse(logs);
      });
      return true;
    case MSG.XSS_DETECTED:
      incrementStats(1);
      addFilterLogEntry({ ruleId: 'XSS', url: message.data || 'XSS blocked' });
      sendResponse({});
      return true;
    case MSG.ABE_BLOCKED:
      incrementStats(1);
      addFilterLogEntry({ ruleId: 'ABE', url: message.data || 'Local network blocked' });
      sendResponse({});
      return true;
    case MSG.SECURE_PAYMENT_BLOCKED:
      incrementStats(1);
      addFilterLogEntry({ ruleId: 'PAY', url: message.data || 'HTTP payment blocked' });
      sendResponse({});
      return true;
    case MSG.GET_DAILY_STATS:
      getDailyStats().then(sendResponse);
      return true;
case MSG.GET_YOUTUBE_WHITELIST:
      getYouTubeWhitelist().then(sendResponse);
      return true;
    case MSG.ADD_YOUTUBE_WHITELIST:
      addYouTubeWhitelist(message.channelId, message.channelName).then(sendResponse);
      return true;
    case MSG.REMOVE_YOUTUBE_WHITELIST:
      removeYouTubeWhitelist(message.channelId).then(sendResponse);
      return true;
    case MSG.GET_TOP_DOMAINS:
      getTopDomainsIDB(10).then(sendResponse);
      return true;
    case MSG.HANDLE_BROWSER_CLEANUP:
      handleBrowserCleanup(message).then(sendResponse);
      return true;
    case MSG.GET_SITE_PERMISSIONS:
      getSitePermissions().then(sendResponse);
      return true;
    case MSG.GET_CONTAINER_STATUS:
      (async () => {
        const c = await getOrCreateContainer();
        sendResponse({ exists: !!c, name: CONTAINER_NAME, domains: ISOLATED_DOMAINS, cookieStoreId: c ? c.cookieStoreId : null });
      })();
      return true;
    case MSG.UPDATE_CDN_MAP:
      updateCDNMap().then(sendResponse);
      return true;
    case MSG.GET_CDN_MAP:
      (async () => {
        let r = await _b.storage.local.get('durgashield_cdn_map');
        if (!r.durgashield_cdn_map || !r.durgashield_cdn_map.entries || r.durgashield_cdn_map.entries.length === 0) {
          await loadCDNMap();
          r = await _b.storage.local.get('durgashield_cdn_map');
        }
        sendResponse(r.durgashield_cdn_map || null);
      })();
      return true;
    case MSG.UPDATE_CDN_FILES:
      updateCDNFiles().then(sendResponse);
      return true;
    case MSG.GET_CDN_FILES_STATUS:
      (async () => {
        const r = await _b.storage.local.get('durgashield_cdn_updated_files');
        const t = await _b.storage.local.get('durgashield_cdn_files_updated');
        const files = r.durgashield_cdn_updated_files || {};
        sendResponse({ count: Object.keys(files).length, updated: t.durgashield_cdn_files_updated || null, files: files });
      })();
      return true;
    case MSG.CHECK_PASSWORD_LEAK:
      checkPasswordLeak(message.hash).then(sendResponse);
      return true;
    case MSG.GET_PASSWORD_LEAKS:
      getPasswordLeaks().then(sendResponse);
      return true;
    case MSG.CLEAR_PASSWORD_LEAKS:
      clearPasswordLeaks().then(() => sendResponse({ success: true }));
      return true;
    case MSG.AUTO_CHECK_PASSWORD:
      (async () => {
        const config = await getConfig();
        if (config.passwordLeakCheck === false) { sendResponse({ skipped: true }); return; }
        const result = await checkPasswordLeak(message.hash);
        if (result.compromised) {
          batchNotification('Password Leak Detected', 'A password you entered has been found in ' + result.count + ' known data breaches. Change it immediately.');
        }
        sendResponse({ checked: true, compromised: result.compromised });
      })();
      return true;
    case MSG.EXPORT_FILTER_LOG:
      exportFilterLog().then(sendResponse);
      return true;
    case MSG.SCAN_EXTENSIONS:
      scanExtensions().then(sendResponse);
      return true;
    case MSG.GET_EXTENSION_AUDIT:
      getExtensionAudit().then(sendResponse);
      return true;
    case MSG.GET_PRIVACY_SCORE:
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
    case MSG.GET_SITE_BLOCKER:
      getSiteBlockerList().then(sendResponse);
      return true;
    case MSG.SAVE_SITE_BLOCKER:
      saveSiteBlockerList(message.domains).then(sendResponse);
      return true;
    case MSG.GET_ACCEPTABLE_ADS:
      getAcceptableAds().then(sendResponse);
      return true;
    case MSG.SAVE_ACCEPTABLE_ADS:
      saveAcceptableAds(message.domains).then(sendResponse);
      return true;
    case MSG.GET_SITE_PREFS:
      _b.storage.local.get(SITE_PREFS_KEY, (r) => sendResponse(r[SITE_PREFS_KEY] || {}));
      return true;
    case MSG.SET_SITE_PREFS:
      (async () => {
        const r = await _b.storage.local.get(SITE_PREFS_KEY);
        const prefs = r[SITE_PREFS_KEY] || {};
        prefs[message.host] = prefs[message.host] || {};
        prefs[message.host][message.feature] = message.enabled;
        await _b.storage.local.set({ [SITE_PREFS_KEY]: prefs });
        const tabs = await _b.tabs.query({});
        for (const tab of tabs) {
          try { _b.tabs.sendMessage(tab.id, { type: MSG.SITE_PREFS, prefs }); } catch (e) {}
        }
        sendResponse({ success: true });
      })();
      return true;
    case MSG.GET_PERF_MODE:
      getConfig().then(c => sendResponse({ perfMode: c.perfMode || 'balanced' }));
      return true;
    case MSG.SET_PERF_MODE:
      getConfig().then(async (c) => {
        c.perfMode = message.perfMode || 'balanced';
        await saveConfig(c);
        await reconcileDynamicRules();
        sendResponse({ success: true });
      });
      return true;
    case 'shouldBlock':
      Promise.resolve(shouldBlock(message.url)).then(sendResponse);
      return true;
    case 'shouldBlockBatch':
      Promise.resolve(shouldBlockUrls(message.urls || [])).then(sendResponse);
      return true;
  }
});

function updateBadge(tabId, type) {
  const colors = { danger: '#dc3545', warning: '#ffc107', safe: '#28a745' };
  const icons = { danger: '\u26A0', safe: '\u2713' };
  _b.action.setBadgeText({ tabId, text: icons[type] || '' });
  _b.action.setBadgeBackgroundColor({ tabId, color: colors[type] || colors.safe });
}

_b.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    try {
      const url = new URL(tab.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') _b.action.setBadgeText({ tabId, text: '' });
      // Inject custom hide rules CSS before page renders
      try {
        const host = url.hostname.replace(/^www\./, '');
        const r = await _b.storage.local.get('durgashield_hide_rules');
        const rules = r.durgashield_hide_rules || {};
        const selectors = rules[host];
        if (selectors && selectors.length > 0) {
          const safe = selectors.filter(function(s) { return s !== 'body' && s !== 'html' && !s.startsWith('body ') && !s.startsWith('html '); });
          if (safe.length > 0) {
            const css = safe.map(s => s + '{display:none!important}').join('\n');
            _b.scripting.insertCSS({ target: { tabId }, css: css, origin: 'USER' });
          }
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
    const allowed = await _b.storage.local.get('durgashield_download_allowed');
    if (allowed.durgashield_download_allowed && allowed.durgashield_download_allowed.includes(item.url)) return;
    const reason = isMalwareDomain ? 'suspicious domain' : 'dangerous file type (' + ext + ')';
    const nid = 'dl-confirm-' + item.id;
    pendingDownloadConfirmations[item.id] = { item, reason, nid };
    await _b.notifications.create(nid, {
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
          await _b.downloads.cancel(item.id);
          await _b.downloads.erase({ id: item.id });
        } catch (e) {}
        try { _b.notifications.clear(nid); } catch (e) {}
      }
    }, 60000);
  } catch (e) {}
}

// Handle download notification button clicks
_b.notifications.onButtonClicked.addListener((nid, btnIdx) => {
  if (!nid.startsWith('dl-confirm-')) return;
  const id = parseInt(nid.replace('dl-confirm-', ''));
  const entry = pendingDownloadConfirmations[id];
  if (!entry) return;
  delete pendingDownloadConfirmations[id];
  _b.notifications.clear(nid);
  if (btnIdx === 0) {
    // Proceed anyway — whitelist this URL
    _b.storage.local.get('durgashield_download_allowed', (r) => {
      let list = r.durgashield_download_allowed || [];
      if (!list.includes(entry.item.url)) list.push(entry.item.url);
      _b.storage.local.set({ durgashield_download_allowed: list });
    });
    if (entry.item.paused) {
      try { _b.downloads.resume(id); } catch (e) {}
    }
  } else {
    // Cancel download
    try {
      _b.downloads.cancel(id);
      _b.downloads.erase({ id: id });
    } catch (e) {}
  }
});

let _downloadScannerInitialized = false;

async function registerDownloadListeners() {
  if (_downloadScannerInitialized) return;
  _downloadScannerInitialized = true;
  _b.downloads.onCreated.addListener((item) => {
    checkDownload(item);
  });
  _b.downloads.onChanged.addListener((delta) => {
    if (delta.state && delta.state.current === 'complete') {
      _b.downloads.search({ id: delta.id }, (items) => {
        if (items && items[0]) checkDownload(items[0]);
      });
    }
  });
}

async function initDownloadScanner() {
  if (_downloadScannerInitialized) return;
  const perms = OPTIONAL_FEATURE_PERMS.downloadScan;
  if (!perms) return;
  const already = await _b.permissions.contains({ permissions: perms });
  if (!already) return;
  await registerDownloadListeners();
}
initDownloadScanner();

/* ---------- URL Tracking Cleaner (DNR removeParams) ---------- */
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
  { domain: 'payments.amazon.dev', desc: 'Amazon Payments Dev (payment iframes)' },
  { domain: 'bank.in', desc: 'Bank.in' }
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
    const existing = await _b.declarativeNetRequest.getDynamicRules();
    const oldIds = existing.filter(r => r.id >= GITHUB_ALLOW_START && r.id < GITHUB_ALLOW_START + 50).map(r => r.id);
    const rules = buildSiteAllowRules();
    await _b.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: rules });
  } catch (e) { console.warn('DurgaShield: allow rules install error:', e); }
}

/* ---------- CDN Replacement ---------- */
const CDN_RULE_PRIORITY = 1;
const CDN_RULE_ID_START = 990000;

async function loadCDNMap() {
  try {
    const bundled = await fetch(_b.runtime.getURL('resources/cdn-map.json'));
    const bundledMap = await bundled.json();
    let map = { entries: bundledMap, version: '1.0', source: 'bundled', lastUpdate: Date.now() };
    const existing = await _b.storage.local.get('durgashield_cdn_map');
    if (existing.durgashield_cdn_map && existing.durgashield_cdn_map.lastUpdate) {
      map.lastUpdate = existing.durgashield_cdn_map.lastUpdate;
      map.version = existing.durgashield_cdn_map.version || '1.0';
      if (existing.durgashield_cdn_map.entries) map.entries = existing.durgashield_cdn_map.entries;
    }
    await _b.storage.local.set({ durgashield_cdn_map: map });
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
  try { await _b.storage.local.get('durgashield_cdn_updated_files'); } catch (e) {}
}

async function updateCDNFiles() {
  const results = { success: 0, failed: 0, files: [], errors: [] };
  for (const bundled of KNOWN_LOCAL_RESOURCES) {
    results.files.push({ lib: bundled.lib, version: bundled.version, size: 0 });
    results.success++;
  }
  await _b.storage.local.set({ durgashield_cdn_files_updated: Date.now() });
  return results;
}

async function installCDNReplacement() {
  try {
    const existing = await _b.declarativeNetRequest.getDynamicRules();
    const oldCDNRules = existing.filter(r => r.id >= CDN_RULE_ID_START && r.id < CDN_RULE_ID_START + 5000);
    if (oldCDNRules.length > 0) {
      await _b.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldCDNRules.map(r => r.id)
      });
    }
    const rules = buildCDNRules();
    if (rules.length > 0) {
      await _b.declarativeNetRequest.updateDynamicRules({ addRules: rules });
    }
    await _b.storage.local.set({ durgashield_cdn_rules_count: rules.length });
  } catch (e) {
    console.warn('DurgaShield: installCDNReplacement error:', e);
  }
}

async function removeCDNReplacement() {
  try {
    const existing = await _b.declarativeNetRequest.getDynamicRules();
    const cdnRules = existing.filter(r => r.id >= CDN_RULE_ID_START && r.id < CDN_RULE_ID_START + 5000);
    if (cdnRules.length > 0) {
      await _b.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: cdnRules.map(r => r.id)
      });
    }
    await _b.storage.local.set({ durgashield_cdn_rules_count: 0 });
  } catch (e) {
    console.warn('DurgaShield: removeCDNReplacement error:', e);
  }
}

async function updateCDNMap() {
  try {
    const bundled = await fetch(_b.runtime.getURL('resources/cdn-map.json'));
    const bundledMap = await bundled.json();
    if (!Array.isArray(bundledMap)) throw new Error('Invalid map format');
    const map = { entries: bundledMap, version: '1.0', source: 'bundled', lastUpdate: Date.now() };
    await _b.storage.local.set({ durgashield_cdn_map: map });
    const config = await getConfig();
    if (config.cdnReplacement) await installCDNReplacement();
    return { success: true, entries: bundledMap.length, lastUpdate: map.lastUpdate };
  } catch (e) {
    console.warn('DurgaShield: updateCDNMap error:', e);
    return { success: false, error: e.message };
  }
}

/* ---------- DNR Rule Usage Feedback ---------- */
// Track rule hits for smart pruning (only if permission available)
try {
  if (_b.declarativeNetRequest.onRuleMatchedDebug) {
    _b.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
      if (info.rule && info.rule.ruleId >= FILTER_RULE_START && info.rule.ruleId < FILTER_RULE_START + 100000) {
        recordRuleHit(info.rule.ruleId);
      }
    });
  }
} catch (e) {}

/* ---------- Scheduled Background Tasks (Alarms API) ----------
   Using alarms instead of setInterval to survive SW lifecycle and avoid quota issues.
*/
try {
  _b.alarms.create('filterUpdate', { periodInMinutes: 360 });
  _b.alarms.create('cookieSelfDestruct', { periodInMinutes: 30 });
  _b.alarms.create('pollMatchedRules', { periodInMinutes: 1 });
  _b.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'filterUpdate') {
      updateFilterLists().then(result => {
        if (result && result.compiled) setCompiledIndex(result.compiled, result.overflowPatterns);
      });
      // Also run rule pruning periodically
      pruneUnusedRules().catch(() => {});
    }
    if (alarm.name === 'cookieSelfDestruct') {
      cookieSelfDestruct();
    }
    if (alarm.name === 'pollMatchedRules') {
      pollMatchedRules();
    }
    if (alarm.name === 'cdnFileUpdate') {
      _b.storage.local.get('durgashield_config').then(r => {
        if (r.durgashield_config && r.durgashield_config.cdnReplacement !== false) updateCDNFiles();
      });
    }
  });
} catch (e) {
  console.warn('DurgaShield: alarms error:', e);
}

// 24-hour CDN file auto-update
try {
  _b.alarms.create('cdnFileUpdate', { periodInMinutes: 1440 });
} catch (e) {
  console.warn('DurgaShield: cdn alarm error:', e);
}

/* ---------- Extension Risk Auditing ---------- */
const EXTENSION_RISK_KEY = 'durgashield_extension_audit';
async function scanExtensions() {
  try {
    if (!_b.management || !_b.management.getAll) return { error: 'management API not available' };
    const all = await _b.management.getAll();
    const results = [];
    const highRiskPerms = ['nativeMessaging','debugger','proxy','privacy','history','sessions','tabs','bookmarks','downloads','clipboardRead','clipboardWrite','identity','identity.email'];
    const mediumRiskPerms = ['cookies','webRequest','webRequestBlocking','notifications','alarms','storage','unlimitedStorage','geolocation'];
    for (const ext of all) {
      if (ext.id === _b.runtime.id) continue;
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
    await _b.storage.local.set({ [EXTENSION_RISK_KEY]: results });
    return results;
  } catch (e) {
    return { error: e.message };
  }
}
async function getExtensionAudit() {
  const r = await _b.storage.local.get(EXTENSION_RISK_KEY);
  return r[EXTENSION_RISK_KEY] || [];
}

/* ---------- Site Blocker (Productivity) ---------- */
const SITE_BLOCKER_KEY = 'durgashield_site_blocker';
const SITE_BLOCKER_RULE_START = 702000;
async function getSiteBlockerList() {
  const r = await _b.storage.local.get(SITE_BLOCKER_KEY);
  return r[SITE_BLOCKER_KEY] || [];
}
async function saveSiteBlockerList(domains) {
  await _b.storage.local.set({ [SITE_BLOCKER_KEY]: domains });
  await applySiteBlockerRules(domains);
}
async function applySiteBlockerRules(domains) {
  try {
    const existing = await _b.declarativeNetRequest.getDynamicRules();
    const oldIds = existing.filter(r => r.id >= SITE_BLOCKER_RULE_START && r.id < SITE_BLOCKER_RULE_START + 100).map(r => r.id);
    if (domains.length === 0) {
      await _b.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: [] });
      return;
    }
    const rules = domains.map((d, i) => ({
      id: SITE_BLOCKER_RULE_START + i,
      priority: 100,
      action: { type: 'block' },
      condition: { urlFilter: '||' + d + '^', resourceTypes: ['main_frame'] }
    }));
    await _b.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: rules });
  } catch (e) { console.warn('DurgaShield: site blocker error:', e); }
}

/* ---------- Acceptable Ads ---------- */
const ACCEPTABLE_ADS_KEY = 'durgashield_acceptable_ads';
const ACCEPTABLE_ADS_RULE_START = 703000;
async function getAcceptableAds() {
  const r = await _b.storage.local.get(ACCEPTABLE_ADS_KEY);
  return r[ACCEPTABLE_ADS_KEY] || [];
}
async function saveAcceptableAds(domains) {
  await _b.storage.local.set({ [ACCEPTABLE_ADS_KEY]: domains });
  await applyAcceptableAdsRules(domains);
}
async function applyAcceptableAdsRules(domains) {
  try {
    const existing = await _b.declarativeNetRequest.getDynamicRules();
    const oldIds = existing.filter(r => r.id >= ACCEPTABLE_ADS_RULE_START && r.id < ACCEPTABLE_ADS_RULE_START + 200).map(r => r.id);
    if (domains.length === 0) {
      await _b.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: [] });
      return;
    }
    const rules = domains.map((d, i) => ({
      id: ACCEPTABLE_ADS_RULE_START + i,
      priority: 200,
      action: { type: 'allow' },
      condition: { urlFilter: '||' + d + '^', resourceTypes: ['script', 'image', 'stylesheet', 'xmlhttprequest', 'other'] }
    }));
    await _b.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: rules });
  } catch (e) { console.warn('DurgaShield: acceptable ads error:', e); }
}
