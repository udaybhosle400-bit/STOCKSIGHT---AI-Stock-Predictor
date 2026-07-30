const paperTradingService = require('../services/paperTradingService');
const paperTradingModel = require('../models/paperTradingModel');

async function getAccountSummary(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 1;
    const summary = await paperTradingService.getPortfolioSummary(userId);
    res.json({
      success: true,
      data: summary.account
    });
  } catch (err) {
    next(err);
  }
}

async function executeTrade(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 1;
    const { symbol, tradeType, shares } = req.body;

    const result = await paperTradingService.executeTrade(userId, { symbol, tradeType, shares });
    res.status(201).json({
      success: true,
      message: `Successfully executed ${tradeType} order for ${shares} shares of ${symbol.toUpperCase()}.`,
      data: result
    });
  } catch (err) {
    if (err.status && err.message) {
      return res.status(err.status).json({
        success: false,
        error: { message: err.message, status: err.status }
      });
    }
    next(err);
  }
}

async function getHoldings(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 1;
    const summary = await paperTradingService.getPortfolioSummary(userId);
    res.json({
      success: true,
      count: summary.holdings.length,
      data: summary.holdings
    });
  } catch (err) {
    next(err);
  }
}

async function getTradeHistory(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 1;
    const trades = await paperTradingModel.getTradeHistory(userId);
    res.json({
      success: true,
      count: trades.length,
      data: trades
    });
  } catch (err) {
    next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 1;
    const [summary, sectorAllocation, equityCurve] = await Promise.all([
      paperTradingService.getPortfolioSummary(userId),
      paperTradingService.getSectorAllocation(userId),
      paperTradingService.getEquityCurve(userId)
    ]);

    res.json({
      success: true,
      data: {
        summary: summary.account,
        sectorAllocation,
        equityCurve
      }
    });
  } catch (err) {
    next(err);
  }
}

async function resetAccount(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 1;
    const account = await paperTradingService.resetAccount(userId);
    res.json({
      success: true,
      message: 'Paper trading account reset back to default ₹10,00,000 balance.',
      data: account
    });
  } catch (err) {
    next(err);
  }
}

async function depositFunds(req, res, next) {
  try {
    const userId = req.user ? req.user.id : 1;
    const { amount } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid deposit amount' } });
    }
    const account = await paperTradingModel.getAccount(userId);
    const newBal = account.balance + amt;
    await paperTradingModel.updateBalance(userId, newBal);
    res.json({ success: true, data: { balance: newBal } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAccountSummary,
  executeTrade,
  getHoldings,
  getTradeHistory,
  getAnalytics,
  resetAccount,
  depositFunds
};
