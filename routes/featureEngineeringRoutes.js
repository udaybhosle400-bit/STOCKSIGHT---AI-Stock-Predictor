const express = require('express');
const router = express.Router();
const featureEngineeringController = require('../controllers/featureEngineeringController');

// GET /api/features/status - Feature Store health & monitoring stats
router.get('/status', featureEngineeringController.getFeatureStatus);

// POST /api/features/generate - Trigger manual or batch feature generation
router.post('/generate', featureEngineeringController.triggerFeatureGeneration);

// GET /api/features/:symbol/latest - Get latest engineered feature snapshot for symbol
router.get('/:symbol/latest', featureEngineeringController.getLatestFeatures);

// GET /api/features/:symbol - Get all historical engineered features for symbol
router.get('/:symbol', featureEngineeringController.getFeaturesBySymbol);

module.exports = router;
