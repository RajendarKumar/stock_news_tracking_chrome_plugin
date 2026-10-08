/**
 * Automated Verification Test Suite for Stock News Tracker Extension
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting Stock News Tracker Test Suite...\n');

// 1. Verify Manifest JSON structure
console.log('Test 1: Manifest V3 Compliance');
const manifestRaw = fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8');
const manifest = JSON.parse(manifestRaw);

assert.strictEqual(manifest.manifest_version, 3, 'Must be Manifest V3');
assert.ok(manifest.permissions.includes('storage'), 'Must have storage permission');
assert.ok(manifest.permissions.includes('alarms'), 'Must have alarms permission');
assert.ok(manifest.permissions.includes('notifications'), 'Must have notifications permission');
assert.ok(manifest.host_permissions.some(p => p.includes('kite.zerodha.com')), 'Must have Kite host permission');
assert.ok(manifest.host_permissions.some(p => p.includes('news.google.com')), 'Must have Google News host permission');
assert.strictEqual(manifest.background.service_worker, 'background/background.js');
console.log('  ✓ Manifest V3 validation passed');

// 2. Test Stock Lookup and Query Builder
console.log('Test 2: Stock Lookup & Query Builder');
const { cleanStockSymbol, resolveCompanyName, buildNewsFeedUrl } = require('../shared/stock-lookup.js');

assert.strictEqual(cleanStockSymbol('NSE:INFY-EQ'), 'INFY');
assert.strictEqual(cleanStockSymbol('BSE:RELIANCE-BE'), 'RELIANCE');
assert.strictEqual(cleanStockSymbol('TATAMOTORS'), 'TATAMOTORS');

assert.strictEqual(resolveCompanyName('INFY'), 'Infosys');
assert.strictEqual(resolveCompanyName('RELIANCE'), 'Reliance Industries');
assert.strictEqual(resolveCompanyName('TCS'), 'Tata Consultancy Services');
assert.strictEqual(resolveCompanyName('CUSTOMSYM', 'My Custom Co'), 'My Custom Co');

const queryUrl = buildNewsFeedUrl('INFY', 'Infosys', 'IN');
assert.ok(queryUrl.includes('news.google.com/rss/search'), 'Must be Google News RSS URL');
assert.ok(queryUrl.includes('Infosys'), 'Must contain resolved company name');
console.log('  ✓ Stock Lookup & Query Builder passed');

// 3. Test RSS Parser with mock and realistic RSS XML
console.log('Test 3: DOM-Independent RSS Parser');
const { parseRssFeed, decodeHtmlEntities, stripHtml, parseRelativeTime } = require('../background/rss-parser.js');

assert.strictEqual(decodeHtmlEntities('HDFC &amp; ICICI Bank &quot;Results&quot; &#39;Strong&#39;'), 'HDFC & ICICI Bank "Results" \'Strong\'');
assert.strictEqual(stripHtml('<b>Sensex</b> jumps <a href="#">500 pts</a>'), 'Sensex jumps 500 pts');

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Google News</title>
    <item>
      <title>Reliance Jio IPO likely in 2026: Key triggers to watch - Economic Times</title>
      <link>https://news.google.com/articles/CAIiED123?oc=5</link>
      <guid isPermaLink="false">CAIiED123</guid>
      <pubDate>Thu, 08 Oct 2026 10:00:00 GMT</pubDate>
      <description>&lt;a href="..."&gt;Reliance Jio IPO&lt;/a&gt; Market analysts expect mega listing next year.&amp;nbsp;&lt;font color="#6f6f6f"&gt;The Economic Times&lt;/font&gt;</description>
      <source url="https://economictimes.indiatimes.com">The Economic Times</source>
    </item>
    <item>
      <title>Tata Motors EV sales register 28% growth in Q2</title>
      <link>https://news.google.com/articles/CAIiED456?oc=5</link>
      <guid isPermaLink="false">CAIiED456</guid>
      <pubDate>Wed, 07 Oct 2026 08:30:00 GMT</pubDate>
      <description>Electric passenger vehicle portfolio expands rapidly.</description>
      <source url="https://livemint.com">Livemint</source>
    </item>
  </channel>
</rss>`;

const parsed = parseRssFeed(sampleXml, 'RELIANCE');
assert.strictEqual(parsed.length, 2);
assert.strictEqual(parsed[0].symbol, 'RELIANCE');
assert.strictEqual(parsed[0].source, 'The Economic Times');
assert.strictEqual(parsed[0].id, 'CAIiED123');
assert.ok(parsed[0].snippet.includes('Reliance Jio IPO Market analysts expect mega listing'));
assert.ok(parsed[0].timestamp > 0);
console.log('  ✓ RSS Parser passed');

// 4. Test Broker Upsert and Storage Transformation Logic
console.log('Test 4: Broker Holdings Extraction & Storage Logic');
const mockHoldingsFromKite = [
  { symbol: 'NSE:INFY-EQ', quantity: 50, avgPrice: 1450.0 },
  { symbol: 'RELIANCE', quantity: 20, avgPrice: 2800.5 },
  { symbol: 'TATAMOTORS', quantity: 100, avgPrice: 920.0 }
];

// Simulate upsert mapping logic
const upserted = mockHoldingsFromKite.map(item => {
  const sym = cleanStockSymbol(item.symbol);
  return {
    symbol: sym,
    name: resolveCompanyName(sym),
    quantity: item.quantity,
    avgPrice: item.avgPrice,
    source: 'Zerodha Kite',
    addedAt: Date.now()
  };
});

assert.strictEqual(upserted.length, 3);
assert.strictEqual(upserted[0].symbol, 'INFY');
assert.strictEqual(upserted[0].name, 'Infosys');
assert.strictEqual(upserted[1].symbol, 'RELIANCE');
assert.strictEqual(upserted[1].name, 'Reliance Industries');
assert.strictEqual(upserted[2].symbol, 'TATAMOTORS');
assert.strictEqual(upserted[2].name, 'Tata Motors');
console.log('  ✓ Broker Holdings Extraction logic passed');

// 5. Verify All Required Extension Assets Exist
console.log('Test 5: Extension Files Integrity');
const requiredFiles = [
  'manifest.json',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'background/background.js',
  'background/rss-parser.js',
  'content/content-zerodha.js',
  'content/content-zerodha.css',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'options/options.html',
  'options/options.css',
  'options/options.js',
  'shared/stock-lookup.js',
  'shared/storage.js'
];

for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, '..', file);
  assert.ok(fs.existsSync(fullPath), `Missing required file: ${file}`);
  const stat = fs.statSync(fullPath);
  assert.ok(stat.size > 0, `File is empty: ${file}`);
}
console.log('  ✓ All required extension files verified');

// 6. Test StorageManager clearCompleteList vs clearHoldings
console.log('Test 6: StorageManager Operations (clearCompleteList vs clearHoldings)');
const mockStorage = {};
global.chrome = {
  storage: {
    local: {
      get(keys, cb) {
        const res = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => { if (k in mockStorage) res[k] = mockStorage[k]; });
        } else if (typeof keys === 'string') {
          if (keys in mockStorage) res[keys] = mockStorage[keys];
        }
        cb(res);
      },
      set(items, cb) {
        Object.assign(mockStorage, items);
        if (cb) cb();
      },
      clear(cb) {
        for (const k in mockStorage) delete mockStorage[k];
        if (cb) cb();
      }
    }
  }
};

const { StorageManager } = require('../shared/storage.js');

(async () => {
  // First run: should initialize with sample stocks
  const initialStocks = await StorageManager.getStocks();
  assert.ok(initialStocks.length > 0, 'Initial run should return default stocks');

  // Add a broker holding stock
  await StorageManager.upsertStocksFromBroker([
    { symbol: 'TCS', name: 'Tata Consultancy Services', category: 'holding', source: 'Zerodha Kite' }
  ]);
  // Add a custom watchlist stock
  await StorageManager.addStock('ZOMATO', 'Zomato Ltd', 'watchlist');

  let stocks = await StorageManager.getStocks();
  assert.ok(stocks.some(s => s.symbol === 'TCS' && (s.source === 'Zerodha Kite' || s.category === 'holding')));
  assert.ok(stocks.some(s => s.symbol === 'ZOMATO' && s.category === 'watchlist'));

  // Test clearHoldings: should remove TCS but retain ZOMATO
  await StorageManager.clearHoldings();
  stocks = await StorageManager.getStocks();
  assert.strictEqual(stocks.some(s => s.symbol === 'TCS'), false, 'TCS holding should be removed');
  assert.strictEqual(stocks.some(s => s.symbol === 'ZOMATO'), true, 'ZOMATO watchlist should be retained');

  // Now test clearCompleteList: should wipe ALL stocks permanently
  await StorageManager.clearCompleteList();
  stocks = await StorageManager.getStocks();
  assert.strictEqual(stocks.length, 0, 'After clearCompleteList, stocks must be []');

  // Call getStocks() again to ensure empty list does NOT revert to sample stocks
  const stocksAfterReload = await StorageManager.getStocks();
  assert.strictEqual(stocksAfterReload.length, 0, 'Empty stocks list must NOT auto-repopulate sample stocks');

  // Adding a stock to an empty list works seamlessly
  await StorageManager.addStock('INFY', 'Infosys', 'watchlist');
  stocks = await StorageManager.getStocks();
  assert.strictEqual(stocks.length, 1);
  assert.strictEqual(stocks[0].symbol, 'INFY');

  // Clear complete list again
  await StorageManager.clearCompleteList();
  stocks = await StorageManager.getStocks();
  assert.strictEqual(stocks.length, 0, 'Should be cleared back to 0');

  console.log('  ✓ StorageManager clearCompleteList and persistence verified');
  console.log('\n🎉 ALL 6 TEST SUITES PASSED SUCCESSFULLY!');
})();

