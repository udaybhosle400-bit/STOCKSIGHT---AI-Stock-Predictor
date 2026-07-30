const { isValidSymbol, sanitizeSymbol } = require('../utils/validators');

function validateSymbol(req, res, next) {
  const symbol = req.params.symbol;
  if (!symbol || !isValidSymbol(symbol)) {
    return res.status(400).json({
      success: false,
      error: {
        message: `Invalid stock symbol: '${symbol}'. Symbol must be between 1 and 20 alphanumeric characters.`,
        status: 400
      }
    });
  }
  
  // Attach sanitized symbol to request
  req.sanitizedSymbol = sanitizeSymbol(symbol);
  next();
}

module.exports = {
  validateSymbol
};
