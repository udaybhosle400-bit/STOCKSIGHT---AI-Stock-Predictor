const watchlistModel = require('../models/watchlistModel');

async function getWatchlist(req, res, next) {
  try {
    const list = await watchlistModel.getUserWatchlist(req.user.id);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    next(err);
  }
}

async function addToWatchlist(req, res, next) {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ success: false, error: { message: 'Stock symbol is required.', status: 400 } });
    }
    const item = await watchlistModel.addToWatchlist(req.user.id, symbol);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

async function removeFromWatchlist(req, res, next) {
  try {
    const { symbol } = req.params;
    await watchlistModel.removeFromWatchlist(req.user.id, symbol);
    res.json({ success: true, message: `Removed ${symbol} from watchlist.` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist
};
