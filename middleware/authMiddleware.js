const jwt = require('jsonwebtoken');
const config = require('../config/env.config');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Access Denied: Missing authorization Bearer token.',
        status: 401
      }
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded; // { id, email, name }
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Access Denied: Invalid or expired access token.',
        status: 403
      }
    });
  }
}

module.exports = {
  authenticateToken
};
