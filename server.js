const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const config = require('./config/env.config');
const logger = require('./utils/logger');
const fs = require('fs');
const { initDatabase } = require('./config/database');
const setupSwagger = require('./swagger/swaggerConfig');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');

// Route Imports
const stockRoutes = require('./routes/stockRoutes');
const authRoutes = require('./routes/authRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const alertRoutes = require('./routes/alertRoutes');
const quantRoutes = require('./routes/quantRoutes');
const quantPipelineRoutes = require('./routes/quantPipelineRoutes');
const featureEngineeringRoutes = require('./routes/featureEngineeringRoutes');
const quantBacktestRoutes = require('./routes/quantBacktestRoutes');
// Research routes removed
const paperTradingRoutes = require('./routes/paperTradingRoutes');
const portfolioOptimizerRoutes = require('./routes/portfolioOptimizerRoutes');
const mlopsRoutes = require('./routes/mlopsRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply Rate Limiting
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/v1/auth', authLimiter);

// Request Logger
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/stream')) {
    logger.info(`[${req.method}] ${req.url}`);
  }
  next();
});

// Setup Swagger Documentation at /api-docs
setupSwagger(app);

// Resolve Frontend Static Files Path
const getFrontendDir = () => {
  if (fs.existsSync(path.join(__dirname, 'index.html'))) {
    return __dirname;
  } else if (fs.existsSync(path.join(__dirname, '../index.html'))) {
    return path.join(__dirname, '..');
  } else if (fs.existsSync(path.join(__dirname, '../frontend/index.html'))) {
    return path.join(__dirname, '../frontend');
  } else if (fs.existsSync(path.join(__dirname, './frontend/index.html'))) {
    return path.join(__dirname, './frontend');
  } else {
    return __dirname;
  }
};

const frontendDir = getFrontendDir();

// Static File Server
app.use(express.static(frontendDir));

// Health Check Endpoint
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.env || 'development',
    version: 'v1.0.0',
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    features: {
      dcfValuation: 'Active',
      multiModelPredictions: 'Active',
      quantBacktesting: 'Active',
      portfolioOptimizer: 'Active',
      enterpriseMlops: 'Active'
    }
  });
};
app.get('/api/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// API Route Mounts (v1 API Aliasing + Legacy /api Compatibility)
// /api/v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/watchlist', watchlistRoutes);
app.use('/api/v1/portfolio', portfolioRoutes);
app.use('/api/v1/predictions', predictionRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/quant', quantPipelineRoutes);
app.use('/api/v1/features', featureEngineeringRoutes);
app.use('/api/v1/backtest', quantBacktestRoutes);
app.use('/api/v1/quant', quantRoutes);
// Research route mounting removed
app.use('/api/v1/paper', paperTradingRoutes);
app.use('/api/v1/portfolio-optimizer', portfolioOptimizerRoutes);
app.use('/api/v1/mlops', mlopsRoutes);
app.use('/api/v1/model-registry', mlopsRoutes);
app.use('/api/v1', stockRoutes);

// Legacy /api Routes
app.use('/api/auth', authRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/quant', quantPipelineRoutes);
app.use('/api/features', featureEngineeringRoutes);
app.use('/api/backtest', quantBacktestRoutes);
app.use('/api/quant', quantRoutes);
// Research route mounting removed
app.use('/api/paper', paperTradingRoutes);
app.use('/api/portfolio-optimizer', portfolioOptimizerRoutes);
app.use('/api/mlops', mlopsRoutes);
app.use('/api/model-registry', mlopsRoutes);
app.use('/api', stockRoutes);

// SPA Fallback Route: Serve index.html for non-API root requests
app.get(/^((?!\/api).)*$/, (req, res, next) => {
  if (req.path.includes('.')) {
    return next();
  }
  const indexPath = path.join(frontendDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Database & Start Server
(async () => {
  const dbStatus = await initDatabase();
  const dbMessage = dbStatus ? 'Connected (PostgreSQL Active)' : 'Offline (In-Memory Fallback Active)';

  const host = '0.0.0.0';
  app.listen(config.port, host, () => {
    logger.info(`=======================================================`);
    logger.info(`🚀 StockSight Institutional Quant Platform Active`);
    logger.info(`🌐 Independent Access: http://localhost:${config.port}`);
    logger.info(`📖 Swagger UI Docs: http://localhost:${config.port}/api-docs`);
    logger.info(`🏥 Health Check: http://localhost:${config.port}/api/v1/health`);
    logger.info(`🗄️  PostgreSQL DB Status: ${dbMessage}`);
    logger.info(`💼 Paper Trading Desk: Active (Default Capital: ₹10,00,000)`);
    logger.info(`=======================================================`);
  });
})();

module.exports = app;
