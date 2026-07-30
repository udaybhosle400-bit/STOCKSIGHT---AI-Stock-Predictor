const express = require('express');
const router = express.Router();
const portfolioOptimizerController = require('../controllers/portfolioOptimizerController');

router.post('/optimize', portfolioOptimizerController.optimizePortfolio);
router.post('/monte-carlo', portfolioOptimizerController.runMonteCarlo);
router.post('/risk-analytics', portfolioOptimizerController.getRiskAnalytics);
router.post('/diversification', portfolioOptimizerController.getDiversification);
router.post('/ai-recommendations', portfolioOptimizerController.getAiRecommendations);
router.post('/stress-test', portfolioOptimizerController.runStressTest);

module.exports = router;
