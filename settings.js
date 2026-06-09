const _tabLoaded = {};

function switchTab(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  var btn = document.querySelector('.nav-btn[data-tab="' + name + '"]');
  if (btn) btn.classList.add('active');
  var tab = $('tab' + name.charAt(0).toUpperCase() + name.slice(1));
  if (tab) tab.classList.add('active');
  if (!_tabLoaded[name]) {
    _tabLoaded[name] = true;
    switch (name) {
      case 'features': renderFeatures(); break;
      case 'filters': renderFilters(); break;
      case 'rules': renderRules(); renderYouTubeWhitelist(); break;
      case 'advanced': renderAdvanced(); renderCDNReplacement(); break;
    }
  }
}

function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchTab(this.dataset.tab);
    });
  });
}

async function loadConfig() {
  try {
    var resp = await _b.runtime.sendMessage({ type: MSG.GET_CONFIG });
    if (resp && typeof resp === 'object') store.setConfig(resp);
  } catch(e) { store.setConfig({}); }
}

async function renderFeatures() {
  var el = $('featureToggles');
  if (!el) return;
  el.innerHTML = '';
  try {
    var cats = ['Blocking', 'Security', 'Privacy'];
    var icons = { Blocking:'&#x1F6E1;', Security:'&#x1F9F0;', Privacy:'&#x1F50E;' };
    var fragment = document.createDocumentFragment();
    cats.forEach(function(cat) {
      var items = FEATURES.filter(function(f) { return f.cat === cat; });
      if (items.length === 0) return;
      var h = document.createElement('h3');
      h.innerHTML = (icons[cat] || '') + ' ' + cat;
      fragment.appendChild(h);
      var grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px 16px';
      var gridFrag = document.createDocumentFragment();
      items.forEach(function(f) {
        var enabled = store.get(f.id) !== false;
        var d = document.createElement('div');
        d.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:none';

      var leftDiv = document.createElement('div');
      leftDiv.style.cssText = 'display:flex;align-items:center;gap:10px';
      var iconBox = document.createElement('div');
      iconBox.style.cssText = 'width:28px;height:28px;background:' + (f.bg || '#6c757d') + ';border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;flex-shrink:0';
      iconBox.textContent = f.icon || '?';
      leftDiv.appendChild(iconBox);
      var labelDiv = document.createElement('div');
      labelDiv.className = 'setting-label';
      labelDiv.textContent = f.label + ' ';
      var smallDesc = document.createElement('small');
      smallDesc.textContent = f.desc;
      labelDiv.appendChild(smallDesc);
      leftDiv.appendChild(labelDiv);
      d.appendChild(leftDiv);

      var labelToggle = document.createElement('label');
      labelToggle.className = 'switch';
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'cfg-' + f.id;
      if (enabled) checkbox.checked = true;
      labelToggle.appendChild(checkbox);
      var slider = document.createElement('span');
      slider.className = 'slider';
      labelToggle.appendChild(slider);
      d.appendChild(labelToggle);

      gridFrag.appendChild(d);
    });
    grid.appendChild(gridFrag);
    fragment.appendChild(grid);
  });
  el.appendChild(fragment);
    el.addEventListener('change', function(e) {
      if (e.target.matches('input[type="checkbox"]')) {
        var id = e.target.id.replace('cfg-', '');
        store.set(id, e.target.checked);
        saveConfigDebounced();
        updateActiveCount();
        if (id === 'cdnReplacement') renderCDNReplacement();
      }
    });
  } catch (e) {
    console.error('renderFeatures error:', e);
    el.innerHTML = '<div style="color:#dc3545;padding:12px">Error loading features: ' + e.message + '</div>';
  }
}

function updateActiveCount() {

  var el = $('activeFilters');
  if (el) el.textContent = FEATURES.filter(function(f) { return store.get(f.id) !== false; }).length;
}

