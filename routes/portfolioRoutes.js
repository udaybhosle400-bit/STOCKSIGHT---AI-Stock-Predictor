const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolioController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/', portfolioController.getPortfolio);
router.post('/', portfolioController.addOrUpdatePosition);
router.delete('/:symbol', portfolioController.deletePosition);

module.exports = router;
