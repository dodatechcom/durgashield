/* ---------- DNR Manager Module ----------
   DeclarativeNetRequest rule building, lifecycle, reconciliation.
   Loaded via background.html before background.js.
   Depends on globals: _b, PRIORITY, getStoredFilterRules, getConfig, getAutoTracked,
   getTrackerActions, getJsSettings, getCustomRules, getDisabledRuleIds,
   FILTER_LISTS, FILTER_RULE_START, HEADER_RULE_START, AUTO_TRACKER_START,
   COOKIE_BLOCK_START, CC_START, CC_DOMAINS, JS_RULE_START, CUSTOM_RULE_START,
   GOOGLE_SAFE_START, GITHUB_ALLOW_START, GPC_RULE_ID, SITE_BLOCKER_RULE_START,
   ACCEPTABLE_ADS_RULE_START, CDN_RULE_ID_START, TRACKING_CLEANER_RULE_START,
   HTTPS_ENFORCE_START
*/

const DYNAMIC_RULE_LIMIT = 5000;

/* ---------- Core Apply ---------- */
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
  const sorted = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.id || 0) - (b.id || 0));
  if (sorted.length <= limit) return sorted;
  return sorted.slice(0, limit);
}

/* ---------- JS Blocking ---------- */
const JS_RULE_MAX = 1800;

function buildJsBlockingRules(settings) {
  const rules = [];
  let id = JS_RULE_START;
  const g = settings.global !== false;
  if (!g) {
    rules.push({
      id: id++, priority: PRIORITY.DEFAULT, action: { type: 'block' },
      condition: { urlFilter: 'http', resourceTypes: ['script'] }
    });
    let siteCount = 0;
    for (const [host, enabled] of Object.entries(settings.sites)) {
      if (siteCount >= JS_RULE_MAX) break;
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
      if (siteCount >= JS_RULE_MAX) break;
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

/* ---------- Privacy Headers ---------- */
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

/* ---------- Tracker & Cookie Blocking ---------- */
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

/* ---------- Content Control ---------- */
const CC_DOMAIN_CAP = 200;
function buildContentControlRules(config) {
  const rules = [];
  let id = CC_START;
  let count = 0;
  for (const [key, domains] of Object.entries(CC_DOMAINS)) {
    if (config[key] !== true) continue;
    for (const domain of domains) {
      if (count >= CC_DOMAIN_CAP) break;
      rules.push({
        id: id++, priority: 5,
        action: { type: 'block' },
        condition: { urlFilter: '||' + domain + '^', resourceTypes: ['main_frame','sub_frame','script','image','stylesheet','font','media','xmlhttprequest','other'] }
      });
      count++;
    }
    if (count >= CC_DOMAIN_CAP) break;
  }
  return rules;
}

/* ---------- Google Safe Rules ---------- */
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
    const existing = await _b.declarativeNetRequest.getDynamicRules();
    const oldIds = existing.filter(r => r.id >= GOOGLE_SAFE_START && r.id < GOOGLE_SAFE_START + 200).map(r => r.id);
    await _b.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldIds,
      addRules: safeRules
    });
  } catch (e) {
    console.warn('DurgaShield: applyGoogleSessionRules error:', e);
  }
}

/* ---------- Site Allow Rules ---------- */
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

/* ---------- Tracking Cleaner ---------- */
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'dclid', 'gclsrc',
  'mc_cid', 'mc_eid', 'oly_anon_id', 'oly_enc_id', '_openstat',
  'vero_id', 'vero_conv', 'vero_series', 'wickedid', 'yclid',
  '_hsenc', '_hsmi', 'hsCtaTracking', '__hstc', '__hsfp', '__hssc',
  'trk_contact', 'trk_msg', 'trk_module', 'trk_sid',
  'mtm_source', 'mtm_medium', 'mtm_campaign', 'mtm_keyword', 'mtm_content',
  'pk_source', 'pk_medium', 'pk_campaign', 'pk_keyword', 'pk_content',
  'awc', 'tb_source', 'ref', 'spm',
  'sc_channel', 'sc_place', 'sc_campaign', 'sc_content', 'sc_medium',
  'si', 's_kwcid', 'ef_id', 'soc_src', 'soc_trk'
];

