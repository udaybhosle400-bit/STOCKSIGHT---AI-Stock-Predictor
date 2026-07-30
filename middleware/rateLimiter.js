const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // High limit to allow seamless authentication and testing
  message: {
    status: 429,
    error: 'Too Many Auth Requests',
    message: 'Too many login/registration attempts. Please try again later.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter
};
