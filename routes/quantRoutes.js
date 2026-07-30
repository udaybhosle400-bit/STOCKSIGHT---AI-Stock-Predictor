const express = require('express');
const router = express.Router();
const quantController = require('../controllers/quantController');
const { apiLimiter: apiRateLimiter } = require('../middleware/rateLimiter');

// Public / Authenticated Quant Analysis endpoints
router.post('/analytics', apiRateLimiter, quantController.getPortfolioAnalytics);
router.post('/backtest', apiRateLimiter, quantController.runBacktest);
router.post('/optimize', apiRateLimiter, quantController.optimizePortfolio);
router.post('/correlation', apiRateLimiter, quantController.getCorrelationMatrix);
router.post('/risk', apiRateLimiter, quantController.getRiskAnalytics);

module.exports = router;
