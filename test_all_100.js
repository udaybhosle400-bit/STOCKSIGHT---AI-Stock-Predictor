const https = require('https');
const companyRegistry = require('./config/companyRegistry');

const all100Symbols = companyRegistry.getAllSymbols();

let successCount = 0;
let failCount = 0;

console.log(`Testing Yahoo Live Quote Fetching for all ${all100Symbols.length} NSE stocks...`);

all100Symbols.forEach((sym, i) => {
  setTimeout(() => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1m`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          const meta = json?.chart?.result?.[0]?.meta;
          if (meta && meta.regularMarketPrice) {
            successCount++;
            console.log(`[${successCount + failCount}/${all100Symbols.length}] ✅ ${sym.padEnd(15)} CMP: ₹${meta.regularMarketPrice} | 52W H/L: ₹${meta.fiftyTwoWeekHigh} / ₹${meta.fiftyTwoWeekLow}`);
          } else {
            failCount++;
            console.log(`[${successCount + failCount}/${all100Symbols.length}] ❌ ${sym} (No price)`);
          }
        } catch(e) {
          failCount++;
        }
      });
    }).on('error', () => { failCount++; });
  }, i * 50);
});
