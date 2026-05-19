# DurgaShield

A comprehensive Firefox security extension using Manifest V3. Blocks ads, popups, crypto miners, malware, phishing sites, and cookie consent popups. Includes filter lists, element zapper, heuristic tracker detection, GPC/DNT headers, CDN resource localization, stealth mode, anti-fingerprinting, Never-Consent, enhanced anti-tracking, XSS protection, ClearClick anti-clickjacking, ABE local network protection, 200+ tracking parameter stripping, YouTube annoyance cleanup, mixed content blocking, download malware scanning, and isolates social media activity into a dedicated container.

<h2>Why Choose DurgaShield?</h2>

| | |
|---|---|
| **Comprehensive** | 30+ features in one extension |
| **Privacy-focused** | No tracking, no data collection |
| **Open source** | Fully transparent codebase |
| **All-in-one** | Replaces 8–10 separate extensions |
| **Active development** | Regular updates with new features |
| **Well-maintained** | Timely security patches |
| **User-friendly** | Clean, intuitive interface |

## Features

### CDN Resource Localization (Decentraleyes-style)
- **Redirects CDN requests** to bundled local copies — prevents tracking via Google Hosted Libraries, CDNJS, jQuery CDN, jsDelivr, and Bootstrap CDN
- **Bundled libraries**: jQuery 3.6.0 / 3.7.1, AngularJS 1.8.3, Modernizr 2.8.3, Bootstrap 4.6.2 / 5.3.3, D3 7.9.0, FontAwesome 6.5.0, Lodash 4.17.21, Moment 2.29.4, React 18.2.0, Vue 3.4.0 (17 files)
- **22 DNR redirect rules** (IDs 900001-900044) covering 5 major CDN networks
- Works out of the box — no configuration needed
- Toggle on/off via the **CDN Redirect** switch in the popup
- Sites continue to function because local copies are served instead of blocking

### Ad Blocking
- **Network-level** (declarativeNetRequest): 290+ rules covering major ad networks — DoubleClick, Google Ads/Syndication, Facebook/Meta Ads, Amazon Ads, Taboola, Outbrain, ad exchanges (OpenX, AppNexus, Rubicon, PubMatic), analytics (Google Analytics, Mixpanel, Amplitude, FullStory, LuckyOrange, Heap, Segment, New Relic), social media pixels (Twitter, TikTok, Snapchat, Instagram, LinkedIn, Reddit, Pinterest), and tracking domains
- **YouTube ads**: Removes ad DOM elements (`ytd-ad-slot-renderer`, `ytd-display-ad-renderer`, `ytd-promoted-video-renderer`, `#masthead-ad`, `#merch-shelf`, `ytp-ad-module`). Auto-skips video ads by clicking the skip button as soon as it appears. Mutes and speeds up unskippable ads (16x). Runs on a delayed interval to avoid interfering with player initialization.
- **DOM cleanup**: Content script removes ad elements injected after page load, including Google AdSense, ad iframes, and banners
- **Popup blocker**: Intercepts `window.open()` calls targeting ad/popup domains

### Privacy Dashboard
- **Tabbed UI** — switch between Overview (toggles + live stats) and Dashboard (charts + analytics)
- **7-Day Block Chart** — CSS bar chart showing blocked requests per day for the last week
- **Privacy Score** — letter grade (A–F) calculated from total blocked requests, displayed as a conic gradient ring
- **Top Blocked Domains** — ranked list of most-blocked domains from the filtering log
- **Tracker Heatmap** — color-coded tracker badges (heat level 1–4) showing detected trackers on the current page
- **Auto-refresh** — dashboard re-renders every 10 seconds

### Ad Placeholder Removal
- **Collapses empty ad containers** — after removing ad elements, scans for containers with ad-related classes/IDs (`ad-*`, `ads-*`, `advert*`, `sponsor*`, `banner*`, `adslot*`, `ad-container*`, `adsense*`, and 30+ more patterns)
- **Removes blank space** — collapses detected containers to zero height, padding, and margin, eliminating the white rectangles and gaps left behind by blocked ads
- **Safe** — only targets containers with no visible content (no images, no iframes, no inline scripts)
- **Runs on DOM mutations** — catches dynamically injected ad containers

