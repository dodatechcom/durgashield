/* ---------- Tracking Engine Module ----------
   Privacy Badger-style tracking detection, domain learning, auto-blocking.
   Loaded via background.html before background.js.
   Depends on globals: _b, MSG, reconcileDynamicRules
*/

const TRACKER_MAP_KEY = 'durgashield_tracker_map';
const AUTO_TRACKED_KEY = 'durgashield_auto_tracked';
const TRACKER_ACTIONS_KEY = 'durgashield_tracker_actions';
const LEARNING_SITES_KEY = 'durgashield_learning_sites';
const LEARNING_THRESHOLD = 3;

/* ---------- Storage ---------- */
async function getTrackerMap() {
  const r = await _b.storage.local.get(TRACKER_MAP_KEY);
  return r[TRACKER_MAP_KEY] || {};
}
async function saveTrackerMap(m) {
  await _b.storage.local.set({ [TRACKER_MAP_KEY]: m });
}
async function getAutoTracked() {
  const r = await _b.storage.local.get(AUTO_TRACKED_KEY);
  return r[AUTO_TRACKED_KEY] || [];
}
async function saveAutoTracked(list) {
  await _b.storage.local.set({ [AUTO_TRACKED_KEY]: list });
}
async function getTrackerActions() {
  const r = await _b.storage.local.get(TRACKER_ACTIONS_KEY);
  return r[TRACKER_ACTIONS_KEY] || {};
}
async function saveTrackerActions(actions) {
  await _b.storage.local.set({ [TRACKER_ACTIONS_KEY]: actions });
}
async function getLearningSites() {
  const r = await _b.storage.local.get(LEARNING_SITES_KEY);
  return r[LEARNING_SITES_KEY] || {};
}
async function saveLearningSites(sites) {
  await _b.storage.local.set({ [LEARNING_SITES_KEY]: sites });
}
async function setTrackerAction(domain, action) {
  const actions = await getTrackerActions();
  actions[domain] = action;
  await saveTrackerActions(actions);
  await reconcileDynamicRules();
}

/* ---------- Classification ---------- */
const AD_DOMAINS = ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com', 'adsafeprotected.com', 'adnxs.com', 'rubiconproject.com', 'criteo.com', 'criteo.net', 'outbrain.com', 'taboola.com', 'scorecardresearch.com', 'quantserve.com', 'exelator.com', 'bluekai.com', 'agkn.com', 'casalemedia.com', 'addthis.com', 'moatads.com', 'pubmatic.com', 'openx.net', 'appnexus.com', 'sharethrough.com'];
const ANALYTICS_DOMAINS = ['google-analytics.com', 'googletagmanager.com', 'gtagmanager.com', 'analytics.google.com', 'facebook.com/tr', 'connect.facebook.net', 'pixel.quantserve.com', 'scorecardresearch.com', 'hotjar.com', 'mouseflow.com', 'fullstory.com', 'mixpanel.com', 'amplitude.com', 'segment.io', 'segment.com', 'heap.io', 'clicky.com', 'matomo.org', 'piwik.org', 'piwik.pro', 'woopra.com', 'mouseflow.com', 'luckyorange.com', 'crazyegg.com', 'clarity.ms', 'bing.com/collect'];
const SOCIAL_DOMAINS = ['facebook.com', 'facebook.net', 'fbcdn.net', 'twitter.com', 'twimg.com', 'linkedin.com', 'linkedin.com/li', 'pinterest.com', 'instagram.com', 't.co', 'bit.ly', 'ow.ly', 'tinyurl.com', 'reddit.com', 'youtube.com', 'ytimg.com'];
const CDN_DOMAINS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'cdn.jsdelivr.net', 'stackpathcdn.com', 'fastly.net', 'cloudfront.net', 'akamaihd.net', 'akamaiedge.net', 'azureedge.net', 'netdna-ssl.com', 'netdna.com', 'bootstrapcdn.com', 'maxcdn.com', 'jsdelivr.net', 'cloudflare.com', 'cloudflare.net', 'googleapis.com', 'gstatic.com'];
const FONT_DOMAINS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit.net', 'fonts.cdnfonts.com', 'fontawesome.com', 'use.fontawesome.com'];

