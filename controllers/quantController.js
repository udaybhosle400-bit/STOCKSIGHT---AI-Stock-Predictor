const quantService = require('../services/quantService');
const portfolioModel = require('../models/portfolioModel');
const logger = require('../utils/logger');

async function getPortfolioAnalytics(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    let positions = req.body.positions;

    if (!positions && userId) {
      positions = await portfolioModel.getUserPortfolio(userId);
    }

    const benchmarkSymbol = req.body.benchmark || '^GSPC';
    const analytics = await quantService.calculatePortfolioAnalytics(positions || [], benchmarkSymbol);

    res.json({
      success: true,
      data: analytics
    });
  } catch (err) {
    next(err);
  }
}

async function runBacktest(req, res, next) {
  try {
    const { symbol, strategy, params, initialCapital } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: { message: 'Stock symbol is required for backtesting.', status: 400 }
      });
    }

    const stratName = strategy || 'RSI';
    const capital = parseFloat(initialCapital) || 10000;

    const result = await quantService.runBacktest(symbol, stratName, params || {}, capital);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function optimizePortfolio(req, res, next) {
  try {
    const { symbols, simulations } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'Please provide at least 2 stock symbols in an array.', status: 400 }
      });
    }

    const numSims = parseInt(simulations || '3000', 10);
    const result = await quantService.optimizePortfolio(symbols, numSims);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getCorrelationMatrix(req, res, next) {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length < 1) {
      return res.status(400).json({
        success: false,
        error: { message: 'Please provide stock symbols array for correlation matrix.', status: 400 }
      });
    }

    const result = await quantService.calculateCorrelationMatrix(symbols);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getRiskAnalytics(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    let positions = req.body.positions;

    if (!positions && userId) {
      positions = await portfolioModel.getUserPortfolio(userId);
    }

    const benchmarkSymbol = req.body.benchmark || '^GSPC';
    const riskData = await quantService.calculateRiskAnalytics(positions || [], benchmarkSymbol);

    res.json({
      success: true,
      data: riskData
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPortfolioAnalytics,
  runBacktest,
  optimizePortfolio,
  getCorrelationMatrix,
  getRiskAnalytics
};
