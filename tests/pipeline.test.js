/* ---------- Pipeline Tests ----------
   Validates the 6-step matching pipeline, WASM scanner, tokenization,
   URL normalization, and cache behavior.

   Run: node tests/pipeline.test.js
   Depends on core/pattern-matcher.js (loaded via require or global).
*/

const assert = {
  equal: (a, b, msg) => { if (a !== b) throw new Error(`FAIL: ${msg || ''} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  ok: (v, msg) => { if (!v) throw new Error(`FAIL: ${msg || ''}`); },
  deepEqual: (a, b, msg) => {
    const sa = JSON.stringify(a); const sb = JSON.stringify(b);
    if (sa !== sb) throw new Error(`FAIL: ${msg || ''} — expected ${sb}, got ${sa}`);
  }
};

// Load pattern-matcher (works in Node with global scope)
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'core', 'pattern-matcher.js'), 'utf-8');
eval(code);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); }
}

console.log('\n=== Pipeline Tests ===\n');

// ── URL Normalization ──
test('normalizeUrl lowercases protocol+host', () => {
  assert.equal(normalizeUrl('HTTP://EXAMPLE.COM/Path'), 'http://example.com/Path');
});
test('normalizeUrl strips fragment', () => {
  assert.equal(normalizeUrl('https://example.com/page#section'), 'https://example.com/page');
});
test('normalizeUrl removes trailing dot', () => {
  assert.equal(normalizeUrl('https://example.com./path'), 'https://example.com/path');
});
test('normalizeUrl handles already-normal URL', () => {
  assert.equal(normalizeUrl('https://example.com/path?q=1'), 'https://example.com/path?q=1');
});
test('normalizeUrl handles punycode', () => {
  const result = normalizeUrl('https://münchen.de/');
  assert.ok(result.startsWith('http'), 'result should start with http');
  assert.ok(result.includes('xn--'), 'result should contain punycode: ' + result);
});

// ── Domain extraction ──
test('extractHostname extracts host from URL', () => {
  assert.equal(extractHostname('https://www.example.com/path?q=1'), 'www.example.com');
});
test('extractHostname handles root', () => {
  assert.equal(extractHostname('https://example.com'), 'example.com');
});

// ── Suffix variations ──
test('suffixVariations generates parent domains + dot-prefixed', () => {
  const result = suffixVariations('cdn.ads.example.com');
  assert.ok(result.includes('ads.example.com'), 'should include parent: ads.example.com');
  assert.ok(result.includes('.ads.example.com'), 'should include dot-prefixed: .ads.example.com');
  assert.ok(result.includes('example.com'), 'should include grandparent: example.com');
  assert.ok(result.includes('.example.com'), 'should include grandparent dot-prefixed: .example.com');
});

// ── Aho-Corasick ──
test('buildAhoCorasick builds trie with patterns', () => {
  const trie = buildAhoCorasick(['/ad', '/banner', '/track']);
  assert.ok(trie.length > 0, 'trie should have nodes');
});
test('searchAhoCorasick finds substring match', () => {
  const trie = buildAhoCorasick(['/ad', '/banner-']);
  const matches = searchAhoCorasick('https://example.com/banner-123.js', trie);
  assert.ok(matches.length > 0, 'should find banner match');
  assert.equal(matches[0].pattern, '/banner-');
});
test('searchAhoCorasick no false positive', () => {
  const trie = buildAhoCorasick(['/ad', '/banner']);
  const matches = searchAhoCorasick('https://example.com/clean-image.png', trie);
  assert.equal(matches.length, 0, 'should not match clean URL');
});
test('searchAhoCorasick matches hostname', () => {
  const trie = buildAhoCorasick(['doubleclick', 'googlead']);
  const matches = searchAhoCorasick('doubleclick.net', trie);
  assert.ok(matches.length > 0, 'should match hostname');
});

// ── Domain trie ──
test('buildDomainTrie builds trie', () => {
  const trie = buildDomainTrie(['ads.example.com', 'tracker.com']);
  assert.ok(trie, 'trie should exist');
  assert.ok(trie.children, 'root should have children');
});
test('matchDomainTrie matches exact domain', () => {
  const trie = buildDomainTrie(['ads.example.com']);
  const result = matchDomainTrie('ads.example.com', trie);
  assert.ok(result, 'should match exact domain');
});
test('matchDomainTrie matches wildcard subdomain', () => {
  const trie = buildDomainTrie(['*.example.com']);
  const result = matchDomainTrie('cdn.example.com', trie);
  assert.ok(result, 'should match wildcard subdomain');
});
test('matchDomainTrie rejects non-matching', () => {
  const trie = buildDomainTrie(['*.example.com']);
  const result = matchDomainTrie('other.com', trie);
  assert.equal(result, null, 'should not match unrelated domain');
});

// ── Compiled Index ──
test('createCompiledIndex creates empty index', () => {
  const idx = createCompiledIndex();
  assert.ok(idx, 'index should exist');
  assert.deepEqual(idx.domains, {});
  assert.deepEqual(idx.substrings, []);
});
test('fromPlainObject / toPlainObject roundtrip', () => {
  const orig = createCompiledIndex();
  orig.domains['example.com'] = { action: 'block' };
  orig.substrings.push({ pattern: '/ad', action: 'block' });
  const plain = toPlainObject(orig);
  const restored = fromPlainObject(plain);
  assert.ok(restored.domains['example.com'], 'should restore domain');
  assert.equal(restored.substrings.length, 1, 'should restore substrings');
  assert.equal(restored.domains['example.com'].action, 'block');
});

// ── Tokenization ──
test('tokenize splits URL into tokens', () => {
  const tokens = tokenize('https://cdn.example.com/ad-banner-123.js');
  assert.ok(tokens.includes('cdn'), 'should include cdn');
  assert.ok(tokens.includes('ad'), 'should include ad');
  assert.ok(tokens.includes('banner'), 'should include banner');
});
test('tokenize single segment', () => {
  const tokens = tokenize('ad');
  assert.equal(tokens.length, 0, 'single char should not be token');
});
test('tokenize ignores protocol', () => {
  const tokens = tokenize('https://example.com');
  assert.ok(tokens.includes('example'), 'should include example');
  assert.ok(!tokens.includes('https'), 'should not include https');
});
test('buildTokenIndex builds set from patterns', () => {
  const idx = buildTokenIndex([{ pattern: '/ad-banner' }]);
  assert.ok(idx, 'index should exist');
  assert.ok(idx.has('ad'), 'should contain ad');
  assert.ok(idx.has('banner'), 'should contain banner');
});
test('matchTokens finds matching token', () => {
  const idx = buildTokenIndex([{ pattern: '/ad-banner' }]);
  assert.ok(matchTokens('https://example.com/ad-banner-123.js', idx), 'should match ad-banner URL');
});
test('matchTokens no false positive', () => {
  const idx = buildTokenIndex([{ pattern: '/ad-banner' }]);
  assert.ok(!matchTokens('https://example.com/clean-image.png', idx), 'should not match clean URL');
});

// ── LRU Cache ──
test('createMatchCache stores and retrieves', () => {
  const cache = createMatchCache(5);
  cache.set('key1', 'val1');
  assert.equal(cache.get('key1'), 'val1');
});
test('createMatchCache evicts oldest', () => {
  const cache = createMatchCache(2);
  cache.set('k1', 1);
  cache.set('k2', 2);
  cache.set('k3', 3); // should evict k1
  assert.equal(cache.get('k1'), undefined, 'k1 should be evicted');
  assert.equal(cache.get('k2'), 2, 'k2 should remain');
  assert.equal(cache.get('k3'), 3, 'k3 should exist');
});
test('createMatchCache updates LRU on get', () => {
  const cache = createMatchCache(2);
  cache.set('k1', 1);
  cache.set('k2', 2);
  cache.get('k1');  // promotes k1
  cache.set('k3', 3); // should evict k2
  assert.equal(cache.get('k1'), 1, 'k1 should remain (was promoted)');
  assert.equal(cache.get('k2'), undefined, 'k2 should be evicted');
});

// ── Precompile wildcards ──
test('precompileWildcards converts patterns to regex', () => {
  const result = precompileWildcards([{ pattern: '||example.com^', action: 'block' }]);
  assert.ok(result.length > 0, 'should compile wildcard');
  assert.ok(result[0].regex instanceof RegExp, 'should produce RegExp');
  assert.ok(result[0].regex.test('http://example.com/ad'), 'regex should match example.com');
});

// ── Full integration: matchUrl with compiled index ──
test('matchUrl blocks known domain', () => {
  const idx = createCompiledIndex();
  idx.domains['doubleclick.net'] = { action: 'block' };
  const m = createMatcher(idx);
  const result = matchUrl('https://doubleclick.net/ad.js', m);
  assert.ok(result, 'should match');
  assert.equal(result.source, 'domain');
});
test('matchUrl blocks via suffix', () => {
  const idx = createCompiledIndex();
  idx.domains['example.com'] = { action: 'block' };
  const m = createMatcher(idx);
  const result = matchUrl('https://ads.example.com/track.js', m);
  assert.ok(result, 'should match via suffix');
  assert.equal(result.source, 'suffix');
});
test('matchUrl blocks via substring', () => {
  const idx = createCompiledIndex();
  idx.substrings.push({ pattern: '/pagead/', action: 'block' });
  const m = createMatcher(idx);
  const result = matchUrl('https://google.com/pagead/ad.js', m);
  assert.ok(result, 'should match');
  assert.equal(result.source, 'substring');
});
test('matchUrl blocks via wildcard', () => {
  const idx = createCompiledIndex();
  idx.hostWildcards.push({ pattern: '||example.com^', action: 'block' });
  const m = createMatcher(idx);
  const result = matchUrl('https://example.com/ad.js', m);
  assert.ok(result, 'should match');
  assert.equal(result.source, 'wildcard');
});
test('matchUrl returns null for clean URL', () => {
  const idx = createCompiledIndex();
  idx.domains['doubleclick.net'] = { action: 'block' };
  const m = createMatcher(idx);
  const result = matchUrl('https://github.com/opencode', m);
  assert.equal(result, null, 'should not match clean URL');
});

// ── Cache ──
test('matchUrl caches results', () => {
  const idx = createCompiledIndex();
  idx.domains['doubleclick.net'] = { action: 'block' };
  const m = createMatcher(idx);
  const r1 = matchUrl('https://doubleclick.net/ad.js', m);
  const r2 = matchUrl('https://doubleclick.net/ad.js', m);
  assert.ok(r1, 'first call should match');
  assert.ok(r2, 'second call should match');
});

// ── Batch match ──
test('matchUrls returns only matching', () => {
  const idx = createCompiledIndex();
  idx.domains['doubleclick.net'] = { action: 'block' };
  const m = createMatcher(idx);
  const urls = ['https://doubleclick.net/ad.js', 'https://github.com'];
  const results = matchUrls(urls, m);
  assert.equal(results.length, 1, 'should return only the matching URL');
  assert.equal(results[0].url, 'https://doubleclick.net/ad.js');
});

// ── NormalizeUrl in pipeline ──
test('matchUrl normalizes before matching', () => {
  const idx = createCompiledIndex();
  idx.domains['doubleclick.net'] = { action: 'block' };
  const m = createMatcher(idx);
  const result = matchUrl('HTTPS://DOUBLECLICK.NET/AD.JS#track', m);
  assert.ok(result, 'should match normalized URL');
  assert.equal(result.source, 'domain');
});

// ── Token integration ──
test('matchUrl blocks via token', () => {
  const idx = createCompiledIndex();
  idx.substrings.push({ pattern: '/ad-banner', action: 'block' });
  const m = createMatcher(idx);
  const result = matchUrl('https://example.com/ad-banner-123.js', m);
  assert.ok(result, 'should match ad-banner URL');
});

// ── Domain trie integration ──
test('matchUrl blocks via domain trie', () => {
  const idx = createCompiledIndex();
  idx.hostWildcards.push({ pattern: '||*.example.com^', action: 'block' });
  const m = createMatcher(idx);
  const result = matchUrl('https://sub.example.com/page', m);
  assert.ok(result, 'should match wildcard domain');
});

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
process.exit(failed > 0 ? 1 : 0);
