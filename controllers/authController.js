const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env.config');
const userModel = require('../models/userModel');
const logger = require('../utils/logger');

function generateTokens(user) {
  const payload = { id: user.id, email: user.email, name: user.name };
  const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
  return { accessToken, refreshToken };
}

async function signup(req, res, next) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email and password (min 6 characters) are required.', status: 400 }
      });
    }

    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { message: 'An account with this email already exists.', status: 409 }
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await userModel.create({ email, passwordHash, name });

    const tokens = generateTokens(newUser);
    await userModel.updateRefreshToken(newUser.id, tokens.refreshToken);

    logger.info(`Auth: New user signed up successfully [ID: ${newUser.id}, Email: ${newUser.email}]`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
      tokens
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email and password are required.', status: 400 }
      });
    }

    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.', status: 401 }
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.', status: 401 }
      });
    }

    const tokens = generateTokens(user);
    await userModel.updateRefreshToken(user.id, tokens.refreshToken);

    logger.info(`Auth: User logged in [ID: ${user.id}, Email: ${user.email}]`);

    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      tokens
    });
  } catch (err) {
    next(err);
  }
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { message: 'Refresh token is required.', status: 400 }
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret);
    } catch (e) {
      return res.status(403).json({
        success: false,
        error: { message: 'Invalid or expired refresh token.', status: 403 }
      });
    }

    const user = await userModel.findById(decoded.id);
    if (!user || user.refresh_token !== token) {
      return res.status(403).json({
        success: false,
        error: { message: 'Revoked or invalid refresh token.', status: 403 }
      });
    }

    const tokens = generateTokens(user);
    await userModel.updateRefreshToken(user.id, tokens.refreshToken);

    res.json({
      success: true,
      tokens
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    if (userId) {
      await userModel.updateRefreshToken(userId, null);
    }
    res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found.', status: 404 } });
    }
    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  signup,
  login,
  refreshToken,
  logout,
  getProfile
};
