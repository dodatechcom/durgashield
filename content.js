(function() {
  if (window._durgashield_loaded) return;
  window._durgashield_loaded = true;

  const config = { ads: true, malware: true, crypto: true, phishing: true, popupBlocking: true, containerIsolation: true, searchAnnotations: true, metadataCleanup: false, videoRedirect: false, stealth: false, enhancedTracking: false, xssProtection: false, clearClick: false, aiDlp: false, defacementDetect: false, phoneScamDetect: false };
  let zapperActive = false;
  let jsBlocked = false;

  /* Amazon domains: bail from init() early to avoid CSP & API interference on payment flows */
  const _isAmazonPayment = window.location.hostname.includes('amazon.') || window.location.hostname.includes('amazon.dev') || window.location.hostname.includes('siege-amazon.com');

  /* Pre-emptive CSS: hide known ad elements before first paint */
  try {
    var hideStyle = document.createElement('style');
    hideStyle.id = 'dgs-instant-hide';
    hideStyle.textContent = 'ins.adsbygoogle,amp-ad,google-ad,.ad-panel,iframe[src*="doubleclick.net"],iframe[src*="googlesyndication.com"],.adsbygoogle[data-ad-status="unfilled"]{display:none!important}';
    document.documentElement.appendChild(hideStyle);
  } catch (_e) {}

  /* ---------- uBlock-style Scriptlets (anti-adblock bypass) ---------- */
  const scriptlets = {};

  scriptlets['abort-on-property-read'] = function(propName) {
    const nativeProp = propName;
    try {
      const parts = propName.split('.');
      let obj = window;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) return;
        obj = obj[parts[i]];
      }
      const last = parts[parts.length - 1];
      Object.defineProperty(obj, last, {
        get: function() { throw new Error('DurgaShield: aborted ' + nativeProp); },
        set: function() {},
        configurable: true
      });
    } catch (e) {}
  };

  scriptlets['set-constant'] = function(propPath, value) {
    try {
      const parts = propPath.split('.');
      let obj = window;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      Object.defineProperty(obj, parts[parts.length - 1], {
        get: function() { return value; },
        set: function() {},
        configurable: false
      });
    } catch (e) {}
  };

  scriptlets['nano-setInterval-booster'] = function(multiplier) {
    const m = parseFloat(multiplier) || 0.01;
    const orig = window.setInterval;
    window.setInterval = function(fn, delay) {
      return orig.call(window, fn, Math.max(1, Math.floor(delay * m)));
    };
  };

  scriptlets['addEventListener-defuser'] = function(type) {
    const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(eventType, fn, opts) {
      if (eventType && eventType.toString() === type) return;
      return orig.call(this, eventType, fn, opts);
    };
  };

  scriptlets['prevent-xhr'] = function(urlPattern) {
    const orig = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (url && url.toString().includes(urlPattern)) {
        return;
      }
      return orig.apply(this, arguments);
    };
  };

  scriptlets['prevent-fetch'] = function(urlPattern) {
    const orig = window.fetch;
    window.fetch = function(url, options) {
      const urlStr = typeof url === 'string' ? url : (url ? url.url || url.toString() : '');
      if (urlStr.includes(urlPattern)) {
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return orig.apply(this, arguments);
    };
  };

  scriptlets['json-prune'] = function(propPath) {
    const origParse = JSON.parse;
    JSON.parse = function(text, reviver) {
      const result = origParse.call(this, text, reviver);
      if (result && typeof result === 'object') {
        pruneProp(result, propPath);
      }
      return result;
    };
    function pruneProp(obj, path) {
      if (!obj || !path) return;
      const parts = path.split('.');
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined) return;
        if (Array.isArray(current)) {
          for (const item of current) pruneProp(item, path);
          return;
        }
        current = current[parts[i]];
      }
      delete current[parts[parts.length - 1]];
    }
  };

  scriptlets['abort-current-inline-script'] = function(pattern) {
    if (!pattern) return;
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function(tag, options) {
      const el = origCreateElement(tag, options);
      if (tag && tag.toLowerCase() === 'script') {
        const origSetAttribute = el.setAttribute.bind(el);
        el.setAttribute = function(name, value) {
          if (name === 'src') return;
          return origSetAttribute(name, value);
        };
        Object.defineProperty(el, 'src', { set: function(v) {} });
        Object.defineProperty(el, 'text', {
          get: function() { return ''; },
          set: function(v) {
            if (typeof v === 'string' && v.includes(pattern)) return;
            try { el.appendChild(document.createTextNode(v)); } catch (e) {}
          },
          configurable: true
        });
        Object.defineProperty(el, 'textContent', {
          get: function() { return ''; },
          set: function(v) {
            if (typeof v === 'string' && v.includes(pattern)) return;
            try { el.appendChild(document.createTextNode(v)); } catch (e) {}
          },
          configurable: true
        });
      }
      return el;
    };
    const origWrite = document.write.bind(document);
    document.write = function(html) {
      if (typeof html === 'string' && html.includes(pattern)) return;
      return origWrite(html);
    };
  };

  scriptlets['remove-attr'] = function(selector, attr) {
    if (!selector || !attr) return;
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
        try { scriptlets[name].apply(null, args); } catch (e) {}
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
      try {
        if (window[ns]) {
          Object.defineProperty(window[ns], prop, {
            get: function() { return false; },
            set: function() {},
            configurable: false
          });
        }
        scriptlets['set-constant'](ns + '.' + prop, false);
      } catch (e) {}
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
  function isFacebookOrigin() { const h = window.location.hostname.toLowerCase(); return h.endsWith('facebook.com') || h.endsWith('fb.com') || h.endsWith('facebook.net') || h.endsWith('fbcdn.net'); }
  function isIsolatedPage() { const h = hostname(); return ISOLATED_DOMAINS.some(d => { const c = d.replace(/^www\./, ''); return h === c || h.endsWith('.' + c); }); }
  function isCryptoSite() { const h = hostname(); return h === 'coinmarketcap.com' || h.endsWith('.coinmarketcap.com') || h === 'bitget.com' || h.endsWith('.bitget.com') || h === 'coingecko.com' || h.endsWith('.coingecko.com'); }

  // Inject hide-rule style tag immediately (before any async callback)
  try {
    var _st = document.createElement('style');
    _st.id = 'dgs-hide-css';
    (document.head || document.documentElement).appendChild(_st);
  } catch (_e) {}

  chrome.storage.local.get(['durgashield_config', 'durgashield_hide_rules'], (result) => {
    const saved = result.durgashield_config;
    if (saved) Object.assign(config, saved);
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

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'configUpdated') {
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
    if (msg.type === 'activateZapper' || msg.action === 'START_ELEMENT_PICKER') {
      activateZapper();
    }
    if (msg.type === 'setJsBlocked') {
      jsBlocked = msg.blocked;
      if (jsBlocked) {
        document.querySelectorAll('script[src]').forEach(s => {
          if (s.src && !s.src.startsWith('moz-extension') && !s.src.startsWith('chrome-extension')) s.remove();
        });
      }
    }
    if (msg.type === 'stealthUpdated') {
      Object.assign(stealthConfig, msg.config || {});
      applyStealth();
    }
    if (msg.type === 'cosmeticFilters' || msg.type === 'applyCosmetics') {
      applyCosmeticFilters(msg.cosmetics);
    }
  });

  function init() {
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
      if (!isGoogle) initPrivacyFeatures();
      initGenAIDLP();
      detectDefacement();
      detectPhoneScams();
    } else {
      if (config.popupBlocking && !_isAmazonPayment) overrideWindowOpen();
      if (config.ads && !isYouTube() && !_isAmazonPayment) removeAdElements();
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

  function generateSelector(el) {
    const target = findContainer(el);
    if (target.id && isValidId(target.id)) return '#' + CSS.escape(target.id);
    const attrSel = getAttrSelector(target);
    if (attrSel) return attrSel;
    const classSel = getStableClassSelector(target);
    if (classSel) return classSel;
    let path = [];
    let current = target;
    while (current && current !== document.body && current !== document.documentElement && path.length < 4) {
      let selector = current.tagName.toLowerCase();
      if (current.id && isValidId(current.id)) {
        path.unshift('#' + CSS.escape(current.id));
        break;
      }
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c.length > 0 && !/\d/.test(c) && c !== 'active' && c !== 'hover').slice(0, 2);
        if (classes.length > 0) selector += '.' + classes.map(c => CSS.escape(c)).join('.');
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ').replace(/:nth-child\(\d+\)/g, '');
  }

  function isSafeSelector(selector) {
    try { return document.querySelectorAll(selector).length < 10; } catch (e) { return false; }
  }

  function activateZapper() {
    if (zapperActive) return;
    zapperActive = true;

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
      if (hovered) { hovered.classList.remove('durgashield-zapper-hover'); hovered = null; }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el !== document.body && el !== document.documentElement) {
        hovered = el;
        hovered.classList.add('durgashield-zapper-hover');
      }
    }

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!hovered) return;
      const el = hovered;
      zapperActive = false;
      document.documentElement.classList.remove('durgashield-zapper-mode');
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
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
        cleanup();
      };
      document.getElementById('dgs-cancel-block').onclick = function() {
        if (previewStyle) previewStyle.remove();
        box.remove();
        cleanup();
      };
    }

    function commitBlock(selector) {
      document.querySelectorAll(selector).forEach(el => el.remove());
      chrome.runtime.sendMessage({ type: 'addHideRule', url: window.location.href, selector });
      chrome.runtime.sendMessage({ type: 'blockCount', count: 1 });
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') cleanup();
    }

    function cleanup() {
      zapperActive = false;
      document.documentElement.classList.remove('durgashield-zapper-mode');
      const s = document.getElementById('durgashield-zapper-style');
      if (s) s.remove();
      const p = document.getElementById('durgashield-preview-style');
      if (p) p.remove();
      const b = document.getElementById('durgashield-zapper-confirm');
      if (b) b.remove();
      if (hovered) { hovered.classList.remove('durgashield-zapper-hover'); hovered = null; }
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown);
    }

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown);
  }

  function applyCosmeticFilters(cosmetics) {
    if (!cosmetics || !cosmetics.length) return;
    const host = hostname();
    const cosmeticSkipHosts = ['keep.google.com', 'mail.google.com', 'docs.google.com', 'sheets.google.com', 'slides.google.com', 'calendar.google.com'];
    if (cosmeticSkipHosts.some(h => host.includes(h))) return;
    const hostParts = host.split('.');
    const styleId = 'durgashield-cosmetic-style';
    let old = document.getElementById(styleId);
    if (old) old.remove();
    const selectors = [];
    for (const c of cosmetics) {
      if (!c.domain) { selectors.push(c.selector); continue; }
      const domains = c.domain.split(',').map(d => d.trim()).filter(Boolean);
      const match = domains.some(d => {
        if (d === '*' || d === host) return true;
        return hostParts.some((_, i) => d === hostParts.slice(i).join('.'));
      });
      if (match) selectors.push(c.selector);
    }
    if (!selectors.length) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = selectors.map(s => s + ' { display: none !important; }').join('\n');
    document.head.appendChild(style);
  }

  function loadCosmeticFilters() {
    chrome.storage.local.get('durgashield_cosmetic_filters', (r) => {
      if (r.durgashield_cosmetic_filters) applyCosmeticFilters(r.durgashield_cosmetic_filters);
    });
  }

  function applyCustomHideRules() {
    chrome.storage.local.get('durgashield_selector_hits', (r) => {
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
      if (changed) chrome.storage.local.set({ durgashield_selector_hits: hits });
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
    document.documentElement.style.marginTop = '32px';
    document.body.prepend(bar);
  }

  function blockFacebookEmbeds() {
    const now = Date.now();
    if (blockFacebookEmbeds._lastRun && now - blockFacebookEmbeds._lastRun < 3000) return;
    blockFacebookEmbeds._lastRun = now;
    const fbPatterns = ['facebook.com', 'www.facebook.com', 'fb.com', 'facebook.net', 'connect.facebook.net', 'fbcdn.net', 'fbcdn.com'];
    function isFbUrl(url) {
      if (!url) return false;
      try { return fbPatterns.some(p => new URL(url).hostname.includes(p)); } catch { return url.includes('facebook.com') || url.includes('fbcdn'); }
    }
    let fbCount = 0;
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) { if (isFbUrl(iframe.src)) { iframe.remove(); fbCount++; } }
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) { if (isFbUrl(script.src)) { script.remove(); fbCount++; } }
    const imgs = document.querySelectorAll('img[src*="facebook"], img[src*="fbcdn"]');
    for (const img of imgs) { img.remove(); fbCount++; }
    const fbRoot = document.getElementById('fb-root');
    if (fbRoot) fbRoot.remove();
    let child = document.querySelector('div[data-facebook], iframe[title*="fb"], iframe[title*="Facebook"]');
    while (child) { child.remove(); child = document.querySelector('div[data-facebook], iframe[title*="fb"], iframe[title*="Facebook"]'); }
    Object.defineProperty(document, 'fbAsyncInit', { set: () => {}, get: () => undefined });
    if (fbCount > 0) queueBlockCount(fbCount);
  }

  function applyExistingFeatures() {
    if (_isAmazonPayment) return;
    if (config.popupBlocking) overrideWindowOpen();
    if (config.videoRedirect === true) preventVideoRedirect();
    if (config.ads) { if (isYouTube()) blockYouTubeAds(); else if (!isCryptoSite()) removeAdElements(); }
    if (config.ads) removeAdPlaceholders();
    if (config.crypto && !isCryptoSite()) { detectCryptoMining(); detectCryptoScams(); }
    if (config.phishing) { detectFakeLoginForms(); detectFakeAddressBar(); detectHttpPasswordFields(); }
    if (config.malware) { detectKeyloggers(); detectTechSupportScams(); }
    if (config.enhancedTracking !== false) preventClipboardHijack();
    if (config.ads && window.location.hostname.includes('facebook.com')) removeFacebookAds();
    if (config.ads && !isCryptoSite()) dismissInterstitials();
    if (config.metadataCleanup) setupMetadataCleanup();
    if (config.ads) { blockTwitchAds(); blockGmailAds(); removeSocialFeedAds(); }
  }

  let videoRedirectActive = false;
  function preventVideoRedirect() {
    if (videoRedirectActive) return;
    videoRedirectActive = true;

    function isVideoPlayer(el) {
      if (el.closest('video, [class*="video"], [class*="player"], [class*="vjs-"], [id*="video"], [id*="player"], [class*="jwplayer"], [class*="mejs"]')) return true;
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        if (p.querySelector('video')) return true;
      }
      return false;
    }

    document.addEventListener('click', function(e) {
      if (!isVideoPlayer(e.target)) return;
      for (let el = e.target; el && el !== document.body; el = el.parentElement) {
        if (el.tagName === 'A' && el.href && !el.href.startsWith('javascript') && !el.href.startsWith('#') && el.href !== window.location.href && el.href !== document.baseURI) {
          e.preventDefault();
          e.stopPropagation();
          queueBlockCount(1);
          return;
        }
      }
    }, true);
  }
  let windowOpenOverridden = false;
  const originalOpen = window.open;
  function overrideWindowOpen() {
    if (windowOpenOverridden) return;
    windowOpenOverridden = true;
    const host = window.location.hostname;
    if (host.includes('amazon.') || host.includes('payments.')) return;
    window.open = function() {
      const url = arguments[0];
      if (!url) return null;
      try {
        const parsed = new URL(url, window.location.href);
        const hostname = parsed.hostname.toLowerCase();
        if (['ad', 'ads', 'banner', 'popup', 'pop-up', 'popunder', 'sponsor', 'promo', 'offer', 'win', 'prize', 'gift', 'click', 'track', 'tracking', 'affiliate', 'redirect'].some(k => hostname.includes(k))) { queueBlockCount(1); return null; }
        if ([/\/ads?\//i, /\/(ads[-_.\/]|banner[-_.\/]|popup[-_.\/]|track[-_.\/])/i, /\/click?\//i, /\/(redirect|offer)[-_.\/]/i].some(p => p.test(parsed.pathname) || p.test(parsed.search))) { queueBlockCount(1); return null; }
      } catch (e) {}
      try { return originalOpen.apply(window, arguments); } catch (e) { return null; }
    };
  }

  let blockReportTimer = null;
  let pendingBlockCount = 0;
  function flushBlockCount() {
    if (pendingBlockCount > 0) {
      chrome.runtime.sendMessage({ type: 'blockCount', count: pendingBlockCount });
      chrome.runtime.sendMessage({ type: 'recordSiteBlock', count: pendingBlockCount });
      pendingBlockCount = 0;
    }
    blockReportTimer = null;
  }
  function queueBlockCount(n) {
    pendingBlockCount += n;
    if (!blockReportTimer) blockReportTimer = setTimeout(flushBlockCount, 2000);
  }

  function removeAdElements() {
    const selectors = ['ins.adsbygoogle', 'amp-ad', 'google-ad', '.ad-panel', 'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]'];
    let count = 0;
    const elements = document.querySelectorAll(selectors.join(','));
    for (const el of elements) { el.style.setProperty('display', 'none', 'important'); count++; }
    if (count > 0) { queueBlockCount(count); removeAdPlaceholders(); }
    bypassAntiAdblock();
  }

  function isSafeElement(el) {
    const role = el.getAttribute('role');
    if (role === 'checkbox' || role === 'button' || role === 'textbox' || role === 'switch' || role === 'radio') return true;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.tagName === 'BUTTON') return true;
    return false;
  }

  function removeAdPlaceholders() {
    const skipHosts = ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'mail.yahoo.com', 'keep.google.com', 'coinmarketcap.com', 'bitget.com', 'coingecko.com', 'tvsmotor.com'];
    const host = window.location.hostname;
    if (skipHosts.some(h => host.includes(h))) return;
    if (host.endsWith('.google.com') || host === 'google.com') return;
    const now = Date.now();
    if (removeAdPlaceholders._lastRun && now - removeAdPlaceholders._lastRun < 2000) return;
    removeAdPlaceholders._lastRun = now;
    const adContainerPatterns = [
      'div[class*="ad"]', 'div[id*="ad"]',
      'ins[class*="ad"]',
      'section[class*="ad"]', 'section[id*="ad"]',
    ];
    const adKeyword = /(^|[\s_-])(a[dds][-\s_]|advert|sponsor|banner|promo)/i;
    for (const pat of adContainerPatterns) {
      const els = document.querySelectorAll(pat);
      for (const el of els) {
        if (el.offsetParent === null) continue;
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'CANVAS' || el.tagName === 'SVG') continue;
        if (isSafeElement(el)) continue;
        if (el.querySelector('input, textarea, [role="checkbox"], [role="button"], [role="textbox"], [role="switch"], [role="radio"]')) continue;
        const cls = (el.className || '') + ' ' + (el.id || '');
        if (!adKeyword.test(cls)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 30) continue;
        const text = (el.textContent || '').trim();
        if (text.length >= 50) continue;
        const imgs = el.querySelectorAll('img');
        const hasBigImage = Array.from(imgs).some(img => img.naturalWidth > 50 || img.offsetWidth > 50);
        const iframes = el.querySelectorAll('iframe');
        const hasFilledIframe = Array.from(iframes).some(f => f.offsetWidth > 50 && f.offsetHeight > 50);
        const canvases = el.querySelectorAll('canvas');
        const hasCanvas = Array.from(canvases).some(c => c.offsetWidth > 50 && c.offsetHeight > 50);
        const svgs = el.querySelectorAll('svg');
        const hasSvg = Array.from(svgs).some(s => s.offsetWidth > 50 && s.offsetHeight > 50);
        if (!hasBigImage && !hasFilledIframe && !hasCanvas && !hasSvg) {
          collapseElement(el);
        }
      }
    }
  }

  function collapseElement(el) {
    el.style.setProperty('display', 'none', 'important');
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
    for (const sel of antiAdblockSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetParent === null) continue;
        const text = (el.textContent || '').toLowerCase();
        if (text.includes('disable') || text.includes('adblock') || text.includes('whitelist') ||
            text.includes('ad blocker') || text.includes('turn off') || text.includes('please')) {
          el.style.setProperty('display', 'none', 'important');
          queueBlockCount(1);
        }
      }
    }
    const body = document.body;
    if (body) {
      if (body.style.overflow === 'hidden') body.style.overflow = '';
      if (body.style.position === 'fixed') body.style.position = '';
    }
    const html = document.documentElement;
    if (html) {
      if (html.style.overflow === 'hidden') html.style.overflow = '';
    }
    const locks = document.querySelectorAll('[style*="overflow: hidden"], [style*="overflow:hidden"]');
    for (const el of locks) {
      if (el === body || el === html) continue;
      if (el.offsetParent === null) continue;
      const text = (el.textContent || '').toLowerCase();
      if (text.includes('adblock') || text.includes('disable') || text.includes('whitelist')) {
        el.style.overflow = '';
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
      for (const p of patterns) { if (src.includes(p) || text.includes(p)) { script.remove(); queueBlockCount(1); chrome.runtime.sendMessage({ type: 'malwareDetected' }); return true; } }
    }
    return false;
  }

  function detectFakeLoginForms() {
    const forms = document.querySelectorAll('form');
    const currentHost = window.location.hostname;
    for (const form of forms) {
      const action = (form.action || '').toLowerCase();
      if (action && !action.includes(currentHost)) {
        const pw = form.querySelectorAll('input[type="password"]');
        if (pw.length > 0) {
          const w = document.createElement('div');
          w.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#dc3545;color:white;padding:12px 20px;font-family:Arial,sans-serif;font-size:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3)';
          w.textContent = 'DurgaShield Warning: This form submits to a different domain. Login credentials could be stolen!';
          document.body.prepend(w);
          setTimeout(() => w.remove(), 10000);
          chrome.runtime.sendMessage({ type: 'malwareDetected' });
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
    let count = 0;
    for (const sel of adSelectors) { const els = document.querySelectorAll(sel); for (const el of els) { el.remove(); count++; } }
    const overlayAds = document.querySelectorAll('.ytp-ad-module, .ytp-ad-player-overlay, .ytp-ad-text-overlay, .ytp-ad-image-overlay');
    for (const ad of overlayAds) { if (ad.offsetParent !== null) { ad.remove(); count++; } }
    if (count > 0) { queueBlockCount(count); removeAdPlaceholders(); }
    cleanYouTubeAnnoyances();
  }

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
      const els = document.querySelectorAll(sel);
      for (const el of els) { el.remove(); }
    }
  }

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
    let timer = null;
    const observer = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        if (isGoogle || isAmazon) return;
        if (config.ads && !isYouTube() && !isCryptoSite()) { removeAdElements(); bypassAntiAdblock(); }
        if (config.ads && !isYouTube() && !isSubFrame) removeAdPlaceholders();
        if (config.ads) { blockTwitchAds(); blockGmailAds(); removeSocialFeedAds(); }
        if (config.crypto && !isCryptoSite() && !isSubFrame) detectCryptoMining();
        if (config.containerIsolation && !isFacebookOrigin()) blockFacebookEmbeds();
        if (config.neverConsent !== false && !isSubFrame) handleCookieConsent();
        if (config.enhancedTracking === true && !isSubFrame) removeTrackingStorage();
        if (config.xssProtection === true) { monitorXssMutations(); }
        if (config.clearClick === true && !isCryptoSite() && !isSubFrame) { scanSuspiciousOverlays(); }
        if (config.abe !== false) { checkLocalNetworkContent(); }
        if (window.location.protocol === 'https:' && !isSubFrame) detectMixedContent();
      }, 100);
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
    chrome.storage.local.get('durgashield_youtube_whitelist', function(r) {
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
          chrome.runtime.sendMessage({ type:'removeYouTubeWhitelist', channelId: ytChannelId });
          banner.remove();
          ytWhitelisted = false;
        };
      }
    });
  }

  function startYouTubeAdSkip() {
    setInterval(function() {
      if (!config.ads || !isYouTube() || ytWhitelisted) return;
      blockYouTubeAds();
      skipVideoAd();
      skipEndScreenCards();
    }, 800);
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
      chrome.runtime.sendMessage({ type: 'reportThirdParties', domains: Array.from(thirdParties) });
    }
  }

  function initPrivacyFeatures() {
    if (_isAmazonPayment) return;
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
    audioFingerprintProtection();
    webglFingerprintProtection();
    domRectProtection();
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
    const obs = new MutationObserver(() => hideAnnoyanceElements());
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  function hideAnnoyanceElements() {
    if (document.hidden) return;
    for (const sel of ANNOYANCE_SELECTORS) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetParent !== null && !el.dataset._sfAnnoyance) {
          el.dataset._sfAnnoyance = '1';
          el.style.display = 'none';
          el.style.visibility = 'hidden';
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
    chrome.storage.local.get('durgashield_stealth', (r) => {
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
    if (window.RTCPeerConnection) {
      const orig = window.RTCPeerConnection;
      window.RTCPeerConnection = function() { return { close: function() {}, createDataChannel: function() { return {}; }, createOffer: function() { return { then: function() {} }; }, setLocalDescription: function() {} }; };
      window.RTCPeerConnection.prototype = orig.prototype;
    }
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
    'Only allow required', 'Required only'
  ];

  const ACCEPT_BUTTON_PATTERNS = [
    'Accept all', 'Accept All', 'Accept', 'accept',
    'Allow all', 'Allow All', 'Allow', 'allow',
    'OK', 'Okay', 'okay',
    'Got it', 'Got It', 'I understand',
    'Agree', 'Agree all', 'Agree All',
    'Continue', 'Continue to site',
    'Close', 'close',
    '\u2713', '\u2714'
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
    hideBanner(banner);
    return false;
  }

  function hideBanner(banner) {
    banner.style.display = 'none';
    banner.style.visibility = 'hidden';
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
    try {
      Object.defineProperty(navigator, 'languages', { get: () => [randomLang, 'en'], configurable: false });
    } catch (e) {}
    try {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => Math.max(2, Math.floor(Math.random() * 4) + 2), configurable: false });
    } catch (e) {}
    const ua = navigator.userAgent;
    const spoofedUa = ua.replace(/(Windows NT 10\.0|Mac OS X 10_\d+)/, 'Windows NT 10.0').replace(/Win64; x64;?/, 'Win64; x64');
    try {
      Object.defineProperty(navigator, 'userAgent', { get: () => spoofedUa, configurable: false });
    } catch (e) {}
    try {
      Object.defineProperty(navigator, 'deviceMemory', { get: () => Math.floor(Math.random() * 4) * 2 + 2, configurable: false });
    } catch (e) {}
    try {
      navigator.mediaDevices && navigator.mediaDevices.enumerateDevices && (navigator.mediaDevices.enumerateDevices = function() {
        return Promise.resolve([{ kind: 'audioinput', deviceId: '', groupId: '', label: '' }]);
      });
    } catch (e) {}
  }

  function spoofScreenProperties() {
    const dither = () => Math.floor(Math.random() * 3 - 1);
    try {
      Object.defineProperty(screen, 'width', { get: () => window.screen.width + dither(), configurable: false });
    } catch (e) {}
    try {
      Object.defineProperty(screen, 'height', { get: () => window.screen.height + dither(), configurable: false });
    } catch (e) {}
    try {
      Object.defineProperty(screen, 'colorDepth', { get: () => (Math.random() > 0.5 ? 24 : 32), configurable: false });
    } catch (e) {}
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
      'sess', 'sessionid', 'session_id',
      'csrftoken', 'csrf',
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
    if (xssInitialized) return;
    if (config.xssProtection !== true) return;
    xssInitialized = true;
    injectCspMeta();
    sanitizeUrlXss();
    monitorXssMutations();
    interceptFormXss();
  }

  function injectCspMeta() {
    if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) return;
    const csp = document.createElement('meta');
    csp.httpEquiv = 'Content-Security-Policy';
    csp.content = "default-src 'self' 'unsafe-inline' 'unsafe-eval' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; object-src 'none'; frame-src 'self' https:;";
    document.head.appendChild(csp);
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

  function sanitizeUrlXss() {
    try {
      const params = new URLSearchParams(window.location.search);
      let foundXss = false;
      for (const [key, val] of params) {
        if (XSS_PATTERNS.some(p => p.test(val))) {
          foundXss = true;
          if (confirm('DurgaShield blocked a potential XSS attack in the URL parameter "' + key + '".\n\nValue: ' + val.substring(0, 100) + '\n\nReload the page without this parameter?')) {
            params.delete(key);
            const newUrl = window.location.origin + window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
            window.location.replace(newUrl);
            return;
          }
        }
      }
    } catch (e) {}
  }

  function monitorXssMutations() {
    const xssObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            if (node.tagName === 'SCRIPT') {
              const src = node.src || '';
              const text = node.textContent || '';
              // Skip legitimate scripts that trigger false positives
              const falsePositivePatterns = ['recaptcha', 'google-analytics', 'googletagmanager', 'facebook.net', 'connect.facebook.net', 'hotjar.com', 'doubleclick.net', 'googlesyndication'];
              if (src && falsePositivePatterns.some(p => src.includes(p))) continue;
              if (XSS_PATTERNS.some(p => p.test(src) || p.test(text))) {
                node.remove();
                queueBlockCount(1);
                chrome.runtime.sendMessage({ type: 'xssDetected', data: src || text.substring(0, 200) });
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
    xssObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function interceptFormXss() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.tagName !== 'FORM') return;
      let foundXss = false;
      const inputs = form.querySelectorAll('input[type="text"], input[type="search"], input[type="url"], input[type="email"], textarea');
      for (const input of inputs) {
        const val = input.value || '';
        if (XSS_PATTERNS.some(p => p.test(val))) {
          foundXss = true;
          input.style.border = '2px solid red';
          input.title = 'DurgaShield: Removed suspicious content';
          input.value = val.replace(/<[^>]*>/g, '').replace(/javascript\s*:/gi, '').replace(/on\w+\s*=/gi, '');
        }
      }
      if (foundXss) {
        queueBlockCount(1);
        chrome.runtime.sendMessage({ type: 'xssDetected', data: 'form submission' });
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

  function scanSuspiciousOverlays() {
    const all = document.querySelectorAll('*');
    for (const el of all) {
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
    const rect = el.getBoundingClientRect();
    if (rect.width < 5 || rect.height < 5) return false;
    const opacity = parseFloat(style.opacity);
    if (opacity > 0.5) return false;
    if (rect.width < window.innerWidth * 0.5 || rect.height < window.innerHeight * 0.5) return false;
    if (style.position !== 'fixed' && style.position !== 'absolute') return false;
    if (style.zIndex < 999) return false;
    const bg = style.backgroundColor;
    if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return true;
    return opacity < 0.3;
  }

  function clearClickHandler(e) {
    const target = e.target;
    let overlay = target;
    while (overlay && overlay !== document.body) {
      if (clearClickOverlays.has(overlay)) {
        e.preventDefault();
        e.stopPropagation();
        var tagInfo = (overlay.tagName || '') + (overlay.id ? '#' + overlay.id : '');
        var confirmed = confirm('DurgaShield ClearClick: This click was intercepted by a transparent overlay.\n\nThis could be a clickjacking attempt. Allow the click anyway?\n\nElement: ' + tagInfo + '\n\n- Click OK to allow the click through.\n- Click Cancel to dismiss this warning (overlay stays blocked).');
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
            chrome.runtime.sendMessage({ type: 'abeBlocked', data: url.hostname });
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
  function audioFingerprintProtection() {
    if (config.stealth !== true) return;
    const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
    if (!OrigAudioContext) return;
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
    try {
      Object.defineProperty(window, 'AudioContext', { get: () => OrigAudioContext, configurable: false });
    } catch (e) {}
  }

  /* ---------- WebGL Fingerprinting Protection ---------- */
  function webglFingerprintProtection() {
    if (config.stealth !== true) return;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;
    const origGetParameter = WebGLRenderingContext.prototype.getParameter;
    const origGetExtension = WebGLRenderingContext.prototype.getExtension;
    const origReadPixels = WebGLRenderingContext.prototype.readPixels;
    WebGLRenderingContext.prototype.getParameter = function(pname) {
      const result = origGetParameter.call(this, pname);
      if (pname === 37446) return 'DurgaShield WebGL' + (result || '').substring(14);
      if (pname === 7936) return 'DurgaShield' + (result || '').substring(9);
      if (pname === 7937) return 'DurgaShield Shading Language' + (result || '').substring(result ? result.length - 10 : 0);
      if (pname === 35724) return 'WebGL GLSL' + (result || '').substring(Math.min(8, (result || '').length));
      return result;
    };
    WebGLRenderingContext.prototype.getExtension = function(name) {
      if (name && (
        name.startsWith('WEBGL_debug_renderer_info') ||
        name.startsWith('WEBGL_debug_shaders') ||
        name.startsWith('WEBGL_depth_texture') === false
      )) return null;
      return origGetExtension.call(this, name);
    };
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      WebGL2RenderingContext.prototype.getParameter = WebGLRenderingContext.prototype.getParameter;
    }
  }

  /* ---------- DOMRect Fingerprinting Protection ---------- */
  function domRectProtection() {
    if (config.stealth !== true) return;
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
          const rect = rects[0];
          return [new DOMRect(rect.x + dither, rect.y + dither, rect.width, rect.height)];
        } catch (e) {}
        return rects;
      };
    } catch (e) {}
  }

  /* ---------- History API Protection ---------- */
  function historyProtection() {
    if (config.stealth !== true) return;
    try {
      Object.defineProperty(history, 'length', { get: function() { return Math.max(1, Math.floor(Math.random() * 10)); }, configurable: false });
    } catch (e) {}
    try {
      const origPushState = history.pushState;
      history.pushState = function() {};
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
    /pin/i, /atm.?pin/i, /card.?pin/i, /debit.?pin/i,
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
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'phishing' });
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
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) fileInput.files = dt.files;
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
      return parts.slice(0, -1).some(function(p) { return ['gov','edu','org'].indexOf(p) >= 0; });
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
    const origAddEventListener = EventTarget.prototype.addEventListener;
    let warned = false;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if ((type === 'keydown' || type === 'keyup' || type === 'keypress') && (this === document || this === window)) {
        if (!warned) {
          const stack = new Error().stack;
          if (stack && !stack.includes('durgashield') && !stack.includes('content.js')) {
            warned = true;
            queueBlockCount(1);
            showWarning('Keylogger detected: page is tracking keystrokes.');
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'malware' });
            }
          }
        }
      }
      return origAddEventListener.call(this, type, listener, options);
    };
    const inputProto = HTMLInputElement.prototype;
    if (inputProto) {
      ['onkeydown', 'onkeyup', 'onkeypress'].forEach(prop => {
        try {
          const desc = Object.getOwnPropertyDescriptor(inputProto, prop);
          if (desc && desc.configurable) {
            Object.defineProperty(inputProto, prop, {
              get: function() { return this['_dgs_' + prop]; },
              set: function(fn) {
                if (typeof fn === 'function' && !warned) {
                  warned = true;
                  queueBlockCount(1);
                  showWarning('Keylogger detected: input keystroke tracking.');
                }
                this['_dgs_' + prop] = fn;
              },
              configurable: true
            });
          }
        } catch (e) {}
      });
    }
  }

  /* ---------- Clipboard Hijack Prevention ---------- */
  function preventClipboardHijack() {
    if (navigator.clipboard) {
      if (navigator.clipboard.read) {
        const origRead = navigator.clipboard.read.bind(navigator.clipboard);
        navigator.clipboard.read = async function() {
          if (!confirm('DurgaShield: This page wants to read your clipboard. Allow?')) {
            throw new Error('Clipboard read blocked by DurgaShield');
          }
          return origRead();
        };
      }
      if (navigator.clipboard.readText) {
        const origReadText = navigator.clipboard.readText.bind(navigator.clipboard);
        navigator.clipboard.readText = async function() {
          if (!confirm('DurgaShield: This page wants to read your clipboard. Allow?')) {
            throw new Error('Clipboard read blocked by DurgaShield');
          }
          return origReadText();
        };
      }
    }
  }

  /* ---------- Facebook Feed Ad Removal ---------- */
  function removeFacebookAds() {
    if (!window.location.hostname.includes('facebook.com')) return;
    function scanAndRemove() {
      const feedStream = document.querySelector('div[role="feed"]');
      if (!feedStream) return;
      const items = feedStream.querySelectorAll('> div > div');
      for (const item of items) {
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
    }
    scanAndRemove();
    const observer = new MutationObserver(scanAndRemove);
    observer.observe(document.body, { childList: true, subtree: true });
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
      if (style.position === 'fixed' && (style.zIndex >= 99999 || el.offsetWidth >= window.innerWidth * 0.8)) {
        const closeBtn = el.querySelector(
          'button[class*="close"], button[aria-label*="close"], button[aria-label*="Close"], ' +
          'button[title*="close"], button[title*="Close"], .close, .dismiss, [class*="closebtn"]'
        );
        if (closeBtn) {
          closeBtn.click();
          queueBlockCount(1);
        } else {
          el.style.display = 'none';
          queueBlockCount(1);
        }
      }
    }
  }

  /* ---------- Tech Support Scam Detection ---------- */
  function detectTechSupportScams() {
    const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
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
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'malware', count: found.length });
      }
    }
  }

  /* ---------- Crypto Scam Page Detection ---------- */
  function detectCryptoScams() {
    const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
    const indicators = [
      'free airdrop', 'claim your airdrop', 'free crypto', 'double your bitcoin',
      'send 1 get 10', 'send eth get', 'giveaway', 'fake wallet',
      'validate your wallet', 'connect wallet to claim', 'approve contract',
      'metamask sync', 'wallet verification', 'seed phrase', 'private key required',
      'enter your seed phrase', 'verify your wallet', 'token approval',
      'fake token sale', 'presale', 'rug pull'
    ];
    const found = indicators.filter(s => bodyText.includes(s));
    if (found.length > 0) {
      queueBlockCount(found.length);
      showWarning('Potential crypto scam detected! Do not connect your wallet or enter seed phrases.');
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'crypto', count: found.length });
      }
    }
  }

  /* ---------- HTTP Password Field Monitor ---------- */
  function detectHttpPasswordFields() {
    if (window.location.protocol === 'https:') return;
    const inputs = document.querySelectorAll('input[type="password"]');
    if (inputs.length > 0) {
      queueBlockCount(inputs.length);
      showWarning('Password field detected on insecure (HTTP) page. Your credentials could be intercepted!');
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'phishing', count: inputs.length });
      }
    }
  }

  /* ---------- Automatic Password Leak Check ---------- */
  function setupPasswordLeakCheck() {
    if (typeof chrome === 'undefined' || !chrome.runtime) return;
    let checkTimer = null;
    document.addEventListener('input', function(e) {
      const el = e.target;
      if (el.type !== 'password' || !el.value || el.value.length < 6) return;
      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(function() {
        chrome.runtime.sendMessage({ type: 'autoCheckPassword', password: el.value }, function(r) {});
      }, 2000);
    }, true);
    document.addEventListener('submit', function(e) {
      const form = e.target;
      const pw = form.querySelector('input[type="password"]');
      if (pw && pw.value && pw.value.length >= 6) {
        chrome.runtime.sendMessage({ type: 'autoCheckPassword', password: pw.value }, function(r) {});
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
          chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'privacy', count: matches.length });
          return true;
        }
      }
      return false;
    }
    const textInputs = document.querySelectorAll('textarea, input[type="text"], input[type="search"], div[contenteditable="true"]');
    for (const el of textInputs) {
      el.addEventListener('input', function() {
        checkInput(this.value || this.textContent || '');
      });
      el.addEventListener('blur', function() {
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
            art.style.display = 'none';
            count++;
            break;
          }
        }
        if (count > 0) break;
      }
      const promoted = document.querySelectorAll('div[style*="display: flex"][role="presentation"] a[href*="/ads/"]');
      for (const el of promoted) {
        const feedItem = el.closest('article, div[style*="margin-bottom"]');
        if (feedItem) { feedItem.style.display = 'none'; count++; }
      }
    }

    /* Twitter/X promoted tweets */
    if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.x.com') || host.endsWith('.twitter.com')) {
      const tweets = document.querySelectorAll('article[data-testid="tweet"]');
      for (const t of tweets) {
        const span = t.querySelector('div[data-testid="placementTracking"]');
        if (span) { t.style.display = 'none'; count++; continue; }
        const labels = t.querySelectorAll('span');
        for (const s of labels) {
          if (s.textContent.trim() === 'Promoted' || s.textContent.trim() === 'Ad') {
            t.style.display = 'none'; count++; break;
          }
        }
      }
      const sidebarAds = document.querySelectorAll('aside[aria-label="Who to follow"] div[data-testid="UserCell"]');
      for (const el of sidebarAds) {
        const parent = el.closest('section');
        if (parent) { parent.style.display = 'none'; count++; }
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
            item.style.display = 'none'; count++; break;
          }
        }
      }
      const sidebarAds2 = document.querySelectorAll('aside div[class*="ad"], aside div[id*="ad"]');
      for (const el of sidebarAds2) { el.style.display = 'none'; count++; }
    }

    if (count > 0) {
      queueBlockCount(count);
      chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'ads', count: count });
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
    for (const el of adBanners) { el.style.display = 'none'; }
    const adIframes = document.querySelectorAll('iframe[src*="ad"], iframe[src*="doubleclick"], iframe[src*="googlesyndication"]');
    for (const f of adIframes) { f.style.display = 'none'; }
    const player = document.querySelector('video');
    if (player) {
      const adOverlay = player.closest('div[class*="video-player"]');
      if (adOverlay) {
        const overlays = adOverlay.querySelectorAll('div[class*="overlay"], div[class*="ad-overlay"]');
        for (const o of overlays) { o.style.display = 'none'; }
      }
    }
    const adCount = adBanners.length + adIframes.length;
    if (adCount > 0) {
      queueBlockCount(adCount);
      chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'ads', count: adCount });
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
    for (const el of adLabels) { el.style.display = 'none'; }
    const sidePromos = document.querySelectorAll('div[class*="promo"], div[id*="promo"], div[class*="offer"], div[id*="offer"]');
    for (const el of sidePromos) { el.style.display = 'none'; }
    const adCount2 = adLabels.length + sidePromos.length;
    if (adCount2 > 0) {
      queueBlockCount(adCount2);
      chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'ads', count: adCount2 });
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
        chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'malware', count: 1 });
        showWarning('Possible site defacement detected! This page may have been compromised. Title contains: "' + document.title + '"');
        break;
      }
    }
  }

  /* ---------- Phone Scam Detection ---------- */
  function detectPhoneScams() {
    if (config.phoneScamDetect !== true) return;
    const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
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
      chrome.runtime.sendMessage({ type: 'incrementBlocked', category: 'malware', count: 1 });
      showWarning('Potential phone scam detected! This page uses common scam tactics. Do not call any numbers listed.');
    }
  }

})();
