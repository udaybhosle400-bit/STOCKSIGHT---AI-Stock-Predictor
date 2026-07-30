const featureEngineeringService = require('../services/featureEngineeringService');
const featureModel = require('../models/featureModel');
const companyRegistry = require('../config/companyRegistry');
const logger = require('../utils/logger');

/**
 * GET all engineered features for a symbol
 * GET /api/features/:symbol?category=technical
 */
async function getFeaturesBySymbol(req, res, next) {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const category = req.query.category;
    const records = await featureModel.getSymbolFeatures(symbol, category);
    res.json({
      success: true,
      symbol: symbol,
      category: category || 'all',
      count: records.length,
      data: records
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET latest snapshot of engineered features for a symbol
 * GET /api/features/:symbol/latest
 */
async function getLatestFeatures(req, res, next) {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const snapshot = await featureModel.getLatestFeatures(symbol);
    res.json({
      success: true,
      data: snapshot
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Trigger manual or batch feature generation across master registry
 * POST /api/features/generate
 */
async function triggerFeatureGeneration(req, res, next) {
  try {
    const requestedSymbols = req.body && Array.isArray(req.body.symbols) && req.body.symbols.length > 0
      ? req.body.symbols
      : companyRegistry.getAllSymbols();

    const result = await featureEngineeringService.generateAllFeatures(requestedSymbols);
    res.json({
      success: true,
      message: `Feature Engineering generation completed for ${requestedSymbols.length} companies`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET feature store monitoring status & health statistics
 * GET /api/features/status
 */
async function getFeatureStatus(req, res, next) {
  try {
    const stats = await featureModel.getFeatureStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFeaturesBySymbol,
  getLatestFeatures,
  triggerFeatureGeneration,
  getFeatureStatus
};
