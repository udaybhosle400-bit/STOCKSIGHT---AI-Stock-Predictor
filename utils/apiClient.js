const axios = require('axios');
const logger = require('./logger');

const apiClient = axios.create({
  timeout: 10000, // 10s default timeout
  headers: {
    'User-Agent': 'StockSight-FinTech-Engine/1.0 (Mozilla/5.0)'
  }
});

// Intercept responses for logging errors cleanly
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config ? error.config.url : 'unknown';
    const status = error.response ? error.response.status : 'NETWORK_ERROR';
    logger.warn(`API call failed [${status}] for ${url}: ${error.message}`);
    return Promise.reject(error);
  }
);

module.exports = apiClient;