async function renderDashboard() {
  try {
    // Check extension enabled/paused state
    var enabledData = await _b.storage.local.get('durgashield_enabled');
    var isEnabled = enabledData.durgashield_enabled !== false;
    if ($('protectionBadge')) {
      if (isEnabled) {
        $('protectionBadge').textContent = 'Protected';
        $('protectionBadge').style.background = '#28a745';
      } else {
        $('protectionBadge').textContent = 'Paused';
        $('protectionBadge').style.background = '#dc3545';
      }
    }
    if ($('protectionBadge2')) {
      $('protectionBadge2').textContent = isEnabled ? 'Active' : 'Paused';
      $('protectionBadge2').style.background = isEnabled ? '#28a745' : '#dc3545';
    }
    if ($('dashboardPauseToggle')) {
      $('dashboardPauseToggle').checked = isEnabled;
      $('dashboardPauseToggle').onchange = async function() {
        var enabled2 = this.checked;
        await _b.storage.local.set({ durgashield_enabled: enabled2 });
        try {
          var tabs = await _b.tabs.query({});
          for (var t = 0; t < tabs.length; t++) {
            try { _b.tabs.sendMessage(tabs[t].id, { type: MSG.SET_ENABLED, enabled: enabled2 }); } catch (e) {}
          }
        } catch (e) {}
        renderDashboard();
      };
    }
    var r = await _b.storage.local.get('durgashield_stats');
    var s = r.durgashield_stats || { total:0, today:0 };
    if ($('totalBlocked')) $('totalBlocked').textContent = s.total;
    if ($('todayBlocked')) $('todayBlocked').textContent = s.today || 0;
    try {
      var dnr = await _b.declarativeNetRequest.getDynamicRules();
      if ($('dynamicRules')) $('dynamicRules').textContent = dnr.length;
    } catch(e) {}
    updateActiveCount();
    // Chart
    var byDay = s.byDay || {};
    var chart = $('blockChart');
    if (chart) {
      chart.innerHTML = '';
      var days = [];
      for (var i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0,10)); }
      var maxVal = Math.max.apply(null, days.map(function(d) { return byDay[d] || 0; }).concat([1]));
      days.forEach(function(day) {
        var val = byDay[day] || 0;
        var pct = Math.max(2, (val / maxVal) * 100);
        var bar = document.createElement('div'); bar.className = 'bar'; bar.style.height = pct + 'px';
        bar.innerHTML = '<div class="bar-label">' + day.slice(5) + '</div>';
        chart.appendChild(bar);
      });
    }
    // Privacy Score
    var ring = $('privacyScoreRing');
    if (ring) {
      var deg = Math.min(360, ((s.total || 0) / 1000) * 360);
      ring.style.background = 'conic-gradient(#28a745 0deg ' + deg + 'deg, #e0e0e0 ' + deg + 'deg)';
    }
    // Top Domains
    var td = $('topDomains');
    if (td) {
      var sorted = await _b.runtime.sendMessage({ type: MSG.GET_TOP_DOMAINS });
      if (sorted.length === 0) {
        var emptyDiv = document.createElement('div'); emptyDiv.className = 'empty-state'; emptyDiv.textContent = 'No blocked domains logged yet.'; td.appendChild(emptyDiv);
      } else {
        sorted.forEach(function(x) {
          var row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #eee';
          var nameSpan = document.createElement('span'); nameSpan.textContent = x[0];
          var countSpan = document.createElement('span'); countSpan.style.cssText = 'color:#e94560'; countSpan.textContent = x[1];
          row.appendChild(nameSpan); row.appendChild(countSpan); td.appendChild(row);
        });
      }
    }

    // Tracker Categories (Ghostery-style) + update tracked domains count
    var tcr = null;
    try {
      tcr = await _b.runtime.sendMessage({ type:'getTrackerCategories' });
    } catch(e) {}
    if ($('trackedDomains')) $('trackedDomains').textContent = (tcr && tcr.total) || 0;
    var tc = $('trackerCategories');
    if (tc) {
      if (tcr && tcr.categories) {
        var catKeys = Object.keys(tcr.categories);
        if (catKeys.length === 0) {
          var emptyDiv = document.createElement('div'); emptyDiv.className = 'empty-state'; emptyDiv.textContent = 'No trackers detected yet'; tc.appendChild(emptyDiv);
        } else {
          var catColors = { Advertising:'#e94560', Analytics:'#ffc107', 'Social Media':'#1877f2', CDN:'#6f42c1', Hosting:'#20c997', Fonts:'#fd7e14', Other:'#888' };
          var summary = document.createElement('div'); summary.style.cssText = 'margin-bottom:8px;font-size:11px;color:#888';
          summary.textContent = 'Detected ' + (tcr.total||0) + ' unique trackers, ' + (tcr.blocked||0) + ' auto-blocked';
          tc.appendChild(summary);
          var flexWrap = document.createElement('div'); flexWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
          catKeys.forEach(function(c) {
            var info = tcr.categories[c];
            var box = document.createElement('div'); box.style.cssText = 'flex:1;min-width:100px;padding:8px;background:#f8f9fa;border-radius:6px;border:1px solid #e0e0e0;text-align:center';
            var countDiv = document.createElement('div'); countDiv.style.cssText = 'font-size:18px;font-weight:700;color:' + (catColors[c]||'#888');
            countDiv.textContent = info.count;
            box.appendChild(countDiv);
            var catDiv = document.createElement('div'); catDiv.style.cssText = 'font-size:9px;color:#888;text-transform:uppercase;margin-top:2px';
            catDiv.textContent = c;
            box.appendChild(catDiv);
            flexWrap.appendChild(box);
          });
          tc.appendChild(flexWrap);
        }
      } else {
        tc.innerHTML = '<div class="empty-state">Loading...</div>';
      }
    }
    // Tracker domain actions list
    var ta = $('trackerActions');
    if (ta && tcr && tcr.domains && tcr.domains.length) {
      var domainList = tcr.domains.sort(function(a,b) { return b.sites - a.sites; }).slice(0, 50);
      ta.innerHTML = '<div style="margin:12px 0 6px;font-size:11px;color:#888;font-weight:600">TRACKER ACTIONS (A=Allow, C=Cookie-only, B=Block) - Top 50 by site count</div>' +
        domainList.map(function(d) {
          var cur = d.action || 'none';
          var domain = escapeHtml(d.domain);
          return '<div class="tracker-row" data-domain="' + domain + '" style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid #eee">' +
            '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
              '<span style="font-size:11px;color:#333">' + domain + '</span>' +
              '<span style="font-size:9px;color:#555;margin-left:6px">(' + d.sites + ' sites)</span></div>' +
            '<div class="trk-actions" style="display:flex;gap:3px;flex-shrink:0">' +
              '<button class="trk-btn' + (cur === 'allow' ? ' active-allow' : '') + '" data-action="allow" title="Allow">A</button>' +
              '<button class="trk-btn' + (cur === 'cookie-block' ? ' active-cookie' : '') + '" data-action="cookie-block" title="Cookie-only">C</button>' +
              '<button class="trk-btn' + (cur === 'block' ? ' active-block' : '') + '" data-action="block" title="Block">B</button>' +
            '</div></div>';
        }).join('');
      ta.addEventListener('click', function(e) {
        var btn = e.target.closest('.trk-btn');
        if (!btn) return;
        var row = btn.closest('.tracker-row');
        if (!row) return;
        var domain = row.dataset.domain;
        var action = btn.dataset.action;
        _b.runtime.sendMessage({ type:'setTrackerAction', domain:domain, action:action }, function() {
          row.querySelectorAll('.trk-btn').forEach(function(b) { b.className = 'trk-btn'; });
          if (action === 'allow') btn.className = 'trk-btn active-allow';
          else if (action === 'cookie-block') btn.className = 'trk-btn active-cookie';
          else if (action === 'block') btn.className = 'trk-btn active-block';
        });
      });
    }
    // Reset
    if ($('resetStatsBtn')) {
      $('resetStatsBtn').onclick = async function() {
        await _b.storage.local.set({ durgashield_stats:{ total:0, today:0, date:new Date().toDateString() } });
        renderDashboard();
      };
    }
  } catch(e) { console.error('Dashboard render error:', e); }
}

