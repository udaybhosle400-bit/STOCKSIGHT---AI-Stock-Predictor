const quantDataPipelineService = require('../services/quantDataPipelineService');
const companyRegistry = require('../config/companyRegistry');
const logger = require('../utils/logger');

/**
 * Trigger manual or scheduled data pipeline ingestion
 * POST /api/quant/pipeline/ingest
 */
async function triggerPipelineIngestion(req, res, next) {
  try {
    const requestedSymbols = req.body && Array.isArray(req.body.symbols) && req.body.symbols.length > 0
      ? req.body.symbols
      : companyRegistry.getAllSymbols();

    const result = await quantDataPipelineService.runFullIngestion(requestedSymbols);
    res.json({
      success: true,
      message: `Quantitative Data Pipeline Ingestion Completed for ${requestedSymbols.length} companies`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Clean Historical OHLCV Data
 * GET /api/quant/pipeline/ohlcv/:symbol?range=1mo
 */
async function getHistoricalOHLCV(req, res, next) {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const range = req.query.range || '1mo';
    const data = await quantDataPipelineService.getHistoricalOHLCV(symbol, range);
    res.json({ success: true, symbol: symbol, count: data.length, data: data });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Enriched Fundamentals Data
 * GET /api/quant/pipeline/fundamentals/:symbol
 */
async function getFundamentals(req, res, next) {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const data = await quantDataPipelineService.getFundamentals(symbol);
    res.json({ success: true, symbol: symbol, data: data });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Income, Balance, Cash Flow Statements
 * GET /api/quant/pipeline/statements/:symbol
 */
async function getFinancialStatements(req, res, next) {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const data = await quantDataPipelineService.getFinancialStatements(symbol);
    res.json({ success: true, symbol: symbol, count: data.length, data: data });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Live Global Market Overview (Indices, Commodities, Crypto)
 * GET /api/quant/pipeline/market
 */
async function getMarketOverview(req, res, next) {
  try {
    const data = await quantDataPipelineService.getMarketOverview();
    res.json({ success: true, count: data.length, data: data });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Company News Intelligence
 * GET /api/quant/pipeline/news/:symbol
 */
async function getNews(req, res, next) {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const data = await quantDataPipelineService.getNews(symbol);
    res.json({ success: true, symbol: symbol, count: data.length, data: data });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Pipeline Health & Ingestion Statistics
 * GET /api/quant/pipeline/status
 */
function getPipelineStatus(req, res, next) {
  try {
    const status = quantDataPipelineService.getPipelineStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  triggerPipelineIngestion,
  getHistoricalOHLCV,
  getFundamentals,
  getFinancialStatements,
  getMarketOverview,
  getNews,
  getPipelineStatus
};
