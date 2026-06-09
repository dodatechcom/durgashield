/* ---------- Shared State & Utilities for Settings ---------- */
const _b = typeof browser !== 'undefined' ? browser : chrome;

const MSG = {
  GET_CONFIG: 'getConfig',
  SET_ENABLED: 'setEnabled',
  EXPORT_FILTER_LOG: 'exportFilterLog',
  GET_LOG_COUNT: 'getLogCount',
  GET_FILTER_LOG_RANGE: 'getFilterLogRange',
  GET_FILTER_LOG: 'getFilterLog',
  CLEAR_FILTER_LOG: 'clearFilterLog',
  GET_TOP_DOMAINS: 'getTopDomains',
  CHECK_PASSWORD_LEAK: 'checkPasswordLeak',
  CLEAR_PASSWORD_LEAKS: 'clearPasswordLeaks',
  GET_PASSWORD_LEAKS: 'getPasswordLeaks',
  GET_CDN_MAP: 'getCDNMap',
  GET_CDN_FILES_STATUS: 'getCDNFilesStatus',
  UPDATE_CDN_FILES: 'updateCDNFiles',
  UPDATE_CDN_MAP: 'updateCDNMap',
  GET_PRIVACY_SCORE: 'getPrivacyScore',
  GET_SITE_BLOCKER: 'getSiteBlocker',
  SAVE_SITE_BLOCKER: 'saveSiteBlocker',
  GET_ACCEPTABLE_ADS: 'getAcceptableAds',
  SAVE_ACCEPTABLE_ADS: 'saveAcceptableAds',
  SCAN_EXTENSIONS: 'scanExtensions',
  GET_EXTENSION_AUDIT: 'getExtensionAudit'
};

