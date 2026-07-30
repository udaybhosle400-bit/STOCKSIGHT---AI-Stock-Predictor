const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'StockSight FinTech API - Zerodha Paper Trading & Quant Suite',
      version: '5.0.0',
      description: 'Production-ready financial API with Zerodha-Grade Paper Trading Engine (₹10,00,000 default virtual balance, atomic BUY/SELL order execution, trade validation, holdings P&L, transaction ledger, sector allocation, equity curve tracking), FMP fundamentals, Finnhub news, and Jane Street Quant Research.'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local Development Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Provide your JWT access token to authenticate protected endpoints'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: []
};

const swaggerSpec = swaggerJsdoc(options);

swaggerSpec.paths = {
  '/api/paper/account': {
    get: {
      summary: 'Get Paper Trading Account Summary (Virtual Balance & Portfolio Value)',
      tags: ['Zerodha Paper Trading'],
      responses: { 200: { description: 'Returns virtual balance, invested value, current holdings value, and total return.' } }
    }
  },
  '/api/paper/trade': {
    post: {
      summary: 'Execute BUY or SELL Order with Validation',
      tags: ['Zerodha Paper Trading'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                symbol: { type: 'string', example: 'RELIANCE.NS' },
                tradeType: { type: 'string', example: 'BUY' },
                shares: { type: 'number', example: 10 }
              }
            }
          }
        }
      },
      responses: {
        201: { description: 'Trade executed successfully.' },
        400: { description: 'Trade validation failure (insufficient balance, shorting unowned shares, invalid quantity).' }
      }
    }
  },
  '/api/paper/holdings': {
    get: {
      summary: 'Get Active Stock Holdings with Live Prices & P&L',
      tags: ['Zerodha Paper Trading'],
      responses: { 200: { description: 'Active holdings list with unrealized P&L.' } }
    }
  },
  '/api/paper/trades': {
    get: {
      summary: 'Get Transaction History Ledger',
      tags: ['Zerodha Paper Trading'],
      responses: { 200: { description: 'Trade history audit log.' } }
    }
  },
  '/api/paper/analytics': {
    get: {
      summary: 'Get Portfolio Sector Breakdown & Performance Equity Curve',
      tags: ['Zerodha Paper Trading'],
      responses: { 200: { description: 'Sector allocation percentages and historical equity curve points.' } }
    }
  },
  '/api/paper/reset': {
    post: {
      summary: 'Reset Paper Trading Account back to Default ₹10,00,000',
      tags: ['Zerodha Paper Trading'],
      responses: { 200: { description: 'Account reset successful.' } }
    }
  },
  '/api/stock/{symbol}': {
    get: {
      summary: 'Get Aggregated Stock Data (Yahoo + FMP + Finnhub)',
      tags: ['Stock Market'],
      parameters: [{ name: 'symbol', in: 'path', required: true, schema: { type: 'string', example: 'AAPL' } }],
      responses: { 200: { description: 'Aggregated stock metrics, fundamentals, news, and historical OHLC data.' } }
    }
  }
};

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = setupSwagger;
