const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predictionController');

// Public & Service AI Prediction Endpoints
router.get('/screener', predictionController.getPredictionScreener);
router.get('/models', predictionController.getModelComparison);
router.get('/status', predictionController.getPredictionStatus);

router.post('/train', predictionController.trainModels);
router.post('/retrain', predictionController.retrainModels);

router.get('/multi-horizon/:symbol', predictionController.getMultiHorizonForecast);
router.get('/forecast-chart/:symbol', predictionController.getForecastChartData);
router.get('/xai/:symbol', predictionController.getXaiAnalysis);
router.get('/history-comparison/:symbol', predictionController.getHistoryComparison);

router.get('/latest/:symbol', predictionController.getLatestPrediction);
router.get('/:symbol', predictionController.getPredictionsBySymbol);

// Legacy History & Save Endpoints
router.get('/history/all', predictionController.getPredictionHistory);
router.post('/save', predictionController.savePrediction);

module.exports = router;
