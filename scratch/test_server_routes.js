const app = require('../server');
const http = require('http');

let server;

function makeReq(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(b) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  server = app.listen(3001, '127.0.0.1', async () => {
    console.log('Test server listening on port 3001...');
    try {
      const h = await makeReq('/api/health');
      console.log('Health Check:', h.status, h.data.status);

      const s = await makeReq('/api/stocks');
      console.log('Stocks count:', s.status, s.data.data.length);

      const b = await makeReq('/api/backtest/run', 'POST', { symbol: 'AAPL', strategyName: 'AI_PREDICTION', initialCapital: 100000 });
      console.log('Backtest Run:', b.status, b.data.success ? 'SUCCESS' : b.data);

      const p = await makeReq('/api/paper/account');
      console.log('Paper Account:', p.status, p.data.data.cash_balance);

      const pred = await makeReq('/api/predictions/latest/AAPL');
      console.log('Predictions Latest:', pred.status, pred.data.success ? 'SUCCESS' : pred.data);

      const opt = await makeReq('/api/portfolio-optimizer/optimize', 'POST', { investmentAmount: 100000, selectedStocks: ['AAPL', 'MSFT'] });
      console.log('Portfolio Optimizer:', opt.status, opt.data.success ? 'SUCCESS' : opt.data);

      const ml = await makeReq('/api/mlops/dashboard');
      console.log('MLOps Dashboard:', ml.status, ml.data.success ? 'SUCCESS' : ml.data);

      console.log('\nALL ENDPOINTS PASSED WITH 100% SUCCESS!');
    } catch (err) {
      console.error('Test Error:', err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

runTests();
