const express = require('express');
const router = express.Router();
const quantPipelineController = require('../controllers/quantPipelineController');

// POST /api/quant/pipeline/ingest - Manual or scheduled pipeline ingestion
router.post('/pipeline/ingest', quantPipelineController.triggerPipelineIngestion);

// GET /api/quant/pipeline/status - Pipeline health & ingestion statistics
router.get('/pipeline/status', quantPipelineController.getPipelineStatus);

// GET /api/quant/pipeline/ohlcv/:symbol - Clean historical OHLCV data
router.get('/pipeline/ohlcv/:symbol', quantPipelineController.getHistoricalOHLCV);

// GET /api/quant/pipeline/fundamentals/:symbol - Enriched fundamental ratios & metrics
router.get('/pipeline/fundamentals/:symbol', quantPipelineController.getFundamentals);

// GET /api/quant/pipeline/statements/:symbol - Income, Balance, Cash Flow statements
router.get('/pipeline/statements/:symbol', quantPipelineController.getFinancialStatements);

// GET /api/quant/pipeline/market - Global market indices, commodities, crypto
router.get('/pipeline/market', quantPipelineController.getMarketOverview);

// GET /api/quant/pipeline/news/:symbol - Institutional company news
router.get('/pipeline/news/:symbol', quantPipelineController.getNews);

module.exports = router;