function buildTrackingCleanerRules() {
  const chunkSize = 30;
  const rules = [];
  for (let i = 0; i < TRACKING_PARAMS.length; i += chunkSize) {
    const chunk = TRACKING_PARAMS.slice(i, i + chunkSize);
    rules.push({
      id: TRACKING_CLEANER_RULE_START + (i / chunkSize),
      priority: 2,
      action: { type: 'redirect', redirect: { transform: { queryTransform: { removeParams: chunk } } } },
      condition: { urlFilter: '|https://', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'] }
    });
  }
  return rules;
}

async function installTrackingCleaner() {
  try {
    const existing = await _b.declarativeNetRequest.getDynamicRules();
    const oldIds = existing.filter(r => r.id >= TRACKING_CLEANER_RULE_START && r.id < TRACKING_CLEANER_RULE_START + 100).map(r => r.id);
    const rules = buildTrackingCleanerRules();
    await _b.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds, addRules: rules });
  } catch (e) { console.warn('DurgaShield: tracking cleaner install error:', e); }
}

/* ---------- Site Blocker ---------- */
async function getSiteBlockerList() {
  const r = await _b.storage.local.get('durgashield_site_blocker');
  return r['durgashield_site_blocker'] || [];
}

async function saveSiteBlockerList(domains) {
  await _b.storage.local.set({ 'durgashield_site_blocker': domains });
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
async function getAcceptableAds() {
  const r = await _b.storage.local.get('durgashield_acceptable_ads');
  return r['durgashield_acceptable_ads'] || [];
}

async function saveAcceptableAds(domains) {
  await _b.storage.local.set({ 'durgashield_acceptable_ads': domains });
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

/* ---------- Main Reconcile ---------- */
let _reconcileDNR = 0;
let _reconcileDNRTimer = null;

async function reconcileDynamicRules() {
  if (_reconcileDNRTimer) clearTimeout(_reconcileDNRTimer);
  return new Promise(resolve => {
    _reconcileDNRTimer = setTimeout(async () => {
      _reconcileDNRTimer = null;
      try {
        const jsSettings = await getJsSettings();
        const customRules = await getCustomRules();
        const disabledIds = await getDisabledRuleIds();
        const disabledSet = new Set(disabledIds);
        const config = await getConfig();
        const perfMode = config.perfMode || 'balanced';

        const all = [];

        if (config.enhancedTracking !== false) {
          const headerRules = buildPrivacyHeaderRules();
          all.push(...headerRules);
        }

        const jsRules = buildJsBlockingRules(jsSettings);
        all.push(...jsRules);

        if (config.enhancedTracking !== false) {
          const autoTracked = await (typeof getAutoTracked === 'function' ? getAutoTracked() : Promise.resolve([]));
          const actions = await (typeof getTrackerActions === 'function' ? getTrackerActions() : Promise.resolve({}));
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

        if (config['cc-adult'] || config['cc-gambling'] || config['cc-violence']) {
          const contentControlRules = buildContentControlRules(config);
          all.push(...contentControlRules);
        }

        const customDnrRules = customRules.map(r => ({
          id: CUSTOM_RULE_START + r.id, priority: r.priority || 100,
          action: { type: r.action || 'block' },
          condition: { urlFilter: r.pattern, ...(r.resourceTypes ? { resourceTypes: r.resourceTypes.split(',') } : {}) }
        }));
        all.push(...customDnrRules);

        const finalRules = all.filter(r => !disabledSet.has(r.id));
        await applyDynamicRules(finalRules);
        await applyGoogleSessionRules();
      } finally {
        resolve();
      }
    }, 100);
  });
}
