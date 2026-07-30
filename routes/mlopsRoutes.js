const express = require('express');
const router = express.Router();
const mlopsController = require('../controllers/mlopsController');
const { apiLimiter: apiRateLimiter } = require('../middleware/rateLimiter');

router.get('/dashboard', mlopsController.getDashboard);
router.post('/retrain', apiRateLimiter, mlopsController.triggerRetraining);
router.post('/promote', apiRateLimiter, mlopsController.promoteModel);
router.post('/rollback', apiRateLimiter, mlopsController.rollbackModel);
router.get('/drift', mlopsController.getDriftMetrics);
router.get('/monitoring', mlopsController.getMonitoring);

module.exports = router;
