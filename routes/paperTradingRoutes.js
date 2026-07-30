const express = require('express');
const router = express.Router();
const paperTradingController = require('../controllers/paperTradingController');
const { apiLimiter: apiRateLimiter } = require('../middleware/rateLimiter');

router.get('/account', paperTradingController.getAccountSummary);
router.post('/trade', apiRateLimiter, paperTradingController.executeTrade);
router.get('/holdings', paperTradingController.getHoldings);
router.get('/trades', paperTradingController.getTradeHistory);
router.get('/analytics', paperTradingController.getAnalytics);
router.post('/reset', paperTradingController.resetAccount);
router.post('/deposit', paperTradingController.depositFunds);

module.exports = router;
