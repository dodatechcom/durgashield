(function() {
  if (window._durgashield_loaded) return;
  window._durgashield_loaded = true;

  console.log('[DurgaShield] content script loaded on', location.hostname);

  const _b = typeof browser !== 'undefined' ? browser : chrome;

  let siteDisabled = false;

  const MSG = {
    ADD_HIDE_RULE: 'addHideRule',
    BLOCK_COUNT: 'blockCount',
    RECORD_SITE_BLOCK: 'recordSiteBlock',
    MALWARE_DETECTED: 'malwareDetected',
    REPORT_THIRD_PARTIES: 'reportThirdParties',
    XSS_DETECTED: 'xssDetected',
    ABE_BLOCKED: 'abeBlocked',
    INCREMENT_BLOCKED: 'incrementBlocked',
    AUTO_CHECK_PASSWORD: 'autoCheckPassword',
    CONFIG_UPDATED: 'configUpdated',
    ACTIVATE_ZAPPER: 'activateZapper',
    SET_JS_BLOCKED: 'setJsBlocked',
    STEALTH_UPDATED: 'stealthUpdated',
    COSMETIC_FILTERS: 'cosmeticFilters',
    APPLY_COSMETICS: 'applyCosmetics',
    SET_SITE_DISABLED: 'setSiteDisabled',
    SET_ENABLED: 'setEnabled',
    SITE_PREFS: 'sitePrefs',
    REMOVE_HIDE_RULE: 'removeHideRule'
  };

  const _confirmModals = new Map();

  function injectMainWorldCode(code) {
    try {
      const el = document.createElement('script');
      el.textContent = code;
      (document.documentElement || document.head || document.body).appendChild(el);
      el.remove();
    } catch (e) {}
  }
  injectMainWorldCode('window.__dgsBridged=true');
  document.addEventListener('dgs-bridge', (e) => {
    if (e.detail && e.detail.type === 'queueBlock') {
      queueBlockCount(e.detail.count || 1);
    }
  });

  /* Pre-emptive CSS: hide known ad elements before first paint */
  try {
    var _dgsHideStyle = document.createElement('style');
    _dgsHideStyle.id = 'dgs-instant-hide';
    _dgsHideStyle.textContent = 'ins.adsbygoogle,amp-ad,google-ad,.ad-panel,div[id^="div-gpt-ad"],div[id^="google_ads_iframe"],div[id*="google_adsense"],div[id*="gpt-ad-"],div[id*="gpt_ad_"],div[id^="ad-"],div[class*="ad-container"],div[class*="ad-wrapper"],div[class*="adslot"],div[data-adunit],div[data-ad-],iframe[src*="doubleclick.net"],iframe[src*="googlesyndication.com"],iframe[src*="googleadservices.com"],iframe[src*="amazon-adsystem.com"],iframe[src*="adservice.google.com"],.adsbygoogle[data-ad-status="unfilled"],[data-element="barcode"],[data-element="campaign"],[data-izone*="uc-area"],[data-element="branding"],div[id*="taboola"],div[class*="taboola"],div[class*="trc_"],div[id*="taboola-"],div[class*="video-rec"],div[class*="rec-item"],div[class*="organic-rec"],div[class*="native-rec"],div[class*="suggestions"],div[data-type="rbox"],div[data-placement*="Taboola"],.trc_related_container,.trc_rbox_div,.videocube-unit{display:none!important}';
    document.documentElement.appendChild(_dgsHideStyle);
  } catch (_e) { debugError('Pre-emptive CSS injection failed', _e); }
  /* Core ds-hidden style — injected synchronously so class-based hiding works immediately */
  try {
    var _dgsCore = document.createElement('style');
    _dgsCore.id = 'dgs-core-early';
    _dgsCore.textContent = '.ds-hidden,a[data-dgs-unsafe]{display:none!important}.ds-blocked{display:none!important}';
    document.documentElement.appendChild(_dgsCore);
  } catch (_e) {}

  function showConfirmModal(msg, title) {
    return new Promise((resolve) => {
      const existing = document.getElementById('dgs-modal-overlay');
      if (existing) existing.remove();
      const overlay = document.createElement('div');
      overlay.id = 'dgs-modal-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif';
      const box = document.createElement('div');
      box.style.cssText = 'background:#fff;color:#1a1a2e;padding:28px 32px;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.2);min-width:360px;max-width:480px;text-align:left';
      if (title) {
        const t = document.createElement('div');
        t.style.cssText = 'font-size:17px;margin-bottom:12px;font-weight:600';
        t.textContent = title;
        box.appendChild(t);
      }
      const msgEl = document.createElement('div');
      msgEl.style.cssText = 'font-size:14px;line-height:1.5;margin-bottom:20px;white-space:pre-wrap';
      msgEl.textContent = msg;
      box.appendChild(msgEl);
      const btnWrap = document.createElement('div');
      btnWrap.style.cssText = 'display:flex;gap:12px;justify-content:flex-end';
      const okBtn = document.createElement('button');
      okBtn.textContent = 'OK';
      okBtn.style.cssText = 'padding:10px 28px;background:#e94560;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600';
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = 'padding:10px 28px;background:#6c757d;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600';
      btnWrap.appendChild(okBtn);
      btnWrap.appendChild(cancelBtn);
      box.appendChild(btnWrap);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      okBtn.focus();
      okBtn.onclick = () => { overlay.remove(); resolve(true); };
      cancelBtn.onclick = () => { overlay.remove(); resolve(false); };
      overlay.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') { overlay.remove(); resolve(false); overlay.removeEventListener('keydown', handler); }
      });
    });
  }

  scriptlets['nano-setInterval-booster'] = function(multiplier) {
    const m = JSON.stringify(parseFloat(multiplier) || 0.01);
    injectMainWorldCode('(function(){var orig=window.setInterval;window.setInterval=function(fn,delay){return orig.call(window,fn,Math.max(1,Math.floor(delay*'+m+')))};})();');
  };

  scriptlets['addEventListener-defuser'] = function(type) {
    const t = JSON.stringify(type);
    injectMainWorldCode('(function(){var orig=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(evt,fn,opts){if(evt&&evt.toString()===' + t + ')return;return orig.call(this,evt,fn,opts);}})();');
  };

  function isFirstParty(url) {
    try {
      const reqHost = new URL(url).hostname.replace(/^www\./, '');
      return reqHost === window.location.hostname.replace(/^www\./, '');
    } catch { return false; }
  }

  scriptlets['prevent-xhr'] = function(urlPattern) {
    const orig = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (url && url.toString().includes(urlPattern) && !isFirstParty(url)) {
        orig.apply(this, arguments);
        this.abort();
        return;
      }
      return orig.apply(this, arguments);
    };
  };

  scriptlets['prevent-fetch'] = function(urlPattern) {
    const pat = JSON.stringify(urlPattern);
    injectMainWorldCode(`
      (function(){
        var orig = window.fetch;
        window.fetch = function(url, options) {
          var urlStr = typeof url === 'string' ? url : (url ? url.url || url.toString() : '');
          if (urlStr.indexOf(${pat}) !== -1 && !/^(https?:\\/\\/)?([^\\/]+\\.)?${window.location.hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i.test(urlStr)) {
            return Promise.resolve(new Response('', { status: 200 }));
          }
          return orig.apply(this, arguments);
        };
      })();
    `);
  };

  scriptlets['json-prune'] = function(propPath) {
    const path = JSON.stringify(propPath);
    injectMainWorldCode(`
      (function(){
        var origParse = JSON.parse;
        JSON.parse = function(text, reviver) {
          var result = origParse.call(this, text, reviver);
          if (result && typeof result === 'object') {
            (function pruneProp(obj, p) {
              if (!obj || !p) return;
              var parts = p.split('.');
              var current = obj;
              for (var i = 0; i < parts.length - 1; i++) {
                if (Array.isArray(current)) {
                  for (var j = 0; j < current.length; j++) pruneProp(current[j], parts.slice(i).join('.'));
                  return;
                }
                if (current[parts[i]] === undefined) return;
                current = current[parts[i]];
              }
              delete current[parts[parts.length - 1]];
            })(result, ${path});
          }
          return result;
        };
      })();
    `);
  };

  scriptlets['abort-current-inline-script'] = function(pattern) {
    if (!pattern) return;
    const origCreateElement = document.createElement.bind(document);
    var storedTextMap = new WeakMap();
    document.createElement = function(tag, options) {
      const el = origCreateElement(tag, options);
      if (tag && tag.toLowerCase() === 'script') {
        storedTextMap.set(el, '');
        var origTextDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'text');
        var origTcDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'textContent');
        Object.defineProperty(el, 'text', {
          get: function() { return storedTextMap.get(el) || ''; },
          set: function(v) {
            if (typeof v === 'string' && v.includes(pattern)) return;
            storedTextMap.set(el, v);
            if (origTextDesc && origTextDesc.set) origTextDesc.set.call(el, v);
          },
          configurable: true
        });
        Object.defineProperty(el, 'textContent', {
          get: function() { return storedTextMap.get(el) || ''; },
          set: function(v) {
            if (typeof v === 'string' && v.includes(pattern)) return;
            storedTextMap.set(el, v);
            if (origTcDesc && origTcDesc.set) origTcDesc.set.call(el, v);
          },
          configurable: true
        });
      }
      return el;
    };
  };

  scriptlets['remove-attr'] = function(selector, attr) {
    if (!selector || !attr) return;
    const key = 'rma_' + selector + '_' + attr;
    if (scriptlets._done && scriptlets._done.has(key)) return;
    if (!scriptlets._done) scriptlets._done = new Set();
    scriptlets._done.add(key);
    const els = document.querySelectorAll(selector);
    for (const el of els) el.removeAttribute(attr);
    const obs = new MutationObserver(() => {
      const els = document.querySelectorAll(selector);
      for (const el of els) el.removeAttribute(attr);
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  };

  scriptlets['remove-class'] = function(selector, cls) {
    if (!selector || !cls) return;
    const key = 'rmc_' + selector + '_' + cls;
    if (scriptlets._done && scriptlets._done.has(key)) return;
    if (!scriptlets._done) scriptlets._done = new Set();
    scriptlets._done.add(key);
    const els = document.querySelectorAll(selector);
    for (const el of els) el.classList.remove(cls);
    const obs = new MutationObserver(() => {
      const els = document.querySelectorAll(selector);
      for (const el of els) el.classList.remove(cls);
    });
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  };

  scriptlets['set-cookie'] = function(name, value) {
    if (!name) return;
    document.cookie = name + '=' + encodeURIComponent(value || '') + '; path=/; max-age=31536000';
  };

  /* Map hostname → [anti-adblock bypasses] */
  const KNOWN_ANTI_ADBLOCK_BYPASSES = {
    'adblocktest.org': [['set-constant', 'FuckAdBlock', undefined], ['set-constant', 'BlockAdBlock', undefined]],
    'blockadblock.com': [['set-constant', 'FuckAdBlock', undefined], ['set-constant', 'BlockAdBlock', undefined]],
    'test-adblock.com': [['set-constant', 'window.adblock', false], ['set-constant', 'window.adBlockDetected', false]],
    'ad-block-test.com': [['set-constant', 'window.adblock', false]],
  };

  function applyScriptletsForHost(host) {
    const bypasses = KNOWN_ANTI_ADBLOCK_BYPASSES[host];
    if (!bypasses) return;
    for (const [name, ...args] of bypasses) {
      if (scriptlets[name]) {
        try { scriptlets[name].apply(null, args); } catch (e) { debugError('Scriptlet failed', name, e); }
      }
    }
  }

  /* Generic anti-adblock property neutering (applies to all sites) */
  function neuterGenericAntiAdblock() {
    const targets = [
      ['FuckAdBlock', 'detect'],
      ['BlockAdBlock', 'detect'],
      ['adblock', 'detected'],
      ['adBlockDetected', true],
      ['adBlock', 'active'],
      ['adsBlocked', true],
      ['AdBlock', 'installed'],
      ['abp', 'detected'],
    ];
    for (const [ns, prop] of targets) {
      scriptlets['set-constant'](ns + '.' + prop, false);
    }
  }

  const ISOLATED_DOMAINS = [
    'facebook.com', 'www.facebook.com', 'm.facebook.com',
    'fb.com', 'messenger.com', 'www.messenger.com',
    'instagram.com', 'www.instagram.com',
    'whatsapp.com', 'web.whatsapp.com',
    'fbcdn.net', 'facebook.net',
    'fb.watch', 'www.fb.watch'
  ];

  function hostname() { return window.location.hostname.toLowerCase().replace(/^www\./, ''); }
  function isYouTube() { const h = hostname(); return h === 'youtube.com' || h === 'm.youtube.com'; }
  function isFacebookOrigin() { const h = window.location.hostname.toLowerCase(); return h === 'facebook.com' || h.endsWith('.facebook.com') || h === 'fb.com' || h.endsWith('.fb.com') || h === 'facebook.net' || h.endsWith('.facebook.net') || h === 'fbcdn.net' || h.endsWith('.fbcdn.net'); }
  function isIsolatedPage() { const h = hostname(); return ISOLATED_DOMAINS.some(d => { const c = d.replace(/^www\./, ''); return h === c || h.endsWith('.' + c); }); }
  function isCryptoSite() { const h = hostname(); return h === 'coinmarketcap.com' || h.endsWith('.coinmarketcap.com') || h === 'bitget.com' || h.endsWith('.bitget.com') || h === 'coingecko.com' || h.endsWith('.coingecko.com'); }
  function isAdminPanel() {
    const h = window.location.hostname.toLowerCase();
    const p = window.location.pathname;
    return h.includes('web-hosting.com') || h.includes('.cpanel.') || h === 'cpanel' || p.includes('cpsess') || /\/frontend\/(jupiter|paper_lantern|x3|x5)\//.test(p) || h.includes('.whm.');
  }

  // Inject hide-rule style tag immediately (before any async callback)
  try {
    var _st = document.createElement('style');
    _st.id = 'dgs-hide-css';
    (document.head || document.documentElement).appendChild(_st);
  } catch (_e) {}

  _b.storage.local.get(['durgashield_config', 'durgashield_hide_rules', 'durgashield_enabled'], (result) => {
    const saved = result.durgashield_config;
    if (saved) Object.assign(config, saved);
    if (result.durgashield_enabled === false) { siteDisabled = true; }
    var hideRules = result.durgashield_hide_rules || {};
    var host = hostname();
    var selectors = hideRules[host];
    if (selectors && selectors.length > 0) {
      var styleTag = document.getElementById('dgs-hide-css');
      if (styleTag) styleTag.textContent = selectors.map(function(s) { return s + '{display:none!important}'; }).join('\n');
    }
    if (config.ads !== false) {
      neuterGenericAntiAdblock();
      applyScriptletsForHost(hostname());
    }
    init();
  });

  _b.runtime.onMessage.addListener((msg, sender) => {
    if (!sender || sender.id !== _b.runtime.id) return;
    if (msg.type === MSG.CONFIG_UPDATED) {
      Object.assign(config, msg.config);
      if (!config.ads) {
        const s = document.getElementById('dgs-instant-hide');
        if (s) s.remove();
      }
      if (isFacebookOrigin()) {
        const bar = document.getElementById('durgashield-container-bar');
        if (bar) { bar.remove(); document.documentElement.style.marginTop = ''; }
      }
    }
    if (msg.type === MSG.ACTIVATE_ZAPPER || msg.action === 'START_ELEMENT_PICKER') {
      activateZapper();
    }
    if (msg.type === MSG.SET_SITE_DISABLED) {
      siteDisabled = msg.disabled === true;
      return;
    }
    if (msg.type === MSG.SET_ENABLED) {
      siteDisabled = !msg.enabled;
      if (!msg.enabled) {
        document.querySelectorAll('.ds-hidden').forEach(function(el) { el.classList.remove('ds-hidden'); });
        var s = document.getElementById('dgs-instant-hide');
        if (s) s.remove();
      } else {
        if (config.ads) {
          var existing = document.getElementById('dgs-instant-hide');
          if (!existing) {
            var hs = document.createElement('style');
            hs.id = 'dgs-instant-hide';
            hs.textContent = 'ins.adsbygoogle,amp-ad,google-ad,.ad-panel,div[id^="div-gpt-ad"],div[id^="google_ads_iframe"],div[id*="google_adsense"],div[id*="gpt-ad-"],div[id*="gpt_ad_"],div[id^="ad-"],div[class*="ad-container"],div[class*="ad-wrapper"],div[class*="adslot"],div[data-adunit],div[data-ad-],iframe[src*="doubleclick.net"],iframe[src*="googlesyndication.com"],iframe[src*="googleadservices.com"],iframe[src*="amazon-adsystem.com"],iframe[src*="adservice.google.com"],.adsbygoogle[data-ad-status="unfilled"],[data-element="barcode"],[data-element="campaign"],[data-izone*="uc-area"],[data-element="branding"],div[id*="taboola"],div[class*="taboola"],div[class*="trc_"],div[id*="taboola-"],div[class*="video-rec"],div[class*="rec-item"],div[class*="organic-rec"],div[class*="native-rec"],div[class*="suggestions"],div[data-type="rbox"],div[data-placement*="Taboola"],.trc_related_container,.trc_rbox_div,.videocube-unit{display:none!important}';
            document.documentElement.appendChild(hs);
          }
          removeAdPlaceholders();
          removeSpacerDivs();
        }
      }
      return;
    }
    if (msg.type === 'setDebug') {
      debugMode = msg.enabled === true;
      return;
    }
    if (msg.type === MSG.SET_JS_BLOCKED) {
      jsBlocked = msg.blocked;
      if (jsBlocked) {
        document.querySelectorAll('script[src]').forEach(s => {
          if (s.src && !s.src.startsWith('moz-extension') && !s.src.startsWith('chrome-extension')) s.remove();
        });
      }
    }
    if (msg.type === MSG.STEALTH_UPDATED) {
      Object.assign(stealthConfig, msg.config || {});
      applyStealth();
    }
    if (msg.type === MSG.COSMETIC_FILTERS || msg.type === MSG.APPLY_COSMETICS) {
      applyCosmeticFilters(msg.cosmetics);
    }
    if (msg.type === MSG.SITE_PREFS) {
      sitePrefs = msg.prefs || {};
    }
  });

  var DS_STYLE = null;
  function injectDSStyle(rules) {
    if (!DS_STYLE) {
      DS_STYLE = document.createElement('style');
      DS_STYLE.id = 'dgs-core-style';
      document.documentElement.appendChild(DS_STYLE);
    }
    DS_STYLE.textContent += (DS_STYLE.textContent ? '\n' : '') + rules;
  }

  /* Inject CSS into document — shadow DOM penetration requires a per-component observer */
  function injectStyleDeep(css) {
    injectDSStyle(css);
  }

  function init() {
    if (siteDisabled) { debugLog('Site disabled, skipping init'); return; }

    injectDSStyle('.ds-hidden{display:none!important}.ds-blocked{display:none!important}.ds-outlined{outline:2px solid rgba(233,69,96,0.4)!important}.ds-override-scroll{overflow:auto!important}.ds-opacity-zero{opacity:0!important}');

    _b.storage.local.get(SITE_PREFS_KEY, (r) => {
      sitePrefs = r[SITE_PREFS_KEY] || {};
    });
    debugLog('init() on', hostname());

    const host = hostname();
    const isGoogle = host.endsWith('.google.com') || host === 'google.com';
    let isSubFrame;
    try { isSubFrame = window.self !== window.top; } catch (e) { isSubFrame = true; }
    if (!config.ads) {
      const s = document.getElementById('dgs-instant-hide');
      if (s) s.remove();
    }
    applyCustomHideRules();
    if (!isSubFrame) {
      if (!isGoogle) loadCosmeticFilters();
      if (isIsolatedPage() && config.containerIsolation) showContainerIndicator();
      if (!isFacebookOrigin() && !_isAmazonPayment) blockFacebookEmbeds();
      if (!isGoogle) applyExistingFeatures();
      if (config.searchAnnotations) setupSearchAnnotations();
      if (config.passwordLeakCheck !== false && !_isAmazonPayment) setupPasswordLeakCheck();
      if (isYouTube() && config.ads) startYouTubeAdSkip();
      if (isYouTube()) { detectYouTubeChannel(); setTimeout(checkYouTubeWhitelist, 2000); }
      if (!isGoogle && !isCryptoSite()) initPrivacyFeatures();
      initGenAIDLP();
      detectDefacement();
      detectPhoneScams();
      detectScareware();
      detectPhishingLinks();
      applyFBPrivacy();
    } else {
      if (config.popupBlocking && !_isAmazonPayment) overrideWindowOpen();
      if (config.ads && !isYouTube() && !_isAmazonPayment) removeAdElements();
    }
    /* Fallback: periodic placeholder check for late-loading ad containers (up to 60s) */
    if (config.ads && !isSubFrame) {
      var _phRuns = 0;
      (function _phCheck() {
        removeAdPlaceholders();
        removeSpacerDivs();
        if (++_phRuns < 20) setTimeout(_phCheck, 3000);
      })();
    }
    startObserver();
  }

  function isValidId(id) {
    return id.length < 40 && !/\d{3,}/.test(id) && !id.includes('random');
  }

  function findContainer(el) {
    let current = el;
    for (let i = 0; i < 5; i++) {
      if (!current || current === document.body || current === document.documentElement) break;
      const rect = current.getBoundingClientRect();
      const style = window.getComputedStyle(current);
      if (rect.width >= 200 && rect.height >= 80 && style.display !== 'inline') {
        return current;
      }
      current = current.parentElement;
    }
    return el;
  }

  function getAttrSelector(el) {
    const checks = [
      ['src', 'ads'], ['src', 'doubleclick'], ['href', 'sponsor'],
      ['data-ad', ''], ['aria-label', 'ad'], ['data-advertisement', '']
    ];
    for (const [attr, keyword] of checks) {
      const val = el.getAttribute(attr);
      if (val && (!keyword || val.includes(keyword))) {
        return el.tagName.toLowerCase() + '[' + attr + (keyword ? '*="' + keyword + '"' : '') + ']';
      }
    }
    return null;
  }

  function getStableClassSelector(el) {
    if (!el.classList.length) return null;
    const clean = Array.from(el.classList).filter(c =>
      !/\d/.test(c) && c !== 'active' && c !== 'hover' && c !== 'selected'
    );
    if (clean.length === 0) return null;
    return el.tagName.toLowerCase() + '.' + clean.map(c => CSS.escape(c)).join('.');
  }

  function getNthChildPath(el, maxDepth) {
    const parts = [];
    let current = el;
    maxDepth = maxDepth || 4;
    while (current && current !== document.body && current !== document.documentElement && parts.length < maxDepth) {
      const parent = current.parentElement;
      let nth = 1;
      if (parent) {
        const siblings = parent.children;
        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i] === current) { nth = i + 1; break; }
        }
      }
      const tag = current.tagName.toLowerCase();
      if (current.id && isValidId(current.id)) {
        parts.unshift('#' + CSS.escape(current.id));
        break;
      }
      parts.unshift(tag + ':nth-child(' + nth + ')');
      current = parent;
    }
    return parts.join(' > ');
  }

  function generateSelector(el) {
    const target = findContainer(el);
    if (target.id && isValidId(target.id)) return '#' + CSS.escape(target.id);
    const attrSel = getAttrSelector(target);
    if (attrSel) return attrSel;
    const classSel = getStableClassSelector(target);
    if (classSel) return classSel;
    return getNthChildPath(target);
  }

  function isSafeSelector(selector) {
    try { return document.querySelectorAll(selector).length < 10; } catch (e) { return false; }
  }

  function cleanupZapper() {
    zapperActive = false;
    document.documentElement.classList.remove('durgashield-zapper-mode');
    const style = document.getElementById('durgashield-zapper-style');
    if (style) style.remove();
    const preview = document.getElementById('durgashield-preview-style');
    if (preview) preview.remove();
    const confirmBox = document.getElementById('durgashield-zapper-confirm');
    if (confirmBox) confirmBox.remove();
  }

  function activateZapper() {
    if (zapperActive) return;
    zapperActive = true;
    console.log('[DurgaShield] Zapper active');

    const style = document.createElement('style');
    style.id = 'durgashield-zapper-style';
    style.textContent = `
      .durgashield-zapper-hover { outline: 3px solid #e94560 !important; cursor: crosshair !important; }
      .durgashield-zapper-mode * { cursor: crosshair !important; }
    `;
    document.head.appendChild(style);
    document.documentElement.classList.add('durgashield-zapper-mode');

    let hovered = null;
    let previewStyle = null;

    function onMouseMove(e) {
      if (!zapperActive) return;
      if (hovered) { hovered.classList.remove('durgashield-zapper-hover'); hovered = null; }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el !== document.body && el !== document.documentElement) {
        hovered = el;
        hovered.classList.add('durgashield-zapper-hover');
      }
    }

    function onClick(e) {
      if (!zapperActive) return;
      e.preventDefault();
      e.stopPropagation();
      if (!hovered) return;
      const el = hovered;
      cleanupZapper();
      el.classList.remove('durgashield-zapper-hover');
      const elSrc = el.src || el.href || '';
      const elText = (el.textContent || '').trim().substring(0, 60);
      const elTag = el.tagName.toLowerCase();
      let selector = generateSelector(el);
      if (!isSafeSelector(selector)) {
        selector = elTag + '.' + CSS.escape(el.className.split(' ')[0] || '');
        if (!isSafeSelector(selector)) return;
      }
      previewStyle = document.createElement('style');
      previewStyle.id = 'durgashield-preview-style';
      previewStyle.textContent = selector + ' { display: none !important; }';
      document.head.appendChild(previewStyle);
      showConfirmBox(selector, elSrc, elText, elTag);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        exitZapper();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);

    function showConfirmBox(selector, elSrc, elText, elTag) {
      const box = document.createElement('div');
      box.id = 'durgashield-zapper-confirm';
      box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;background:#fff;color:#1a1a2e;padding:28px 32px;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.2);font-family:Arial,sans-serif;min-width:380px;max-width:480px;text-align:left';

      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size:17px;margin-bottom:12px;font-weight:600;text-align:center';
      titleEl.textContent = 'Block this element?';
      box.appendChild(titleEl);

      const selLabel = document.createElement('div');
      selLabel.style.cssText = 'font-size:12px;color:#777;margin-bottom:4px';
      selLabel.textContent = 'Selector:';
      box.appendChild(selLabel);

      const selCode = document.createElement('code');
      selCode.style.cssText = 'font-size:12px;display:block;overflow:auto;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;margin-bottom:12px;word-break:break-all';
      selCode.textContent = selector;
      box.appendChild(selCode);

      const tagInfo = document.createElement('div');
      tagInfo.style.cssText = 'font-size:13px;color:#888;margin-bottom:6px';
      tagInfo.textContent = '<' + elTag + '>';
      box.appendChild(tagInfo);

      if (elSrc) {
        const srcInfo = document.createElement('div');
        srcInfo.style.cssText = 'font-size:12px;color:#555;margin-bottom:6px;word-break:break-all';
        srcInfo.textContent = elSrc.substring(0, 100);
        box.appendChild(srcInfo);
      }

      if (elText) {
        const textInfo = document.createElement('div');
        textInfo.style.cssText = 'font-size:12px;color:#555;margin-bottom:6px';
        textInfo.textContent = '"' + elText + '"';
        box.appendChild(textInfo);
      }

      const btnWrap = document.createElement('div');
      btnWrap.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:16px';

      const btnBlock = document.createElement('button');
      btnBlock.id = 'dgs-confirm-block';
      btnBlock.style.cssText = 'padding:10px 32px;background:#dc3545;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:15px;font-weight:600';
      btnBlock.textContent = 'Block';

      const btnCancel = document.createElement('button');
      btnCancel.id = 'dgs-cancel-block';
      btnCancel.style.cssText = 'padding:10px 32px;background:#6c757d;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:15px;font-weight:600';
      btnCancel.textContent = 'Cancel';

      btnWrap.appendChild(btnBlock);
      btnWrap.appendChild(btnCancel);
      box.appendChild(btnWrap);
      document.body.appendChild(box);
      document.getElementById('dgs-confirm-block').onclick = function() {
        commitBlock(selector);
        box.remove();
        exitZapper();
      };
      document.getElementById('dgs-cancel-block').onclick = function() {
        if (previewStyle) previewStyle.remove();
        box.remove();
        exitZapper();
      };
    }

    const blockedSelectors = [];

    function commitBlock(selector) {
      document.querySelectorAll(selector).forEach(el => el.remove());
      _b.runtime.sendMessage({ type: MSG.ADD_HIDE_RULE, url: window.location.href, selector });
      _b.runtime.sendMessage({ type: MSG.BLOCK_COUNT, count: 1 });
      blockedSelectors.push(selector);
    }

    function showUndoBanner() {
      if (!blockedSelectors.length) return;
      const banner = document.createElement('div');
      banner.id = 'dgs-zapper-undo';
      banner.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1a1a2e;color:#fff;padding:14px 24px;border-radius:10px;font-family:Arial,sans-serif;font-size:14px;display:flex;gap:16px;align-items:center;box-shadow:0 4px 20px rgba(0,0,0,0.3)';
      banner.textContent = blockedSelectors.length + ' element(s) blocked';
      const undoBtn = document.createElement('button');
      undoBtn.textContent = 'Undo';
      undoBtn.style.cssText = 'padding:6px 20px;background:#e94560;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600';
      undoBtn.onclick = function() {
        for (const sel of blockedSelectors) {
          _b.runtime.sendMessage({ type: MSG.REMOVE_HIDE_RULE, url: window.location.href, selector: sel });
          const style = document.getElementById('durgashield-preview-style');
          if (style && style.textContent.includes(sel)) {
            style.textContent = style.textContent.replace(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}', 'g'), '');
          }
        }
        blockedSelectors.length = 0;
        banner.remove();
      };
      banner.appendChild(undoBtn);
      document.body.appendChild(banner);
      setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
    }

    function exitZapper() {
      if (hovered) { hovered.classList.remove('durgashield-zapper-hover'); hovered = null; }
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      cleanupZapper();
      showUndoBanner();
    }
  }

  function applyCosmeticFilters(cosmetics) {
    if (!cosmetics || !cosmetics.length) return;
    const host = hostname();
    const cosmeticSkipHosts = ['keep.google.com', 'mail.google.com', 'docs.google.com', 'sheets.google.com', 'slides.google.com', 'calendar.google.com'];
    if (cosmeticSkipHosts.some(h => host.includes(h))) return;
    const hostParts = host.split('.');
    const hideSelectors = [];
    const exceptionSelectors = new Set();
    for (const c of cosmetics) {
      const isException = c.exception === true;
      const domains = c.domain ? c.domain.split(',').map(d => d.trim()).filter(Boolean) : [];
      const matches = domains.length === 0 || domains.some(d => {
        if (d === '*' || d === host) return true;
        return hostParts.some((_, i) => d === hostParts.slice(i).join('.'));
      });
      if (!matches) continue;
      if (isException) {
        exceptionSelectors.add(c.selector);
      } else if (!exceptionSelectors.has(c.selector)) {
        hideSelectors.push(c.selector);
      }
    }
    const finalSelectors = hideSelectors.filter(s => !exceptionSelectors.has(s));
    if (!finalSelectors.length) return;

    // Use CSSStyleSheet.insertRule() for incremental rule injection.
    // Reuse the existing dgs-hide-css stylesheet if available; otherwise create one.
    let sheet = null;
    let existing = document.getElementById('dgs-hide-css');
    if (existing && existing.sheet) {
      sheet = existing.sheet;
    } else {
      existing = document.getElementById('dgs-cosmetic-css');
      if (existing && existing.sheet) {
        sheet = existing.sheet;
      } else {
        const style = document.createElement('style');
        style.id = 'dgs-cosmetic-css';
        document.head.appendChild(style);
        sheet = style.sheet;
      }
    }
    // Track injected rules per stylesheet for dedup
    if (!sheet._dgsRules) sheet._dgsRules = new Set();
    const existingRules = sheet._dgsRules;
    for (const sel of finalSelectors) {
      if (existingRules.has(sel)) continue;
      try {
        sheet.insertRule(sel + ' { display: none !important; }', sheet.cssRules.length);
        existingRules.add(sel);
      } catch (e) {}
    }
    // Remove stale rules that no longer match
    const finalSet = new Set(finalSelectors);
    const stale = [];
    for (const sel of existingRules) {
      if (!finalSet.has(sel)) stale.push(sel);
    }
    for (const sel of stale) {
      existingRules.delete(sel);
      const rules = sheet.cssRules;
      for (let i = 0; i < rules.length; i++) {
        if (rules[i].selectorText === sel) {
          sheet.deleteRule(i);
          break;
        }
      }
    }
  }

  function loadCosmeticFilters() {
    _b.storage.local.get('durgashield_cosmetic_filters', (r) => {
      if (r.durgashield_cosmetic_filters) applyCosmeticFilters(r.durgashield_cosmetic_filters);
    });
  }

  function applyCustomHideRules() {
    _b.storage.local.get('durgashield_selector_hits', (r) => {
      var hits = r.durgashield_selector_hits || {};
      var changed = false;
      var styleTag = document.getElementById('dgs-hide-css');
      if (!styleTag || !styleTag.textContent) return;
      var selectors = styleTag.textContent.split('{display:none!important}').filter(Boolean).map(function(s) { return s.trim(); });
      for (var si = 0; si < selectors.length; si++) {
        var matchCount = document.querySelectorAll(selectors[si]).length;
        if (matchCount > 0) {
          hits[selectors[si]] = (hits[selectors[si]] || 0) + matchCount;
          changed = true;
        }
      }
      if (changed) _b.storage.local.set({ durgashield_selector_hits: hits });
    });
  }

  function showContainerIndicator() {
    const bar = document.createElement('div');
    bar.id = 'durgashield-container-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:linear-gradient(135deg,#1877f2,#0d5ab9);color:white;padding:6px 16px;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;font-size:12px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;gap:8px;border-bottom:2px solid rgba(255,255,255,0.2)';
    var iconSpan = document.createElement('span');
    iconSpan.style.cssText = 'font-size:14px;';
    iconSpan.textContent = '\u{1F6E1}';
    bar.appendChild(iconSpan);
    bar.appendChild(document.createTextNode(' DurgaShield Container '));
    var subSpan = document.createElement('span');
    subSpan.style.cssText = 'opacity:0.8;font-size:11px;';
    subSpan.textContent = '\u2022 Your activity here is isolated';
    bar.appendChild(subSpan);
    /* Only shift down if no fixed/sticky navbar — avoids breaking site layout */
    var hasFixedNavbar = !!document.querySelector(
      'header[style*="position:fixed"], nav[style*="position:fixed"], ' +
      '[style*="position:sticky"], header.sticky, .fixed-header, .navbar-fixed'
    );
    if (!hasFixedNavbar) {
      document.documentElement.style.marginTop = '32px';
    }
    document.body.prepend(bar);
  }

  function blockFacebookEmbeds() {
    const now = Date.now();
    if (blockFacebookEmbeds._lastRun && now - blockFacebookEmbeds._lastRun < 3000) return;
    blockFacebookEmbeds._lastRun = now;
    const fbTrackingPatterns = ['connect.facebook.net', 'staticxx.facebook.com'];
    function isTrackingUrl(url) {
      if (!url) return false;
      try { return fbTrackingPatterns.some(p => new URL(url).hostname.includes(p)); } catch { return false; }
    }
    let fbCount = 0;
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) { if (isTrackingUrl(script.src)) { script.remove(); fbCount++; } }
    /* Remove FB SDK iframes (like login buttons embedded via fb:login-button) */
    const iframes = document.querySelectorAll('iframe[src*="facebook.com/plugins"], iframe[src*="connect.facebook.net"]');
    for (const iframe of iframes) { iframe.remove(); fbCount++; }
    const fbRoot = document.getElementById('fb-root');
    if (fbRoot) fbRoot.remove();
    let child = document.querySelector('div[data-facebook], iframe[title*="fb"], iframe[title*="Facebook"]');
    while (child) { child.remove(); child = document.querySelector('div[data-facebook], iframe[title*="fb"], iframe[title*="Facebook"]'); }
    Object.defineProperty(document, 'fbAsyncInit', { set: () => {}, get: () => undefined });
    if (fbCount > 0) queueBlockCount(fbCount);
  }

  function applyExistingFeatures() {
    if (_isAmazonPayment) return;
    if (config.popupBlocking && isFeatureAllowed('popupBlocking')) overrideWindowOpen();
    if (config.videoRedirect === true && isFeatureAllowed('videoRedirect')) preventVideoRedirect();
    if (config.ads && isFeatureAllowed('ads')) { if (isYouTube()) blockYouTubeAds(); else if (!isCryptoSite()) removeAdElements(); }
    if (config.ads && isFeatureAllowed('ads')) removeAdPlaceholders();
    if (config.crypto && !isCryptoSite() && isFeatureAllowed('crypto')) { detectCryptoMining(); detectCryptoScams(); }
    if (config.phishing && isFeatureAllowed('phishing')) { detectFakeLoginForms(); detectFakeAddressBar(); detectHttpPasswordFields(); }
    if (config.malware && isFeatureAllowed('malware')) { detectKeyloggers(); detectTechSupportScams(); }
    if (config.enhancedTracking !== false && isFeatureAllowed('enhancedTracking')) preventClipboardHijack();
    if (config.ads && isFeatureAllowed('ads') && window.location.hostname.includes('facebook.com')) removeFacebookAds();
    if (config.ads && isFeatureAllowed('ads') && !isCryptoSite()) dismissInterstitials();
    if (config.metadataCleanup && isFeatureAllowed('metadataCleanup')) setupMetadataCleanup();
    if (config.ads && isFeatureAllowed('ads')) { blockTwitchAds(); blockGmailAds(); removeSocialFeedAds(); blockStreamingAds(); }
  }

  let videoRedirectActive = false;
  function preventVideoRedirect() {
    if (videoRedirectActive) return;
    videoRedirectActive = true;

    function isVideoPlayer(el) {
      /* Use bounding-box overlap with <video> elements instead of class heuristics
         — avoids false positives on news sites where articles share a container with embeds */
      var vid = document.querySelector('video');
      if (!vid) return false;
      try {
        var vb = vid.getBoundingClientRect();
        if (vb.width === 0 || vb.height === 0) return false;
        var eb = el.getBoundingClientRect();
        /* Check if clicked element overlaps with video or is within 60px (for control bars / overlays) */
        var margin = 60;
        var expanded = {
          left: vb.left - margin, right: vb.right + margin,
          top: vb.top - margin, bottom: vb.bottom + margin
        };
        return !(eb.right < expanded.left || eb.left > expanded.right ||
                 eb.bottom < expanded.top || eb.top > expanded.bottom);
      } catch (e) { return false; }
    }

    document.addEventListener('click', function(e) {
      if (!isVideoPlayer(e.target)) return;
      for (let el = e.target; el && el !== document.body; el = el.parentElement) {
        if (el.tagName === 'A' && el.href && !el.href.startsWith('javascript') && !el.href.startsWith('#') && el.href !== window.location.href && el.href !== document.baseURI) {
          e.preventDefault();
          queueBlockCount(1);
          return;
        }
      }
    }, false);
  }
  let windowOpenOverridden = false;
  const originalOpen = window.open;
  function overrideWindowOpen() {
    if (windowOpenOverridden) return;
    windowOpenOverridden = true;
    const host = window.location.hostname;
    if (host.includes('amazon.') || host.includes('payments.')) return;
    injectMainWorldCode(`
      (function(){
        var orig = window.open.bind(window);
        window.open = function() {
          var url = arguments[0];
          if (!url) return null;
          try {
            var parsed = new URL(url, window.location.href);
            var hostname = parsed.hostname.toLowerCase();
            var blocked = ['ad','ads','banner','popup','pop-up','popunder','sponsor','promo','offer','win','prize','gift','click','track','tracking','affiliate','redirect'];
            if (blocked.some(function(k){return hostname.indexOf(k)!==-1;})) {
              document.dispatchEvent(new CustomEvent('dgs-bridge',{detail:{type:'queueBlock',count:1}}));
              return null;
            }
            var pats = [/\\/ads?\\//i,/\\/(ads[-_.\\/]|banner[-_.\\/]|popup[-_.\\/]|track[-_.\\/])/i,/\\/click?\\//i,/\\/(redirect|offer)[-_.\\/]/i];
            if (pats.some(function(p){return p.test(parsed.pathname)||p.test(parsed.search);})) {
              document.dispatchEvent(new CustomEvent('dgs-bridge',{detail:{type:'queueBlock',count:1}}));
              return null;
            }
          } catch(e) {}
          try { return orig.apply(window, arguments); } catch(e) { return null; }
        };
      })();
    `);
  }

  let blockReportTimer = null;
  let pendingBlockCount = 0;
  function flushBlockCount() {
    if (pendingBlockCount > 0) {
      _b.runtime.sendMessage({ type: MSG.BLOCK_COUNT, count: pendingBlockCount });
      _b.runtime.sendMessage({ type: MSG.RECORD_SITE_BLOCK, count: pendingBlockCount });
      pendingBlockCount = 0;
    }
    blockReportTimer = null;
  }
  function queueBlockCount(n) {
    pendingBlockCount += n;
    if (!blockReportTimer) blockReportTimer = setTimeout(flushBlockCount, 2000);
  }

  function removeAdElements() {
    const selectors = [
      'ins.adsbygoogle', 'amp-ad', 'google-ad', '.ad-panel',
      'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]',
      '[data-element="barcode"]', '[data-element="campaign"]',
      '[data-izone*="uc-area"]', '[data-element="branding"]',
      'div[id^="taboola-"]',
      'div[id*="taboola"]',
      'div[class*="taboola"]',
      'div[class*="trc_"]',
      '.trc_related_container',
      '.trc_rbox_div',
      'div[data-type="rbox"]',
      'div[data-placement*="Taboola"]',
      '.videocube-unit',
      'div[id^="taboola-"]:empty',
      'div[class*="video-rec"]',
      'div[class*="rec-item"]',
      'div[class*="organic-rec"]',
      'div[class*="suggestions"]',
      'div[class*="native-rec"]',
    ];
    let count = 0;
    for (const sel of selectors) {
      if (removeAdElements._injected.has(sel)) continue;
      removeAdElements._injected.add(sel);
      injectStyleDeep(sel + '{display:none!important}');
    }
    count = document.querySelectorAll(selectors.join(',')).length;
    if (count > 0) { queueBlockCount(count); removeAdPlaceholders(); }
    bypassAntiAdblock();
  }
  removeAdElements._injected = new Set();

  function isSafeElement(el) {
    const role = el.getAttribute('role');
    if (role === 'checkbox' || role === 'button' || role === 'textbox' || role === 'switch' || role === 'radio') return true;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.tagName === 'BUTTON') return true;
    return false;
  }

  function removeAdPlaceholders() {
    const skipHosts = ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'mail.yahoo.com', 'keep.google.com', 'coinmarketcap.com', 'bitget.com', 'coingecko.com', 'tvsmotor.com'];
    const now = Date.now();
    if (removeAdPlaceholders._lastRun && now - removeAdPlaceholders._lastRun < 2000) return;
    removeAdPlaceholders._lastRun = now;
    const adContainerPatterns = [
      'div[class*="-ad-"]', 'div[class*=" advert"]', 'div[class*="ad-"]', 'div[class*="-ad"]', 'div[class*=" sponsor"]', 'div[class*=" banner"]', 'div[class*=" promo"]', 'div[class*="ads-"]', 'div[class*="-ads"]',
      'div[id*="-ad-"]', 'div[id*="ad-"]', 'div[id*=" sponsor"]', 'div[id*=" banner"]', 'div[id*=" promo"]', 'div[id*="ads-"]', 'div[id*="-ads"]',
      'ins[class*="-ad-"]', 'ins[class*="ad-"]', 'ins[class*="-ad"]',
      'section[class*="-ad-"]', 'section[class*="ad-"]', 'section[class*="-ad"]', 'section[class*=" advert"]', 'section[class*=" sponsor"]', 'section[class*=" banner"]',
      'section[id*="-ad-"]', 'section[id*="ad-"]', 'section[id*=" sponsor"]', 'section[id*=" banner"]',
      'div[id*="div-gpt-ad"]', 'div[id*="google_ads_iframe"]', 'div[id*="google_adsense"]',
      'div[class*="adslot"]', 'div[class*="ad-wrapper"]', 'div[class*="ad-container"]', 'div[class*="ad-unit"]', 'div[class*="adplacement"]', 'div[class*="ad_box"]', 'div[class*="advt"]', 'div[class*="advertise"]',
      'div[data-ad-]', 'div[data-adunit]', 'div[data-google-query-id]',
      'aside[class*="ad-"]', 'aside[id*="ad-"]',
    ];
    const adKeyword = /(^|[\s_-])(a[dds][-\s_]|advert|sponsor|banner|promo|advt|adsl|adunit|adslot|adwrap)/i;
    for (const pat of adContainerPatterns) {
      const els = document.querySelectorAll(pat);
      for (const el of els) {
        if (el.offsetParent === null) continue;
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'CANVAS' || el.tagName === 'SVG') continue;
        if (isSafeElement(el)) continue;
        if (el.querySelector('input, textarea, [role="checkbox"], [role="button"], [role="textbox"], [role="switch"], [role="radio"]')) continue;
        const cls = (el.className || '') + ' ' + (el.id || '');
        if (!/div-gpt-ad|google_ads_iframe/.test(el.id)) {
          if (!adKeyword.test(cls)) continue;
        }
        const rect = el.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 30) continue;
        const text = (el.textContent || '').trim();
        if (text.length >= 200) continue;
        const imgs = el.querySelectorAll('img');
        const hasBigImage = Array.from(imgs).some(img => img.naturalWidth > 50 || img.offsetWidth > 50);
        const iframes = el.querySelectorAll('iframe');
        const hasFilledIframe = Array.from(iframes).some(f => {
          const src = (f.src || '').toLowerCase();
          if (!src || src === 'about:blank' || /doubleclick\.net|googlesyndication\.com|googleadservices\.com|amazon-adsystem\.com/.test(src)) return false;
          return f.offsetWidth > 50 && f.offsetHeight > 50;
        });
        const canvases = el.querySelectorAll('canvas');
        const hasCanvas = Array.from(canvases).some(c => c.offsetWidth > 50 && c.offsetHeight > 50);
        const svgs = el.querySelectorAll('svg');
        const hasSvg = Array.from(svgs).some(s => s.offsetWidth > 50 && s.offsetHeight > 50);
        if (!hasBigImage && !hasFilledIframe && !hasCanvas && !hasSvg) {
          collapseElement(el);
        }
      }
    }
    /* Second pass: collapse ad-iframes' immediate ad-looking parent containers */
    var adIframes = document.querySelectorAll('iframe[src*="doubleclick.net"], iframe[src*="googlesyndication.com"], iframe[src*="googleadservices.com"], iframe[src*="amazon-adsystem.com"]');
    for (var fi = 0; fi < adIframes.length; fi++) {
      var adIframe = adIframes[fi];
      if (adIframe.offsetParent === null) continue;
      var parent = adIframe.parentElement;
      var maxWalk = 0;
      while (parent && parent !== document.body && parent !== document.documentElement && maxWalk < 3) {
        var cls = (parent.className || '') + ' ' + (parent.id || '');
        if (adKeyword.test(cls) || /div-gpt-ad|google_ads_iframe/.test(cls)) {
          if (parent.offsetParent !== null && !parent.classList.contains('ds-hidden')) {
            collapseElement(parent);
          }
          break;
        }
        parent = parent.parentElement;
        maxWalk++;
      }
    }
    /* Third pass: collapse any visible GPT slot that has been on page >5s with no real content */
    var gptSlots = document.querySelectorAll('div[id^="div-gpt-ad"], div[id^="google_ads_iframe"]');
    var gptThreshold = Date.now() - 5000;
    for (var gi = 0; gi < gptSlots.length; gi++) {
      var slot = gptSlots[gi];
      if (slot.offsetParent === null || slot.classList.contains('ds-hidden')) continue;
      var slotAge = slot._gptCreated || Date.now();
      if (!slot._gptCreated) { slot._gptCreated = Date.now(); continue; }
      if (slotAge < gptThreshold) continue;  // only collapse slots sitting >5s
      /* Check if slot has real content (non-ad iframe, big image, canvas, svg) */
      var iframes = slot.querySelectorAll('iframe');
      var hasRealIframe = Array.from(iframes).some(function(f) {
        var s = (f.src || '').toLowerCase();
        if (!s || s === 'about:blank' || /doubleclick\.net|googlesyndication\.com|googleadservices\.com|amazon-adsystem\.com/.test(s)) return false;
        return f.offsetWidth > 50 && f.offsetHeight > 50;
      });
      var imgs = slot.querySelectorAll('img');
      var hasBigImage = Array.from(imgs).some(function(img) { return img.naturalWidth > 50 || img.offsetWidth > 50; });
      if (!hasRealIframe && !hasBigImage) collapseElement(slot);
    }
    /* Fourth pass: collapse Taboola/Outbrain containers that are now empty wrappers */
    var nativeAdWrappers = document.querySelectorAll(
      'div[id^="taboola-"], div[id*="taboola"], div[class*="trc_rbox"], ' +
      'div[data-type="rbox"], div[class*="OUTBRAIN"], div[id^="outbrain_widget"]'
    );
    for (var ti = 0; ti < nativeAdWrappers.length; ti++) {
      var tw = nativeAdWrappers[ti];
      if (tw.offsetParent === null || tw.classList.contains('ds-hidden')) continue;
      var twIframes = tw.querySelectorAll('iframe');
      var hasOnlyAdIframes = twIframes.length > 0 && Array.from(twIframes).every(function(f) {
        var s = (f.src || '').toLowerCase();
        return !s || s === 'about:blank' || s.includes('taboola') || s.includes('outbrain');
      });
      var isEmpty = tw.textContent.trim().length < 10 && !tw.querySelector('img[src]:not([src=""])');
      if (hasOnlyAdIframes || isEmpty) collapseElement(tw);
    }
    collapseGhostWrappers();
  }

  function collapseElement(el) {
    /* display:none removes element from all layout flows including flex/grid */
    el.style.setProperty('display', 'none', 'important');
    el.classList.add('ds-hidden');
    queueBlockCount(1);
    el.style.setProperty('height', '0', 'important');
    el.style.setProperty('min-height', '0', 'important');
    el.style.setProperty('max-height', '0', 'important');
    el.style.setProperty('width', '0', 'important');
    el.style.setProperty('min-width', '0', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('padding', '0', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
    /* Walk up to 4 levels, collapsing wrappers that now have all-hidden children */
    try {
      var current = el.parentElement;
      for (var _i = 0; _i < 4 && current && current !== document.body && current !== document.documentElement; _i++) {
        var allHidden = Array.from(current.children).every(function(c) {
          if (c.tagName === 'SCRIPT' || c.tagName === 'NOSCRIPT' || c.tagName === 'STYLE' || c.tagName === 'LINK' || c.tagName === 'META') return true;
          return c.style.display === 'none' || c.classList.contains('ds-hidden') || c.offsetParent === null;
        });
        if (!allHidden) break;
        current.style.setProperty('display', 'none', 'important');
        current.style.setProperty('min-height', '0', 'important');
        current.style.setProperty('height', '0', 'important');
        current.style.setProperty('padding', '0', 'important');
        current.style.setProperty('margin', '0', 'important');
        current = current.parentElement;
      }
    } catch (_e) {}
  }

  function collapseGhostWrappers() {
    /* Fifth pass: find any visible element with ad-like classes/IDs that only contains
       hidden children, and collapse it too — catches wrappers with min-height */
    var ghostSelectors = 'div[class*="ad-"],div[id*="ad-"],div[class*="-ad"],div[id*="-ad"],' +
      'div[class*="gpt"],div[id*="gpt"],div[class*="google_ads"],div[id*="google_ads"],' +
      'div[class*="banner"],div[id*="banner"],div[class*="sponsor"],div[id*="sponsor"]';
    var ghostCandidates = document.querySelectorAll(ghostSelectors);
    for (var gi = 0; gi < ghostCandidates.length; gi++) {
      var g = ghostCandidates[gi];
      if (g.offsetParent === null || g.classList.contains('ds-hidden')) continue;
      /* Check all layout-contributing children are hidden */
      var kids = Array.from(g.children);
      var allKidsHidden = kids.every(function(k) {
        if (k.tagName === 'SCRIPT' || k.tagName === 'NOSCRIPT' || k.tagName === 'STYLE' || k.tagName === 'LINK' || k.tagName === 'META') return true;
        return k.style.display === 'none' || k.classList.contains('ds-hidden') || k.offsetParent === null;
      });
      /* Also check text-content length — if very little text, it's likely just ad wiring */
      var textLen = (g.textContent || '').trim().length;
      if (allKidsHidden && textLen < 50) collapseElement(g);
    }
  }

  function removeSpacerDivs() {
    var spacerSelectors = 'div[class*="spacer"],div[id*="spacer"],div[class*="placeholder-ad"],div[class*="ad-placeholder"]';
    var spacers = document.querySelectorAll(spacerSelectors);
    for (var si = 0; si < spacers.length; si++) {
      var s = spacers[si];
      if (s.offsetParent === null || s.classList.contains('ds-hidden') || s.querySelector('img, iframe, canvas, video')) continue;
      var sText = (s.textContent || '').trim();
      if (sText.length > 100) continue;
      collapseElement(s);
    }
  }

  function bypassAntiAdblock() {
    const now = Date.now();
    if (bypassAntiAdblock._lastRun && now - bypassAntiAdblock._lastRun < 2000) return;
    bypassAntiAdblock._lastRun = now;
    const antiAdblockSelectors = [
      '[class*="adblock"]', '[class*="ad-block"]', '[class*="ad_block"]',
      '[id*="adblock"]', '[id*="ad-block"]', '[id*="ad_block"]',
      '[class*="anti-adblock"]', '[id*="anti-adblock"]',
      '[class*="ad-detected"]', '[id*="ad-detected"]',
      '[class*="adblock-detected"]', '[id*="adblock-detected"]',
      '[class*="adblocker-wall"]', '[id*="adblocker-wall"]',
      '[class*="adblock-wall"]', '[id*="adblock-wall"]',
      '[class*="adwall"]', '[id*="adwall"]',
      '[class*="adblock-notice"]', '[id*="adblock-notice"]',
      '[class*="adblock-msg"]', '[id*="adblock-msg"]',
      '[class*="block-adblock"]', '[id*="block-adblock"]',
      '[class*="stop-adblock"]', '[id*="stop-adblock"]',
      '[class*="adblock-overlay"]', '[id*="adblock-overlay"]',
      '[class*="adblock-modal"]', '[id*="adblock-modal"]',
      '.adsbygoogle[data-ad-status="unfilled"]',
      '.ad-overlay', '#ad-overlay',
    ];
    var scarewareFound = false;
    for (const sel of antiAdblockSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetParent === null) continue;
        const text = (el.textContent || '').toLowerCase();
        /* Require BOTH structural selector AND matching text — not just one keyword */
        const hasAdblockText = text.includes('adblock') || text.includes('ad blocker') || text.includes('disable adblock') ||
          text.includes('turn off adblock') || text.includes('disable ad blocker');
        const hasWhitelistText = text.includes('whitelist');
        if (hasAdblockText || (hasWhitelistText && /* whitelist alone is weak signal, require selector match */
            antiAdblockSelectors.some(function(s) { try { return el.matches(s); } catch { return false; } }))) {
          el.classList.add('ds-hidden');
          scarewareFound = true;
          queueBlockCount(1);
        }
      }
    }
    const body = document.body;
    const html = document.documentElement;
    if (scarewareFound) {
      if (body) {
        if (body.style.overflow === 'hidden' || getComputedStyle(body).overflow === 'hidden') body.style.setProperty('overflow', 'auto', 'important');
        if (body.style.position === 'fixed' || getComputedStyle(body).position === 'fixed') body.style.setProperty('position', 'static', 'important');
      }
      if (html) {
        if (html.style.overflow === 'hidden' || getComputedStyle(html).overflow === 'hidden') html.style.setProperty('overflow', 'auto', 'important');
      }
    }
    const locks = document.querySelectorAll('[style*="overflow: hidden"], [style*="overflow:hidden"]');
    for (const el of locks) {
      if (el === body || el === html) continue;
      if (el.offsetParent === null) continue;
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('adblock') || text.includes('disable adblock') || text.includes('whitelist')) {
        el.style.setProperty('overflow', 'auto', 'important');
      }
    }
  }

  function detectCryptoMining() {
    const now = Date.now();
    if (detectCryptoMining._lastRun && now - detectCryptoMining._lastRun < 3000) return;
    detectCryptoMining._lastRun = now;
    const patterns = ['coin-hive', 'coinhive', 'cryptoloot', 'crypto-loot', 'webminer', 'webmine'];
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const src = (script.src || '').toLowerCase();
      const text = (script.textContent || '').toLowerCase();
      for (const p of patterns) { if (src.includes(p) || text.includes(p)) { script.remove(); queueBlockCount(1); _b.runtime.sendMessage({ type: MSG.MALWARE_DETECTED }); return true; } }
    }
    return false;
  }

  function detectFakeLoginForms() {
    const forms = document.querySelectorAll('form');
    const currentHost = window.location.hostname;
    const ssoDomains = ['auth0.com', 'okta.com', 'oktacdn.com', 'onelogin.com', 'login.microsoftonline.com', 'login.live.com', 'login.salesforce.com', 'accounts.google.com', 'accounts.youtube.com', 'accounts.facebook.com', 'appleid.apple.com', 'signin.aws.amazon.com', 'idp.'];
    for (const form of forms) {
      const action = (form.action || '').toLowerCase();
      if (action && !action.includes(currentHost)) {
        if (ssoDomains.some(d => action.includes(d))) continue;
        const pw = form.querySelectorAll('input[type="password"]');
        if (pw.length > 0) {
          const w = document.createElement('div');
          w.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#dc3545;color:white;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3)';
          w.textContent = 'DurgaShield Warning: This form submits to a different domain. Login credentials could be stolen!';
          document.body.prepend(w);
          setTimeout(() => w.remove(), 10000);
          _b.runtime.sendMessage({ type: MSG.MALWARE_DETECTED });
          return true;
        }
      }
    }
    return false;
  }

  function detectFakeAddressBar() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.style.position === 'fixed' || iframe.style.position === 'absolute') {
        const rect = iframe.getBoundingClientRect();
        if (rect.top < 60 && rect.width > window.innerWidth * 0.5) {
          const w = document.createElement('div');
          w.id = 'durgashield-overlay-warning';
          w.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483646;background:#fff3cd;color:#856404;padding:8px 16px;font-family:Arial,sans-serif;font-size:12px;text-align:center;border-bottom:2px solid #ffc107;display:flex;align-items:center;justify-content:center;gap:12px';
          var warnText = document.createElement('span');
          warnText.textContent = 'DurgaShield: Suspicious overlay detected on this page.';
          w.appendChild(warnText);
          var dismissBtn = document.createElement('button');
          dismissBtn.textContent = 'Dismiss';
          dismissBtn.style.cssText = 'background:#856404;color:#fff;border:none;border-radius:3px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:600';
          dismissBtn.onclick = function() { w.remove(); };
          w.appendChild(dismissBtn);
          document.body.prepend(w);
          return true;
        }
      }
    }
    return false;
  }

  function blockYouTubeAds() {
    const adSelectors = ['ytd-ad-slot-renderer', 'ytd-display-ad-renderer', 'ytd-promoted-video-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-compact-promoted-video-renderer', 'ytd-compact-ad-renderer', 'ytd-banner-promo-renderer', 'ytd-mealbar-promo-renderer', 'ytd-video-masthead-ad', 'ytd-rich-item-ad-renderer', 'ytd-in-feed-ad-layout-renderer', '#masthead-ad', '#merch-shelf', '#player-ads > .ytd-ad-slot-renderer'];
    const overlaySelectors = '.ytp-ad-module, .ytp-ad-player-overlay, .ytp-ad-text-overlay, .ytp-ad-image-overlay';
    for (const sel of adSelectors) {
      if (blockYouTubeAds._injected.has(sel)) continue;
      blockYouTubeAds._injected.add(sel);
      injectDSStyle(sel + '{display:none!important}');
    }
    if (!blockYouTubeAds._injected.has(overlaySelectors)) {
      blockYouTubeAds._injected.add(overlaySelectors);
      injectDSStyle(overlaySelectors + '{display:none!important}');
    }
    let count = document.querySelectorAll(adSelectors.concat(['.ytp-ad-module', '.ytp-ad-player-overlay', '.ytp-ad-text-overlay', '.ytp-ad-image-overlay']).join(',')).length;
    if (count > 0) { queueBlockCount(count); removeAdPlaceholders(); }
    cleanYouTubeAnnoyances();
  }
  blockYouTubeAds._injected = new Set();

  function cleanYouTubeAnnoyances() {
    const annoyances = [
      '#channel-watermark', 'ytd-video-preview', '.ytp-ce-element', '.ytp-ce-expanding-overlay',
      'ytd-subscribe-button-renderer[button-style*="brand"]', '.ytp-subscribe-button',
      'ytd-feed-filter-chip-bar-renderer', '#notification-preference-button',
      'ytd-donate-button-renderer', 'ytd-button-renderer[icon*="card"]',
      'ytd-popup-container > yt-notification-action-renderer',
      '#player-container-outer .ytp-overflow-button',
      '.ytp-player-content .ytp-videowall-still',
      '.ytp-collage', '.ytp-videowall-still',
      'ytd-compact-promoted-video-renderer',
      'ytd-in-video-promo-renderer',
      '.ytp-inline-preview',
      '#clarify-box', '#donation-shelf',
      'ytd-movie-offer-module-renderer',
      'ytd-offer-module-renderer',
      '#offer-module',
      'ytd-in-video-membership-offer-renderer',
      '#membership-offer',
      'ytd-stickershelf-renderer'
    ];
    for (const sel of annoyances) {
      if (cleanYouTubeAnnoyances._injected.has(sel)) continue;
      cleanYouTubeAnnoyances._injected.add(sel);
      injectDSStyle(sel + '{display:none!important}');
    }
  }
  cleanYouTubeAnnoyances._injected = new Set();

  function skipVideoAd() {
    const video = document.querySelector('video');
    if (!video) return;
    if (!document.querySelector('.ytp-ad-player-overlay')) return;
    const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
    if (skipBtn) { skipBtn.click(); queueBlockCount(1); return; }
    video.muted = true;
    if (video.playbackRate < 16) video.playbackRate = 16;
    const closeBtn = document.querySelector('.ytp-ad-overlay-close-button');
    if (closeBtn) closeBtn.click();
  }

  function skipEndScreenCards() {
    const cards = document.querySelectorAll('.ytp-ce-element');
    for (const card of cards) {
      const btn = card.querySelector('.ytp-ce-close');
      if (btn) btn.click();
    }
    const pauseOverlay = document.querySelector('.ytp-pause-overlay');
    if (pauseOverlay) pauseOverlay.remove();
  }

  function startObserver() {
    const target = document.body || document.documentElement;
    if (!target) { requestAnimationFrame(startObserver); return; }
    const host = hostname();
    const isGoogle = host.endsWith('.google.com') || host === 'google.com';
    let isSubFrame;
    try { isSubFrame = window.self !== window.top; } catch (e) { isSubFrame = true; }
    const isAmazon = host.includes('amazon.') || host.includes('payments.');
    const isAdminPanel = host.includes('web-hosting.com') || host.includes('cpanel') || host.includes('whm') || /cpsess\d+/.test(window.location.pathname);
    let timer = null;
    let pendingMutations = [];
    const throttle = {};
    function runThrottled(name, minGap, fn) {
      const now = Date.now();
      if (throttle[name] && now - throttle[name] < minGap) return;
      throttle[name] = now;
      fn();
    }
    const observer = new MutationObserver((mutations) => {
      pendingMutations.push(...mutations);
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        let addedCount = 0;
        for (const m of pendingMutations) addedCount += m.addedNodes.length;
        pendingMutations = [];
        if (siteDisabled) return;
        if (isGoogle || isAmazon || isCryptoSite()) return;
        if (addedCount < 5) {
          if (config.xssProtection === true) { monitorXssMutations(); }
        runThrottled('placeholders', 2000, () => { if (config.ads && !isSubFrame) removeAdPlaceholders(); });
        runThrottled('spacers', 3000, () => { if (config.ads && !isSubFrame) removeSpacerDivs(); });
          return;
        }
        runThrottled('ads', 300, () => { if (config.ads && !isYouTube() && !isCryptoSite()) { removeAdElements(); bypassAntiAdblock(); }});
        runThrottled('placeholders', 2000, () => { if (config.ads && !isSubFrame) removeAdPlaceholders(); });
        runThrottled('streamAds', 1000, () => { if (config.ads) { blockTwitchAds(); blockGmailAds(); removeSocialFeedAds(); blockStreamingAds(); }});
        runThrottled('annoyances', 500, () => { if (config.neverConsent !== false && !isSubFrame) { hideAnnoyanceElements(); handleCookieConsent(); }});
        if (config.ads && window.location.hostname.includes('facebook.com') && !isSubFrame) runThrottled('fbAds', 500, facebookScanAndRemove);
        runThrottled('tracking', 1000, () => { if (config.enhancedTracking === true && !isSubFrame) removeTrackingStorage(); });
        if (config.xssProtection === true) { monitorXssMutations(); }
        runThrottled('clearClick', 500, () => { if (config.clearClick === true && !isCryptoSite() && !isSubFrame) { scanSuspiciousOverlays(); }});
        runThrottled('abe', 500, () => { if (config.abe !== false) { checkLocalNetworkContent(); }});
        runThrottled('mixed', 1000, () => { if (window.location.protocol === 'https:' && !isSubFrame) detectMixedContent(); });
        runThrottled('phish', 2000, () => { if (config.phishingLinkDetect === true && !isSubFrame) detectPhishingLinks(); });
        runThrottled('fbPrivacy', 2000, () => { if (config.fbPrivacy === true && !isSubFrame) applyFBPrivacy(); });
      }, 200);
    });
    observer.observe(target, { childList: true, subtree: true });
  }

  /* ---------- YouTube Channel Whitelist ---------- */
  let ytWhitelisted = false;
  let ytChannelName = '';
  let ytChannelId = '';

  function detectYouTubeChannel() {
    if (!isYouTube()) return;
    var el = document.querySelector('#owner ytd-channel-name a');
    if (el) ytChannelName = el.textContent.trim();
    var link = document.querySelector('#owner ytd-channel-name a');
    if (link && link.href) {
      var m = link.href.match(/\/channel\/(UC[\w-]+)/);
      if (m) ytChannelId = m[1];
    }
    if (!ytChannelId) {
      var sub = document.querySelector('#subscribe-button');
      if (sub) {
        var href = sub.querySelector('a[href*="/channel/"]');
        if (href) {
          var m2 = href.getAttribute('href').match(/\/channel\/(UC[\w-]+)/);
          if (m2) ytChannelId = m2[1];
        }
      }
    }
  }

  function checkYouTubeWhitelist() {
    if (!isYouTube() || !ytChannelId) return;
    _b.storage.local.get('durgashield_youtube_whitelist', function(r) {
      var list = r.durgashield_youtube_whitelist || [];
      ytWhitelisted = list.some(function(c) { return c.id === ytChannelId; });
      if (ytWhitelisted) {
        var banner = document.createElement('div');
        banner.id = 'ds-yt-whitelist-banner';
        banner.style.cssText = 'position:fixed;top:60px;right:12px;z-index:9999;background:#16213e;border:1px solid #e94560;border-radius:6px;padding:6px 12px;font-family:Arial,sans-serif;font-size:11px;color:#ccc;display:flex;align-items:center;gap:8px';
        var bannerText = document.createElement('span');
        bannerText.textContent = '\u2713 Ads allowed on ' + ytChannelName;
        banner.appendChild(bannerText);
        var undoBtn = document.createElement('button');
        undoBtn.id = 'ds-yt-unwhitelist';
        undoBtn.style.cssText = 'background:#333;color:#ccc;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:10px';
        undoBtn.textContent = 'Undo';
        banner.appendChild(undoBtn);
        document.body.appendChild(banner);
        document.getElementById('ds-yt-unwhitelist').onclick = function() {
          _b.runtime.sendMessage({ type:'removeYouTubeWhitelist', channelId: ytChannelId });
          banner.remove();
          ytWhitelisted = false;
        };
      }
    });
  }

  function startYouTubeAdSkip() {
    let lastYTUrl = '';
    let lastCheck = 0;
    function checkYT() {
      if (!isYouTube()) return;
      const now = Date.now();
      if (now - lastCheck < 400) return;
      lastCheck = now;
      if (window.location.href !== lastYTUrl) {
        lastYTUrl = window.location.href;
        detectYouTubeChannel();
        checkYouTubeWhitelist();
        lastCheck = 0;
        setTimeout(checkYT, 100);
        return;
      }
      if (!config.ads || ytWhitelisted) return;
      blockYouTubeAds();
      skipVideoAd();
      skipEndScreenCards();
    }
    setInterval(checkYT, 400);
    window.addEventListener('popstate', function() {
      lastYTUrl = '';
      lastCheck = 0;
    });
  }

  /* ---------- Privacy Badger Features ---------- */

  function removeLinkTracking() {
    document.addEventListener('click', (e) => {
      let el = e.target;
      while (el && el.tagName !== 'A') el = el.parentElement;
      if (!el || !el.href) return;
      try {
        const url = new URL(el.href);
        const params = ['fbclid','gclid','gclsrc','dclid','yclid','mc_eid',
          'utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
        let changed = false;
        for (const p of params) {
          if (url.searchParams.has(p)) { url.searchParams.delete(p); changed = true; }
        }
        if (changed) el.href = url.toString();
      } catch (e) {}
    }, true);
  }

  function replaceSocialWidgets() {
    const placeholders = [
      { sel: '[class*="fb-like"], [class*="fb-share"], [class*="fb-comments"], [class*="fb-follow"]', name: 'Facebook' },
      { sel: '[class*="twitter-timeline"], [class*="twitter-follow"], [class*="twitter-tweet"], [class*="twitter-share"]', name: 'Twitter' },
      { sel: '[class*="instagram-media"]', name: 'Instagram' },
      { sel: '[class*="linkedin-insight"]', name: 'LinkedIn' }
    ];
    for (const ph of placeholders) {
      const els = document.querySelectorAll(ph.sel);
      for (const el of els) {
        if (el.dataset._sfPlaceholder) continue;
        el.dataset._sfPlaceholder = '1';
        const rect = el.getBoundingClientRect();
        const w = Math.max(rect.width || 300, 200);
        const h = Math.max(rect.height || 100, 60);
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'display:flex;align-items:center;justify-content:center;width:' + w + 'px;height:' + h + 'px;background:#1e1e3a;border:1px dashed #555;border-radius:6px;font-family:Arial,sans-serif;font-size:12px;color:#999;cursor:pointer;margin:4px 0';
        placeholder.textContent = 'Click to load ' + ph.name + ' widget';
        placeholder.addEventListener('click', () => { el.style.display = ''; placeholder.remove(); });
        el.style.display = 'none';
        el.parentNode.insertBefore(placeholder, el.nextSibling);
      }
    }
  }

  function scanThirdParties() {
    const thirdParties = new Set();
    const currentHost = window.location.hostname;
    document.querySelectorAll('script[src], iframe[src], img[src], link[href]').forEach(el => {
      try {
        const src = el.src || el.href;
        if (!src) return;
        const url = new URL(src, location.href);
        const h = url.hostname.replace(/^www\./, '');
        if (h && h !== currentHost.replace(/^www\./, '') && !h.startsWith('moz-extension') && !h.startsWith('chrome-extension')) {
          thirdParties.add(h);
        }
      } catch (e) {}
    });
    if (thirdParties.size > 0) {
      _b.runtime.sendMessage({ type: MSG.REPORT_THIRD_PARTIES, domains: Array.from(thirdParties) });
    }
  }

  function initPrivacyFeatures() {
    if (_isAmazonPayment) return;
    if (isAdminPanel()) return;
    removeLinkTracking();
    replaceSocialWidgets();
    if (!isFacebookOrigin() && !isYouTube()) scanThirdParties();
    initStealthMode();
    initNeverConsent();
    initAnnoyanceFilter();
    initEnhancedAntiTracking();
    initXssProtection();
    initClearClick();
    initABE();
    enhancedUrlCleaning();
    initFingerprintingProtection();
    initHeuristicDetection();
    historyProtection();
    permissionMonitor();
    detectMixedContent();
    initSecurePayment();
  }

  /* ---------- Enhanced Annoyance Filter ---------- */
  const ANNOYANCE_SELECTORS = [
    '#notification-request', '.notification-request', '[class*="push-notification"]', '[id*="push-notification"]',
    '.push-notification', '[class*="webpush"]', '[id*="webpush"]',
    '.mailmunch-popup', '.sumome-popup', '.sumome-modal', '[class*="newsletter-popup"]',
    '[class*="email-popup"]', '[class*="subscribe-popup"]', '[class*="signup-popup"]',
    '[class*="app-banner"]', '[id*="app-banner"]', '.smartbanner', '.android-banner', '.ios-banner',
    '[class*="mobile-app-banner"]', '[class*="app-download"]',
    '.share-buttons-floating', '.floating-share', '[class*="share-fixed"]',
    '[class*="sticky-share"]', '.social-floating', '[class*="social-float"]',
    '[class*="exit-popup"]', '[id*="exit-popup"]', '[class*="exitintent"]',
    '[class*="slidein"]', '[class*="slide-in"]', '.slidein', '.slide-in'
  ];

  function initAnnoyanceFilter() {
    if (config.neverConsent === false) return;
    hideAnnoyanceElements();
  }

  function hideAnnoyanceElements() {
    if (siteDisabled || document.hidden) return;
    for (const sel of ANNOYANCE_SELECTORS) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetParent !== null && !el.dataset._sfAnnoyance) {
          el.dataset._sfAnnoyance = '1';
          el.classList.add('ds-hidden');
          el.setAttribute('aria-hidden', 'true');
          queueBlockCount(1);
        }
      }
    }
  }

  /* ---------- Stealth Mode (AdGuard-inspired) ---------- */
  let stealthConfig = { hideReferrer: true, hideSearchQueries: true, blockWebRTC: true };
  let stealthInitialized = false;

  function initStealthMode() {
    if (stealthInitialized) return;
    if (!config.stealth) return;
    stealthInitialized = true;
    _b.storage.local.get('durgashield_stealth', (r) => {
      const saved = r.durgashield_stealth || {};
      Object.assign(stealthConfig, saved);
      applyStealth();
    });
  }

  function applyStealth() {
    if (stealthConfig.blockWebRTC) blockWebRTC();
    if (stealthConfig.hideReferrer || stealthConfig.hideSearchQueries) hideReferrer();
    antiFingerprinting();
  }

  function blockWebRTC() {
    injectMainWorldCode(`
      (function() {
        if (!window.RTCPeerConnection) return;
        var orig = window.RTCPeerConnection;
        window.RTCPeerConnection = function() {
          var pc = new (Function.prototype.bind.apply(orig, [null].concat(Array.prototype.slice.call(arguments))));
          pc.addEventListener('icecandidate', function(e) {
            if (e.candidate && e.candidate.candidate) {
              var privates = /(?:192\\.168\\.\\d{1,3}\\.\\d{1,3}|10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|172\\.(?:1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3})/;
              if (privates.test(e.candidate.candidate)) {
                pc.dispatchEvent(new RTCPeerConnectionIceEvent('icecandidate', { candidate: null }));
              }
            }
          });
          return pc;
        };
        window.RTCPeerConnection.prototype = orig.prototype;
      })();
    `);
  }

  function hideReferrer() {
    if (!document.querySelector('meta[name="referrer"]')) {
      const m = document.createElement('meta');
      m.name = 'referrer';
      m.content = 'no-referrer';
      document.head.appendChild(m);
    }
  }

  function antiFingerprinting() {
    if (HTMLCanvasElement.prototype._dgsPatched) return;
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: false });
    } catch (e) {}
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    const fpNoise = () => {
      const shift = Math.random() * 0.001 - 0.0005;
      return function() {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imgData = ctx.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imgData.data.length; i += 4) {
            imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + shift * 255));
          }
          ctx.putImageData(imgData, 0, 0);
        }
        return origToDataURL.apply(this, arguments);
      };
    };
    HTMLCanvasElement.prototype.toDataURL = fpNoise();
    HTMLCanvasElement.prototype.toBlob = function() {
      const args = arguments;
      const canvas = this;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const shift = Math.random() * 0.001 - 0.0005;
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < imgData.data.length; i += 4) {
          imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + shift * 255));
        }
        ctx.putImageData(imgData, 0, 0);
      }
      origToBlob.call(canvas, function(blob) {
        if (args[0]) args[0].call(canvas, blob);
      }, args[1], args[2]);
    };
    HTMLCanvasElement.prototype._dgsPatched = true;
  }

  /* ---------- Ghostery-inspired: Never-Consent ---------- */
  const COOKIE_BANNER_SELECTORS = [
    '#cookie-consent', '#cookie-banner', '#cookie-notice', '#cookie-law',
    '#cookies-banner', '#cookies-notice', '#cookies-bar',
    '.cookie-consent', '.cookie-banner', '.cookie-notice', '.cookie-law',
    '.cookies-banner', '.cookies-notice', '.cookies-bar',
    '[class*="cookie-consent"]', '[class*="cookie-banner"]', '[class*="cookie-notice"]',
    '[class*="cookies-banner"]', '[class*="cookies-notice"]', '[class*="cookie-law"]',
    '[id*="cookie-consent"]', '[id*="cookie-banner"]', '[id*="cookie-notice"]',
    '[id*="cookies-banner"]', '[id*="cookies-notice"]', '[id*="cookie-law"]',
    '#onetrust-banner-sdk', '.onetrust-banner', '.ot-sdk-container',
    '#trustarc-banner', '.truste-banner', '.truste-overlay',
    '#CookiebotWidget', '.cookiebot',
    '.qc-cmp-cleanslate', '.qc-cmp2-container', '#qc-cmp2',
    '.cc-banner', '.cc-window', '.cc-revoke',
    '.modal-cookie', '[aria-label*="cookie" i]', '[aria-label*="consent" i]',
    '[data-testid*="cookie" i]', '[data-testid*="consent" i]',
    '#cmpwrapper', '.cmp-wrapper', '#didomi-host', '.didomi-banner',
    '#usercentrics-root', '.uc-banner', '.uc-consent',
    '#consent_blackbar', '#teconsent', '[class*="consent"]',
    '[id*="consent"]', '[class*="gdpr"]', '[id*="gdpr"]'
  ];

  const REJECT_BUTTON_PATTERNS = [
    'Reject all', 'Reject All', 'Reject', 'reject',
    'Decline all', 'Decline All', 'Decline', 'decline',
    'Deny', 'deny',
    'Refuse', 'refuse',
    'Allow only necessary', 'Only necessary', 'Necessary only', 'necessary',
    'Accept only necessary', 'Accept necessary', 'Accept required',
    'Reject optional', 'Continue without accepting', 'Continue without',
    'Only allow essential', 'Essential only', 'essential',
    'No thanks', 'No, thanks',
    'Not now', 'Not Now',
    'I decline', 'I disagree', 'Disagree',
    'Do not sell', 'Do Not Sell', 'Opt out', 'Opt Out',
    'Manage options', 'Manage Options',
    'Settings', 'Cookie settings', 'Cookie Settings',
    'Preferences', 'Cookie preferences', 'Cookie Preferences',
    'Customize', 'Customize Settings',
    'Let me choose', 'Choose',
    'Deny all', 'Deny All',
    'Refuse all', 'Refuse All',
    'Reject all cookies', 'Reject All Cookies',
    'Decline all cookies', 'Decline All Cookies',
    'Reject non-essential', 'Reject Non-Essential',
    'Only allow required', 'Required only',
    /* Spanish */
    'Rechazar', 'Rechazar todo', 'Rechazar todos', 'Rechazar todas',
    'No aceptar', 'No aceptar cookies', 'Solo necesarias',
    'Solo necesarias cookies', 'Configuraci\u00f3n', 'Preferencias',
    /* French */
    'Refuser', 'Refuser tout', 'Tout refuser', 'Refuser tous',
    'Accepter uniquement n\u00e9cessaires', 'Uniquement n\u00e9cessaires',
    'Continuer sans accepter', 'Param\u00e8tres', 'G\u00e9rer',
    /* German */
    'Ablehnen', 'Alle ablehnen', 'Alles ablehnen',
    'Nur notwendige', 'Nur notwendige Cookies', 'Notwendige nur',
    'Einstellungen', 'Cookie-Einstellungen', 'Pr\u00e4ferenzen',
    'Nur erforderliche', 'Nur erforderliche Cookies',
    /* Italian */
    'Rifiuta', 'Rifiuta tutto', 'Rifiuta tutti', 'Rifiuta tutte',
    'Solo necessari', 'Solo necessari cookies', 'Solo necessarie',
    'Continua senza accettare', 'Impostazioni', 'Preferenze',
    /* Portuguese */
    'Recusar', 'Recusar tudo', 'Recusar todos', 'Recusar todas',
    'Apenas necess\u00e1rios', 'Apenas necess\u00e1rias',
    'Continuar sem aceitar', 'Configura\u00e7\u00f5es', 'Prefer\u00eancias',
    /* Dutch */
    'Weigeren', 'Alles weigeren', 'Alleen noodzakelijke',
    'Alleen noodzakelijke cookies', 'Instellingen', 'Voorkeuren',
    'Niet accepteren', 'Sla over',
    /* Polish */
    'Odrzu\u0107', 'Odrzu\u0107 wszystkie', 'Odrzu\u0107 wszystko',
    'Tylko niezb\u0119dne', 'Tylko niezb\u0119dne cookies',
    'Ustawienia', 'Preferencje',
    /* Russian */
    '\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c', '\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c \u0432\u0441\u0435', '\u0422\u043e\u043b\u044c\u043a\u043e \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u044b\u0435',
    '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438', '\u041f\u0440\u0435\u0434\u043f\u043e\u0447\u0442\u0435\u043d\u0438\u044f', '\u041d\u0435 \u043f\u0440\u0438\u043d\u0438\u043c\u0430\u0442\u044c',
    /* Swedish */
    'Avvisa', 'Avvisa alla', 'Endast n\u00f6dv\u00e4ndiga',
    'N\u00f6dv\u00e4ndiga endast', 'Inst\u00e4llningar', 'Preferenser',
    /* Danish / Norwegian */
    'Afvis', 'Afvis alle', 'Kun n\u00f8dvendige',
    'Avvis', 'Avvis alle', 'Bare n\u00f8dvendige',
    /* Finnish */
    'Hylk\u00e4\u00e4', 'Hylk\u00e4\u00e4 kaikki', 'Vain v\u00e4ltt\u00e4m\u00e4tt\u00f6m\u00e4t',
    'Asetukset', 'Mieltymykset',
    /* Czech */
    'Odm\u00edtnout', 'Odm\u00edtnout v\u0161e', 'Pouze nezbytn\u00e9',
    'Nastaven\u00ed', 'P\u0159edvolby',
    /* Hungarian */
    'Elutas\u00edt\u00e1s', 'Mindet elutas\u00edt', 'Minden elutas\u00edt\u00e1sa',
    'Csak a sz\u00fcks\u00e9gesek', 'Be\u00e1ll\u00edt\u00e1sok',
    /* Turkish */
    'Reddet', 'T\u00fcm\u00fcn\u00fc reddet', 'Sadece gerekli',
    'Ayarlar', 'Tercihler',
    /* Romanian */
    'Refuz\u0103', 'Refuz\u0103 tot', 'Respinge',
    'Doar necesare', 'Doar cookie-urile necesare',
    'Set\u0103ri', 'Preferin\u021be',
    /* Other */
    'Necesar', 'Necessaire', 'Necessario', 'Necessari',
    'Rifiutare', 'Rifiutare tutto',
    'Nur das N\u00f6tigste', 'Nur N\u00f6tigste',
    'Weiter ohne Zustimmung', 'Ohne Zustimmung fortfahren',
    'Gestionar', 'G\u00e9rer', 'Gestionar',
    'Continuer sans', 'Continuer sans accepter',
    'Continua senza', 'Continua senza accettare'
  ];

  const ACCEPT_BUTTON_PATTERNS = [
    'Accept all', 'Accept All', 'Accept', 'accept',
    'Allow all', 'Allow All', 'Allow', 'allow',
    'OK', 'Okay', 'okay',
    'Got it', 'Got It', 'I understand',
    'Agree', 'Agree all', 'Agree All',
    'Continue', 'Continue to site',
    'Close', 'close',
    '\u2713', '\u2714',
    /* Spanish */
    'Aceptar todo', 'Aceptar todos', 'Aceptar todas', 'Aceptar',
    'Permitir todo', 'Permitir', 'De acuerdo', 'Entendido',
    /* French */
    'Accepter tout', 'Tout accepter', 'Accepter tous', 'Accepter',
    'J\u2019accepte', "D'accord", "J'ai compris",
    /* German */
    'Alle akzeptieren', 'Akzeptieren', 'Zustimmen', 'OK',
    'Alle Cookies akzeptieren', 'Cookies akzeptieren', 'Einverstanden',
    /* Italian */
    'Accetta tutto', 'Accetta tutti', 'Accetta tutte', 'Accetta',
    'Consenti tutto', 'Consenti', 'OK',
    /* Portuguese */
    'Aceitar tudo', 'Aceitar todos', 'Aceitar todas', 'Aceitar',
    'Permitir tudo', 'Permitir', 'OK',
    /* Dutch */
    'Alles accepteren', 'Accepteren', 'Akkoord', 'OK',
    'Alle cookies accepteren', 'Cookies accepteren',
    /* Polish */
    'Akceptuj wszystko', 'Akceptuj wszystkie', 'Akceptuj',
    'Zgadzam si\u0119', 'Zgoda', 'OK',
    /* Russian */
    '\u041f\u0440\u0438\u043d\u044f\u0442\u044c \u0432\u0441\u0435', '\u041f\u0440\u0438\u043d\u044f\u0442\u044c', '\u0421\u043e\u0433\u043b\u0430\u0441\u0438\u0442\u044c\u0441\u044f',
    '\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c', '\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c \u0432\u0441\u0435', 'OK',
    /* Swedish */
    'Acceptera alla', 'Acceptera', 'Godk\u00e4nn', 'OK',
    /* Danish / Norwegian */
    'Accepter alle', 'Accepter alt', 'Accepter', 'Godkend', 'OK',
    'Godta alle', 'Godta alt', 'Godta',
    /* Finnish */
    'Hyv\u00e4ksy kaikki', 'Hyv\u00e4ksy', 'OK', 'Salli',
    /* Czech */
    'P\u0159ijmout v\u0161e', 'P\u0159ijmout', 'Souhlas\u00edm', 'OK',
    /* Hungarian */
    '\u00d6sszes elfogad\u00e1sa', 'Elfogad', 'Elfogadom', 'OK',
    /* Turkish */
    'T\u00fcm\u00fcn\u00fc kabul et', 'Kabul et', 'Kabul', 'OK',
    /* Romanian */
    'Accept\u0103 tot', 'Accept\u0103', 'Sunt de acord', 'OK',
  ];

  let neverConsentInitialized = false;

  function initNeverConsent() {
    if (neverConsentInitialized) return;
    if (config.neverConsent === false) return;
    neverConsentInitialized = true;
    handleCookieConsent();
  }

  function handleCookieConsent() {
    const now = Date.now();
    if (handleCookieConsent._lastRun && now - handleCookieConsent._lastRun < 2000) return;
    handleCookieConsent._lastRun = now;
    const banners = findBanners();
    for (const banner of banners) {
      if (banner.offsetParent === null) continue;
      if (tryReject(banner)) continue;
      tryAccept(banner);
    }
  }

  function findButtonIn(banner, patterns) {
    const buttons = banner.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], span, div');
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim();
      const aria = (btn.getAttribute('aria-label') || '');
      for (const pat of patterns) {
        if (text === pat || text.toLowerCase() === pat.toLowerCase() || aria === pat || aria.toLowerCase() === pat.toLowerCase()) {
          return btn;
        }
      }
    }
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      for (const pat of patterns) {
        const pl = pat.toLowerCase();
        if (text.includes(pl) || aria.includes(pl)) return btn;
      }
    }
    return null;
  }

  function tryReject(banner) {
    const btn = findButtonIn(banner, REJECT_BUTTON_PATTERNS);
    if (btn) {
      btn.click();
      queueBlockCount(1);
      hideBanner(banner);
      return true;
    }
    return false;
  }

  function tryAccept(banner) {
    const btn = findButtonIn(banner, ACCEPT_BUTTON_PATTERNS);
    if (btn) {
      btn.click();
      hideBanner(banner);
      return true;
    }
    return false;
  }

  function hideBanner(banner) {
    banner.classList.add('ds-hidden');
    banner.setAttribute('aria-hidden', 'true');
    banner.dataset._sfConsent = '1';
  }

  function findBanners() {
    const found = new Set();
    for (const sel of COOKIE_BANNER_SELECTORS) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetParent === null || el.dataset._sfConsent) continue;
        found.add(el);
      }
    }
    if (found.size === 0 && !findBanners._fallbackDone) {
      findBanners._fallbackDone = true;
      const allDivs = document.querySelectorAll('div[class*="cookie" i], div[id*="cookie" i], div[class*="consent" i], div[id*="consent" i]');
      for (const el of allDivs) {
        if (el.offsetParent === null || el.dataset._sfConsent) continue;
        if (el.children.length > 0 && el.children.length < 20) found.add(el);
      }
    }
    return Array.from(found);
  }

  /* ---------- Ghostery-inspired: Enhanced Anti-Tracking ---------- */
  let enhancedTrackingInitialized = false;

  function initEnhancedAntiTracking() {
    if (enhancedTrackingInitialized) return;
    if (config.enhancedTracking !== true) return;
    enhancedTrackingInitialized = true;
    spoofNavigatorProperties();
    spoofScreenProperties();
    removeTrackingStorage();
  }

  function spoofNavigatorProperties() {
    const randomLang = (Math.random() > 0.5 ? 'en-US' : 'en-GB');
    const hc = Math.max(2, Math.floor(Math.random() * 4) + 2);
    const dm = Math.floor(Math.random() * 4) * 2 + 2;
    injectMainWorldCode('(function(){try{Object.defineProperty(Navigator.prototype,"languages",{get:function(){return ' + JSON.stringify([randomLang, 'en']) + '},configurable:true});}catch(e){}' +
      'try{Object.defineProperty(Navigator.prototype,"hardwareConcurrency",{get:function(){return ' + hc + '},configurable:true});}catch(e){}' +
      'try{Object.defineProperty(Navigator.prototype,"deviceMemory",{get:function(){return ' + dm + '},configurable:true});}catch(e){}' +
      'try{if(navigator.mediaDevices&&navigator.mediaDevices.enumerateDevices){navigator.mediaDevices.enumerateDevices=function(){return Promise.resolve([{kind:"audioinput",deviceId:"",groupId:"",label:""}])};}}catch(e){}' +
      '})();');
  }

  function spoofScreenProperties() {
    injectMainWorldCode('(function(){var ow=screen.width,oh=screen.height;var d=function(){return Math.floor(Math.random()*3-1)};' +
      'try{Object.defineProperty(Screen.prototype,"width",{get:function(){return ow+d()},configurable:true});}catch(e){}' +
      'try{Object.defineProperty(Screen.prototype,"height",{get:function(){return oh+d()},configurable:true});}catch(e){}' +
      'try{Object.defineProperty(Screen.prototype,"colorDepth",{get:function(){return Math.random()>0.5?24:32},configurable:true});}catch(e){}' +
      '})();');
  }

  function removeTrackingStorage() {
    const trackingKeys = [
      '_ga', '_gid', '_gat', '_fbp', '_gaid', '_gcl_au',
      '__utmz', '__utma', '__utmb', '__utmc', '__utmt',
      '_ym_uid', '_ym_d', '_ym_isad', '_ym_metrika',
      'mp_', 'ajs_', '_hj',
      'amplitude', 'mixpanel', 'segment',
      'lot', 'lt', 'listrak',
      'pardot', 'eloqua', 'act-on',
      'hubspot', 'hs_', '__hstc', '__hssc', '__hssrc',
      'intercom', 'drift', 'olark',
      'optimizely', 'visualwebsiteoptimizer',
      'hotjar', 'clarity',
      'fullstory', 'heap',
      'gtm_', '_dc_gtm_',
      'browser_id', 'device_id', 'deviceId',
      'fingerprint', 'fingerprint2',
      '_pin_unauth', '_ir',
      '_uetsid', '_uetvid',
      'trk_', 'bscookie',
      'personalization_id',
      '__cfduid', '_cfduid'
    ];
    try {
      for (const key of Object.keys(localStorage)) {
        if (trackingKeys.some(t => key === t || key.startsWith(t))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (trackingKeys.some(t => key === t || key.startsWith(t))) {
          sessionStorage.removeItem(key);
        }
      }
    } catch (e) {}
    try {
      if (typeof document.cookie === 'string' && document.cookie.includes('_ga')) {
        const cookies = document.cookie.split(';');
        for (const c of cookies) {
          const name = c.split('=')[0].trim();
          if (trackingKeys.some(t => name === t || name.startsWith(t))) {
            document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          }
        }
      }
    } catch (e) {}
  }

  /* ---------- NoScript-inspired: XSS Protection ---------- */
  let xssInitialized = false;

  function initXssProtection() {
    sanitizeUrlXss();
    monitorXssMutations();
    if (!isAdminPanel) interceptFormXss();
  }

  const XSS_PATTERNS = [
    /<script[^>]*>/i, /<script>/i, /<\/script>/i,
    /javascript\s*:/i, /vbscript\s*:/i,
    /onerror\s*=/i, /onload\s*=/i, /onclick\s*=/i,
    /onmouseover\s*=/i, /onfocus\s*=/i, /onblur\s*=/i,
    /onchange\s*=/i, /onsubmit\s*=/i, /onkeypress\s*=/i,
    /alert\s*\(/i, /confirm\s*\(/i, /prompt\s*\(/i,
    /<iframe[^>]*>/i, /<embed[^>]*>/i, /<object[^>]*>/i,
    /expression\s*\(/i, /url\s*\(/i,
    /eval\s*\(/i, /setTimeout\s*\(/i, /setInterval\s*\(/i,
    /document\.write/i, /document\.cookie/i,
    /String\.fromCharCode/i, /atob\s*\(/i,
    /data\s*:\s*text\/html/i, /data\s*:\s*application\/x-javascript/i
  ];

  async function sanitizeUrlXss() {
    try {
      const params = new URLSearchParams(window.location.search);
      const REAL_XSS = [/<script/i, /javascript\s*:/i, /onerror\s*=/i, /onload\s*=/i, /<iframe/i];
      let dirty = false;
      for (const [key, val] of params) {
        if (REAL_XSS.some(p => p.test(val))) {
          params.delete(key);
          dirty = true;
        }
      }
      if (dirty) {
        const newUrl = window.location.origin + window.location.pathname +
          (params.toString() ? '?' + params.toString() : '') + window.location.hash;
        window.history.replaceState(null, '', newUrl);
        showWarning('DurgaShield: Removed suspicious XSS parameter from URL.');
      }
    } catch (e) {}
  }

  var _xssObserver = null;
  function monitorXssMutations() {
    if (_xssObserver) return;
    _xssObserver = new MutationObserver((mutations) => {
      if (siteDisabled) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            if (node.tagName === 'SCRIPT') {
              const src = node.src || '';
              const type = node.type || '';
              if (type && type !== 'text/javascript' && type !== 'module' && type !== 'application/javascript') continue;
              if (src && XSS_PATTERNS.some(p => p.test(src))) {
                node.remove();
                queueBlockCount(1);
                _b.runtime.sendMessage({ type: MSG.XSS_DETECTED, data: src.substring(0, 200) });
              }
            }
            if (node.tagName === 'IFRAME') {
              const src = node.src || '';
              if (/^data:text\/html/i.test(src)) {
                node.remove();
                queueBlockCount(1);
              }
            }
            if (node.tagName === 'A' || node.tagName === 'AREA') {
              const href = node.href || '';
              if (/^javascript:/i.test(href)) {
                node.addEventListener('click', (e) => { e.preventDefault(); queueBlockCount(1); });
              }
            }
          }
        }
      }
    });
    _xssObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function interceptFormXss() {
    const XSS_PATTERNS_FORM = [
      /<script[^>]*>/i,
      /javascript\s*:/i,
      /onerror\s*=/i, /onload\s*=/i,
      /<iframe[^>]*>/i,
      /expression\s*\(\s*[^)]/i,
    ];
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.tagName !== 'FORM') return;
      let foundXss = false;
      const inputs = form.querySelectorAll('input[type="text"], input[type="search"], input[type="url"], input[type="email"], textarea');
      for (const input of inputs) {
        const val = input.value || '';
        if (XSS_PATTERNS_FORM.some(p => p.test(val))) {
          foundXss = true;
          input.style.border = '2px solid red';
          input.title = 'DurgaShield: Removed suspicious content';
          input.value = val.replace(/<[^>]*>/g, '').replace(/javascript\s*:/gi, '').replace(/on\w+\s*=/gi, '');
        }
      }
      if (foundXss) {
        queueBlockCount(1);
        _b.runtime.sendMessage({ type: MSG.XSS_DETECTED, data: 'form submission' });
      }
    }, true);
  }

  /* ---------- NoScript-inspired: ClearClick (Anti-Clickjacking) ---------- */
  let clearClickInitialized = false;
  const clearClickOverlays = new WeakSet();

  function initClearClick() {
    if (clearClickInitialized) return;
    if (config.clearClick !== true) return;
    if (isCryptoSite()) return;
    clearClickInitialized = true;
    scanSuspiciousOverlays();
    document.addEventListener('click', clearClickHandler, true);
  }

  var scanOverlaysThrottle = 0;
  function scanSuspiciousOverlays() {
    var now = Date.now();
    if (now - scanOverlaysThrottle < 2000) return;
    scanOverlaysThrottle = now;
    var candidates = document.querySelectorAll('div, iframe, object, embed');
    for (const el of candidates) {
      if (isSuspiciousOverlay(el)) {
        clearClickOverlays.add(el);
        el.style.outline = '2px solid rgba(233,69,96,0.4)';
      }
    }
  }

  function isSuspiciousOverlay(el) {
    if (el === document.body || el === document.documentElement) return false;
    if (el.offsetParent === null) return false;
    if (el.dataset._sfClearClicked) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (style.pointerEvents === 'none') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 5 || rect.height < 5) return false;
    const opacity = parseFloat(style.opacity);
    if (opacity >= 0.1) return false;
    if (style.position !== 'fixed' && style.position !== 'absolute') return false;
    if (style.zIndex < 99) return false;
    const bg = style.backgroundColor;
    if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return false;
    return true;
  }

  async function clearClickHandler(e) {
    const target = e.target;
    let overlay = target;
    while (overlay && overlay !== document.body) {
      if (clearClickOverlays.has(overlay)) {
        e.preventDefault();
        e.stopPropagation();
        var tagInfo = (overlay.tagName || '') + (overlay.id ? '#' + overlay.id : '');
        var confirmed = await showConfirmModal('DurgaShield ClearClick: This click was intercepted by a transparent overlay.\n\nThis could be a clickjacking attempt. Allow the click anyway?\n\nElement: ' + tagInfo + '\n\n- Click OK to allow the click through.\n- Click Cancel to dismiss this warning (overlay stays blocked).');
        if (confirmed) {
          overlay.dataset._sfClearClicked = '1';
          clearClickOverlays.delete(overlay);
          overlay.style.outline = '';
          target.click();
        } else {
          overlay.dataset._sfClearClicked = '1';
          clearClickOverlays.delete(overlay);
          overlay.style.outline = '';
        }
        return;
      }
      overlay = overlay.parentElement;
    }
  }

  /* ---------- NoScript-inspired: ABE (Application Boundaries Enforcer) ---------- */
  const PRIVATE_IP_PATTERNS = [
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^0\.0\.0\.0$/,
    /^localhost$/i,
    /^::1$/
  ];

  let abeInitialized = false;

  function initABE() {
    if (abeInitialized) return;
    if (config.abe === false) return;
    abeInitialized = true;
    checkLocalNetworkContent();
  }

  function isPrivateHost(hostname) {
    return PRIVATE_IP_PATTERNS.some(p => p.test(hostname));
  }

  function checkLocalNetworkContent() {
    const currentHost = window.location.hostname;
    if (isPrivateHost(currentHost)) return;
    const elements = document.querySelectorAll('iframe[src], img[src], script[src], link[href], embed[src], object[data]');
    let warned = false;
    for (const el of elements) {
      try {
        const src = el.src || el.href || el.data || '';
        if (!src) continue;
        const url = new URL(src, location.href);
        if (isPrivateHost(url.hostname)) {
          el.remove();
          queueBlockCount(1);
          if (!warned) {
            warned = true;
            const w = document.createElement('div');
            w.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#dc3545;color:white;padding:8px 16px;font-family:Arial,sans-serif;font-size:12px;text-align:center';
            w.textContent = 'DurgaShield ABE: Blocked request to local network from this page.';
            document.body.prepend(w);
            setTimeout(() => w.remove(), 8000);
            _b.runtime.sendMessage({ type: MSG.ABE_BLOCKED, data: url.hostname });
          }
        }
      } catch (e) {}
    }
  }

  /* ---------- ClearURLs: Enhanced URL Tracking Cleaning (200+ params) ---------- */
  const TRACKING_PARAMS = [
    'fbclid','gclid','gclsrc','dclid','yclid','mc_eid','_ga','_gl','_hsenc','_hsmi',
    'utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','utm_cid',
    'utm_reader','utm_viz_id','utm_pubreferrer','utm_affiliate','utm_affiliate_id','utm_agency',
    'utm_brand','utm_budget','utm_campaignid','utm_channel','utm_contentid','utm_country',
    'utm_cp','utm_device','utm_division','utm_dgroup','utm_effective','utm_entry','utm_extra',
    'utm_feed','utm_format','utm_from','utm_gclid','utm_geo','utm_gsrc','utm_hashtag',
    'utm_issue','utm_keyword','utm_label','utm_location','utm_m','utm_mediumname','utm_ name',
    'utm_network','utm_nooverride','utm_override','utm_page','utm_partner','utm_placement',
    'utm_position','utm_pro','utm_pubreferrer','utm_pub','utm_rank','utm_referrer','utm_rm',
    'utm_s','utm_segment','utm_series','utm_sid','utm_site','utm_sk','utm_social','utm_social_type',
    'utm_soi','utm_source_site','utm_src','utm_sub','utm_subscriber','utm_subscription',
    'utm_tag','utm_term_id','utm_term_list','utm_test','utm_topic','utm_tracker','utm_type',
    'utm_user','utm_v','utm_viz_id','utm_wo','utm_medium','ref','ref_src','ref_url',
    'referrer','referral','ref_source','source','si','sq','sk','sp','s_kwcid',
    'ef_id','msclkid','wt_mc_o','wt_zmc','vero_conv','vero_id','yclid','_openstat',
    'mkt_tok','igshid','ncid','trk','trkCampaign','trk_content','wt_mc',
    'oly_anon_id','oly_enc_id','_branch_match_id','_bhlid','_c1','_c2','_c3','_c4',
    'keystats','hotjar_v','hk','hsCtaTracking','__hstc','__hssc','__hssrc',
    'guccounter','guce_referrer','guce_referrer_sig','__twitter_impression',
    'twclid','trueh','li_fat_id','vero_id','mkt_tok','elp','et_rid','et_oid',
    'external_id','icid','intcmp','inpt','kid','lkid','lkid','mkevt','mkcid','mkrid',
    'mkt_tok','mlid','mtm_source','mtm_medium','mtm_campaign','mtm_keyword','mtm_content',
    'mtm_cid','mtm_group','mtm_placement','mtm_creative','mtm_partner','mtm_kwd',
    'mtm_ad','mtm_network','mtm_account','mtm_pk','mtm_ct','mtm_ci','mtm_ea','mtm_cr',
    'mtm_id','mtm_no','mtm_tid','mtm_vid','mtm_test','mtm_pp','mtm_param',
    '__twitter_impression','twclid','fb_action_ids','fb_action_types','fb_source',
    'fb_ref','fb_bmfr','jazo','ads_crl','ads_id','adid','age-verified','ao_noptimize',
    'ao_opt','crlp','dd','dclid','dr','exmns','exp','fkeid','fl_ten','fl_tw',
    'ftag','gclsrc','gs_l','gbraid','wbraid','hmb_campaign','hmb_medium','hmb_source',
    'hmb_ad_group','hmb_keyword','hmb_placement','hmb_device','hmb_target','hmb_creative',
    'hmb_match_type','hmb_feed','hmb_network','hmb_loc','hmb_loc_inter','hmb_loc_ph',
    'hmb_phys','hmb_region','hmb_country','hmb_currency','hmb_bid','hmb_target_id',
    'hmb_account','hmb_campaign_id','hmb_ad_group_id','hmb_keyword_id','hmb_placement_id',
    'hmb_creative_id','hmb_network_type','hmb_target_id','hmb_loc_id','hmb_physical_id',
    'hmb_vertical','hmb_device_model','hmb_os','hmb_os_version','hmb_browser','hmb_browser_version',
    'hmb_site','hmb_domain','hmb_path','hmb_query','hmb_ref','hmb_ref_domain','hmb_ref_path',
    'hmb_ref_query','hmb_url','hmb_url_domain','hmb_url_path','hmb_url_query'
  ];

  function enhancedUrlCleaning() {
    if (!config.ads && !config.enhancedTracking) return;
    document.addEventListener('click', (e) => {
      let el = e.target;
      while (el && el.tagName !== 'A') el = el.parentElement;
      if (!el || !el.href) return;
      try {
        const url = new URL(el.href);
        let changed = false;
        for (const p of TRACKING_PARAMS) {
          if (url.searchParams.has(p)) { url.searchParams.delete(p); changed = true; }
        }
        if (changed) el.href = url.toString();
      } catch (err) {}
    }, true);
  }

  /* ---------- AudioContext Fingerprinting Protection ---------- */
  function initFingerprintingProtection() {
    if (config.stealth !== true) return;

    /* AudioContext — AnalyserNode prototype noise (shared DOM prototype) */
    if (window.AudioContext || window.webkitAudioContext) {
      const origGetFloat = AnalyserNode.prototype.getFloatFrequencyData;
      const origGetByte = AnalyserNode.prototype.getByteFrequencyData;
      const origByteTime = AnalyserNode.prototype.getByteTimeDomainData;
      AnalyserNode.prototype.getFloatFrequencyData = function(array) {
        origGetFloat.call(this, array);
        for (let i = 0; i < array.length; i++) array[i] += (Math.random() - 0.5) * 0.5;
      };
      AnalyserNode.prototype.getByteFrequencyData = function(array) {
        origGetByte.call(this, array);
        for (let i = 0; i < array.length; i++) array[i] = Math.max(0, Math.min(255, array[i] + Math.floor(Math.random() * 3 - 1)));
      };
      AnalyserNode.prototype.getByteTimeDomainData = function(array) {
        origByteTime.call(this, array);
        for (let i = 0; i < array.length; i++) array[i] = Math.max(0, Math.min(255, array[i] + Math.floor(Math.random() * 3 - 1)));
      };
    }

    /* Canvas — add subtle noise instead of returning static 1x1; skip if antiFingerprinting already patched */
    if (!HTMLCanvasElement.prototype._dgsPatched) try {
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
        return origGetImageData.call(this, x, y, w, h);
      };
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        var ctx = this.getContext('2d');
        if (ctx) {
          const w = this.width, h = this.height;
          const clean = origGetImageData.call(ctx, 0, 0, w, h);
          const noisy = new Uint8ClampedArray(clean.data);
          for (let i = 0; i < noisy.length; i += 4) {
            noisy[i] = Math.max(0, Math.min(255, noisy[i] + Math.floor(Math.random() * 3 - 1)));
            noisy[i + 1] = Math.max(0, Math.min(255, noisy[i + 1] + Math.floor(Math.random() * 3 - 1)));
            noisy[i + 2] = Math.max(0, Math.min(255, noisy[i + 2] + Math.floor(Math.random() * 3 - 1)));
          }
          ctx.putImageData(clean, 0, 0);
          ctx.putImageData(new ImageData(noisy, w, h), 0, 0);
          const result = origToDataURL.call(this, type);
          ctx.putImageData(clean, 0, 0);
          return result;
        }
        return origToDataURL.call(this, type);
      };
      HTMLCanvasElement.prototype.toBlob = function(callback, type) {
        var ctx = this.getContext('2d');
        if (ctx) {
          const w = this.width, h = this.height;
          const clean = origGetImageData.call(ctx, 0, 0, w, h);
          const noisy = new Uint8ClampedArray(clean.data);
          for (let i = 0; i < noisy.length; i += 4) {
            noisy[i] = Math.max(0, Math.min(255, noisy[i] + Math.floor(Math.random() * 3 - 1)));
            noisy[i + 1] = Math.max(0, Math.min(255, noisy[i + 1] + Math.floor(Math.random() * 3 - 1)));
            noisy[i + 2] = Math.max(0, Math.min(255, noisy[i + 2] + Math.floor(Math.random() * 3 - 1)));
          }
          ctx.putImageData(new ImageData(noisy, w, h), 0, 0);
          origToBlob.call(this, callback, type);
          ctx.putImageData(clean, 0, 0);
        }
      };
    } catch (e) {}

    /* WebGL */
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const origGetParameter = WebGLRenderingContext.prototype.getParameter;
      const origGetExtension = WebGLRenderingContext.prototype.getExtension;
      WebGLRenderingContext.prototype.getParameter = function(pname) {
        const result = origGetParameter.call(this, pname);
        if (pname === 37446) return 'Intel Inc. Intel Iris OpenGL Engine';
        if (pname === 7936) return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
        if (pname === 7937) return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
        if (pname === 35724) return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
        return result;
      };
      WebGLRenderingContext.prototype.getExtension = function(name) {
        if (name && (
          name.startsWith('WEBGL_debug_renderer_info') ||
          name.startsWith('WEBGL_debug_shaders')
        )) return null;
        return origGetExtension.call(this, name);
      };
      const gl2 = canvas.getContext('webgl2');
      if (gl2) {
        WebGL2RenderingContext.prototype.getParameter = WebGLRenderingContext.prototype.getParameter;
      }
    }

    /* DOMRect */
    try {
      const origFromRect = DOMRect.fromRect;
      DOMRect.fromRect = function(rect) {
        const r = origFromRect.call(this, rect);
        return new DOMRect(
          r.x + (Math.random() - 0.5) * 0.01,
          r.y + (Math.random() - 0.5) * 0.01,
          r.width + (Math.random() - 0.5) * 0.01,
          r.height + (Math.random() - 0.5) * 0.01
        );
      };
    } catch (e) {}
    try {
      const origGetClientRects = Element.prototype.getClientRects;
      Element.prototype.getClientRects = function() {
        const rects = origGetClientRects.call(this);
        if (rects.length === 0) return rects;
        const dither = (Math.random() - 0.5) * 0.01;
        try {
          return Array.from(rects).map(function(r) {
            return new DOMRect(r.x + dither, r.y + dither, r.width, r.height);
          });
        } catch (e) {}
        return rects;
      };
    } catch (e) {}
  }

  /* ---------- Heuristic Detection (Aggressive Cookies, Beacons) ---------- */
  function initHeuristicDetection() {
    if (config.enhancedTracking !== true) return;
    let cookieAccessCount = 0;
    let cookieAccessThreshold = 50;

    try {
      const origCookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
      if (origCookieDesc) {
        Object.defineProperty(document, 'cookie', {
          get: function() {
            cookieAccessCount++;
            if (cookieAccessCount > cookieAccessThreshold) {
              cookieAccessCount = 0;
              _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'privacy', count: 1 }).catch(() => {});
            }
            return origCookieDesc.get.call(document);
          },
          set: function(val) { origCookieDesc.set.call(document, val); },
          configurable: false
        });
      }
    } catch (e) {}

    try {
      const origSendBeacon = navigator.sendBeacon;
      navigator.sendBeacon = function(url, data) {
        try {
          const u = new URL(url);
          const trackingDomains = ['doubleclick.net', 'google-analytics.com', 'googletagmanager.com', 'facebook.com/tr', 'amazon-adsystem.com', 'scorecardresearch.com', 'outbrain.com', 'taboola.com', 'criteo.com', 'adsrvr.org', 'adnxs.com', 'rubiconproject.com', 'pubmatic.com'];
          if (trackingDomains.some(function(d) { return u.hostname.includes(d) || u.pathname.includes(d); })) {
            _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'privacy', count: 1 }).catch(() => {});
            return true;
          }
        } catch (e) {}
        return origSendBeacon.call(this, url, data);
      };
    } catch (e) {}
  }

  /* ---------- History API Protection ---------- */
  function historyProtection() {
    if (config.stealth !== true) return;
    /* SPAs rely on history.length for routing — skip them */
    if (window.history.pushState) return;
    try {
      Object.defineProperty(history, 'length', { get: function() { return Math.max(1, Math.floor(Math.random() * 10)); }, configurable: true });
    } catch (e) {}
  }

  /* ---------- Permission Monitor ---------- */
  let permGeoCount = 0;
  let permCamCount = 0;
  let permMicCount = 0;

  function permissionMonitor() {
    const origGetCurrentPosition = navigator.geolocation && navigator.geolocation.getCurrentPosition;
    if (origGetCurrentPosition) {
      navigator.geolocation.getCurrentPosition = function(success, error, opts) {
        permGeoCount++;
        if (permGeoCount <= 3) {
          showPermNotification('Location', permGeoCount);
        }
        return origGetCurrentPosition.call(navigator.geolocation, success, error, opts);
      };
    }
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function(constraints) {
        if (constraints && constraints.video) { permCamCount++; showPermNotification('Camera', permCamCount); }
        if (constraints && constraints.audio) { permMicCount++; showPermNotification('Microphone', permMicCount); }
        return origGetUserMedia(constraints);
      };
    }
  }

  function showPermNotification(type, count) {
    if (count > 3) return;
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#ffc107;color:#212529;padding:6px 16px;font-family:Arial,sans-serif;font-size:12px;text-align:center;border-top:2px solid #e0a800';
    bar.textContent = 'DurgaShield: This page requested your ' + type + ' (' + count + 'x)';
    document.body.appendChild(bar);
    setTimeout(() => bar.remove(), 5000);
  }

  /* ---------- Mixed Content Detection ---------- */
  function detectMixedContent() {
    if (window.location.protocol !== 'https:') return;
    const now = Date.now();
    if (detectMixedContent._lastRun && now - detectMixedContent._lastRun < 3000) return;
    detectMixedContent._lastRun = now;
    const elements = document.querySelectorAll('img[src^="http:"], script[src^="http:"], iframe[src^="http:"], link[href^="http:"], embed[src^="http:"], object[data^="http:"]');
    let count = 0;
    for (const el of elements) {
      if ((el.src && el.src.startsWith('http:')) || (el.href && el.href.startsWith('http:')) || (el.data && el.data.startsWith('http:'))) {
        if (el.tagName === 'SCRIPT') {
          el.remove();
          count++;
        } else if (el.src) {
          el.src = el.src.replace(/^http:/, 'https:');
          count++;
        } else if (el.href) {
          el.href = el.href.replace(/^http:/, 'https:');
          count++;
        } else if (el.data) {
          el.data = el.data.replace(/^http:/, 'https:');
          count++;
        }
      }
    }
    if (count > 0) queueBlockCount(count);
  }

  /* ---------- Secure Payment Gateway: block payment forms on HTTP ---------- */
  const PAYMENT_FIELD_PATTERNS = [
    /card/i, /cc.?num/i, /cc.?number/i, /card.?number/i, /card.?no/i, /cardnumber/i, /ccnum/i,
    /cvv/i, /cvc/i, /cvv2/i, /cid/i, /card.?code/i, /security.?code/i, /card.?cvv/i,
    /expiry/i, /exp.?date/i, /expiration/i, /exp.?month/i, /exp.?year/i, /cc.?exp/i,
    /name.?on.?card/i, /card.?holder/i, /card.?name/i, /cardholder/i, /cardname/i,
    /upi/i, /vpa/i, /virtual.?payment.?address/i, /payee.?id/i, /upi.?id/i,
    /account.?no/i, /account.?number/i, /bank.?account/i, /bank.?acc/i, /acc.?no/i,
    /ifsc/i, /ifsc.?code/i, /bank.?code/i,
    /net.?banking/i, /netbanking/i, /online.?banking/i,
    /debit.?card/i, /credit.?card/i, /atm.?card/i,
    /payment/i, /amount/i, /currency/i, /transaction/i, /pay.?now/i,
    /otp/i, /password.?token/i, /txn.?password/i, /transaction.?password/i,
    /\bpin\b/i, /atm.?pin/i, /card.?pin/i, /debit.?pin/i,
    /routing.?number/i, /sort.?code/i, /iban/i, /swift/i, /bic/i
  ];

  let securePaymentInitialized = false;
  let securePaymentHandlerBound = null;

  function initSecurePayment() {
    if (securePaymentInitialized) return;
    if (config.securePayment === false) return;
    securePaymentHandlerBound = securePaymentHandler.bind(self);
    document.addEventListener('submit', securePaymentHandlerBound, true);
    securePaymentInitialized = true;
  }

  /* ---------- Secure Payment Handler ---------- */
  function securePaymentHandler(event) {
    if (window.location.protocol === 'https:') return;
    const form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    const hasPaymentField = Array.from(form.querySelectorAll('input')).some(input => {
      const name = (input.name || input.id || '').toLowerCase();
      return PAYMENT_FIELD_PATTERNS.some(p => p.test(name));
    });
    if (!hasPaymentField) return;
    event.preventDefault();
    event.stopPropagation();
    queueBlockCount(1);
    showWarning('Payment form blocked on insecure (HTTP) page. Use a secure (HTTPS) connection.');
    if (_b.runtime) {
      _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'phishing' });
    }
  }

  /* ---------- Warning Bar ---------- */
  function showWarning(msg) {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#dc3545;color:#fff;padding:6px 16px;font-family:Arial,sans-serif;font-size:12px;text-align:center;border-top:2px solid #b02a37';
    bar.textContent = 'DurgaShield: ' + msg;
    document.body.appendChild(bar);
    setTimeout(() => bar.remove(), 5000);
  }

  /* ---------- Metadata Cleanup: strip EXIF/GPS from uploaded images ---------- */
  function setupMetadataCleanup() {
    document.addEventListener('change', function(e) {
      const input = e.target;
      if (input.tagName !== 'INPUT' || input.type !== 'file') return;
      if (!input.files || !input.files.length) return;
      const files = Array.from(input.files);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        (function(f) {
          const reader = new FileReader();
          reader.onload = function(ev) {
            const dataUrl = ev.target.result;
            const img = new Image();
            img.onload = function() {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(function(blob) {
                if (!blob) return;
                const cleanFile = new File([blob], f.name, { type: f.type });
                const dt = new DataTransfer();
                dt.items.add(cleanFile);
                input.files = dt.files;
              }, file.type, 0.92);
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
        })(file);
      }
    }, true);
  }

  /* ---------- Search Annotations: mark trusted/unsafe domains on SERPs ---------- */
  function setupSearchAnnotations() {
    var host = hostname();
    var isGoogle = host.includes('google.com');
    var isBing = host.includes('bing.com');
    var isDDG = host.includes('duckduckgo.com');
    if (!isGoogle && !isBing && !isDDG) return;
    var searchHost = isGoogle ? 'google.com' : isBing ? 'bing.com' : 'duckduckgo.com';
    var trustedTLDs = ['.gov', '.edu', '.org'];
    var unsafeKeywords = ['free', 'win', 'prize', 'lottery', 'casino', 'bonus', 'click-here', 'download-now'];
    var style = document.createElement('style');
    style.textContent = 'a[data-dgs-safe]{font-weight:700!important}a[data-dgs-safe]::after{content:"SAFE";display:inline-block!important;font:700 9px/1.5 Arial,sans-serif!important;margin-left:5px!important;padding:2px 6px!important;border-radius:4px!important;background:#28a745!important;color:#fff!important;border:1px solid #1e7e34!important;letter-spacing:.3px!important;vertical-align:middle!important;filter:none!important;backdrop-filter:none!important}a[data-dgs-unsafe]::after{content:"RISK";display:inline-block!important;font:700 9px/1.5 Arial,sans-serif!important;margin-left:5px!important;padding:2px 6px!important;border-radius:4px!important;background:#dc3545!important;color:#fff!important;border:1px solid #bd2130!important;letter-spacing:.3px!important;vertical-align:middle!important;filter:none!important;backdrop-filter:none!important}';
    (document.head || document.documentElement).appendChild(style);
    function absoluteURL(raw) {
      if (!raw) return '';
      if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
      if (raw.startsWith('//')) return 'https:' + raw;
      if (raw.startsWith('/')) return 'https://www.' + searchHost + raw;
      return 'https://www.' + searchHost + '/' + raw;
    }
    function extractTargetURL(raw) {
      try {
        var abs = absoluteURL(raw);
        var u = new URL(abs);
        if (u.hostname.includes('google.com') && u.searchParams.has('q')) {
          var q = u.searchParams.get('q');
          if (q && q.startsWith('http')) return q;
        }
        if (u.hostname.includes('bing.com') && u.searchParams.has('url')) {
          var bu = u.searchParams.get('url');
          if (bu && bu.startsWith('http')) return bu;
        }
        if (u.hostname.includes('duckduckgo.com') && u.searchParams.has('uddg')) {
          var du = u.searchParams.get('uddg');
          if (du && du.startsWith('http')) return du;
        }
        return abs;
      } catch (e) { return raw; }
    }
    function isSearchEngineDomain(domain) {
      return domain === searchHost || domain.endsWith('.' + searchHost);
    }
    function isTrustedDomain(domain) {
      if (trustedTLDs.some(function(t) { return domain.endsWith(t); })) return true;
      var parts = domain.split('.');
      if (parts.slice(0, -1).some(function(p) { return ['gov','edu','org'].indexOf(p) >= 0; })) return true;
      if (domain.endsWith('.bank.in') || domain === 'bank.in') return true;
      return false;
    }
    function isUnsafeDomain(domain) {
      return unsafeKeywords.some(function(k) { return domain.includes(k); });
    }
    function annotate() {
      var links = document.querySelectorAll('a[href]');
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        if (link.dataset._dgs_anno) continue;
        var rawHref = link.getAttribute('href') || '';
        if (!rawHref || rawHref === '#' || rawHref.startsWith('javascript:')) continue;
        var href = extractTargetURL(rawHref);
        var domain = '';
        try { domain = new URL(href).hostname.replace(/^www\./, ''); } catch (e) { continue; }
        if (isSearchEngineDomain(domain)) continue;
        if (isTrustedDomain(domain)) {
          link.dataset.dgsSafe = '';
          link.dataset._dgs_anno = '1';
        } else if (isUnsafeDomain(domain)) {
          link.dataset.dgsUnsafe = '';
          link.dataset._dgs_anno = '1';
        }
      }
    }
    setTimeout(annotate, 500);
    setTimeout(annotate, 1500);
    var observer = new MutationObserver(annotate);
    var target = document.body || document.documentElement;
    if (target) observer.observe(target, { childList: true, subtree: true });
  }

  /* ---------- Keylogger Detection ---------- */
  function detectKeyloggers() {
    const host = window.location.hostname;
    if (host.includes('amazon.') || host.includes('payments.')) return;
    /* Don't patch addEventListener — almost every site uses keyboard events legitimately.
       Only flag if keystroke exfiltration to a third-party URL is observed via sendBeacon. */
    const origSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url) {
      try {
        const u = new URL(typeof url === 'string' ? url : '');
        const h = u.hostname.replace(/^www\./, '');
        if (h !== hostname() && /key|keystroke|input|type/i.test(u.pathname + u.search)) {
          queueBlockCount(1);
          showWarning('Possible keystroke exfiltration detected to: ' + h);
        }
      } catch (e) {}
      return origSendBeacon.apply(this, arguments);
    };
  }

  /* ---------- Clipboard Hijack Prevention ---------- */
  function preventClipboardHijack() {
    /* Browser native security already requires transient activation for clipboard.read/readText.
       Keeping the overrides would add a redundant second prompt. Skipped intentionally. */
  }

  /* ---------- Facebook Feed Ad Removal ---------- */
  function facebookScanAndRemove() {
    if (!window.location.hostname.includes('facebook.com')) return;
    const feedStream = document.querySelector('div[role="feed"]');
    if (!feedStream) return;
    const container = feedStream.firstElementChild;
    if (!container) return;
    const children = container.children;
    const lastIdx = facebookScanAndRemove._lastIdx || 0;
    if (children.length <= lastIdx) return;
    for (let i = lastIdx; i < children.length; i++) {
      const item = children[i];
      if (item.dataset._dgs_fb_scanned) continue;
      item.dataset._dgs_fb_scanned = '1';
      const text = item.textContent.toLowerCase();
      if (text.includes('sponsored') || text.includes('suggested') || text.includes('recommended')) {
        const spans = item.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent.toLowerCase() === 'sponsored' || span.textContent.toLowerCase() === 'suggested for you') {
            item.remove();
            queueBlockCount(1);
            break;
          }
        }
      }
    }
    facebookScanAndRemove._lastIdx = children.length;
  }

  function removeFacebookAds() {
    if (!window.location.hostname.includes('facebook.com')) return;
    facebookScanAndRemove();
  }

  /* ---------- Webmail Ads (Gmail/Outlook/Yahoo) ---------- */
  /* ---------- Webmail Ads: handled by DNR filter lists (EasyList etc.) ---------- */
  function removeWebmailAds() {}

  /* ---------- Interstitial Ad Dismissal ---------- */
  function dismissInterstitials() {
    const host = window.location.hostname;
    if (host.includes('amazon.') || host.includes('payments.')) return;
    const candidates = document.querySelectorAll(
      'div[class*="overlay"], div[class*="modal"], div[class*="popup"], ' +
      'div[class*="interstitial"], div[id*="overlay"], div[id*="modal"], ' +
      'div[id*="popup"], div[id*="interstitial"]'
    );
    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      if (style.position !== 'fixed') continue;
      if (!(parseInt(style.zIndex) >= 99999 || el.offsetWidth >= window.innerWidth * 0.8)) continue;
      /* Skip login dialogs, galleries, and anything with password inputs */
      if (el.querySelector('input[type="password"]')) continue;
      /* Check text for ad/subscription/interstitial signals */
      const text = (el.textContent || '').toLowerCase();
      const isLogin = el.querySelector('input[type="email"], input[type="text"][autocomplete="email"]');
      if (isLogin) continue;
      const isAdLike = text.includes('subscribe') || text.includes('newsletter') ||
                       text.includes('download our app') || text.includes('notification') ||
                       text.includes('allow notifications') || text.includes('enable notifications') ||
                       el.querySelector('iframe[src*="ad"], img[src*="ad"]');
      if (!isAdLike) continue;
      const closeBtn = el.querySelector(
        'button[class*="close"], button[aria-label*="close"], button[aria-label*="Close"], ' +
        'button[title*="close"], button[title*="Close"], .close, .dismiss, [class*="closebtn"]'
      );
      if (closeBtn) {
        closeBtn.click();
        queueBlockCount(1);
      } else {
        el.classList.add('ds-hidden');
        queueBlockCount(1);
      }
    }
  }

  /* ---------- Tech Support Scam Detection ---------- */
  function detectTechSupportScams() {
    const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
    const urlLower = (window.location.href || '').toLowerCase();
    if (/(support|help|kb\.|knowledgebase|docs\.|learn\.|community\.|blog\.|status\.)/i.test(urlLower)) return;
    const metaDesc = document.querySelector('meta[name="description"], meta[property="og:description"]');
    if (metaDesc && /(product support|help center|knowledge base|documentation|tutorial|blog post|technical (support|article))/i.test(metaDesc.getAttribute('content') || '')) return;
    const indicators = [
      'virus detected', 'your computer is infected', 'your pc has a virus',
      'call windows support', 'call microsoft support', 'call apple support',
      'suspicious activity detected', 'your information is at risk',
      'click here to clean', 'your browser is compromised',
      'microsoft security alert', 'apple security alert', 'windows defender alert',
      'your system is damaged', 'your system is infected'
    ];
    const found = indicators.filter(s => bodyText.includes(s));
    if (found.length > 0) {
      queueBlockCount(found.length);
      showWarning('Tech support scam detected! Do not call any phone numbers on this page.');
      if (_b && _b.runtime) {
        _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'malware', count: found.length });
      }
    }
  }

  /* ---------- Crypto Scam Page Detection ---------- */
  function detectCryptoScams() {
    const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
    const urlLower = (window.location.href || '').toLowerCase();
    if (/(support|help|kb\.|knowledgebase|docs\.|learn\.|community\.|blog\.|status\.)/i.test(urlLower)) return;
    const cryptoNewsDomains = ['coindesk.com', 'cointelegraph.com', 'binance.com', 'coinbase.com', 'kraken.com',
      'crypto.news', 'decrypt.co', 'theblock.co', 'bitcoinmagazine.com', 'bitcoin.org',
      'ethereum.org', 'coinmarketcap.com', 'coingecko.com', 'defillama.com', 'rekt.news',
      'messari.io', 'unchainedcrypto.com', 'bankless.com', 'blockworks.co', 'coincodex.com'];
    if (cryptoNewsDomains.some(d => urlLower.includes(d))) return;
    const indicators = [
      'free airdrop', 'claim your airdrop', 'free crypto', 'double your bitcoin',
      'send 1 get 10', 'send eth get', 'giveaway', 'fake wallet',
      'validate your wallet', 'connect wallet to claim', 'approve contract',
      'metamask sync', 'wallet verification', 'seed phrase', 'private key required',
      'enter your seed phrase', 'verify your wallet', 'token approval',
      'fake token sale', 'presale', 'rug pull',
      'eth to earn', 'btc to earn', 'crypto investment opportunity',
      'guaranteed returns', 'get rich quick', 'crypto signal group',
      'exclusive airdrop', 'whitelist giveaway', 'nft mint scam',
      'wallet drainer', 'approve malicious', 'revoke approval',
      'fake exchange', 'claim btc', 'claim eth', 'claim usdt',
      'send crypto to get', 'impersonating support',
    ];
    const found = indicators.filter(s => bodyText.includes(s));
    if (found.length > 0) {
      queueBlockCount(found.length);
      showWarning('Potential crypto scam detected! Do not connect your wallet or enter seed phrases.');
      if (_b && _b.runtime) {
        _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'crypto', count: found.length });
      }
    }
    const links = document.querySelectorAll('a[href*="airdrop"], a[href*="giveaway"], a[href*="claim"], a[href*="free-eth"], a[href*="free-btc"]');
    for (const link of links) {
      try {
        const parsed = new URL(link.href);
        if (!parsed.hostname.includes(hostname())) {
          link.style.setProperty('color', '#dc3545', 'important');
          link.setAttribute('data-ds-scam-link', 'true');
        }
      } catch (e) {}
    }
  }

  /* ---------- HTTP Password Field Monitor ---------- */
  function detectHttpPasswordFields() {
    if (window.location.protocol === 'https:') return;
    const inputs = document.querySelectorAll('input[type="password"]');
    if (inputs.length > 0) {
      queueBlockCount(inputs.length);
      showWarning('Password field detected on insecure (HTTP) page. Your credentials could be intercepted!');
      if (_b && _b.runtime) {
        _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'phishing', count: inputs.length });
      }
    }
  }

  /* ---------- SHA-1 helper (for password leak check) ---------- */
  async function sha1Hex(str) {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /* ---------- Automatic Password Leak Check ---------- */
  function setupPasswordLeakCheck() {
    if (typeof _b === 'undefined' || !_b.runtime) return;
    let checkTimer = null;
    document.addEventListener('input', function(e) {
      const el = e.target;
      if (el.type !== 'password' || !el.value || el.value.length < 6) return;
      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(async function() {
        const hash = await sha1Hex(el.value);
        _b.runtime.sendMessage({ type: MSG.AUTO_CHECK_PASSWORD, hash: hash }).catch(() => {});
      }, 2000);
    }, true);
    document.addEventListener('submit', async function(e) {
      const form = e.target;
      const pw = form.querySelector('input[type="password"]');
      if (pw && pw.value && pw.value.length >= 6) {
        const hash = await sha1Hex(pw.value);
        _b.runtime.sendMessage({ type: MSG.AUTO_CHECK_PASSWORD, hash: hash }).catch(() => {});
      }
    }, true);
  }

  /* ---------- GenAI Data Leak Prevention ---------- */
  const AI_CHAT_DOMAINS = ['chatgpt.com','chat.openai.com','gemini.google.com','claude.ai','copilot.microsoft.com','deepseek.com','perplexity.ai','pi.ai','character.ai','poe.com','inflection.ai'];
  function initGenAIDLP() {
    if (config.aiDlp !== true) return;
    const host = hostname();
    if (!AI_CHAT_DOMAINS.some(d => host === d || host.endsWith('.' + d))) return;
    const sensitivePatterns = [
      { regex: /\b(?:\d[ -]*?){13,16}\b/g, label: 'Credit card number' },
      { regex: /\b\d{3}-?\d{2}-?\d{4}\b/g, label: 'Social Security Number (US SSN)' },
      { regex: /\b[A-Z]{2}\d{6}[A-Z\d]?\b/g, label: 'Passport number' },
      { regex: /\b\d{2}[.-]?\d{2}[.-]?\d{4}\b/g, label: 'Date of birth' },
      { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: 'Email address' },
      { regex: /\bsk[_\-]live[_\-][A-Za-z0-9]+\b|\bghp_[A-Za-z0-9]+\b|\bgho_[A-Za-z0-9]+\b|\bghu_[A-Za-z0-9]+\b|\bAKIA[0-9A-Z]{16}\b/g, label: 'API key / secret' },
      { regex: /\b(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{4,}/gi, label: 'Password' },
    ];
    let warned = false;
    function checkInput(text) {
      if (warned || !text || text.length < 8) return;
      for (const p of sensitivePatterns) {
        const matches = text.match(p.regex);
        if (matches && matches.length > 0) {
          warned = true;
          showWarning('GenAI Data Leak Prevention: ' + p.label + ' detected! Sending personal data to AI may compromise your privacy.');
          _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'privacy', count: matches.length });
          return true;
        }
      }
      return false;
    }
    const textInputs = document.querySelectorAll('textarea, input[type="text"], input[type="search"], div[contenteditable="true"]');
    for (const el of textInputs) {
      let debounceTimer;
      el.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { checkInput(this.value || this.textContent || ''); }, 500);
      });
      el.addEventListener('blur', function() {
        clearTimeout(debounceTimer);
        checkInput(this.value || this.textContent || '');
      });
    }
    const origFetch = window.fetch;
    window.fetch = function(url, opts) {
      const urlStr = typeof url === 'string' ? url : (url ? url.url || '' : '');
      if (AI_CHAT_DOMAINS.some(d => urlStr.includes(d)) && opts && opts.body && typeof opts.body === 'string') {
        checkInput(opts.body);
      }
      return origFetch.apply(this, arguments);
    };
  }

  /* ---------- Social Platform Feed Ad Removal (Instagram / Twitter / LinkedIn) ---------- */
  function removeSocialFeedAds() {
    const host = hostname();
    let count = 0;

    /* Instagram sponsored posts */
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      const articles = document.querySelectorAll('article[role="presentation"]');
      for (const art of articles) {
        const spans = art.querySelectorAll('span');
        for (const s of spans) {
          if (s.textContent.trim() === 'Sponsored' || s.textContent.trim() === 'Paid partnership') {
            art.classList.add('ds-hidden');
            count++;
            break;
          }
        }
        if (count > 0) break;
      }
      const promoted = document.querySelectorAll('div[style*="display: flex"][role="presentation"] a[href*="/ads/"]');
      for (const el of promoted) {
        const feedItem = el.closest('article, div[style*="margin-bottom"]');
        if (feedItem) { feedItem.classList.add('ds-hidden'); count++; }
      }
    }

    /* Twitter/X promoted tweets */
    if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.x.com') || host.endsWith('.twitter.com')) {
      const tweets = document.querySelectorAll('article[data-testid="tweet"]');
      for (const t of tweets) {
        const span = t.querySelector('div[data-testid="placementTracking"]');
        if (span) { t.classList.add('ds-hidden'); count++; continue; }
        const labels = t.querySelectorAll('span');
        for (const s of labels) {
          if (s.textContent.trim() === 'Promoted' || s.textContent.trim() === 'Ad') {
            t.classList.add('ds-hidden'); count++; break;
          }
        }
      }
      const sidebarAds = document.querySelectorAll('aside[aria-label="Who to follow"] div[data-testid="UserCell"]');
      for (const el of sidebarAds) {
        const parent = el.closest('section');
        if (parent) { parent.classList.add('ds-hidden'); count++; }
      }
    }

    /* LinkedIn sponsored posts */
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
      const feedItems = document.querySelectorAll('div.feed-shared-update-v2, li.feed-shared-update-v2');
      for (const item of feedItems) {
        const spans = item.querySelectorAll('span');
        for (const s of spans) {
          const txt = s.textContent.trim().toLowerCase();
          if (txt === 'promoted' || txt === 'sponsored' || txt.includes('promoted')) {
            item.classList.add('ds-hidden'); count++; break;
          }
        }
      }
      const sidebarAds2 = document.querySelectorAll('aside div[class*="ad"], aside div[id*="ad"]');
      for (const el of sidebarAds2) { el.classList.add('ds-hidden'); count++; }
    }

    if (count > 0) {
      queueBlockCount(count);
      _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'ads', count: count });
    }
  }

  /* ---------- Twitch Ad Blocking ---------- */
  function blockTwitchAds() {
    const host = hostname();
    if (host !== 'twitch.tv' && !host.endsWith('.twitch.tv')) return;
    const adBanners = document.querySelectorAll(
      'div[class*="ad-overlay"], div[class*="player-ad"], div[class*="ad-unit"], ' +
      'div[data-a-target="video-ad"], div[class*="video-ad"], ' +
      'div[class*="preroll"], div[class*="midroll"], div[class*="ad-container"], ' +
      'div[class*="ad-display"], div[class*="ad-controls"], div[aria-label*="ad"]'
    );
    for (const el of adBanners) { el.classList.add('ds-hidden'); }
    const adIframes = document.querySelectorAll('iframe[src*="ad"], iframe[src*="doubleclick"], iframe[src*="googlesyndication"]');
    for (const f of adIframes) { f.classList.add('ds-hidden'); }
    const player = document.querySelector('video');
    if (player) {
      const adOverlay = player.closest('div[class*="video-player"]');
      if (adOverlay) {
        const overlays = adOverlay.querySelectorAll('div[class*="overlay"], div[class*="ad-overlay"]');
        for (const o of overlays) { o.classList.add('ds-hidden'); }
      }
    }
    const adCount = adBanners.length + adIframes.length;
    if (adCount > 0) {
      queueBlockCount(adCount);
      _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'ads', count: adCount });
    }
  }

  /* ---------- Gmail Ad Blocking ---------- */
  function blockGmailAds() {
    const host = hostname();
    if (host !== 'mail.google.com') return;
    const adLabels = document.querySelectorAll(
      'div[aria-label*="Ad"], div[class*="ads"], div[class*="ad-container"], ' +
      'table[class*="ads"], tr[class*="ad"], td[class*="ad"], ' +
      'div[class*="sponsored"], div[class*="promotion"], div[class*="promo"]'
    );
    for (const el of adLabels) { el.classList.add('ds-hidden'); }
    const sidePromos = document.querySelectorAll('div[class*="promo"], div[id*="promo"], div[class*="offer"], div[id*="offer"]');
    for (const el of sidePromos) { el.classList.add('ds-hidden'); }
    const adCount2 = adLabels.length + sidePromos.length;
    if (adCount2 > 0) {
      queueBlockCount(adCount2);
      _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'ads', count: adCount2 });
    }
  }

  /* ---------- Defacement Detection ---------- */
  function detectDefacement() {
    if (config.defacementDetect !== true) return;
    const host = hostname();
    const knownPages = {
      'google.com': ['/search','/webhp'],
      'facebook.com': ['/','/login'],
      'youtube.com': ['/','/feed'],
      'twitter.com': ['/','/home'],
      'x.com': ['/','/home'],
      'github.com': ['/','/login'],
      'amazon.com': ['/','/gp'],
      'reddit.com': ['/','/r'],
      'wikipedia.org': ['/wiki'],
      'linkedin.com': ['/','/feed'],
      'instagram.com': ['/','/accounts'],
      'whatsapp.com': ['/','/send'],
      'microsoft.com': ['/','/en-us'],
      'apple.com': ['/','/us'],
    };
    const matched = Object.entries(knownPages).find(([d]) => host === d || host.endsWith('.' + d));
    if (!matched) return;
    const titleLower = document.title.toLowerCase();
    const suspiciousTitlePatterns = ['hacked','deface','pwned','owned','cracked','by ','hack','breach','security compromised','cyber attack'];
    for (const pat of suspiciousTitlePatterns) {
      if (titleLower.includes(pat) && !titleLower.includes('prevent') && !titleLower.includes('protect')) {
        _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'malware', count: 1 });
        showWarning('Possible site defacement detected! This page may have been compromised. Title contains: "' + document.title + '"');
        break;
      }
    }
  }

  /* ---------- Phone Scam Detection ---------- */
  function detectPhoneScams() {
    if (config.phoneScamDetect !== true) return;
    const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
    const urlLower = (window.location.href || '').toLowerCase();
    if (/(support|help|kb\.|knowledgebase|docs\.|learn\.|community\.|blog\.|status\.)/i.test(urlLower)) return;
    const metaDesc = document.querySelector('meta[name="description"], meta[property="og:description"]');
    if (metaDesc && /(product support|help center|knowledge base|documentation|tutorial|blog post|technical (support|article))/i.test(metaDesc.getAttribute('content') || '')) return;
    const scamPatterns = [
      'call now','call this number','call immediately','call customer care',
      'call toll free','call 24/7','act now','limited time offer','you have won',
      'congratulations you won','claim your prize','free gift','urgent call',
      'your account will be closed','your computer has a virus','windows support',
      'microsoft certified','apple certified','refund department','processing fee',
      'govt grant','government grant','free government','social security award',
      'irs refund','tax refund','unclaimed property','inheritance',
      'you are the lucky winner','final warning','legal action will be taken',
    ];
    const found = scamPatterns.filter(s => bodyText.includes(s));
    if (found.length > 2) {
      _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'malware', count: 1 });
      showWarning('Potential phone scam detected! This page uses common scam tactics. Do not call any numbers listed.');
    }
  }

  /* ---------- Scareware Detection ---------- */
  function detectScareware() {
    const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
    const scarePatterns = [
      'antivirus is off', 'your antivirus is off', 'antivirus expired', 'renew your subscription',
      'subscription has expired', 'your computer is infected', 'your pc is infected',
      'your system is infected', 'your computer has been blocked', 'your account has been blocked',
      'your account is suspended', 'click to renew', 'renew now', 'activate now',
      'your license has expired', 'your security is at risk', 'your system is at risk',
      'virus detected', 'threats detected', 'security alert', 'critical alert',
    ];
    const found = scarePatterns.filter(s => bodyText.includes(s));
    if (found.length > 1) {
      _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'malware', count: 1 });
      showWarning('Scareware detected! This page is using fake security warnings to trick you. Do not click anything.');
    }
  }

  /* ---------- Streaming Service Ad Blocking (Spotify, Crunchyroll) ---------- */
  function blockStreamingAds() {
    if (config.ads !== true) return;
    const host = hostname();
    let count = 0;
    if (host === 'open.spotify.com' || host.endsWith('.spotify.com')) {
      const spotifyAds = document.querySelectorAll(
        '[data-testid="upsell-card"], [class*="ad"], [class*="Ad"], [id*="ad"], [id*="Ad"], ' +
        '[data-testid="ad-container"], [class*="advertisement"], [class*="ad-container"], ' +
        '[class*="tracklist-ad"], [aria-label*="ad"], [aria-label*="Ad"], ' +
        '[data-testid="banner"], [data-testid*="premium"]'
      );
      for (const el of spotifyAds) {
        if (el.offsetParent !== null) { el.classList.add('ds-hidden'); count++; }
      }
      const adSlots = document.querySelectorAll('div[role="banner"][class*=""], section[class*="ad"]');
      for (const el of adSlots) {
        if (el.offsetParent !== null) { el.classList.add('ds-hidden'); count++; }
      }
    }
    if (host === 'crunchyroll.com' || host.endsWith('.crunchyroll.com')) {
      const crAds = document.querySelectorAll(
        '.ad-container, .advertisement, [class*="-ad-"], [id*="ad-"], ' +
        '[class*="ad-break"], [class*="preroll"], .video-ad, ' +
        '.ad-overlay, .ad-unit, [data-testid*="ad"]'
      );
      for (const el of crAds) {
        if (el.offsetParent !== null) { el.classList.add('ds-hidden'); count++; }
      }
    }
    if (host === 'music.youtube.com' || host.endsWith('.music.youtube.com')) {
      const ytMusicAds = document.querySelectorAll(
        'ytmusic-ad-container, ytmusic-ad, .ad-container, [id*="ad"], [class*="ad"], ' +
        '[aria-label*="ad"], [aria-label*="Ad"]'
      );
      for (const el of ytMusicAds) {
        if (el.offsetParent !== null) { el.classList.add('ds-hidden'); count++; }
      }
    }
    if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) {
      const scAds = document.querySelectorAll(
        '.adContainer, .adUnit, [class*="-ad-"], [id*="ad-"], ' +
        '[class*="advertisement"], [class*="promoted"], [class*="sponsored"]'
      );
      for (const el of scAds) {
        if (el.offsetParent !== null) { el.classList.add('ds-hidden'); count++; }
      }
    }
    if (count > 0) { queueBlockCount(count); removeAdPlaceholders(); }
  }

  /* ---------- Phishing Link Detection ---------- */
  function detectPhishingLinks() {
    if (config.phishingLinkDetect !== true) return;
    /* Skip extension internal pages — they link to legitimate external resources */
    if (window.location.protocol === 'moz-extension:' || window.location.protocol === 'chrome-extension:') return;
    const host = hostname();
    const brandPatterns = [
      { pattern: /go0+gle/i, label: 'Google', safe: ['google.com', 'googleapis.com'] },
      { pattern: /facebo0+k/i, label: 'Facebook', safe: ['facebook.com', 'fbcdn.net'] },
      { pattern: /y0utube|youtu[e3]e/i, label: 'YouTube', safe: ['youtube.com', 'ytimg.com'] },
      { pattern: /ama[sz]on/i, label: 'Amazon', safe: ['amazon.com', 'amazonaws.com', 'amazonservices.com'] },
      { pattern: /micr0s0ft|micr0$0ft|micr0soft/i, label: 'Microsoft', safe: ['microsoft.com', 'live.com', 'microsoftonline.com'] },
      { pattern: /app[e3]e\b/i, label: 'Apple', safe: ['apple.com'] },
      { pattern: /paypa[l1]/i, label: 'PayPal', safe: ['paypal.com', 'paypal.me', 'paypalobjects.com'] },
      { pattern: /instagra[mrn]/i, label: 'Instagram', safe: ['instagram.com', 'cdninstagram.com'] },
      { pattern: /twi[t+]e?r|twltter|twiiter/i, label: 'Twitter/X', safe: ['twitter.com', 'twimg.com', 'x.com'] },
      { pattern: /netfli[xk]/i, label: 'Netflix', safe: ['netflix.com', 'nflximg.net'] },
      { pattern: /whatsappp/i, label: 'WhatsApp', safe: ['whatsapp.com'] },
      { pattern: /telegra[mrn]/i, label: 'Telegram', safe: ['telegram.org', 't.me'] },
      { pattern: /githu[b6]/i, label: 'GitHub', safe: ['github.com', 'githubusercontent.com'] },
      { pattern: /linke[d9]in|linked1n/i, label: 'LinkedIn', safe: ['linkedin.com', 'licdn.com'] },
    ];
    const phishingKeywords = ['login', 'signin', 'verify', 'secure', 'account', 'update', 'confirm', 'banking', 'password', 'credential'];
    const urlShorteners = ['bit.ly', 'tinyurl.com', 'tiny.cc', 't.co', 'goo.gl', 'shorturl.at', 'ow.ly', 'is.gd', 'buff.ly', 'cli.gs', 'rb.gy', 'bl.ink', 'short.link', 'cutt.ly'];
    const suspiciousLinks = [];
    const links = document.querySelectorAll('a[href]');
    for (const link of links) {
      try {
        const href = link.href;
        if (!href || href.startsWith('javascript') || href.startsWith('#') || href.startsWith('mailto:')) continue;
        const parsed = new URL(href);
        const hreflink = parsed.hostname.replace(/^www\./, '');
        if (hreflink === host) continue;
        let reasons = [];
        if (urlShorteners.some(s => hreflink.includes(s))) reasons.push('URL shortener (' + hreflink + ')');
        const ipMatch = parsed.hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
        if (ipMatch && phishingKeywords.some(k => (link.textContent || '').toLowerCase().includes(k) || parsed.pathname.toLowerCase().includes(k))) {
          reasons.push('IP-based URL with phishing keywords');
        }
        for (const bp of brandPatterns) {
          if (bp.pattern.test(parsed.hostname) && !parsed.hostname.includes(host)) {
            if (bp.safe && bp.safe.some(function(d) { return parsed.hostname === d || parsed.hostname.endsWith('.' + d); })) continue;
            reasons.push('Brand impersonation: ' + bp.label + ' (' + parsed.hostname + ')');
          }
        }
        const subdomainCount = (parsed.hostname.match(/\./g) || []).length;
        if (subdomainCount > 3 && phishingKeywords.some(k => parsed.pathname.toLowerCase().includes(k))) {
          reasons.push('Excessive subdomains with phishing pattern');
        }
        if (reasons.length > 0) {
          suspiciousLinks.push({ el: link, reasons: reasons });
          link.style.setProperty('color', '#dc3545', 'important');
          if (!link.dataset.dsPhishWarned) {
            link.dataset.dsPhishWarned = 'true';
            link.dataset.dsPhishReasons = reasons.join('; ');
            const origClick = link.onclick;
            link.addEventListener('click', async function(e) {
              if (config.phishingLinkDetect !== true) return;
              e.preventDefault();
              e.stopPropagation();
              queueBlockCount(1);
              const href = this.href;
              const confirmed = await showConfirmModal(
                'DurgaShield detected a possible phishing link.\n' +
                this.dataset.dsPhishReasons + '\n\nURL: ' + href + '\n\nOpen anyway?'
              );
              if (confirmed) { window.location.href = href; }
            });
          }
        }
      } catch (e) {}
    }
    if (suspiciousLinks.length > 0) {
      _b.runtime.sendMessage({ type: MSG.INCREMENT_BLOCKED, category: 'phishing', count: suspiciousLinks.length });
    }
  }

  /* ---------- Facebook/Instagram Privacy Controls ---------- */
  function applyFBPrivacy() {
    if (config.fbPrivacy !== true) return;
    const host = hostname();
    if (!host.includes('facebook.com') && !host.includes('messenger.com') && !host.includes('instagram.com')) return;
    if (host.includes('facebook.com') || host.includes('messenger.com')) {
      const seenIndicators = document.querySelectorAll('[aria-label*="Seen"], [aria-label*="seen"], [data-testid*="typing"], [class*="typing"], [data-testid*="seen"]');
      for (const el of seenIndicators) { el.style.setProperty('display', 'none', 'important'); }
      const readTicks = document.querySelectorAll('[data-visualcompletion="ignore"] svg circle:last-child, [data-visualcompletion="ignore"] svg image[href*="read"]');
      for (const el of readTicks) { el.classList.add('ds-opacity-zero'); }
      const activeStatus = document.querySelectorAll('[aria-label*="Active"], [aria-label*="active now"]');
      for (const el of activeStatus) { el.classList.add('ds-hidden'); }
    }
    if (host.includes('instagram.com')) {
      const seenIndicators = document.querySelectorAll('[aria-label*="Seen"], [aria-label*="seen"], [class*="seen"]');
      for (const el of seenIndicators) { el.classList.add('ds-hidden'); }
      const typingIndicators = document.querySelectorAll('[class*="typing"], [class*="typing-indicator"], [data-testid*="typing"]');
      for (const el of typingIndicators) { el.classList.add('ds-hidden'); }
      const activityStatus = document.querySelectorAll('[aria-label*="Active"], [aria-label*="active now"], [class*="active-status"]');
      for (const el of activityStatus) { el.classList.add('ds-hidden'); }
    }
  }

})();
