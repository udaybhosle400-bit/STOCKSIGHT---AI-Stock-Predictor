const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { validateSymbol } = require('../middleware/validationMiddleware');
const { apiLimiter: apiRateLimiter } = require('../middleware/rateLimiter');

// GET /api/stock/:symbol - Aggregated Yahoo + FMP + Finnhub endpoint
router.get('/stock/:symbol', apiRateLimiter, validateSymbol, stockController.getStockBySymbol);

// GET /api/stocks - Universe list
router.get('/stocks', stockController.getStocks);

// GET /api/stocks/:symbol - Single stock detail
router.get('/stocks/:symbol', validateSymbol, stockController.getLegacyStockDetail);

// GET /api/stocks/:symbol/live-quote - On-demand quote
router.get('/stocks/:symbol/live-quote', validateSymbol, stockController.getLiveQuoteOnDemand);

// GET /api/screens - Stock screener
router.get('/screens', stockController.getScreens);

// GET /api/market/widgets - Live market widgets (Indices, Commodities, Crypto)
router.get('/market/widgets', stockController.getMarketWidgets);

// GET /api/market/details/:symbol - Live candlestick history for any index/commodity/crypto
router.get('/market/details/:symbol', stockController.getMarketDetails);

// GET /api/market/treemap - Live market treemap
router.get('/market/treemap', stockController.getTreemapData);

// GET /api/stock/:symbol/report/pdf - Automatic downloadable PDF report
router.get('/stock/:symbol/report/pdf', validateSymbol, stockController.generatePdfReport);
router.get('/report/pdf/:symbol', validateSymbol, stockController.generatePdfReport);

// GET /api/stock/:symbol/report/csv - Automatic downloadable CSV report
router.get('/stock/:symbol/report/csv', validateSymbol, stockController.generateCsvReport);
router.get('/report/csv/:symbol', validateSymbol, stockController.generateCsvReport);

// GET /api/stock/:symbol/report/excel - Automatic downloadable Excel report
router.get('/stock/:symbol/report/excel', validateSymbol, stockController.generateExcelReport);
router.get('/report/excel/:symbol', validateSymbol, stockController.generateExcelReport);

// GET /api/stream/prices - Real-time SSE stream
router.get('/stream/prices', stockController.handlePriceStream);

module.exports = router;
