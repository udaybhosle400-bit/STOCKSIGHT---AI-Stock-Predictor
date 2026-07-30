/**
 * Utility functions for input validation and sanitization
 */

function sanitizeSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return '';
  // Uppercase and allow alphanumeric, dots, dashes, and carets (e.g. AAPL, RELIANCE.NS, ^GSPC, BRK-B)
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9.\-^]/g, '');
}

function isValidSymbol(symbol) {
  const sanitized = sanitizeSymbol(symbol);
  return sanitized.length >= 1 && sanitized.length <= 20;
}

function parseNumberOrDefault(val, defaultVal = 0) {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
}

module.exports = {
  sanitizeSymbol,
  isValidSymbol,
  parseNumberOrDefault
};
