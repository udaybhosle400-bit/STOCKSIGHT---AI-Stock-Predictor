const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/', alertController.getAlerts);
router.post('/', alertController.createAlert);
router.delete('/:id', alertController.deleteAlert);

module.exports = router;