function classifyTrackerDomain(domain) {
  const d = domain.replace(/^www\./, '');
  const match = (list) => list.some(dm => d === dm || d.endsWith('.' + dm));
  if (match(AD_DOMAINS)) return 'Advertising';
  if (match(ANALYTICS_DOMAINS)) return 'Analytics';
  if (match(SOCIAL_DOMAINS)) return 'Social Media';
  if (match(CDN_DOMAINS)) return 'CDN';
  if (match(FONT_DOMAINS)) return 'Fonts';
  return 'Other';
}

/* ---------- Reporting ---------- */
async function reportThirdParties(domains, host) {
  const map = await getTrackerMap();
  for (const d of domains) {
    if (!map[d]) map[d] = { sites: [], category: classifyTrackerDomain(d) };
    if (!map[d].sites.includes(host)) map[d].sites.push(host);
    if (map[d].sites.length > 100) map[d].sites = map[d].sites.slice(-100);
    learnThirdParty(host, d).catch(() => {});
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

async function whitelistTracker(domain) {
  const actions = await getTrackerActions();
  delete actions[domain];
  await saveTrackerActions(actions);
  let tracked = await getAutoTracked();
  tracked = tracked.filter(d => d !== domain);
  await saveAutoTracked(tracked);
  await reconcileDynamicRules();
}

/* ---------- Domain Learning Engine ----------
   Auto-blocks trackers observed on 3+ different sites. */
async function learnThirdParty(tabHost, thirdPartyDomain) {
  if (!tabHost || !thirdPartyDomain || tabHost === thirdPartyDomain) return;
  const sites = await getLearningSites();
  if (!sites[thirdPartyDomain]) sites[thirdPartyDomain] = [];
  if (!sites[thirdPartyDomain].includes(tabHost)) {
    sites[thirdPartyDomain].push(tabHost);
    if (sites[thirdPartyDomain].length > 20) sites[thirdPartyDomain] = sites[thirdPartyDomain].slice(-20);
    await saveLearningSites(sites);
    if (sites[thirdPartyDomain].length >= LEARNING_THRESHOLD) {
      const autoTracked = await getAutoTracked();
      if (!autoTracked.includes(thirdPartyDomain)) {
        autoTracked.push(thirdPartyDomain);
        await saveAutoTracked(autoTracked);
        await reconcileDynamicRules();
      }
    }
  }
}

/* ---------- Heuristic AI-style Detection (7.5) ----------
   Fingerprint tracking scripts by behavior patterns rather than domain lists.
   Detects canvas fingerprinting, storage writes, timing attacks, etc. */
const HEURISTIC_PATTERNS = {
  canvas: [
    /canvas\.toDataURL/i, /canvas\.toBlob/i,
    /getImageData/i, /getContext\s*\(\s*['"]2d['"]/i,
    /fillRect/i, /arc\s*\(/, /measureText/i
  ],
  storage: [
    /localStorage\.setItem/i, /sessionStorage\.setItem/i,
    /indexedDB\.open/i, /openDatabase/i
  ],
  timing: [
    /performance\.now\s*\(/i, /Date\.now\s*\(/i,
    /performance\.timing/i
  ],
  beacon: [
    /navigator\.sendBeacon/i, /XMLHttpRequest/i, /fetch\s*\(/
  ],
  fingerprint: [
    /navigator\.userAgent/i, /navigator\.platform/i,
    /navigator\.hardwareConcurrency/i, /navigator\.deviceMemory/i,
    /screen\.(width|height|colorDepth|pixelDepth)/i,
    /plugins\.length/i, /mimeTypes\.length/i,
    /fonts\.(load|check)/i, /document\.fonts/i,
    /AudioContext|OfflineAudioContext/i,
    /WebGLRenderingContext/i
  ]
};

function heuristicAnalyze(scriptCode, url, hostname) {
  const hits = { canvas: 0, storage: 0, timing: 0, beacon: 0, fingerprint: 0 };
  for (const [category, patterns] of Object.entries(HEURISTIC_PATTERNS)) {
    for (const re of patterns) {
      if (re.test(scriptCode)) hits[category]++;
    }
  }
  const total = hits.canvas + hits.storage + hits.timing + hits.beacon + hits.fingerprint;
  if (total < 5) return null;

  const score = Math.min(100, total * 10 + (hits.canvas > 2 ? 20 : 0) + (hits.fingerprint > 3 ? 30 : 0));
  return {
    matched: score > 40,
    score,
    hits,
    source: 'heuristic',
    url,
    hostname
  };
}

/* ---------- Query Helpers ---------- */
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
