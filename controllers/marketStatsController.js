// controllers/marketStatsController.js
// Provides professional market statistics for a given stock symbol.
// This is a mock implementation returning deterministic data.

const generateMarketStats = (symbol) => {
  // Simple deterministic pseudo‑random values based on symbol hash.
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const random = (factor) => ((seed * factor) % 97) + 3; // 3‑99 range

  return {
    symbol,
    open: Number((random(1) * 0.95).toFixed(2)),
    high: Number((random(2) * 1.10).toFixed(2)),
    low: Number((random(3) * 0.90).toFixed(2)),
    previousClose: Number((random(4) * 0.97).toFixed(2)),
    volume: Math.round(random(5) * 1000000),
    vwap: Number((random(6) * 0.98).toFixed(2)),
    beta: Number((random(7) / 10).toFixed(2)),
    atr: Number((random(8) * 0.05).toFixed(2)),
    volatility: Number((random(9) * 0.02).toFixed(2)),
  };
};

exports.getMarketStats = async (req, res, next) => {
  try {
    const symbol = req.params.symbol?.toUpperCase() || 'AAPL';
    const data = generateMarketStats(symbol);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
