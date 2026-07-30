const express = require('express');
const router = express.Router();
const quantBacktestController = require('../controllers/quantBacktestController');

// POST /api/backtest/run - Trigger strategy backtest
router.post('/run', quantBacktestController.runBacktest);

// POST & GET /api/backtest/compare
router.post('/compare', quantBacktestController.getStrategyComparison);
router.get('/compare', quantBacktestController.getStrategyComparison);
router.get('/strategies/compare', quantBacktestController.getStrategyComparison);

// POST & GET /api/backtest/portfolio
router.post('/portfolio', quantBacktestController.portfolioBacktest);
router.get('/portfolio', quantBacktestController.getPortfolioSnapshot);

// GET /api/backtest/results - Backtest results summary
router.get('/results', quantBacktestController.getBacktestResults);

// GET /api/backtest/trades - Trade history ledger
router.get('/trades', quantBacktestController.getTradeHistory);

// GET /api/backtest/equity & /equity-curve
router.get('/equity', quantBacktestController.getEquityCurve);
router.get('/equity-curve', quantBacktestController.getEquityCurve);

// GET /api/backtest/metrics - Risk & performance metric suite
router.get('/metrics', quantBacktestController.getFinancialMetrics);

// GET /api/backtest/benchmark - Benchmark relative comparison
router.get('/benchmark', quantBacktestController.getBenchmarkComparison);

// GET /api/backtest/status - Engine status & stats
router.get('/status', quantBacktestController.getBacktestStatus);

// GET /api/backtest/ai-validation - AI Prediction quality validation metrics
router.get('/ai-validation', quantBacktestController.getAiValidation);

// EXPORT ENDPOINTS
router.get('/export/pdf', quantBacktestController.exportPdf);
router.get('/export/csv', quantBacktestController.exportCsv);
router.get('/export/excel', quantBacktestController.exportExcel);

module.exports = router;