async function renderFilters() {
  try {
    var el = $('filterListsCard');
    if (!el) return;
    el.innerHTML = '';

    var meta = (await _b.storage.local.get('durgashield_filter_meta'))['durgashield_filter_meta'] || {};
    var settings = (await _b.storage.local.get('durgashield_filter_list_settings'))['durgashield_filter_list_settings'] || {};

    var lists = FILTER_LISTS.map(function(fl) {
      var m = meta[fl.name] || {};
      return {
        id: fl.id,
        name: fl.name,
        enabled: settings[fl.id] !== undefined ? settings[fl.id] : fl.enabled,
        updated: m.updated || 0,
        count: m.count || 0,
        error: m.error || null
      };
    });

    if (lists.length === 0) {
      el.innerHTML = '<div class="empty-state">No filter lists configured.</div>';
    } else {
      lists.forEach(function(fl) {
        var d = document.createElement('div'); d.className = 'filter-list-item';
        var statusStr = fl.error ? 'Error' : (fl.count > 0 ? fl.count + ' rules' : 'pending');
        var lastStr = fl.updated ? new Date(fl.updated).toLocaleDateString() : 'never';
        d.innerHTML =
          '<label class="switch" style="margin-right:8px"><input type="checkbox" class="filter-toggle" data-id="' + escapeHtml(fl.id) + '"' + (fl.enabled ? ' checked' : '') + '><span class="slider"></span></label>' +
          '<span style="flex:1"><strong>' + escapeHtml(fl.name) + '</strong> <span class="badge">' + escapeHtml(statusStr) + '</span></span>' +
          '<span style="font-size:10px;color:#555;margin-left:8px">Last: ' + escapeHtml(lastStr) + '</span>';
        el.appendChild(d);
      });

      el.querySelectorAll('.filter-toggle').forEach(function(cb) {
        cb.addEventListener('change', async function() {
          var id = this.dataset.id;
          var enabled = this.checked;
          try {
            await _b.runtime.sendMessage({ type:'setFilterListEnabled', id: id, enabled: enabled });
          } catch(e) { console.error('Toggle filter error:', e); }
        });
      });
    }

    async function updateFilterLastUpdated() {
      try {
        var fm = await _b.storage.local.get('durgashield_filter_meta');
        var mta = fm.durgashield_filter_meta || {};
        if (mta.lastUpdate && $('filterUpdateStatus2')) {
          var date = new Date(mta.lastUpdate);
          $('filterUpdateStatus2').textContent = 'Last updated: ' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }
      } catch(e) {}
    }

    async function onUpdateFilters() {
      var status = $('filterUpdateStatus');
      var progress = $('filterProgress');
      if (status) status.textContent = 'Updating...';
      if (progress) { progress.style.display = 'block'; progress.textContent = 'Fetching...'; }
      try {
        var result = await updateFilterLists();
        if (result && result.compiled) {
          if (progress) progress.textContent = 'OK';
          if (status) status.textContent = 'Updated: ' + new Date().toLocaleTimeString();
        } else {
          if (status) status.textContent = 'All lists unchanged';
        }
        // Best-effort wake background for DNR reconciliation
        _b.runtime.sendMessage({ type: 'reconcilePolicy' }).catch(function(){});
      } catch(e) {
        if (status) status.textContent = 'Failed: ' + e.message;
      }
      updateFilterLastUpdated();
      renderFilters();
    }
    if ($('updateFiltersBtn')) $('updateFiltersBtn').onclick = onUpdateFilters;
    if ($('updateFiltersBtn2')) $('updateFiltersBtn2').onclick = onUpdateFilters;
    updateFilterLastUpdated();
  } catch(e) {
    console.error('Filters render error:', e);
    var el = $('filterListsCard');
    if (el) el.innerHTML = '<div style="color:#dc3545;padding:12px">Error loading filters: ' + e.message + '</div>';
  }
}

