const portfolioModel = require('../models/portfolioModel');

async function getPortfolio(req, res, next) {
  try {
    const holdings = await portfolioModel.getUserPortfolio(req.user.id);
    res.json({ success: true, count: holdings.length, data: holdings });
  } catch (err) {
    next(err);
  }
}

async function addOrUpdatePosition(req, res, next) {
  try {
    const { symbol, shares, averagePrice } = req.body;
    if (!symbol || shares === undefined || averagePrice === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Symbol, shares, and averagePrice are required.', status: 400 } 
      });
    }
    const position = await portfolioModel.addOrUpdatePosition(req.user.id, symbol, shares, averagePrice);
    res.status(200).json({ success: true, data: position });
  } catch (err) {
    next(err);
  }
}

async function deletePosition(req, res, next) {
  try {
    const { symbol } = req.params;
    await portfolioModel.deletePosition(req.user.id, symbol);
    res.json({ success: true, message: `Removed position for ${symbol}.` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPortfolio,
  addOrUpdatePosition,
  deletePosition
};