### Anti-Anti-Adblock System
- **Overlay detection** — scans for "disable adblock to continue" walls using 30+ selector patterns (`adblock*`, `ad-detected*`, `adblocker-wall*`, `adblock-overlay*`, `adblock-modal*`, etc.)
- **Text matching** — checks element text for keywords (`disable`, `adblock`, `whitelist`, `ad blocker`, `turn off`) to confirm it's an anti-adblock gate
- **Auto-removal** — removes detected overlays from the DOM immediately
- **Scroll unlock** — resets `overflow: hidden` and `position: fixed` on `body`/`html` that anti-adblock scripts use to prevent scrolling
- **Runs on DOM mutations** — catches dynamically injected walls
- **Complemented by scriptlets** — `set-constant` / `abort-on-property-read` neuter detection scripts before they can signal the wall to appear

### Anti-Adblock Bypass (uBlock Origin-style Scriptlets)
- **`abort-on-property-read`** — throws an error when a script tries to read a specific property (e.g., `FuckAdBlock.detect`), breaking anti-adblock detection scripts before they can run
- **`set-constant`** — freezes global properties to `false`/`undefined` to neuter adblock detectors (targets `FuckAdBlock`, `BlockAdBlock`, `window.adblock`, `window.adBlockDetected`, and 8+ more)
- **`nano-setInterval-booster`** — accelerates `setInterval` timers to prevent anti-adblock scripts from using timer-based polling to detect ad removal
- **`addEventListener-defuser`** — blocks specific event listener types from being registered (e.g., scroll/viewability checks used by ad trackers)
- **`prevent-xhr` / `prevent-fetch`** — blocks specific XHR/fetch requests from page scripts (e.g., ad analytics beacons)
- **`json-prune`** — removes specified properties from parsed JSON responses (e.g., ad configuration data)
- **Pre-configured host bypasses** — known anti-adblock walls (`adblocktest.org`, `blockadblock.com`, etc.) get targeted scriptlet sets automatically
- **Runs at `document_start`** — before any page JavaScript executes, ensuring the hooks are in place first

### Element Zapper
- Click any element on any page to permanently hide it
- Generates a unique CSS selector for the clicked element
- Selector is persisted in extension storage and applied automatically on future visits
- Hover highlights target elements with a red outline before clicking
- Press Escape to cancel zapper mode

### Site Whitelist
- "Trust site" button in popup to whitelist the current domain
- Whitelisted sites bypass all blocking
- "Untrust" to remove from whitelist
- Whitelist persists across browser restarts

### Malware Protection
- 133+ blocked malware domains including ransomware sites, trojan distributors, spyware, fake antivirus pages, tech support scams, and drive-by download sites

### Crypto Mining Prevention
- 124+ blocked crypto mining domains and scripts (DNR rules)
- Detects and removes in-browser miners (CoinHive, CryptoLoot, WebMiner)
- Blocks WebSocket connections to mining pools via DNR
- **Safe patterns**: Only flags specific miner script identifiers (`coinhive`, `cryptoloot`, `webminer`, `webmine`). Avoids broad terms like `miner`, `mining`, `hashrate`, `stratum`, `monero`, `cryptonight` to prevent false positives on legitimate crypto/tech sites
- **Crypto site compatibility**: Skipped entirely on `coinmarketcap.com`, `bitget.com`, and `coingecko.com` to avoid breaking charts, trading UI, and API data

### Phishing Protection
- 172+ blocked phishing domains targeting major brands: PayPal, Bank of America, Chase, Wells Fargo, Citibank, Capital One, Apple ID, iCloud, Microsoft, Outlook, Office 365, Amazon, Netflix, Google, Facebook, Instagram, Twitter/X, LinkedIn, Discord, Steam, Epic Games, Adobe, Dropbox
- **Fake form detection**: Warns when a form with password fields submits to a different domain
- **Fake address bar detection**: Detects suspicious overlays mimicking browser UI

### Social Media Container Isolation
- **Container isolation**: Automatically opens Facebook, Instagram, Messenger, and WhatsApp in a dedicated "Social Media" container using Firefox's Contextual Identities API
- **Cookie isolation**: Social media cookies are stored only in the container — not accessible from normal browsing tabs
- **Smart redirect**: Navigating to social media sites from a regular tab automatically redirects to the container. Leaving the container (clicking external links) opens outside the container
- **Container indicator**: Blue bar at top of isolated pages
- **Embed blocking**: Facebook Like/Share buttons, comments, tracking pixels removed from non-Facebook pages
- **Cookie cleanup**: Existing Facebook cookies in non-container stores removed on install and browser startup
- **Popup status**: Shows container health, name, and list of isolated domains

