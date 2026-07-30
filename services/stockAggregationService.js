const yahooService = require('./yahooService');
const fmpService = require('./fmpService');
const finnhubService = require('./finnhubService');
const cacheService = require('../cache/cacheService');
const config = require('../config/env.config');
const logger = require('../utils/logger');

class StockAggregationService {
  /**
   * Aggregate stock metrics from Yahoo Finance, FMP, and Finnhub
   * @param {string} symbol - Stock ticker symbol
   */
  async getAggregatedStockData(symbol) {
    const cacheKey = `stock:aggregated:${symbol}`;

    return cacheService.getOrSet(cacheKey, async () => {
      logger.info(`StockAggregationService: Fetching live data for ${symbol}`);

      // Execute external API fetches in parallel for optimal speed
      const [liveQuoteResult, ohlcResult, fundamentalsResult, newsResult, profileResult, statementsResult] = await Promise.allSettled([
        yahooService.getLiveQuote(symbol),
        yahooService.getHistoricalOHLC(symbol, '1mo', '1d'),
        fmpService.getFundamentals(symbol),
        finnhubService.getNews(symbol),
        finnhubService.getCompanyProfile(symbol),
        fmpService.getFinancialStatements(symbol)
      ]);

      const quote = liveQuoteResult.status === 'fulfilled' ? liveQuoteResult.value : {};
      const historicalData = ohlcResult.status === 'fulfilled' ? ohlcResult.value : [];
      const fundamentals = fundamentalsResult.status === 'fulfilled' ? fundamentalsResult.value : {};
      const news = newsResult.status === 'fulfilled' ? newsResult.value : [];
      const profile = profileResult.status === 'fulfilled' ? profileResult.value : {};
      const financialStatements = statementsResult.status === 'fulfilled' ? statementsResult.value : {};

      // Price precedence: Yahoo live quote > FMP profile price > 0
      const price = quote.price || (profile.price ? +profile.price.toFixed(2) : 0);

      // Book value calculation fallback if needed
      let bookValue = fundamentals.bookValue || 0;
      let pb = fundamentals.pb || 0;
      let pe = fundamentals.pe || 0;

      if (price > 0 && bookValue > 0 && pb === 0) {
        pb = +(price / bookValue).toFixed(2);
      }
      if (price > 0 && fundamentals.eps > 0 && pe === 0) {
        pe = +(price / fundamentals.eps).toFixed(2);
      }

      // Exact structure required by GET /api/stock/:symbol specification
      return {
        symbol: symbol.toUpperCase(),
        price: price,
        bookValue: bookValue,
        roe: fundamentals.roe || 0,
        pe: pe,
        pb: pb,
        eps: fundamentals.eps || 0,
        news: news,
        historicalData: historicalData,

        // Extended FinTech fields for enriched client experience
        roa: fundamentals.roa || 0,
        debtToEquity: fundamentals.debtToEquity || 0,
        change: quote.change || 0,
        changePercent: quote.changePercent || 0,
        dayHigh: quote.dayHigh || 0,
        dayLow: quote.dayLow || 0,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
        volume: quote.volume || 0,
        profile: profile,
        financialStatements: financialStatements,
        timestamp: new Date().toISOString()
      };
    }, config.cache.ttlQuotes);
  }
}

module.exports = new StockAggregationService();