const FEATURES = [
  { id:'ads', icon:'&#x1F4AD;', bg:'#e94560', label:'Ad Blocker', desc:'Blocks ads, banners, and video ads', cat:'Blocking' },
  { id:'malware', icon:'&#x2620;', bg:'#dc3545', label:'Malware Protection', desc:'Blocks malicious domains', cat:'Security' },
  { id:'crypto', icon:'&#x26A1;', bg:'#ff6b35', label:'Crypto Miner Blocking', desc:'Prevents in-browser mining', cat:'Security' },
  { id:'phishing', icon:'&#x1F50D;', bg:'#e67e22', label:'Phishing Protection', desc:'Blocks fake login pages', cat:'Security' },
  { id:'popupBlocking', icon:'&#x1F4A5;', bg:'#6f42c1', label:'Popup Blocker', desc:'Blocks unwanted popups', cat:'Blocking' },
  { id:'cdn', icon:'CD', bg:'#17a2b8', label:'CDN Tracker Block', desc:'Blocks known CDN tracking domains', cat:'Privacy' },
  { id:'cdnReplacement', icon:'CR', bg:'#20c997', label:'CDN Replacement', desc:'Serves local copies of CDN libraries', cat:'Privacy' },
  { id:'stealth', icon:'ST', bg:'#6610f2', label:'Stealth Mode', desc:'Anti-fingerprinting, WebRTC block', cat:'Privacy' },
  { id:'neverConsent', icon:'NC', bg:'#fd7e14', label:'Never-Consent', desc:'Auto-dismiss cookie banners', cat:'Privacy' },
  { id:'enhancedTracking', icon:'AT', bg:'#6f42c1', label:'Enhanced Anti-Track', desc:'Spoof fingerprints', cat:'Privacy' },
  { id:'xssProtection', icon:'XS', bg:'#28a745', label:'XSS Protection', desc:'Block cross-site scripting', cat:'Security' },
  { id:'clearClick', icon:'CC', bg:'#e94560', label:'ClearClick', desc:'Anti-clickjacking', cat:'Security' },
  { id:'abe', icon:'AB', bg:'#343a40', label:'ABE', desc:'Local network protection', cat:'Security' },
  { id:'securePayment', icon:'$$', bg:'#dc3545', label:'Secure Payment', desc:'Block HTTP payment forms', cat:'Security' },
  { id:'downloadScan', icon:'DL', bg:'#28a745', label:'Download Scanner', desc:'Scan downloads for threats', cat:'Security' },
  { id:'passwordLeakCheck', icon:'PW', bg:'#dc3545', label:'Password Leak Check', desc:'Auto-check passwords against known breaches (HIBP)', cat:'Security' },
  { id:'containerIsolation', icon:'&#x1F310;', bg:'#1877f2', label:'Social Container', desc:'Isolate social media tabs', cat:'Privacy' },
  { id:'social', icon:'&#x1F5E3;', bg:'#1877f2', label:'Social Media Filter', desc:'Block Facebook, Twitter, LinkedIn widgets', cat:'Blocking' },
  { id:'annoyance', icon:'&#x1F515;', bg:'#fd7e14', label:'Annoyance Blocker', desc:'Block cookie consent, push notifications', cat:'Blocking' },
  { id:'ytWhitelist', icon:'&#x1F3AC;', bg:'#e94560', label:'YouTube Channel Whitelist', desc:'Allow ads on supported YouTube channels', cat:'Privacy' },
  { id:'metadataCleanup', icon:'EX', bg:'#17a2b8', label:'Metadata Cleanup', desc:'Strip EXIF data from uploaded JPEG images', cat:'Privacy' },
  { id:'searchAnnotations', icon:'SA', bg:'#6610f2', label:'Search Annotations', desc:'Annotate search results with safety icons', cat:'Privacy' },
  { id:'cc-adult', icon:'18+', bg:'#dc3545', label:'Adult Content Block', desc:'Blocks adult/pornographic websites', cat:'Blocking' },
  { id:'cc-gambling', icon:'&#x1F3B0;', bg:'#ff6b35', label:'Gambling Block', desc:'Blocks online gambling & betting sites', cat:'Blocking' },
  { id:'cc-violence', icon:'&#x2620;', bg:'#343a40', label:'Violence & Hate Block', desc:'Blocks violent & hate speech content', cat:'Blocking' },
  { id:'videoRedirect', icon:'&#x25B6;', bg:'#e94560', label:'Video Redirect Guard', desc:'Prevents hidden links in video players from opening new tabs', cat:'Blocking' },
  { id:'httpsEnforce', icon:'HT', bg:'#28a745', label:'HTTPS Enforcement', desc:'Upgrades HTTP connections to HTTPS on major sites', cat:'Security' },
  { id:'aiDlp', icon:'AI', bg:'#6f42c1', label:'GenAI Data Leak Prevention', desc:'Warns when sending sensitive data (SSN, passwords, API keys) to AI chatbots', cat:'Privacy' },
  { id:'defacementDetect', icon:'DF', bg:'#dc3545', label:'Defacement Detection', desc:'Detects possible site defacement/hacking', cat:'Security' },
  { id:'phoneScamDetect', icon:'PH', bg:'#e94560', label:'Phone Scam Detection', desc:'Detects phone scam tactics on pages', cat:'Security' },
  { id:'phishingLinkDetect', icon:'PL', bg:'#e67e22', label:'Phishing Link Detection', desc:'Analyzes links for brand impersonation and suspicious patterns', cat:'Security' },
  { id:'fbPrivacy', icon:'FB', bg:'#1877f2', label:'Facebook/Instagram Privacy', desc:'Hides seen indicators, typing status, and read receipts', cat:'Privacy' }
];

/* ---------- Central State Store ---------- */
let _config = {};
let _storeListeners = [];

const store = {
  get state() { return _config; },
  get(key) { return _config ? _config[key] : undefined; },
  set(key, value) {
    var prev = _config[key];
    _config[key] = value;
    store.notify(key, value, prev);
  },
  setConfig(obj) {
    _config = obj || {};
    store.notify('*', _config, null);
  },
  subscribe(fn) { _storeListeners.push(fn); },
  notify(key, value, prev) {
    _storeListeners.forEach(function(fn) { fn(key, value, prev); });
  }
};

let _saveConfigTimer = null;
function saveConfigDebounced() {
  clearTimeout(_saveConfigTimer);
  _saveConfigTimer = setTimeout(function() {
    _b.storage.local.set({ durgashield_config: _config });
    _b.runtime.sendMessage({ type:'saveConfig', config: _config });
  }, 300);
}

function $(id) { return document.getElementById(id); }

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