### Automatic Tracker Detection (Privacy Badger-style)
- **Heuristic learning**: Scans third-party domains (scripts, iframes, images) on every page and reports them to the background
- **Cross-site tracking detection**: When a third-party domain is observed on 3+ different sites, it's automatically blocked via DNR (`buildAutoTrackerRules`)
- **Tracker map**: Stores `domain → [sites...]` in `durgashield_tracker_map`
- **Auto-blocked list**: Learned trackers stored in `durgashield_auto_tracked`, applied as DNR rules (IDs 800100+)
- **Popup tracker panel**: Shows all detected trackers, number of sites each was seen on, blocked status, and unblock button
- **Reset**: One-click reset of all tracker learning data

### Global Privacy Control (GPC) & Do Not Track (DNT)
- **Sec-GPC header**: Sends `Sec-GPC: 1` on all requests via DNR `modifyHeaders` (rule ID 800000)
- **DNT header**: Sends `DNT: 1` on all requests via DNR `modifyHeaders` (rule ID 800001)
- Complies with global privacy regulations for opting out of data sharing/selling

### Social Media Widget Placeholders
- Replaces Facebook Like/Share, Twitter, Instagram, LinkedIn widgets with click-to-activate placeholder buttons
- Shows "Click to load [Platform] widget" in a styled dashed-border container
- Original widget is hidden until user clicks the placeholder
- Replaces the old hard-block approach for better usability while maintaining privacy

### Link Tracking Removal
- Strips tracking parameters from clicked links: `fbclid` (Facebook), `gclid`/`gclsrc` (Google Ads), `dclid` (DoubleClick), `yclid` (Yandex), `mc_eid` (MailChimp), `utm_source`/`utm_medium`/`utm_campaign`/`utm_term`/`utm_content` (Google Analytics)
- Intercepts click events via capture-phase listener on all links

### Advanced Controls (Popup Advanced Section)
- **Block JavaScript per-site**: Toggle JS on/off for the current domain
- **Block JavaScript globally**: Disable JS on all domains
- **Custom rules**: Add/remove user-defined block/allow URL patterns
- **Disable rule IDs**: Toggle individual DNR rules on/off by entering their rule ID

### Stats & Controls
- **Block counter**: Total and daily blocked items displayed in popup
- **Per-category toggles**: Enable/disable ad blocking, malware, crypto, phishing, popup blocker, and container isolation independently
- **Per-site controls**: Whitelist button in popup to trust/untrust current site
- **Element zapper**: Button in popup activates click-to-hide mode on current page
- **Config persistence**: Settings survive browser restarts and propagate to all open tabs
- **Reset stats**: One-click reset of block counts
- **CDN localization**: Bundles popular libraries and serves them locally instead of fetching from CDNs
- **Automatic tracker detection**: Heuristically learns and blocks cross-site trackers (Privacy Badger-style)
- **GPC & DNT signals**: Sends Global Privacy Control and Do Not Track headers on all requests
- **Social widget placeholders**: Facebook/Twitter/Instagram widgets replaced with click-to-activate buttons
- **Link tracking removal**: Strips `fbclid`, `gclid`, `utm_*` tracking params from clicked links

### JavaScript Blocking
- **Per-site**: Toggle JavaScript on/off for the current site from the popup Advanced section
- **Global**: Disable JavaScript on all websites with one toggle
- **DNR rules**: External scripts blocked via `declarativeNetRequest` with `resourceTypes: ["script"]`
- **DOM cleanup**: Content script removes existing scripts and overrides `document.createElement` to intercept dynamically created scripts
- **Priority**: Site-level setting overrides the global toggle

### Custom Rules (User-Defined Overrides)
- Add custom block or allow URL patterns (e.g., `||example.com^`, `https://tracker.com/*`)
- Patterns use DNR URL filter syntax (supports `||domain^` and `*` wildcards)
- Custom allow rules get priority 100 to override any filter list rules
- Add/remove rules directly from the popup Advanced section
- Stored in `durgashield_custom_rules` and applied via `updateDynamicRules`

