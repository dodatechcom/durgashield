const ACTION_LABELS = { allow: 'A', 'cookie-block': 'C', block: 'B' };

function updateUI(enabled) {
  document.getElementById('masterToggle').checked = enabled;
  document.getElementById('statusText').textContent = enabled ? 'Protection active' : 'Paused';
  const dot = document.getElementById('statusDot');
  dot.className = 'dot ' + (enabled ? 'active' : 'paused');
}

const TRUSTED_DOMAINS = ['bank.in', 'github.com', 'github.io', 'githubusercontent.com', 'github.githubassets.com', 'githubstatus.com', 'coinmarketcap.com', 'bitget.com', 'coingecko.com', 'tvsmotor.com', 'amazon.in', 'amazon.com'];

function loadStats() {
  chrome.storage.local.get('durgashield_stats', (r) => {
    const stats = r.durgashield_stats || { today: 0 };
    document.getElementById('blockedToday').textContent = stats.today;
  });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;
    try {
      const host = new URL(tabs[0].url).hostname.replace(/^www\./, '');
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
  });
}

function loadTrackers() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].url) return;
    try {
      const host = new URL(tabs[0].url).hostname.replace(/^www\./, '');
      chrome.runtime.sendMessage({ type: 'getDetectedTrackers' }, (trackers) => {
        if (!trackers || !trackers.length) return;
        const pageTrackers = trackers.filter(t => t.sites && t.sites.includes(host));
        renderTrackerList(pageTrackers);
      });
    } catch (e) {}
  });
}

function createTrackerItem(t) {
  const cur = t.action || 'none';
  const siteCount = t.sites ? t.sites.length : 0;
  let heatColor = '#28a745';
  if (siteCount > 50) heatColor = '#dc3545';
  else if (siteCount > 10) heatColor = '#fd7e14';
  else if (siteCount > 2) heatColor = '#ffc107';

  const item = document.createElement('div');
  item.className = 'tracker-item';
  item.dataset.domain = t.domain;

  const domainSpan = document.createElement('span');
  domainSpan.className = 'tracker-domain';
  domainSpan.title = t.domain + ' (' + siteCount + ' sites)';
  domainSpan.textContent = t.domain;
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
      chrome.runtime.sendMessage({ type: 'setTrackerAction', domain: t.domain, action: a.action }, () => {
        actions.querySelectorAll('.action-btn').forEach(b => b.className = 'action-btn');
        btn.className = 'action-btn ' + a.cls;
      });
    });
    actions.appendChild(btn);
  }

  item.appendChild(actions);
  return item;
}

function renderTrackerList(trackers) {
  const section = document.getElementById('trackerSection');
  const list = document.getElementById('trackerList');
  const count = document.getElementById('trackerCount');
  if (!trackers.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  count.textContent = trackers.length;
  list.textContent = '';
  trackers.forEach(t => list.appendChild(createTrackerItem(t)));
}

chrome.storage.local.get('durgashield_enabled', (r) => {
  const enabled = r.durgashield_enabled !== false;
  updateUI(enabled);
});

loadStats();
loadTrackers();

document.getElementById('masterToggle').addEventListener('change', (e) => {
  const enabled = e.target.checked;
  chrome.storage.local.set({ durgashield_enabled: enabled });
  updateUI(enabled);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'setEnabled', enabled }).catch(() => {});
    }
  });
});

document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('elementPickerBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'activateZapper' }).catch(() => {});
    }
  });
  window.close();
});

document.getElementById('privacyBtn').addEventListener('click', (e) => {
  chrome.tabs.create({ url: chrome.runtime.getURL('privacy.html') });
});

document.getElementById('donateBtn').addEventListener('click', (e) => {
  chrome.tabs.create({ url: chrome.runtime.getURL('donations.html') });
});
