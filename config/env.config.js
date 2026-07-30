const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // JWT Security Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_jwt_secret_key_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_jwt_refresh_secret_key_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  // Database Configuration
  db: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'stocksight_db'
  },

  // API Keys
  fmpApiKey: process.env.FMP_API_KEY || '',
  finnhubApiKey: process.env.FINNHUB_API_KEY || '',

  // Cache Configuration (in seconds)
  cache: {
    ttlPrice: parseInt(process.env.CACHE_TTL_PRICE || '30', 10),           // 30 seconds
    ttlNews: parseInt(process.env.CACHE_TTL_NEWS || '600', 10),            // 10 minutes (600s)
    ttlFundamentals: parseInt(process.env.CACHE_TTL_FUNDAMENTALS || '3600', 10) // 1 hour (3600s)
  },

  // Rate Limiter Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  }
};

module.exports = config;
