const http = require('http');

function fetchJson(path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOpts = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOpts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function auditPlatform() {
  console.log('=== STOCKSIGHT PLATFORM FULL HEALTH & FUNCTIONALITY AUDIT ===\n');

  const tests = [
    { name: 'Health Check', path: '/api/health' },
    { name: 'Stocks List', path: '/api/stocks' },
    { name: 'Stock Screener API', path: '/api/screens?type=FII%20Buying' },
    { name: 'Quant Backtest Run (Single Asset)', path: '/api/backtest/run', method: 'POST', body: { symbol: 'AAPL', strategyName: 'AI_PREDICTION', initialCapital: 100000 } },
    { name: 'Quant Backtest Multi-Strategy Compare', path: '/api/backtest/strategies/compare?symbol=AAPL' },
    { name: 'AI Predictions Latest', path: '/api/predictions/latest/AAPL' },
    { name: 'Portfolio Optimizer Run', path: '/api/portfolio-optimizer/optimize', method: 'POST', body: { investmentAmount: 100000, selectedStocks: ['AAPL', 'MSFT'] } },
    { name: 'Enterprise MLOps Dashboard', path: '/api/mlops/dashboard' },
    { name: 'Paper Trading Account', path: '/api/paper/account' }
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      const res = await fetchJson(t.path, {
        method: t.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: t.body
      });
      if (res.status >= 200 && res.status < 300) {
        console.log(`[PASS] ${t.name} -> HTTP ${res.status}`);
        passed++;
      } else {
        console.error(`[FAIL] ${t.name} -> HTTP ${res.status}`);
      }
    } catch (e) {
      console.error(`[FAIL] ${t.name} -> Error: ${e.message}`);
    }
  }

  console.log(`\nResults: ${passed}/${tests.length} tests passed.`);
  if (passed === tests.length) {
    console.log('🎉 PLATFORM AUDIT SUCCESSFUL! 100% WORKING CONDITION.');
  } else {
    process.exit(1);
  }
}

auditPlatform().catch(err => {
  console.error(err);
  process.exit(1);
});
