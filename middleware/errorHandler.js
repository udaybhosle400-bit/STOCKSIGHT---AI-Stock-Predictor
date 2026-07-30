const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`[${req.method}] ${req.originalUrl} - ${status}: ${message}`, {
    stack: err.stack,
    ip: req.ip
  });

  res.status(status).json({
    success: false,
    error: {
      message,
      status
    }
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: `Resource not found: ${req.originalUrl}`,
      status: 404
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
