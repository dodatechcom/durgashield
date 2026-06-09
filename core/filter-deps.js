/* ---------- Filter Engine Dependencies ----------
   Shared between background.html and settings.html.
   Must be loaded before core/filter-engine.js.
*/

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
const FILTER_META_KEY = 'durgashield_filter_meta';
const FILTER_LIST_SETTINGS_KEY = 'durgashield_filter_list_settings';
const COSMETICS_PREFIX = 'dgs_cosm_';

async function getFilterMeta() {
  const r = await _b.storage.local.get(FILTER_META_KEY);
  return r[FILTER_META_KEY] || {};
}
async function saveFilterMeta(meta) {
  await _b.storage.local.set({ [FILTER_META_KEY]: meta });
}
async function getFilterListSettings() {
  const r = await _b.storage.local.get(FILTER_LIST_SETTINGS_KEY);
  return r[FILTER_LIST_SETTINGS_KEY] || {};
}
async function saveFilterListSettings(settings) {
  await _b.storage.local.set({ [FILTER_LIST_SETTINGS_KEY]: settings });
}
async function loadFilterListEnabledStates() {
  const saved = await getFilterListSettings();
  for (const fl of FILTER_LISTS) {
    if (saved[fl.id] !== undefined) fl.enabled = saved[fl.id];
  }
}
async function getStoredFilterRules() {
  return [];
}
function saveStoredFilterRules(rules) {
  // No-op
}
