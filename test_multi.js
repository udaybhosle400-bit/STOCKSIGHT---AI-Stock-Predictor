const https = require('https');
const companyRegistry = require('./config/companyRegistry');

const sampleSymbols = companyRegistry.getAllSymbols();

sampleSymbols.forEach(sym => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1m`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(raw);
        const meta = json?.chart?.result?.[0]?.meta;
        if (meta) {
          const price = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || meta.previousClose;
          const chg = ((price - prev) / prev) * 100;
          console.log(`${sym.padEnd(15)} | CMP: ₹${price.toFixed(2).padStart(8)} | Chg: ${chg.toFixed(2).padStart(6)}% | 52W High: ₹${meta.fiftyTwoWeekHigh?.toFixed(2)} | 52W Low: ₹${meta.fiftyTwoWeekLow?.toFixed(2)}`);
        }
      } catch(e) {}
    });
  });
});