### Disable Specific Rules
- Enter any DNR rule ID to disable it (removed from dynamic rules before applying)
- Static ruleset IDs: 1001-1294 (ads), 100000-100132 (malware), 200001-200124 (crypto), 300001-300172 (phishing)
- Dynamic rule IDs: 500000+ (filter lists), 700000+ (JS blocking), 701000+ (custom rules)
- Disabled IDs stored in `durgashield_disabled_rules`

### Auto-Updating Filter Lists
- Downloads EasyList, EasyPrivacy, Peter Lowe's Ad server list, Online Malicious URL Blocklist, and Fanboy lists directly from their sources
- Parses AdBlock/uBlock Origin syntax and converts to DNR rules dynamically
- Rules are stored in extension storage and reapplied on browser restart
- Auto-updates every 6 hours in the background
- Manual "Update now" button in popup
- Shows per-list status: rule count, last update time, and any errors
- Up to 4,500 dynamic rules supported (DNR limit)
- `updateDynamicRules()` applied on install, startup, and periodic refresh

### Stealth Mode (AdGuard-inspired, opt-in)
- **Referrer hiding**: Injects `<meta name="referrer" content="no-referrer">` to prevent referrer leakage to third parties
- **WebRTC blocking**: Overrides `RTCPeerConnection` constructor to prevent IP leaks via WebRTC
- **Canvas fingerprinting protection**: Adds subtle noise (`Math.random() * 0.001`) to canvas `toDataURL()` output and wraps `toBlob()` to mitigate fingerprinting
- **Hide automation**: Overrides `navigator.webdriver` to return `undefined`
- **Cookie self-destruction**: Background script removes non-session cookies older than 1 hour from non-whitelisted domains every 30 minutes
- **Opt-in**: Disabled by default — `history.pushState` neutering breaks SPA navigation. Enable via the **Stealth Mode** switch in the popup
- Toggle on/off via the **Stealth Mode** switch in the popup

### Filtering Log
- Records the last 200 blocked requests from DNR matched rules (polled every 10 seconds)
- Shows per-entry: rule ID and truncated request URL
- Accessible in the Advanced section of the popup
- Clear log button to reset
- **Export CSV**: Download full filter log as a CSV file (Timestamp, RuleID, URL columns)

### Never-Consent (Ghostery-inspired)
- **Auto-dismisses cookie consent banners** — detects and closes cookie popups from all major CMPs (OneTrust, Cookiebot, Quantcast, TrustArc, Didomi, Usercentrics, and custom implementations)
- **Preference for rejection** — automatically clicks "Reject All", "Decline", "Deny", or equivalent opt-out buttons when available
- **Fallback to dismiss** — if no reject option exists, accepts and hides the banner
- **Comprehensive selectors** — matches 50+ common cookie banner selectors and button text patterns
- Runs on page load and respects the **Never-Consent** toggle in popup

### Enhanced Anti-Tracking (Ghostery-inspired, opt-in)
- **Navigator property spoofing** — randomizes `navigator.languages`, `navigator.hardwareConcurrency`, and `navigator.deviceMemory` to reduce fingerprint uniqueness
- **Screen property dithering** — adds ±1px noise to `screen.width` and `screen.height`; randomizes `screen.colorDepth` between 24 and 32
- **Tracking storage removal** — clears common tracking keys from `localStorage`, `sessionStorage`, and `document.cookie` including GA (`_ga`, `_gid`), Facebook (`_fbp`), HubSpot, Intercom, Hotjar, Mixpanel, Amplitude, Segment, FullStory, and 50+ more
- **Opt-in by default**: Disabled by default to avoid breaking site functionality. Enable via the **Enhanced Anti-Track** toggle in popup
- Respects the **Enhanced Anti-Track** toggle in popup

### XSS Protection (NoScript-inspired, opt-in)
- **CSP injection** — injects a Content-Security-Policy meta tag with restrictive defaults (`default-src 'self'`, `object-src 'none'`)
- **URL parameter sanitization** — scans URL query parameters for XSS payloads (`<script>`, `javascript:`, `onerror=`, `alert()`, `eval()`) and prompts to reload without the malicious parameter
- **Mutation monitoring** — observes DOM for injected `<script>`, `<iframe>` with `data:text/html`, and `<a>` with `javascript:` hrefs; removes or neuters them
- **Form submission protection** — intercepts form submissions and strips XSS patterns from text inputs, highlighting sanitized fields
- **Opt-in by default**: Disabled by default because CSP injection can break sites that rely on inline scripts/data URIs. Enable via the **XSS Protection** toggle in popup
- Respects the **XSS Protection** toggle in popup

