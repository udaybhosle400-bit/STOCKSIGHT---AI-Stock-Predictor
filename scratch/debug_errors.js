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
        resolve({ status: res.statusCode, body });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function debug() {
  console.log('--- 1. Backtest Run Debug ---');
  let r1 = await fetchJson('/api/backtest/run', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: { symbol: 'AAPL', strategyName: 'AI_PREDICTION', initialCapital: 100000 } });
  console.log('Status:', r1.status, 'Body:', r1.body);

  console.log('--- 2. Predictions Latest Debug ---');
  let r2 = await fetchJson('/api/predictions/latest/AAPL');
  console.log('Status:', r2.status, 'Body:', r2.body);

  console.log('--- 3. Paper Account Debug ---');
  let r3 = await fetchJson('/api/paper/account');
  console.log('Status:', r3.status, 'Body:', r3.body);
}

debug();
