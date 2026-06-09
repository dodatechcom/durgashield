const _b = typeof browser !== 'undefined' ? browser : chrome;

const MSG = {
  GET_TRACKERS_FOR_HOST: 'getTrackersForHost',
  SET_TRACKER_ACTION: 'setTrackerAction',
  SET_ENABLED: 'setEnabled',
  ACTIVATE_ZAPPER: 'activateZapper',
  SET_SITE_DISABLED: 'setSiteDisabled'
};

const DISABLED_SITES_KEY = 'durgashield_disabled_sites';
let disabledSites = [];

let currentTab = null;
_b.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  if (tabs && tabs[0]) {
    currentTab = tabs[0];
    loadStats();
  }
}).catch(() => {});

const ACTION_LABELS = { allow: 'A', 'cookie-block': 'C', block: 'B' };

function updateUI(enabled) {
  document.getElementById('masterToggle').checked = enabled;
  document.getElementById('statusText').textContent = enabled ? 'Protection active' : 'Paused';
  const dot = document.getElementById('statusDot');
  dot.className = 'dot ' + (enabled ? 'active' : 'paused');
}

const DEFAULT_TRUSTED_DOMAINS = ['bank.in', 'github.com', 'github.io', 'githubusercontent.com', 'github.githubassets.com', 'githubstatus.com', 'coinmarketcap.com', 'bitget.com', 'coingecko.com', 'tvsmotor.com', 'amazon.in', 'amazon.com'];

let TRUSTED_DOMAINS = [...DEFAULT_TRUSTED_DOMAINS];

_b.storage.local.get('durgashield_trusted_domains').then(r => {
  if (r.durgashield_trusted_domains) TRUSTED_DOMAINS = r.durgashield_trusted_domains;
}).catch(() => {});

_b.storage.local.get(DISABLED_SITES_KEY).then(r => {
  if (r[DISABLED_SITES_KEY]) disabledSites = r[DISABLED_SITES_KEY];
}).catch(() => {});

function updatePerSiteToggle() {
  var el = document.getElementById('perSiteToggle');
  if (!el || !currentTab || !currentTab.url) return;
  try {
    var host = new URL(currentTab.url).hostname.replace(/^www\./, '');
    var disabled = disabledSites.includes(host);
    el.textContent = disabled ? 'Enable on ' + host : 'Disable on ' + host;
    el.style.color = disabled ? '#28a745' : '#e94560';
    el.onclick = function(e) {
      e.preventDefault();
      if (disabled) {
        disabledSites = disabledSites.filter(function(h) { return h !== host; });
      } else {
        if (!disabledSites.includes(host)) disabledSites.push(host);
      }
      _b.storage.local.set({ [DISABLED_SITES_KEY]: disabledSites }).catch(() => {});
      if (currentTab && currentTab.id) {
        _b.tabs.sendMessage(currentTab.id, { type: MSG.SET_SITE_DISABLED, disabled: !disabled }).catch(() => {});
      }
      updatePerSiteToggle();
    };
  } catch (e) {}
}

function loadStats() {
  _b.runtime.sendMessage({ type: 'getStats' }).then(stats => {
    if (stats && stats.today !== undefined) {
      document.getElementById('blockedToday').textContent = stats.today;
    }
  }).catch(() => {
    _b.storage.local.get('durgashield_stats').then(r => {
      const stats = r.durgashield_stats || { today: 0 };
      document.getElementById('blockedToday').textContent = stats.today;
    }).catch(() => {});
  });
  if (!currentTab || !currentTab.url) return;
  try {
    const host = new URL(currentTab.url).hostname.replace(/^www\./, '');
    const trusted = TRUSTED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
    var el = document.getElementById('trustedBadge');
    if (!el) {
      el = document.createElement('span');
      el.id = 'trustedBadge';
      document.querySelector('.status-row').appendChild(el);
    }
    if (trusted) {
      el.textContent = ' \u2713 Trusted';
      el.style.cssText = 'color:#28a745;font-weight:600';
    } else {
      el.textContent = '';
    }
  } catch (e) {}
  updatePerSiteToggle();
}

function loadTrackers() {
  if (!currentTab || !currentTab.url) return;
  try {
    const host = new URL(currentTab.url).hostname.replace(/^www\./, '');
    _b.runtime.sendMessage({ type: MSG.GET_TRACKERS_FOR_HOST, host }).then(trackers => {
      if (trackers && trackers.length) renderTrackerList(trackers);
    }).catch(() => {});
  } catch (e) {}
}

function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

function createTrackerItem(t) {
  if (!t || typeof t !== 'object' || !t.domain) return null;
  const domain = String(t.domain).trim();
  if (!domain) return null;
  const cur = typeof t.action === 'string' ? t.action : 'none';
  const siteCount = Array.isArray(t.sites) ? t.sites.length : (typeof t.sites === 'number' ? t.sites : 0);
  let heatColor = '#28a745';
  if (siteCount > 50) heatColor = '#dc3545';
  else if (siteCount > 10) heatColor = '#fd7e14';
  else if (siteCount > 2) heatColor = '#ffc107';

  const item = document.createElement('div');
  item.className = 'tracker-item';
  item.dataset.domain = domain;

  const domainSpan = document.createElement('span');
  domainSpan.className = 'tracker-domain';
  domainSpan.title = domain + ' (' + siteCount + ' sites)';
  domainSpan.textContent = domain;
  item.appendChild(domainSpan);

  if (siteCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'heat-badge';
    badge.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;background:' + heatColor + ';margin-right:4px;flex-shrink:0;vertical-align:middle';
    badge.title = 'Seen on ' + siteCount + ' sites';
    item.insertBefore(badge, item.firstChild);
  }

  const actions = document.createElement('div');
  actions.className = 'tracker-actions';

  for (const a of [{label:'A',action:'allow',cls:'active-allow'},{label:'C',action:'cookie-block',cls:'active-cookie'},{label:'B',action:'block',cls:'active-block'}]) {
    const btn = document.createElement('button');
    btn.className = 'action-btn' + (cur === a.action ? ' ' + a.cls : '');
    btn.dataset.action = a.action;
    btn.title = a.label === 'A' ? 'Allow' : a.label === 'C' ? 'Block cookies only' : 'Block';
    btn.textContent = a.label;
    btn.addEventListener('click', () => {
      _b.runtime.sendMessage({ type: MSG.SET_TRACKER_ACTION, domain, action: a.action }).then(() => {
        actions.querySelectorAll('.action-btn').forEach(b => b.className = 'action-btn');
        btn.className = 'action-btn ' + a.cls;
      }).catch(() => {});
    });
    actions.appendChild(btn);
  }

  item.appendChild(actions);
  return item;
}

const debouncedRender = debounce(renderTrackerList, 200);

function renderTrackerList(trackers) {
  const section = document.getElementById('trackerSection');
  const list = document.getElementById('trackerList');
  const count = document.getElementById('trackerCount');
  if (!trackers || !trackers.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  count.textContent = trackers.length;
  list.textContent = '';
  const fragment = document.createDocumentFragment();
  trackers.forEach(t => {
    const el = createTrackerItem(t);
    if (el) fragment.appendChild(el);
  });
  list.appendChild(fragment);
}
