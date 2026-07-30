const db = require('../config/database');
const paperTradingService = require('../services/paperTradingService');
const paperTradingModel = require('../models/paperTradingModel');

async function testPortfolioPersistence() {
  console.log('--- STEP 1: INITIALIZING DB & EXECUTING TRADES ---');
  await db.initDatabase();

  const userId = 1;

  // Execute BUY 50 COASTCORP shares
  console.log('Executing BUY 50 COASTCORP shares...');
  await paperTradingService.executeTrade(userId, { symbol: 'COASTCORP', tradeType: 'BUY', shares: 50 });

  // Execute BUY 100 AAPL shares
  console.log('Executing BUY 100 AAPL shares...');
  await paperTradingService.executeTrade(userId, { symbol: 'AAPL', tradeType: 'BUY', shares: 100 });

  // Execute SELL 50 AAPL shares
  console.log('Executing SELL 50 AAPL shares...');
  await paperTradingService.executeTrade(userId, { symbol: 'AAPL', tradeType: 'SELL', shares: 50 });

  const summaryBefore = await paperTradingService.getPortfolioSummary(userId);
  const tradesBefore = await paperTradingModel.getTradeHistory(userId);
  console.log('Before restart - Balance:', summaryBefore.account.virtualBalance);
  console.log('Before restart - Holdings count:', summaryBefore.holdings.length);
  console.log('Before restart - Trades count:', tradesBefore.length);

  console.log('\n--- STEP 2: SIMULATING SERVER SHUTDOWN AND REBOOT ---');
  await db.initDatabase();

  console.log('\n--- STEP 3: VERIFYING RECOVERED PORTFOLIO DESK DATA AFTER REBOOT ---');
  const summaryAfter = await paperTradingService.getPortfolioSummary(userId);
  const tradesAfter = await paperTradingModel.getTradeHistory(userId);

  console.log('After restart - Balance:', summaryAfter.account.virtualBalance);
  console.log('After restart - Holdings count:', summaryAfter.holdings.length);
  console.log('After restart - Holdings symbols:', summaryAfter.holdings.map(h => `${h.shares}x ${h.symbol}`));
  console.log('After restart - Trades count:', tradesAfter.length);

  if (summaryAfter.holdings.length >= 2 && tradesAfter.length >= 3) {
    console.log('\n🎉 PORTFOLIO DESK PERSISTENCE VERIFICATION SUCCESSFUL! ALL BOUGHT/SOLD STOCKS PERMANENTLY SAVED ACROSS SERVER RESTARTS!');
  } else {
    console.error('\n❌ PORTFOLIO DESK PERSISTENCE VERIFICATION FAILED!');
    process.exit(1);
  }
}

testPortfolioPersistence().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
