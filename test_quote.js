const https = require('https');

function fetchChart(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1m`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(raw);
        const meta = json?.chart?.result?.[0]?.meta;
        console.log(`\n--- CHART META FOR ${sym} ---`);
        console.log('regularMarketPrice:', meta?.regularMarketPrice);
        console.log('chartPreviousClose:', meta?.chartPreviousClose);
        console.log('fiftyTwoWeekHigh:', meta?.fiftyTwoWeekHigh);
        console.log('fiftyTwoWeekLow:', meta?.fiftyTwoWeekLow);
      } catch(e) { console.error('chart error:', e.message); }
    });
  });
}

function fetchSummary(sym) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=price,summaryDetail,defaultKeyStatistics,financialData`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(raw);
        const price = json?.quoteSummary?.result?.[0]?.price;
        const stats = json?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
        const summary = json?.quoteSummary?.result?.[0]?.summaryDetail;
        console.log(`\n--- QUOTE SUMMARY FOR ${sym} ---`);
        console.log('regularMarketPrice:', price?.regularMarketPrice?.raw);
        console.log('marketCap:', price?.marketCap?.raw ? (price.marketCap.raw / 10000000).toFixed(0) + ' Cr' : null);
        console.log('fiftyTwoWeekHigh:', summary?.fiftyTwoWeekHigh?.raw);
        console.log('fiftyTwoWeekLow:', summary?.fiftyTwoWeekLow?.raw);
        console.log('bookValue:', stats?.bookValue?.raw);
        console.log('trailingPE:', summary?.trailingPE?.raw);
      } catch(e) { console.error('summary error:', e.message); }
    });
  });
}

fetchChart('ICICIBANK.NS');
fetchSummary('ICICIBANK.NS');
