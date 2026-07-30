const db = require('../config/database');
const watchlistModel = require('../models/watchlistModel');
const paperTradingModel = require('../models/paperTradingModel');
const aiPredictionModel = require('../models/aiPredictionModel');
const mlopsService = require('../services/mlopsService');
const reportService = require('../services/reportService');

async function testPersistenceFlow() {
  console.log('--- PHASE 1: INITIALIZING DATABASE & WRITING DATA ---');
  await db.initDatabase();

  const userId = 1;

  // 1. Add stocks to Watchlist
  console.log('1. Adding stocks to watchlist...');
  await watchlistModel.addToWatchlist(userId, 'COASTCORP');
  await watchlistModel.addToWatchlist(userId, 'AAPL');

  // 2. Create Paper Trade & Holding
  console.log('2. Recording paper trade and position...');
  await paperTradingModel.recordTrade({
    userId,
    symbol: 'AAPL',
    tradeType: 'BUY',
    shares: 50,
    price: 150.25,
    totalAmount: 7512.50,
    realizedPnL: 0
  });
  await paperTradingModel.upsertHolding(userId, 'AAPL', 50, 150.25);
  await paperTradingModel.updateBalance(userId, 992487.50);

  // 3. Save AI Prediction
  console.log('3. Saving AI prediction record...');
  await aiPredictionModel.saveAIPrediction({
    symbol: 'AAPL',
    currentPrice: 150.25,
    predictedPrice: 245.50,
    predictedReturn: 63.39,
    signal: 'STRONG_BUY',
    confidenceScore: 94.5,
    expectedVolatility: 1.2,
    expectedRisk: 'LOW',
    probIncrease: 88.5,
    return5d: 2.1,
    return7d: 4.2,
    return30d: 12.5,
    topFeatures: ['RSI', 'MACD'],
    xaiReasons: ['Bullish momentum crossover'],
    bestModel: 'Ensemble XGBoost + LSTM',
    modelVersion: 'v3.5.0'
  });

  // 4. Save MLOps Model Record
  console.log('4. Promoting MLOps model...');
  await db.query(
    `INSERT INTO mlops_models (id, version, name, status, accuracy, dir_accuracy, rmse, mae, mape, latency_p95_ms, trained_at, author)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
    ['m-persisted-999', 'v9.9.9 Persistent Stack', 'Persistent Multi-Model Stack', 'CHAMPION', 98.5, '97.2%', 0.85, 0.62, 0.55, 15, new Date().toISOString(), 'Persistent-Tester']
  );

  // 5. Save Report
  console.log('5. Saving report record...');
  await reportService.saveReportRecord(userId, 'AAPL', 'Persistent Quant Report - AAPL', 'PDF', { status: 'PERSISTED' });

  console.log('✅ Data written successfully to PostgreSQL!');

  console.log('\n--- PHASE 2: SIMULATING SERVER SHUTDOWN & RESTART ---');
  // Re-initialize database (simulating fresh server boot)
  await db.initDatabase();

  console.log('\n--- PHASE 3: VERIFYING RECOVERED DATA AFTER SERVER RESTART ---');

  // Verify Watchlist
  const watchlist = await watchlistModel.getUserWatchlist(userId);
  console.log('Watchlist Count:', watchlist.length);
  const hasCoastcorp = watchlist.some(w => w.symbol === 'COASTCORP');
  const hasAapl = watchlist.some(w => w.symbol === 'AAPL');
  console.log('Watchlist Has COASTCORP:', hasCoastcorp, '| Has AAPL:', hasAapl);

  // Verify Paper Holdings & Trades
  const holdings = await paperTradingModel.getHoldings(userId);
  console.log('Paper Holdings Count:', holdings.length);
  const aaplHolding = holdings.find(h => h.symbol === 'AAPL');
  console.log('AAPL Holding Shares:', aaplHolding ? aaplHolding.shares : 0, '| Avg Price:', aaplHolding ? aaplHolding.average_price : 0);

  const trades = await paperTradingModel.getTradeHistory(userId);
  console.log('Paper Trade History Count:', trades.length);
  const lastTrade = trades[0];
  console.log('Last Trade:', lastTrade ? `${lastTrade.tradeType} ${lastTrade.shares} shares ${lastTrade.symbol} @ $${lastTrade.price}` : 'None');

  const account = await paperTradingModel.getAccount(userId);
  console.log('Account Balance:', account.balance);

  // Verify AI Predictions
  const latestPred = await aiPredictionModel.getLatestPrediction('AAPL');
  console.log('Latest AI Prediction for AAPL:', latestPred ? `Predicted: $${latestPred.predicted_price} | Signal: ${latestPred.signal} | Conf: ${latestPred.confidence_score}%` : 'None');

  // Verify MLOps Models
  const mlopsData = await mlopsService.getDashboardData();
  const championModel = mlopsData.championModel;
  console.log('Champion MLOps Model after restart:', championModel ? championModel.version : 'None');

  // Verify Reports
  const savedReports = await reportService.getSavedReports(userId);
  console.log('Saved Reports Count:', savedReports.length, '| Latest Title:', savedReports[0] ? savedReports[0].report_title : 'None');

  if (hasCoastcorp && hasAapl && aaplHolding && trades.length > 0 && latestPred && championModel.version === 'v9.9.9 Persistent Stack' && savedReports.length > 0) {
    console.log('\n🎉 PERSISTENCE VERIFICATION SUCCESSFUL! ALL DATA SURVIVED SERVER RESTART WITHOUT LOSS!');
  } else {
    console.error('\n❌ PERSISTENCE VERIFICATION FAILED! SOME RECORDS MISSING!');
    process.exit(1);
  }
}

testPersistenceFlow().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