async function renderRules() {
  try {
    var r = await _b.storage.local.get('durgashield_custom_rules');
    var rules = r.durgashield_custom_rules || [];
    var hr = await _b.storage.local.get('durgashield_hide_rules');
    var hideRules = hr.durgashield_hide_rules || {};
    var el = $('customRulesList');
    if (!el) return;
    var html = '';
    // Show DNR rules
    rules.forEach(function(r) {
      var pattern = escapeHtml(r.pattern);
      html += '<div class="rule-entry" style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid #eee"><span><span style="color:' + (r.action==='allow'?'#28a745':'#e94560') + ';font-weight:600">' + (r.action==='allow'?'ALLOW':'BLOCK') + '</span> <span style="color:#555">' + pattern + '</span></span><button class="btn btn-secondary" data-del="dnr-' + r.id + '" style="padding:2px 8px;font-size:10px">&#x2716;</button></div>';
    });
    // Show hide rules (from element picker)
    for (var host in hideRules) {
      hideRules[host].forEach(function(sel, idx) {
        var hostEsc = escapeHtml(host);
        var selEsc = escapeHtml(sel);
        html += '<div class="rule-entry" style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid #eee"><span><span style="color:#e94560;font-weight:600">HIDE</span> <span style="color:#555">' + selEsc + '</span> <span style="font-size:10px;color:#888">(' + hostEsc + ')</span></span><button class="btn btn-secondary" data-del="hide-' + host + '-' + idx + '" style="padding:2px 8px;font-size:10px">&#x2716;</button></button></div>';
      });
    }
    if (html === '') { el.innerHTML = '<div class="empty-state">No custom rules.</div>'; }
    else {
      el.innerHTML = html;
      el.querySelectorAll('[data-del]').forEach(function(btn) {
        btn.onclick = async function() {
          var val = this.dataset.del;
          if (val.startsWith('dnr-')) {
            var id = parseInt(val.replace('dnr-', ''));
            var r2 = await _b.storage.local.get('durgashield_custom_rules');
            var list = (r2.durgashield_custom_rules || []).filter(function(x) { return x.id !== id; });
            await _b.storage.local.set({ durgashield_custom_rules: list });
          } else if (val.startsWith('hide-')) {
            var parts = val.split('-');
            var hIdx = parseInt(parts.pop());
            var hHost = parts.slice(1).join('-');
            var hr2 = await _b.storage.local.get('durgashield_hide_rules');
            var hRules = hr2.durgashield_hide_rules || {};
            if (hRules[hHost]) {
              hRules[hHost] = hRules[hHost].filter(function(s, i) { return i !== hIdx; });
              if (hRules[hHost].length === 0) delete hRules[hHost];
              await _b.storage.local.set({ durgashield_hide_rules: hRules });
            }
          }
          renderRules();
        };
      });
    }
    if ($('addCustomRuleBtn')) {
      $('addCustomRuleBtn').onclick = async function() {
        var pattern = $('customRulePattern').value.trim();
        var action = $('customRuleAction').value;
        if (!pattern) return;
        if (pattern.length > 200) { alert('Pattern too long (max 200 chars)'); return; }
        if (!/^[\w\-.*/?&=:;@+$!~'()%#]+$/.test(pattern) || /[<>"\\]/.test(pattern)) {
          alert('Pattern contains invalid characters. Use only URL-safe characters.'); return;
        }
        if (pattern.startsWith('/') || pattern.startsWith('.')) { alert('Pattern must not start with / or .'); return; }
        var r2 = await _b.storage.local.get('durgashield_custom_rules');
        var list = r2.durgashield_custom_rules || [];
        var maxId = list.reduce(function(m,r) { return Math.max(m, r.id||0); }, 0);
        list.push({ id:maxId+1, pattern:pattern, action:action, priority:1 });
        await _b.storage.local.set({ durgashield_custom_rules: list });
        $('customRulePattern').value = '';
        renderRules();
      };
    }
  } catch(e) { console.error('Rules render error:', e); }
}

async function renderYouTubeWhitelist() {
  var el = $('ytWhitelistCard');
  if (!el) return;
  try {
    var r = await _b.runtime.sendMessage({ type:'getYouTubeWhitelist' });
    if (!r || r.length === 0) {
      el.innerHTML = '<div class="empty-state">No channels whitelisted. Visit a YouTube video and click "Allow ads" in the popup.</div>';
      return;
    }
    el.innerHTML = r.map(function(c) {
      var name = escapeHtml(c.name);
      var id = escapeHtml(c.id || '');
      return '<div class="filter-list-item"><span>' + name + ' <span class="badge">' + id + '</span></span><button class="btn btn-secondary" data-yt-del="' + id + '" style="padding:2px 8px;font-size:10px">Remove</button></div>';
    }).join('');
    el.querySelectorAll('[data-yt-del]').forEach(function(btn) {
      btn.onclick = async function() {
        await _b.runtime.sendMessage({ type:'removeYouTubeWhitelist', channelId: this.dataset.ytDel });
        renderYouTubeWhitelist();
      };
    });
  } catch(e) { el.innerHTML = '<div class="empty-state">Error loading whitelist</div>'; }
}

let _logChunkSize = 20;
let _logLoaded = 0;

async function refreshFilterLog() {
  try {
    var count = await _b.runtime.sendMessage({ type: MSG.GET_LOG_COUNT });
    if ($('filterLogCount')) $('filterLogCount').textContent = count + ' entries';
    var el = $('filterLogList');
    if (!el) return;
    if (_logLoaded === 0) {
      el.textContent = '';
      if (count === 0) {
        var emptyDiv = document.createElement('div'); emptyDiv.className = 'empty-state'; emptyDiv.textContent = 'No entries.'; el.appendChild(emptyDiv);
        return;
      }
    }
    var fresh = await _b.runtime.sendMessage({ type: MSG.GET_FILTER_LOG_RANGE, limit: _logChunkSize, offset: _logLoaded });
    if (fresh.length === 0) return;
    var frag = document.createDocumentFragment();
    fresh.forEach(function(e) {
      var entry = document.createElement('div'); entry.className = 'log-entry';
      entry.textContent = '[' + (e.ruleId||'?') + '] ' + (e.url||'') + ' ' + (e.ts?new Date(e.ts).toLocaleTimeString():'');
      frag.appendChild(entry);
    });
    el.appendChild(frag);
    _logLoaded += fresh.length;
  } catch(e) {}
}

function resetFilterLogView() {
  _logLoaded = 0;
  var el = $('filterLogList');
  if (el) el.textContent = '';
  refreshFilterLog();
}

let logRefreshInterval = null;
function startLogRefresh() {
  resetFilterLogView();
  if (logRefreshInterval) clearInterval(logRefreshInterval);
  logRefreshInterval = setInterval(resetFilterLogView, 10000);
}

function stopLogRefresh() {
  if (logRefreshInterval) { clearInterval(logRefreshInterval); logRefreshInterval = null; }
}

async function renderAdvanced() {
  try {
    startLogRefresh();
    if ($('clearFilterLogBtn')) {
      $('clearFilterLogBtn').onclick = async function() {
        await _b.runtime.sendMessage({ type: MSG.CLEAR_FILTER_LOG });
        resetFilterLogView();
      };
    }
    if ($('copyFilterLogBtn')) {
      $('copyFilterLogBtn').onclick = async function() {
        var log = await _b.runtime.sendMessage({ type: MSG.GET_FILTER_LOG });
        var text = log.slice(0, 50).map(function(e) { return '[' + (e.ruleId||'?') + '] ' + (e.url||'') + ' ' + (e.ts?new Date(e.ts).toLocaleTimeString():''); }).join('\n');
        navigator.clipboard.writeText(text);
        this.textContent = 'Copied!';
        setTimeout(() => { this.textContent = 'Copy'; }, 2000);
      };
    }
    var logList = $('filterLogList');
    if (logList) {
      logList.addEventListener('scroll', function() {
        if (logList.scrollTop + logList.clientHeight >= logList.scrollHeight - 40) {
          refreshFilterLog();
        }
      });
    }
    if ($('exportFilterLogBtn')) {
      $('exportFilterLogBtn').onclick = async function() {
        var data = await _b.runtime.sendMessage({ type: MSG.EXPORT_FILTER_LOG });
        var blob = new Blob([data], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'durgashield-filter-log.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.textContent = 'Exported!';
        setTimeout(() => { this.textContent = 'Export CSV'; }, 2000);
      };
    }
    // Disabled Rules
    var r2 = await _b.storage.local.get('durgashield_disabled_rules');
    var ids = r2.durgashield_disabled_rules || [];
    if ($('disabledRulesList')) $('disabledRulesList').textContent = ids.length ? ids.join(', ') : 'None';
    if ($('toggleDisabledRuleBtn')) {
      $('toggleDisabledRuleBtn').onclick = async function() {
        var input = $('disabledRuleInput');
        var id = parseInt(input.value.trim());
        if (!id) return;
        var r3 = await _b.storage.local.get('durgashield_disabled_rules');
        var list = r3.durgashield_disabled_rules || [];
        if (list.includes(id)) list = list.filter(function(i) { return i !== id; });
        else list.push(id);
        await _b.storage.local.set({ durgashield_disabled_rules: list });
        input.value = '';
        renderAdvanced();
      };
    }
    // Container status
    renderContainerStatus();
    // JS Blocking
    renderJsBlocking();
    // Browser Cleanup
    renderCleanup();
    // Import / Export
    renderImportExport();
    // Password Leak Detection
    renderPasswordLeak();
    // Site Blocker
    renderSiteBlocker();
    // Acceptable Ads
    renderAcceptableAds();
    // Reset Stats
    if ($('resetStats')) {
      $('resetStats').onclick = async function() {
        await _b.storage.local.set({ durgashield_stats:{ total:0, today:0, date:new Date().toDateString() } });
      };
    }
  } catch(e) { console.error('Advanced render error:', e); }
}

async function renderContainerStatus() {
  var el = $('containerStatus');
  var dl = $('domainList');
  if (!el) return;
  try {
    var info = await _b.runtime.sendMessage({ type:'getContainerStatus' });
    if (info && info.exists) {
      el.innerHTML = '<span style="color:#28a745">&#x25CF;</span> Container <strong>' + escapeHtml(info.name) + '</strong> is active';
      if (dl) dl.innerHTML = info.domains.map(function(d) { return '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#f0f0f0;color:#555;border:1px solid #ddd">' + escapeHtml(d) + '</span>'; }).join('');
    } else {
      el.innerHTML = '<span style="color:#888">&#x25CB;</span> No container found';
    }
  } catch(e) { el.innerHTML = 'Container status unavailable'; }
  if ($('toggle-container')) {
    $('toggle-container').checked = store.get('containerIsolation') !== false;
    $('toggle-container').onchange = function() {
      store.set('containerIsolation', this.checked);
      saveConfigDebounced();
    };
  }
  if ($('toggle-autoUpdate')) {
    $('toggle-autoUpdate').checked = store.get('autoUpdate') !== false;
    $('toggle-autoUpdate').onchange = function() {
      store.set('autoUpdate', this.checked);
      saveConfigDebounced();
    };
  }
}

async function renderJsBlocking() {
  try {
    var r = await _b.runtime.sendMessage({ type:'getJsSettings' });
    if ($('toggle-js-global')) {
      $('toggle-js-global').checked = r && r.global === false;
      $('toggle-js-global').onchange = function() {
        _b.runtime.sendMessage({ type:'setJsSetting', scope:'global', enabled: this.checked });
      };
    }
    if ($('toggle-js-site')) {
      var host = '';
      try {
        var tabs = await _b.tabs.query({ active:true, currentWindow:true });
        if (tabs[0] && tabs[0].url) host = new URL(tabs[0].url).hostname;
      } catch(e) {}
      $('toggle-js-site').checked = r && r.sites && r.sites[host] === false;
      $('toggle-js-site').onchange = function() {
        _b.runtime.sendMessage({ type:'setJsSetting', scope:'site', host:host, enabled: this.checked });
      };
    }
  } catch(e) {}
}

async function renderCleanup() {
  if ($('cleanupBtn')) {
    $('cleanupBtn').onclick = async function() {
      var since = parseInt($('cleanupTimeRange').value) || 0;
      var cache = $('cleanupCache').checked;
      var cookies = $('cleanupCookies').checked;
      var history = $('cleanupHistory').checked;
      var status = $('cleanupStatus');
      if (status) status.textContent = 'Cleaning...';
      try {
        var resp = await _b.runtime.sendMessage({ type:'handleBrowserCleanup', since:since, cache:cache, cookies:cookies, history:history });
        if (status) status.textContent = resp.success ? 'Done: ' + new Date().toLocaleTimeString() : 'Error: ' + (resp.error||'unknown');
      } catch(e) {
        if (status) status.textContent = 'Error: ' + e.message;
      }
    };
  }
}

function renderImportExport() {
  if ($('exportSettingsBtn')) {
    $('exportSettingsBtn').onclick = async function() {
      var r = await _b.storage.local.get(null);
      var exportData = {};
      for (var key in r) {
        if (key.startsWith('durgashield_')) exportData[key] = r[key];
      }
      var blob = new Blob([JSON.stringify(exportData, null, 2)], { type:'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = 'durgashield-settings.json'; a.click();
      URL.revokeObjectURL(url);
      var status = $('importExportStatus');
      if (status) status.textContent = 'Exported ' + Object.keys(exportData).length + ' keys';
    };
  }
  if ($('importSettingsBtn')) {
    $('importSettingsBtn').onclick = function() { $('importFileInput').click(); };
  }
  if ($('importFileInput')) {
    $('importFileInput').onchange = async function(e) {
      var file = e.target.files[0];
      if (!file) return;
      try {
        var text = await file.text();
        var data = JSON.parse(text);
        for (var key in data) {
          if (key.startsWith('durgashield_')) await _b.storage.local.set({ [key]: data[key] });
        }
        var status = $('importExportStatus');
        if (status) status.textContent = 'Imported ' + Object.keys(data).length + ' keys. Reloading...';
        location.reload();
      } catch(err) {
        var status = $('importExportStatus');
        if (status) status.textContent = 'Error: ' + err.message;
      }
    };
  }
}

function renderPasswordLeak() {
  if ($('checkPasswordLeakBtn')) {
    $('checkPasswordLeakBtn').onclick = async function() {
      var input = $('passwordLeakInput');
      var pw = input.value;
      if (!pw) return;
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Checking...';
      var hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(pw));
      var hashHex = Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('').toUpperCase();
      var result = await _b.runtime.sendMessage({ type: MSG.CHECK_PASSWORD_LEAK, hash: hashHex });
      var el = $('passwordLeakResult');
      if (result.compromised) {
        el.innerHTML = '<span style="color:#dc3545;font-weight:600">&#x26A0; Compromised! Found in ' + result.count + ' breaches.</span>';
      } else if (result.error) {
        el.innerHTML = '<span style="color:#888">Error: ' + escapeHtml(result.error) + '</span>';
      } else {
        el.innerHTML = '<span style="color:#28a745;font-weight:600">&#x2713; Not found in known breaches.</span>';
      }
      input.value = '';
      btn.disabled = false;
      btn.textContent = 'Check';
      loadPasswordLeakHistory();
    };
  }
  if ($('clearPasswordLeaksBtn')) {
    $('clearPasswordLeaksBtn').onclick = async function() {
      await _b.runtime.sendMessage({ type: MSG.CLEAR_PASSWORD_LEAKS });
      loadPasswordLeakHistory();
    };
  }
  loadPasswordLeakHistory();
}
async function loadPasswordLeakHistory() {
  var el = $('passwordLeakCount');
  if (!el) return;
  var leaks = await _b.runtime.sendMessage({ type: MSG.GET_PASSWORD_LEAKS });
  el.textContent = leaks.length + ' checks';
}

async function renderPermissions() {
  var el = $('permissionsList');
  if (!el) return;
  try {
    var list = await _b.runtime.sendMessage({ type:'getSitePermissions' });
    if (!list || list.length === 0) {
      el.innerHTML = '<span style="color:#555">No permission requests tracked yet</span>';
    } else {
      el.innerHTML = list.slice(-20).reverse().map(function(p) {
        var host = escapeHtml(p.host);
        var perms = escapeHtml(p.permissions.join(', '));
        var seen = escapeHtml(new Date(p.lastSeen).toLocaleDateString());
        return '<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #eee;font-size:11px">' +
          '<span>' + host + '</span><span style="color:#888">' + perms + ' <small>' + seen + '</small></span></div>';
      }).join('');
    }
  } catch(e) { el.innerHTML = 'Error loading permissions'; }
  if ($('clearPermissionsBtn')) {
    $('clearPermissionsBtn').onclick = async function() {
      await _b.storage.local.set({ durgashield_site_permissions: [] });
      renderPermissions();
    };
  }
}

async function renderCDNReplacement() {
  var card = $('cdnReplacementCard');
  var details = $('cdnReplacementDetails');
  if (!card || !details) return;
  var enabled = store.get('cdnReplacement') !== false;
  card.style.display = enabled ? 'block' : 'none';
  if (!enabled) return;
  try {
    var map = await _b.runtime.sendMessage({ type: MSG.GET_CDN_MAP });
    if (!map) map = { entries: [], version: '0', source: 'bundled' };
    var entries = map.entries || [];
    var mapLastUpdate = map.lastUpdate ? new Date(map.lastUpdate).toLocaleString() : 'Never';
    var version = map.version || '1.0';
    var count = await _b.storage.local.get('durgashield_cdn_rules_count');
    var rulesCount = count.durgashield_cdn_rules_count || 0;
    var extensionPath = _b.runtime.getURL('resources/lib/');
    var fs = await _b.runtime.sendMessage({ type: MSG.GET_CDN_FILES_STATUS });
    var updatedCount = fs ? fs.count : 0;
    var filesUpdatedAt = (fs && fs.updated) ? new Date(fs.updated).toLocaleString() : 'Never';
    var updatedFilesMap = (fs && fs.files) ? fs.files : {};

    var libs = [
      { lib:'jQuery', version:'3.6.0', cdnPath:'ajax/libs/jquery/3.6.0/jquery.min.js' },
      { lib:'jQuery', version:'3.7.1', cdnPath:'ajax/libs/jquery/3.7.1/jquery.min.js' },
      { lib:'jQuery', version:'3.7.1 (dev)', cdnPath:'ajax/libs/jquery/3.7.1/jquery.js' },
      { lib:'AngularJS', version:'1.8.3', cdnPath:'ajax/libs/angular.js/1.8.3/angular.min.js' },
      { lib:'Bootstrap', version:'4.6.2 (css)', cdnPath:'ajax/libs/twitter-bootstrap/4.6.2/css/bootstrap.min.css' },
      { lib:'Bootstrap', version:'4.6.2 (js)', cdnPath:'ajax/libs/twitter-bootstrap/4.6.2/js/bootstrap.bundle.min.js' },
      { lib:'Bootstrap', version:'5.3.3 (css)', cdnPath:'ajax/libs/twitter-bootstrap/5.3.3/css/bootstrap.min.css' },
      { lib:'Bootstrap', version:'5.3.3 (js)', cdnPath:'ajax/libs/twitter-bootstrap/5.3.3/js/bootstrap.bundle.min.js' },
      { lib:'D3.js', version:'7.9.0', cdnPath:'ajax/libs/d3/7.9.0/d3.min.js' },
      { lib:'Font Awesome', version:'6.5.0', cdnPath:'ajax/libs/font-awesome/6.5.0/css/all.min.css' },
      { lib:'Lodash', version:'4.17.21', cdnPath:'ajax/libs/lodash.js/4.17.21/lodash.min.js' },
      { lib:'Modernizr', version:'2.8.3', cdnPath:'ajax/libs/modernizr/2.8.3/modernizr.min.js' },
      { lib:'Moment.js', version:'2.29.4', cdnPath:'ajax/libs/moment.js/2.29.4/moment.min.js' },
      { lib:'React', version:'18.2.0', cdnPath:'ajax/libs/react/18.2.0/react.production.min.js' },
      { lib:'ReactDOM', version:'18.2.0', cdnPath:'ajax/libs/react-dom/18.2.0/react-dom.production.min.js' },
      { lib:'Vue.js', version:'3.4.0', cdnPath:'ajax/libs/vue/3.4.0/vue.global.prod.js' }
    ];

    var html = '';

    // Info section
    html += '<div style="margin-bottom:12px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<tr><td style="padding:4px 8px;color:#555"><strong>Map Version:</strong></td><td style="padding:4px 8px">' + version + '</td></tr>';
    html += '<tr><td style="padding:4px 8px;color:#555"><strong>Map Last Reloaded:</strong></td><td style="padding:4px 8px">' + mapLastUpdate + '</td></tr>';
    html += '<tr><td style="padding:4px 8px;color:#555"><strong>Files Last Updated:</strong></td><td style="padding:4px 8px">' + filesUpdatedAt + '</td></tr>';
    html += '<tr><td style="padding:4px 8px;color:#555"><strong>Active DNR Redirect Rules:</strong></td><td style="padding:4px 8px">' + rulesCount + '</td></tr>';
    html += '<tr><td style="padding:4px 8px;color:#555"><strong>Updated Files in Cache:</strong></td><td style="padding:4px 8px">' + updatedCount + '</td></tr>';
    html += '<tr><td style="padding:4px 8px;color:#555"><strong>Local Storage Path:</strong></td><td style="padding:4px 8px;word-break:break-all;font-size:11px;font-family:monospace;color:#666">' + extensionPath + '</td></tr>';
    html += '</table>';

    // Action buttons
    html += '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
    html += '<button class="btn btn-primary" id="updateCDNFilesBtn" style="font-size:12px;padding:6px 16px">&#x1F504; Update Files from CDN</button>';
    html += '<button class="btn btn-secondary" id="updateCDNMapBtn" style="font-size:12px;padding:6px 16px">Reload Map</button>';
    html += '<span id="cdnUpdateStatus" style="font-size:11px;color:#888"></span>';
    html += '</div></div>';

    // File listing table
    html += '<div style="max-height:250px;overflow-y:auto;border:1px solid #eee;border-radius:4px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    html += '<thead><tr style="background:#f5f5f5;position:sticky;top:0">';
    html += '<th style="padding:4px 6px;text-align:left;border-bottom:1px solid #ddd">Library</th>';
    html += '<th style="padding:4px 6px;text-align:left;border-bottom:1px solid #ddd">Version</th>';
    html += '<th style="padding:4px 6px;text-align:left;border-bottom:1px solid #ddd">CDN Status</th>';
    html += '</tr></thead><tbody>';
    libs.forEach(function(l) {
      var isUpdated = Object.keys(updatedFilesMap).some(function(k) { return k.includes(l.cdnPath.replace('ajax/libs/', '')); });
      var statusColor = isUpdated ? '#28a745' : '#888';
      var statusText = isUpdated ? 'Updated' : 'Bundled';
      html += '<tr><td style="padding:3px 6px;border-bottom:1px solid #f0f0f0">' + l.lib + '</td>' +
        '<td style="padding:3px 6px;border-bottom:1px solid #f0f0f0;font-family:monospace">' + l.version + '</td>' +
        '<td style="padding:3px 6px;border-bottom:1px solid #f0f0f0;color:' + statusColor + '">' + statusText + '</td></tr>';
    });
    html += '</tbody></table></div>';

    // Map entries listing (collapsed)
    html += '<div style="margin-top:8px"><a href="#" id="toggleMapEntries" style="font-size:11px;color:#888;text-decoration:none">&#x25B6; Show map entries</a></div>';
    html += '<div id="mapEntriesSection" style="display:none;margin-top:4px;max-height:150px;overflow-y:auto;border:1px solid #eee;border-radius:4px;padding:4px">';
    if (entries.length > 0) {
      html += '<table style="width:100%;border-collapse:collapse;font-size:10px">';
      html += '<thead><tr style="background:#f5f5f5"><th style="padding:3px 6px;text-align:left;border-bottom:1px solid #ddd">Host</th><th style="padding:3px 6px;text-align:left;border-bottom:1px solid #ddd">Pattern</th><th style="padding:3px 6px;text-align:left;border-bottom:1px solid #ddd">Local</th></tr></thead><tbody>';
      entries.forEach(function(e) {
        html += '<tr><td style="padding:2px 6px;border-bottom:1px solid #f0f0f0;font-family:monospace">' + escapeHtml(e.host||'') + '</td>' +
          '<td style="padding:2px 6px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:9px">' + escapeHtml(e.pathPattern||'') + '</td>' +
          '<td style="padding:2px 6px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:9px">' + escapeHtml(e.localTemplate||'') + '</td></tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<div style="color:#888;padding:8px">No map entries.</div>';
    }
    html += '</div>';

    details.innerHTML = html;

    // Wire buttons
    var updateFilesBtn = $('updateCDNFilesBtn');
    var updateMapBtn = $('updateCDNMapBtn');
    var statusEl = $('cdnUpdateStatus');
    var toggleLink = $('toggleMapEntries');
    var mapSection = $('mapEntriesSection');

    if (toggleLink && mapSection) {
      toggleLink.onclick = function(e) {
        e.preventDefault();
        var hidden = mapSection.style.display === 'none';
        mapSection.style.display = hidden ? 'block' : 'none';
        toggleLink.innerHTML = hidden ? '&#x25BC; Hide map entries' : '&#x25B6; Show map entries';
      };
    }

    if (updateFilesBtn) {
      updateFilesBtn.onclick = async function() {
        if (statusEl) statusEl.textContent = 'Downloading files from CDNs...';
        updateFilesBtn.disabled = true;
        if (updateMapBtn) updateMapBtn.disabled = true;
        try {
          var result = await _b.runtime.sendMessage({ type: MSG.UPDATE_CDN_FILES });
          if (result) {
            if (statusEl) statusEl.textContent = 'Done: ' + result.success + ' updated, ' + result.failed + ' failed';
          } else {
            if (statusEl) statusEl.textContent = 'Failed: no response';
          }
        } catch (e) {
          if (statusEl) statusEl.textContent = 'Error: ' + e.message;
        }
        updateFilesBtn.disabled = false;
        if (updateMapBtn) updateMapBtn.disabled = false;
        renderCDNReplacement();
      };
    }

    if (updateMapBtn) {
      updateMapBtn.onclick = async function() {
        if (statusEl) statusEl.textContent = 'Reloading map...';
        updateMapBtn.disabled = true;
        if (updateFilesBtn) updateFilesBtn.disabled = true;
        try {
          var result = await _b.runtime.sendMessage({ type: MSG.UPDATE_CDN_MAP });
          if (result && result.success) {
            if (statusEl) statusEl.textContent = 'Map reloaded (' + result.entries + ' entries)';
          } else {
            if (statusEl) statusEl.textContent = 'Failed: ' + (result ? result.error : 'unknown error');
          }
        } catch (e) {
          if (statusEl) statusEl.textContent = 'Error: ' + e.message;
        }
        updateMapBtn.disabled = false;
        if (updateFilesBtn) updateFilesBtn.disabled = false;
        renderCDNReplacement();
      };
    }
  } catch (e) {
    details.innerHTML = '<span style="color:#888">Error loading CDN details: ' + escapeHtml(e.message) + '</span>';
  }
}

/* ---------- Extension Risk Audit ---------- */
async function renderExtensionAudit(results) {
  var el = document.getElementById('extensionAuditResults');
  if (!el) return;
  if (!results || results.error) {
    el.innerHTML = '<div class="empty-state">' + (results ? escapeHtml(results.error) : 'No results') + '</div>';
    return;
  }
  if (results.length === 0) {
    el.innerHTML = '<div class="empty-state">No extensions found to audit.</div>';
    return;
  }
  var criticalCount = results.filter(function(e) { return e.riskLevel === 'critical'; }).length;
  var highCount = results.filter(function(e) { return e.riskLevel === 'high'; }).length;
  var mediumCount = results.filter(function(e) { return e.riskLevel === 'medium'; }).length;
  var html = '<div style="margin-bottom:8px;font-size:11px;color:#888">' +
    '<span style="color:#dc3545;font-weight:600">' + criticalCount + ' critical</span> &middot; ' +
    '<span style="color:#e94560;font-weight:600">' + highCount + ' high</span> &middot; ' +
    '<span style="color:#ffc107;font-weight:600">' + mediumCount + ' medium</span> &middot; ' +
    '<span style="color:#28a745;font-weight:600">' + (results.length - criticalCount - highCount - mediumCount) + ' low</span> &middot; ' +
    results.length + ' total extensions';
  html += '</div>';
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var riskColors = { critical:'#dc3545', high:'#e94560', medium:'#ffc107', low:'#28a745' };
    var color = riskColors[r.riskLevel] || '#888';
    html += '<div style="display:flex;align-items:flex-start;gap:6px;padding:5px 0;border-bottom:1px solid #eee;font-size:11px">' +
      '<span style="width:10px;height:10px;border-radius:50%;background:' + color + ';flex-shrink:0;margin-top:2px"></span>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-weight:600;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(r.name) + ' <span style="font-weight:400;color:#888">v' + escapeHtml(r.version) + '</span></div>';
    if (r.riskLevel === 'critical' || r.riskLevel === 'high') {
      if (r.highRiskPerms && r.highRiskPerms.length > 0) {
        html += '<div style="color:#dc3545;font-size:10px;margin-top:2px">High risk: ' + escapeHtml(r.highRiskPerms.join(', ')) + '</div>';
      }
      if (r.hasAllHosts) {
        html += '<div style="color:#e94560;font-size:10px">Access to all websites (&lt;all_urls&gt;)</div>';
      }
    }
    html += '<div style="color:#888;font-size:10px">' + (r.permissions ? r.permissions.length + ' permissions' : '0 permissions') + ' &middot; ' + (r.hostPermissions ? r.hostPermissions.length + ' host patterns' : '0 host patterns') + '</div>';
    html += '</div></div>';
  }
  el.innerHTML = html;
}

async function renderPrivacyScore() {
  try {
    var tabs = await _b.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0] || !tabs[0].url) return;
    var result = await _b.runtime.sendMessage({ type: MSG.GET_PRIVACY_SCORE, url: tabs[0].url });
    if (!result) return;
    var ring = document.getElementById('privacyScoreRing');
    if (!ring) return;
    var gradeColors = { A:'#28a745', B:'#17a2b8', C:'#ffc107', D:'#e94560', F:'#dc3545' };
    var gradeTexts = { A:'Excellent', B:'Good', C:'Fair', D:'Poor', F:'Critical' };
    ring.textContent = result.grade;
    ring.style.background = 'conic-gradient(' + (gradeColors[result.grade] || '#888') + ' ' + result.score + '%, #e0e0e0 ' + result.score + '%)';
    ring.style.color = gradeColors[result.grade] || '#888';
    var textEl = ring.nextElementSibling;
    if (textEl) textEl.textContent = gradeTexts[result.grade] || 'Unknown';
  } catch (e) {}
}

/* ---------- Site Blocker (Productivity) ---------- */
async function renderSiteBlocker() {
  var el = document.getElementById('siteBlockerCard');
  if (!el) return;
  var list = await _b.runtime.sendMessage({ type: MSG.GET_SITE_BLOCKER });
  var html = '<div style="margin-bottom:8px;font-size:11px;color:#555;line-height:1.5">Block distracting websites. Add one domain per line (e.g. <code>reddit.com</code>).</div>';
  html += '<textarea id="siteBlockerInput" style="width:100%;height:100px;border:1px solid #ddd;border-radius:4px;padding:6px;font-family:monospace;font-size:11px;resize:vertical">' + (list ? list.join('\n') : '') + '</textarea>';
  html += '<div style="margin-top:6px;display:flex;gap:8px;align-items:center">';
  html += '<button class="btn btn-primary" id="saveSiteBlockerBtn" style="font-size:11px;padding:4px 12px">&#x1F4BE; Save Block List</button>';
  html += '<span id="siteBlockerStatus" style="font-size:11px;color:#888"></span>';
  html += '</div>';
  el.innerHTML = html;
  var saveBtn = document.getElementById('saveSiteBlockerBtn');
  if (saveBtn) {
    saveBtn.onclick = async function() {
      var input = document.getElementById('siteBlockerInput');
      var domains = input.value.trim().split('\n').map(function(d) { return d.trim().toLowerCase(); }).filter(function(d) { return d.length > 0 && !d.startsWith('#') && d.includes('.'); });
      var statusEl = document.getElementById('siteBlockerStatus');
      try {
        await _b.runtime.sendMessage({ type: MSG.SAVE_SITE_BLOCKER, domains: domains });
        if (statusEl) statusEl.textContent = 'Saved ' + domains.length + ' domains';
      } catch (e) {
        if (statusEl) statusEl.textContent = 'Error: ' + e.message;
      }
    };
  }
}

/* ---------- Acceptable Ads Whitelist ---------- */
async function renderAcceptableAds() {
  var el = document.getElementById('acceptableAdsCard');
  if (!el) return;
  var list = await _b.runtime.sendMessage({ type: MSG.GET_ACCEPTABLE_ADS });
  var html = '<div style="margin-bottom:8px;font-size:11px;color:#555;line-height:1.5">Allow certain non-intrusive ad networks. Add one domain per line (e.g. <code>googleads.g.doubleclick.net</code>).</div>';
  html += '<textarea id="acceptableAdsInput" style="width:100%;height:80px;border:1px solid #ddd;border-radius:4px;padding:6px;font-family:monospace;font-size:11px;resize:vertical">' + (list ? list.join('\n') : '') + '</textarea>';
  html += '<div style="margin-top:6px;display:flex;gap:8px;align-items:center">';
  html += '<button class="btn btn-primary" id="saveAcceptableAdsBtn" style="font-size:11px;padding:4px 12px">&#x1F4BE; Save Whitelist</button>';
  html += '<span id="acceptableAdsStatus" style="font-size:11px;color:#888"></span>';
  html += '</div>';
  el.innerHTML = html;
  var saveBtn = document.getElementById('saveAcceptableAdsBtn');
  if (saveBtn) {
    saveBtn.onclick = async function() {
      var input = document.getElementById('acceptableAdsInput');
      var domains = input.value.trim().split('\n').map(function(d) { return d.trim().toLowerCase(); }).filter(function(d) { return d.length > 0 && !d.startsWith('#') && d.includes('.'); });
      var statusEl = document.getElementById('acceptableAdsStatus');
      try {
        await _b.runtime.sendMessage({ type: MSG.SAVE_ACCEPTABLE_ADS, domains: domains });
        if (statusEl) statusEl.textContent = 'Saved ' + domains.length + ' domains';
      } catch (e) {
        if (statusEl) statusEl.textContent = 'Error: ' + e.message;
      }
    };
  }
}

async function init() {
  try {
    await loadConfig();
    setupNav();
    await renderDashboard();
    renderPrivacyScore();
    await renderPermissions();
    _tabLoaded.dashboard = true;
    startLogRefresh();

    /* Dark Mode */
    var dmToggle = $('darkModeToggle');
    if (dmToggle) {
      var dm = await _b.storage.local.get('durgashield_dark_mode');
      var darkEnabled = dm.durgashield_dark_mode === true;
      dmToggle.checked = darkEnabled;
      document.documentElement.classList.toggle('dark', darkEnabled);
      dmToggle.onchange = function() {
        var val = dmToggle.checked;
        _b.storage.local.set({ durgashield_dark_mode: val }).catch(() => {});
        document.documentElement.classList.toggle('dark', val);
      };
    }

    /* Extension audit button */
    var scanBtn = document.getElementById('scanExtensionsBtn');
    if (scanBtn) {
      scanBtn.onclick = async function() {
        var statusEl = document.getElementById('extensionAuditStatus');
        var resultsEl = document.getElementById('extensionAuditResults');
        if (statusEl) statusEl.textContent = 'Scanning...';
        scanBtn.disabled = true;
        try {
          var results = await _b.runtime.sendMessage({ type: MSG.SCAN_EXTENSIONS });
          if (results && results.error) {
            if (statusEl) statusEl.textContent = 'Error: ' + results.error;
          } else {
            if (statusEl) statusEl.textContent = 'Last scan: ' + new Date().toLocaleTimeString();
            renderExtensionAudit(results);
          }
        } catch (e) {
          if (statusEl) statusEl.textContent = 'Error: ' + e.message;
        }
        scanBtn.disabled = false;
      };
      _b.runtime.sendMessage({ type: MSG.GET_EXTENSION_AUDIT }).then(function(results) {
        if (results && results.length > 0) {
          renderExtensionAudit(results);
          var statusEl = document.getElementById('extensionAuditStatus');
          if (statusEl) statusEl.textContent = 'Last scan: cached (' + results.length + ' extensions)';
        }
      });
    }
  } catch(e) {
    console.error('DurgaShield init error:', e);
    document.body.innerHTML += '<div style="background:#dc3545;color:white;padding:12px;margin:12px;border-radius:6px;font-size:13px">Error: ' + e.message + '</div>';
  }
}

document.addEventListener('DOMContentLoaded', init);