### ClearClick Anti-Clickjacking (NoScript-inspired, opt-in)
- **Overlay detection** — scans for transparent or low-opacity elements (`opacity < 0.5`, `rgba(0,0,0,0)`, `transparent`) that are positioned fixed/absolute with high `z-index` and cover large portions of the page
- **Click interception** — when a click targets or passes through a suspicious overlay, shows a confirmation dialog before allowing the action
- **Visual indicator** — marks detected overlays with a subtle red outline
- **Opt-in by default**: Disabled by default because overlay detection can cause false positives on sites with sticky headers/ad containers, breaking link clicking. Enable via the **ClearClick** toggle in popup
- Respects the **ClearClick** toggle in popup

### ABE — Application Boundaries Enforcer (NoScript-inspired)
- **Local network isolation** — detects when a public web page loads content (iframes, scripts, images) from private IP addresses (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`, `127.0.0.1`, `localhost`)
- **Automatic blocking** — removes elements referencing local network resources from non-local pages
- **Visual warning** — shows a prominent red banner when local network content is blocked
- Respects the **ABE** toggle in popup

### URL Tracking Parameter Cleaning (ClearURLs-inspired)
- **200+ tracking parameters stripped** — removes `fbclid`, `gclid`, `utm_*`, `_ga`, `_hsenc`, `ref`, `si`, `sk`, `mtm_*`, `hmb_*`, `vero_*`, `oly_*`, `vero_conv`, `vero_id`, `mkt_tok`, `igshid`, `trk`, and 200+ more from all clicked links
- **Click capture-phase listener** — strips parameters before navigation using `capture: true` event listener
- **Link tracking removal** (existing) — previously handled `fbclid`, `gclid`, `gclsrc`, `dclid`, `yclid`, `mc_eid`, and `utm_*`

### AudioContext Fingerprinting Protection
- **AnalyserNode noise injection** — adds random noise (±1 unit, ±0.5 dB) to `getFloatFrequencyData`, `getByteFrequencyData`, and `getByteTimeDomainData` outputs
- **Minimal perceptible difference** — noise is imperceptible to users but breaks fingerprinting hash consistency

### WebGL Fingerprinting Protection
- **Renderer spoofing** — replaces renderer string, vendor string, and shading language version with generic "DurgaShield" prefixes
- **Debug extension blocking** — returns `null` for `WEBGL_debug_renderer_info` and `WEBGL_debug_shaders` extensions
- **WebGL2 support** — same protections applied to WebGL2 context

### Permission Monitor
- **Transparency** — tracks how many times a page requests Location, Camera, and Microphone access
- **Visual badge** — shows a yellow bottom banner on the 1st, 2nd, and 3rd request for each permission type
- **Non-blocking** — does not prevent access, only notifies the user

### Mixed Content Detection
- **HTTPS page scanning** — detects HTTP resources (`http:` src/href/data) on HTTPS pages
- **Upgrade to HTTPS** — automatically rewrites `http://` to `https://` for images, iframes, embeds, and objects
- **Script removal** — removes HTTP scripts (cannot be safely upgraded)
- **Re-checks on DOM mutations** — catches dynamically added mixed content

### Password Leak Detection
- **HIBP k-anonymity** — checks passwords against Have I Been Pwned using SHA-1 prefix (only first 5 hex chars sent)
- **No plaintext transmission** — your password never leaves your device; only the hash prefix is sent
- **Automatic** — monitors password fields on all pages; checks on input (2s debounce) and form submission
- **Desktop warning** — shows a browser notification if a compromised password is detected
- **On-demand** — also accessible from the Advanced tab as a self-service tool
- **Togglable** — enable/disable via the **Password Leak Check** switch in the Features tab
- **History** — stores last 50 checked password hashes for reference

### Notification Batching
- **Cooldown window** — notifications are queued and flushed every 30 seconds
- **Collapse** — multiple events in one window are combined into a summary notification
- **Reduced noise** — prevents notification spam from rapid events

### Tracker Map Size Limits
- **Per-tracker cap** — each tracked domain stores at most 100 referring sites
- **Global cap** — tracker map limited to the 500 most-active trackers
- **Automatic pruning** — excess entries removed on each new report

### Secure Payment Gateway
- **HTTP payment detection** — scans forms for payment-related fields (credit card number, CVV, expiry, UPI ID, netbanking account number, IFSC, OTP, PIN, and 30+ more patterns)
- **Block on HTTP** — intercepts form submission and shows a full-screen warning if the page is served over HTTP
- **Clear warning** — explains that payment data would be sent unencrypted
- **Proceed anyway** — users can override the block if they understand the risk
- **Logs to filtering log** — records blocked payment attempts with hostname
- Respects the **Secure Payment** toggle in popup

### Download Scanner
- **No external dependencies** — works entirely in-browser with zero setup
- **URL check** — monitors all downloads via `chrome.downloads` API, checks the source URL against 40+ known malware domain keywords
- **Dangerous extension warning** — warns about executable file types (`.exe`, `.scr`, `.bat`, `.vbs`, `.ps1`, `.jar`, `.msi`, `.docm`, and 25+ more) from untrusted sites
- **User prompt** — shows notification with "Proceed anyway" / "Cancel download" buttons; 60-second auto-cancel timeout
- Respects the **Download Scanner** toggle in popup

### HTTPS Enforcement
- **Automatic upgrades** — 80 DNR `upgradeScheme` rules for major sites (Google, Facebook, Amazon, banking, email, CDN, news)
- **Main frame only** — upgrades top-level navigations to HTTPS; sub-resources handled by mixed content detection
- Rule IDs: 995000–995079
- Respects the **HTTPS Enforcement** toggle in Features tab

### Filter Rules Summary

| Ruleset | Rule IDs | Rules | Purpose |
|---|---|---|---|---|---|
| `ads.json` (static) | 1001-1288 | 288 | Ad networks, trackers, social pixels, analytics |
| `malware.json` (static) | 100000-100132 | 133 | Malware domains, ransomware, scams |
| `crypto.json` (static) | 200001-200124 | 124 | Crypto miners, mining pools |
| `phishing.json` (static) | 300001-300172 | 172 | Phishing domains, fake login pages |
| `cdn.json` (static) | 900001-900044 | 22 | CDN resource localization redirects |
| `social.json` (static) | 5001-5012 | 12 | Social media widget scripts (FB, Twitter, LinkedIn, etc.) |
| `annoyance.json` (static) | 6001-6014 | 14 | Cookie consent, push notification, app banner scripts |
| Dynamic filter lists | 500000+ | Up to 4,900 | EasyList, EasyPrivacy, Peter Lowe's, URLhaus, Fanboy lists |
| JS blocking rules | 700000-700999 | Dynamic | Per-site/global script blocking |
| Custom user rules | 701000+ | Dynamic | User-defined block/allow patterns |
| Privacy header rules | 800000-800001 | Static | GPC (`Sec-GPC: 1`) and DNT (`DNT: 1`) headers |
| Auto-tracked domains | 800100+ | Dynamic | Heuristically detected cross-site trackers |
| Never-Consent | Content script | — | Auto-dismisses cookie consent popups |
| Enhanced Anti-Track | Content script | — | Spoofs APIs, clears tracking storage |
| XSS Protection | Content script | — | Blocks cross-site scripting attacks |
| ClearClick | Content script | — | Anti-clickjacking overlay detection |
| ABE | Content script | — | Local network / router protection |
| URL Cleaning | Content script | — | Strips 200+ tracking params from links |
| Audio FP Protect | Content script | — | Adds noise to AudioContext analyser data |
| WebGL FP Protect | Content script | — | Spoofs renderer info, blocks debug extensions |
| Permission Monitor | Content script | — | Tracks geo/camera/mic requests |
| Mixed Content | Content script | — | Upgrades/blocks HTTP on HTTPS pages |
| Download Scanner | Background | — | URL + extension check for malware |
| HTTPS Enforcement | Background (DNR) | 995000-995079 | Upgrades HTTP to HTTPS on major sites |
| Password Leak Check | Background | — | HIBP k-anonymity password breach check |
| Notification Batching | Background | — | Queues and batches notifications |
| Ad Placeholder Removal | Content script | — | Collapses empty ad containers |
| Privacy Dashboard | Popup | — | Charts, scores, heatmaps |

## Installation

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select `manifest.json` from the extension directory

For permanent installation, sign the extension at [addons.mozilla.org](https://addons.mozilla.org).

## Requirements

- Firefox 140.0 or later
- Manifest V3

## Permissions

| Permission | Usage |
|---|---|
| `declarativeNetRequest` | Block network requests to ad/malware/phishing/crypto domains |
| `declarativeNetRequestFeedback` | Read matched DNR rules for block stats |
| `storage` | Persist config, block statistics, whitelist, hide rules |
| `tabs` | Tab management for container isolation |
| `webNavigation` | Intercept navigations for container redirect |
| `contextualIdentities` | Create and manage Social Media container |
| `cookies` | Clean up Facebook cookies from non-container stores |
| `notifications` | Security alerts |
| `<all_urls>` | Apply blocking/content scripts across all websites |

## Project Structure

```
durgashield/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Background: DNR management, filters, containers, stats, tracking cleaner
├── content.js             # Content script: ad blocking, XSS, stealth, cookie consent, anti-clickjacking, etc.
├── popup.html             # Popup UI (master toggle + Settings button)
├── popup.js               # Popup logic
├── settings.html          # Full options page (6 tabs: Dashboard/Features/Filters/Rules/Advanced/About)
├── settings.js            # Settings page logic
├── privacy.html           # Privacy policy page
├── donations.html         # Donations page
├── donations.js           # Donations page script
├── rules/
│   ├── ads.json           # 294 ad blocking rules
│   ├── malware.json       # 133 malware blocking rules
│   ├── crypto.json        # 124 crypto mining blocking rules
│   ├── phishing.json      # 172 phishing blocking rules
│   ├── cdn.json           # 22 CDN resource localization redirects
│   ├── social.json        # 12 social media widget blocking rules
│   └── annoyance.json     # 14 cookie consent/push notification blocking rules
├── resources/
│   ├── lib/               # Bundled CDN resources (Decentraleyes-style)
│   │   ├── jquery/        # jQuery 3.6.0, 3.7.1
│   │   ├── angular/       # AngularJS 1.8.3
│   │   ├── bootstrap/     # Bootstrap 4.6.2, 5.3.3
│   │   ├── d3/            # D3 7.9.0
│   │   ├── fontawesome/   # FontAwesome 6.5.0
│   │   ├── lodash/        # Lodash 4.17.21
│   │   ├── modernizr/     # Modernizr 2.8.3
│   │   ├── moment/        # Moment 2.29.4
│   │   ├── react/         # React 18.2.0
│   │   └── vue/           # Vue 3.4.0
│   ├── cdn-map.json       # CDN → local resource mapping
│   ├── angular.min.js     # Legacy AngularJS copy
│   ├── jquery-3.7.1.min.js
│   ├── bootstrap-4.6.2.min.css
│   ├── bootstrap-5.3.3.min.css
│   └── modernizr.min.js
└── icons/
    ├── icon-16.svg
    ├── icon-48.svg
    └── icon-128.svg
```

## Development

Edit files directly and reload the extension in `about:debugging` to apply changes.

After modifying rules JSON files, validate JSON syntax. After changing background/content scripts, reload the extension and test on affected sites.

Keep README.md updated when adding or modifying features.

## Feedback & Support

- **Report bugs or request features**: Open an issue at [github.com/WholeSale2c/durgashield/issues](https://github.com/WholeSale2c/durgashield/issues)
- **Source code**: [github.com/WholeSale2c/durgashield](https://github.com/WholeSale2c/durgashield)

## License

MIT

## Changelog

### v1.0.3 — Broad DNR pattern cleanup, ClearClick opt-in (2026-05-19)
- **DNR broad pattern removal**: Removed 6 overly broad substring rules (`analytics.`, `tracking.`, `/ads/`, `/banner/`, `/sponsor/`, `/promo/`) that blocked first-party resources on arbitrary sites — generic substring filters in Firefox DNR lack `third-party` domain matching, causing false-positive blocking on sites that serve scripts/images from `/ads/` paths or use `analytics.`/`tracking.` subdomains internally
- **ClearClick made opt-in**: Overlay detection caused false positives on sites with sticky headers/ad containers, breaking all link clicks — now only activates when explicitly enabled via toggle
- **Opt-in defaults aligned**: `background.js` `DEFAULT_CONFIG` updated to match `content.js` defaults (`stealth: false`, `enhancedTracking: false`, `xssProtection: false`, `clearClick: false`) for consistent behavior across all contexts

### v1.0.2 — Crypto site compatibility fixes (2026-05-19)
- **`detectCryptoMining()` pattern narrowing**: Removed broad patterns (`miner`, `mining`, `monero`, `hashrate`, `stratum`, `cryptonight`) that matched common crypto terms in legitimate scripts — kept only specific miner identifiers (`coinhive`, `cryptoloot`, `webminer`, `webmine`)
- **Crypto site allowlist**: Added `coinmarketcap.com`, `bitget.com`, and `coingecko.com` to DNR site allow rules and content script skip lists — prevents `removeAdElements()`, `detectCryptoMining()`, `bypassAntiAdblock()`, `dismissInterstitials()`, `scanSuspiciousOverlays()`, `removeAdPlaceholders()`, and `initClearClick()` from breaking charts, trading UI, and API data loading
- **Opt-in safeguards**: `enhancedTracking`, `xssProtection`, and stealth-mode features (`historyProtection`, `audioFingerprintProtection`, `webglFingerprintProtection`, `domRectProtection`) changed from default-on to opt-in (`!== true`) — their prototype spoofing, CSP injection, and `history.pushState` neutering caused site breakage
- **Ad keyword regex anchored**: `adKeyword` regex now uses word-boundary anchors `/(^|[\s_-])(a[dds][-\s_]|advert|sponsor|banner|promo)/i` to prevent false-positive matches
- **ClearClick dismiss button**: Warning bar now includes a Dismiss button so users can close it and interact with CAPTCHAs and legitimate overlays
- **Canvas/SVG protection**: `removeAdPlaceholders()` skips `<canvas>` and `<svg>` elements to avoid removing chart/render surfaces
- **`data_collection_permissions`**: Added as `{"required": ["none"]}` for AMO compliance; `strict_min_version` bumped to Firefox 140.0

### v1.0.1 — Missing features added (2026-05-10)
- **Filter log CSV export**: New "Export CSV" button downloads filter log as CSV
- **HTTPS Enforcement**: 80 DNR upgradeScheme rules for major sites (togglable feature)
- **Password Leak Detection**: On-demand HIBP k-anonymity check in Advanced tab
- **Notification Batching**: Cooldown queue collapses rapid notifications into summaries
- **Tracker map size limiting**: Per-tracker cap (100 sites) and global cap (500 trackers)

### v1.0.0 — Major Overhaul (2026-05-09)

- **Rename**: SecureFox → DurgaShield across all files
- **Popup redesign**: Simplified to single [Settings] button that opens the full options page
- **New options page**: Comprehensive tabbed settings (Dashboard, Features, Filter Lists, Custom Rules, Advanced, About)
- **Social Media Filter**: DNR rules (social.json) blocking Facebook, Twitter, LinkedIn, Pinterest, Instagram, Reddit widget scripts
- **Annoyance Filter**: DNR rules (annoyance.json) + content script blocking cookie consent, notification prompts, mobile app banners, newsletter popups, floating share widgets
- **URL Tracking Cleaner**: webRequest listener stripping 50+ tracking parameters (utm_*, fbclid, gclid, mc_*, etc.) from all page loads
- **Filter List Auto-Update**: Chrome alarms API for scheduled 6-hour filter updates
- **Stealth Mode Enhancements**: Enhanced anti-fingerprinting (audio, WebGL, canvas, screen API, permission monitoring)
- **Element Picker**: Visual click-to-block mode (zapper) with CSS selector generation
- **Manifest updates**: Added webRequest/webRequestBlocking/unlimitedStorage/alarms/scripting permissions; 7 static DNR rule sets
- **Font size +1px** across popup for better readability
- **Footer links**: Options, Privacy, Donate pages with proper chrome.runtime.openOptionsPage() integration
- **New pages**: settings.html (options), privacy.html, donations.html
