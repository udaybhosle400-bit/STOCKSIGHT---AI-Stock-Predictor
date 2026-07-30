const yahooService = require('./yahooService');
const logger = require('../utils/logger');

const RISK_FREE_RATE = 0.04; // 4.0% Risk-Free Rate
const TRADING_DAYS_PER_YEAR = 252;

class QuantService {
  /**
   * Helper: Calculate daily return percentage array from close prices
   */
  calculateDailyReturns(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] > 0) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      } else {
        returns.push(0);
      }
    }
    return returns;
  }

  /**
   * Helper: Standard deviation of returns
   */
  calculateStandardDeviation(returns) {
    if (returns.length <= 1) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Helper: Downside deviation (for Sortino Ratio)
   */
  calculateDownsideDeviation(returns, targetReturn = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR) {
    if (returns.length === 0) return 0;
    const downsideSquareSums = returns.reduce((sum, r) => {
      const diff = Math.min(0, r - targetReturn);
      return sum + Math.pow(diff, 2);
    }, 0);
    return Math.sqrt(downsideSquareSums / returns.length);
  }

  /**
   * Helper: Maximum Drawdown calculation
   */
  calculateMaxDrawdown(equityCurve) {
    if (!equityCurve || equityCurve.length === 0) return 0;
    let peak = equityCurve[0];
    let maxDrawdown = 0;

    for (let i = 0; i < equityCurve.length; i++) {
      if (equityCurve[i] > peak) {
        peak = equityCurve[i];
      }
      const drawdown = (peak - equityCurve[i]) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    return maxDrawdown;
  }

  /**
   * Helper: Covariance between two return series
   */
  calculateCovariance(returnsA, returnsB) {
    const len = Math.min(returnsA.length, returnsB.length);
    if (len <= 1) return 0;

    const meanA = returnsA.slice(0, len).reduce((a, b) => a + b, 0) / len;
    const meanB = returnsB.slice(0, len).reduce((a, b) => a + b, 0) / len;

    let covSum = 0;
    for (let i = 0; i < len; i++) {
      covSum += (returnsA[i] - meanA) * (returnsB[i] - meanB);
    }
    return covSum / (len - 1);
  }

  /**
   * 1. Portfolio Analytics & Comprehensive Metrics
   */
  async calculatePortfolioAnalytics(positions, benchmarkSymbol = '^GSPC') {
    if (!positions || positions.length === 0) {
      return this.getDefaultAnalytics();
    }

    // Fetch benchmark OHLC for Beta/Alpha
    const benchmarkOHLC = await yahooService.getHistoricalOHLC(benchmarkSymbol, '1y', '1d');
    const benchmarkPrices = benchmarkOHLC.map(d => d.close);
    const benchmarkReturns = this.calculateDailyReturns(benchmarkPrices);
    const benchmarkAnnReturn = benchmarkReturns.reduce((a, b) => a + b, 0) * TRADING_DAYS_PER_YEAR;

    let totalCurrentValue = 0;
    let totalInitialValue = 0;

    // Fetch asset histories and calculate weights
    const assetHistories = [];
    for (const pos of positions) {
      const sh = parseFloat(pos.shares) || 0;
      const avgPx = parseFloat(pos.average_price) || 0;
      const ohlc = await yahooService.getHistoricalOHLC(pos.symbol, '1y', '1d');
      const currentPrice = ohlc.length > 0 ? ohlc[ohlc.length - 1].close : avgPx;

      const currentValue = sh * currentPrice;
      const initialValue = sh * avgPx;

      totalCurrentValue += currentValue;
      totalInitialValue += initialValue;

      assetHistories.push({
        symbol: pos.symbol,
        currentValue,
        ohlc
      });
    }

    const totalProfitLoss = totalCurrentValue - totalInitialValue;
    const totalReturnPercent = totalInitialValue > 0 ? totalProfitLoss / totalInitialValue : 0;

    // Build portfolio daily equity curve
    const historyLength = assetHistories.reduce((min, a) => Math.min(min, a.ohlc.length), Infinity);
    const portfolioEquityCurve = [];

    for (let i = 0; i < historyLength; i++) {
      let dayVal = 0;
      for (const asset of assetHistories) {
        const sh = positions.find(p => p.symbol === asset.symbol)?.shares || 0;
        dayVal += sh * (asset.ohlc[i]?.close || 0);
      }
      portfolioEquityCurve.push(dayVal);
    }

    const portfolioReturns = this.calculateDailyReturns(portfolioEquityCurve);
    const avgDailyReturn = portfolioReturns.reduce((a, b) => a + b, 0) / (portfolioReturns.length || 1);
    const dailyReturnPercent = portfolioReturns.length > 0 ? portfolioReturns[portfolioReturns.length - 1] : 0;

    // Annualized Metrics
    const days = historyLength;
    const annualReturn = Math.pow(1 + totalReturnPercent, 365 / (days || 365)) - 1;
    const cagr = annualReturn;

    const dailyStdDev = this.calculateStandardDeviation(portfolioReturns);
    const volatility = dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);

    const downsideDev = this.calculateDownsideDeviation(portfolioReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR);

    const sharpeRatio = volatility > 0 ? (annualReturn - RISK_FREE_RATE) / volatility : 0;
    const sortinoRatio = downsideDev > 0 ? (annualReturn - RISK_FREE_RATE) / downsideDev : 0;

    const maxDrawdown = this.calculateMaxDrawdown(portfolioEquityCurve);

    // Beta & Alpha
    const benchmarkVar = Math.pow(this.calculateStandardDeviation(benchmarkReturns), 2);
    const cov = this.calculateCovariance(portfolioReturns, benchmarkReturns);
    const beta = benchmarkVar > 0 ? cov / benchmarkVar : 1.0;
    const alpha = annualReturn - (RISK_FREE_RATE + beta * (benchmarkAnnReturn - RISK_FREE_RATE));

    return {
      currentValue: +totalCurrentValue.toFixed(2),
      initialValue: +totalInitialValue.toFixed(2),
      profitLoss: +totalProfitLoss.toFixed(2),
      totalReturn: +(totalReturnPercent * 100).toFixed(2),
      dailyReturn: +(dailyReturnPercent * 100).toFixed(2),
      annualReturn: +(annualReturn * 100).toFixed(2),
      cagr: +(cagr * 100).toFixed(2),
      sharpeRatio: +sharpeRatio.toFixed(2),
      sortinoRatio: +sortinoRatio.toFixed(2),
      volatility: +(volatility * 100).toFixed(2),
      maxDrawdown: +(maxDrawdown * 100).toFixed(2),
      beta: +beta.toFixed(2),
      alpha: +(alpha * 100).toFixed(2)
    };
  }

  getDefaultAnalytics() {
    return {
      currentValue: 0,
      initialValue: 0,
      profitLoss: 0,
      totalReturn: 0,
      dailyReturn: 0,
      annualReturn: 0,
      cagr: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      volatility: 0,
      maxDrawdown: 0,
      beta: 1.0,
      alpha: 0
    };
  }

  /**
   * 2. Strategy Backtesting Engine (RSI, MACD, EMA Crossover, Momentum, Mean Reversion)
   */
  async runBacktest(symbol, strategyName, params = {}, initialCapital = 10000) {
    const ohlc = await yahooService.getHistoricalOHLC(symbol, params.range || '1y', '1d');
    if (!ohlc || ohlc.length < 30) {
      throw new Error(`Insufficient historical data for backtesting ${symbol}`);
    }

    const prices = ohlc.map(d => d.close);
    const signals = this.generateStrategySignals(strategyName, prices, params);

    // Simulation variables
    let capital = initialCapital;
    let position = 0; // Number of shares held
    let entryPrice = 0;

    const trades = [];
    const equityCurve = [];

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      const date = ohlc[i].date;
      const sig = signals[i];

      if (sig === 1 && position === 0) {
        // Buy signal
        position = capital / price;
        entryPrice = price;
        capital = 0;
        trades.push({ type: 'BUY', date, price, shares: position });
      } else if (sig === -1 && position > 0) {
        // Sell signal
        capital = position * price;
        const profit = (price - entryPrice) * position;
        const returnPct = (price - entryPrice) / entryPrice;
        trades.push({ type: 'SELL', date, price, shares: position, profit, returnPct });
        position = 0;
      }

      const currentEquity = position > 0 ? position * price : capital;
      equityCurve.push(currentEquity);
    }

    // Liquidate final position if open
    if (position > 0) {
      const finalPrice = prices[prices.length - 1];
      capital = position * finalPrice;
      const lastBuy = trades.filter(t => t.type === 'BUY').pop();
      if (lastBuy) {
        const profit = (finalPrice - lastBuy.price) * position;
        const returnPct = (finalPrice - lastBuy.price) / lastBuy.price;
        trades.push({ type: 'SELL', date: ohlc[ohlc.length - 1].date, price: finalPrice, shares: position, profit, returnPct });
      }
    }

    const finalEquity = capital;
    const totalReturn = (finalEquity - initialCapital) / initialCapital;

    const closedTrades = trades.filter(t => t.type === 'SELL');
    const winningTrades = closedTrades.filter(t => t.profit > 0);
    const losingTrades = closedTrades.filter(t => t.profit <= 0);

    const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;

    const returns = this.calculateDailyReturns(equityCurve);
    const annualReturn = Math.pow(1 + totalReturn, 365 / ohlc.length) - 1;
    const volatility = this.calculateStandardDeviation(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    const downsideDev = this.calculateDownsideDeviation(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR);

    const maxDrawdown = this.calculateMaxDrawdown(equityCurve);
    const sharpeRatio = volatility > 0 ? (annualReturn - RISK_FREE_RATE) / volatility : 0;
    const sortinoRatio = downsideDev > 0 ? (annualReturn - RISK_FREE_RATE) / downsideDev : 0;

    return {
      symbol: symbol.toUpperCase(),
      strategy: strategyName,
      initialCapital,
      finalEquity: +finalEquity.toFixed(2),
      totalReturn: +(totalReturn * 100).toFixed(2),
      annualReturn: +(annualReturn * 100).toFixed(2),
      winRate: +(winRate * 100).toFixed(2),
      profitFactor: +profitFactor.toFixed(2),
      numberOfTrades: closedTrades.length,
      maxDrawdown: +(maxDrawdown * 100).toFixed(2),
      sharpeRatio: +sharpeRatio.toFixed(2),
      sortinoRatio: +sortinoRatio.toFixed(2),
      trades: closedTrades.map(t => ({
        date: t.date,
        price: +t.price.toFixed(2),
        profit: +t.profit.toFixed(2),
        returnPct: +(t.returnPct * 100).toFixed(2)
      })),
      equityCurve: equityCurve.map((eq, idx) => ({ date: ohlc[idx].date, equity: +eq.toFixed(2) }))
    };
  }

  /**
   * Helper: Technical indicator signal generation
   */
  generateStrategySignals(strategyName, prices, params) {
    const signals = new Array(prices.length).fill(0);
    const strats = (strategyName || '').toUpperCase();

    if (strats === 'RSI') {
      const period = params.rsiPeriod || 14;
      const rsi = this.calculateRSI(prices, period);
      for (let i = period; i < prices.length; i++) {
        if (rsi[i] < (params.oversold || 30)) signals[i] = 1;       // Buy
        else if (rsi[i] > (params.overbought || 70)) signals[i] = -1; // Sell
      }
    } else if (strats === 'MACD') {
      const macdObj = this.calculateMACD(prices);
      for (let i = 1; i < prices.length; i++) {
        if (macdObj.macd[i] > macdObj.signal[i] && macdObj.macd[i - 1] <= macdObj.signal[i - 1]) {
          signals[i] = 1; // Bullish Crossover
        } else if (macdObj.macd[i] < macdObj.signal[i] && macdObj.macd[i - 1] >= macdObj.signal[i - 1]) {
          signals[i] = -1; // Bearish Crossover
        }
      }
    } else if (strats === 'EMA' || strats === 'EMA CROSSOVER') {
      const shortPeriod = params.shortPeriod || 9;
      const longPeriod = params.longPeriod || 21;
      const emaShort = this.calculateEMA(prices, shortPeriod);
      const emaLong = this.calculateEMA(prices, longPeriod);
      for (let i = longPeriod; i < prices.length; i++) {
        if (emaShort[i] > emaLong[i] && emaShort[i - 1] <= emaLong[i - 1]) signals[i] = 1;
        else if (emaShort[i] < emaLong[i] && emaShort[i - 1] >= emaLong[i - 1]) signals[i] = -1;
      }
    } else if (strats === 'MOMENTUM') {
      const lookback = params.lookback || 10;
      for (let i = lookback; i < prices.length; i++) {
        const roc = (prices[i] - prices[i - lookback]) / prices[i - lookback];
        if (roc > 0.02) signals[i] = 1;
        else if (roc < -0.02) signals[i] = -1;
      }
    } else if (strats === 'MEAN REVERSION' || strats === 'BOLLINGER') {
      const period = params.bbPeriod || 20;
      const multiplier = params.multiplier || 2;
      const bands = this.calculateBollingerBands(prices, period, multiplier);
      for (let i = period; i < prices.length; i++) {
        if (prices[i] < bands.lower[i]) signals[i] = 1;
        else if (prices[i] > bands.upper[i]) signals[i] = -1;
      }
    }
    return signals;
  }

  calculateRSI(prices, period = 14) {
    const rsi = new Array(prices.length).fill(50);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff >= 0) {
        avgGain = (avgGain * (period - 1) + diff) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - diff) / period;
      }

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
    return rsi;
  }

  calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    const ema = new Array(prices.length).fill(prices[0]);
    for (let i = 1; i < prices.length; i++) {
      ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
    }
    return ema;
  }

  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12.map((val, i) => val - ema26[i]);
    const signalLine = this.calculateEMA(macdLine, 9);
    return { macd: macdLine, signal: signalLine };
  }

  calculateBollingerBands(prices, period = 20, multiplier = 2) {
    const upper = [];
    const lower = [];
    const sma = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(prices[i]);
        upper.push(prices[i]);
        lower.push(prices[i]);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const stdDev = Math.sqrt(slice.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / period);
        sma.push(mean);
        upper.push(mean + multiplier * stdDev);
        lower.push(mean - multiplier * stdDev);
      }
    }
    return { sma, upper, lower };
  }

  /**
   * 3. Modern Portfolio Theory (MPT) Optimizer & Efficient Frontier
   */
  async optimizePortfolio(symbols, numSimulations = 3000) {
    if (!symbols || symbols.length < 2) {
      throw new Error('At least 2 stock symbols are required for portfolio optimization');
    }

    const assetData = [];
    for (const sym of symbols) {
      const ohlc = await yahooService.getHistoricalOHLC(sym, '1y', '1d');
      const prices = ohlc.map(d => d.close);
      const returns = this.calculateDailyReturns(prices);
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length * TRADING_DAYS_PER_YEAR;
      assetData.push({ symbol: sym, returns, meanReturn });
    }

    const k = assetData.length;
    const simulations = [];

    let maxSharpePortfolio = null;
    let maxSharpeRatio = -Infinity;

    let minVolPortfolio = null;
    let minVolatility = Infinity;

    for (let sim = 0; sim < numSimulations; sim++) {
      // Generate random weights summing to 1.0
      let rawWeights = Array.from({ length: k }, () => Math.random());
      const sumWeights = rawWeights.reduce((a, b) => a + b, 0);
      const weights = rawWeights.map(w => w / sumWeights);

      // Expected return
      let portReturn = 0;
      for (let i = 0; i < k; i++) {
        portReturn += weights[i] * assetData[i].meanReturn;
      }

      // Portfolio volatility using covariance matrix
      let portVar = 0;
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
          const cov = this.calculateCovariance(assetData[i].returns, assetData[j].returns);
          portVar += weights[i] * weights[j] * cov * TRADING_DAYS_PER_YEAR;
        }
      }
      const portVol = Math.sqrt(Math.max(0, portVar));
      const sharpe = portVol > 0 ? (portReturn - RISK_FREE_RATE) / portVol : 0;

      const simResult = {
        weights: weights.map(w => +w.toFixed(4)),
        expectedReturn: +(portReturn * 100).toFixed(2),
        volatility: +(portVol * 100).toFixed(2),
        sharpeRatio: +sharpe.toFixed(2)
      };

      simulations.push(simResult);

      if (sharpe > maxSharpeRatio) {
        maxSharpeRatio = sharpe;
        maxSharpePortfolio = simResult;
      }

      if (portVol < minVolatility) {
        minVolatility = portVol;
        minVolPortfolio = simResult;
      }
    }

    // Format weights mapping
    const mapWeights = (wArr) => {
      const res = {};
      symbols.forEach((sym, idx) => {
        res[sym] = +(wArr[idx] * 100).toFixed(2);
      });
      return res;
    };

    return {
      symbols,
      maxSharpePortfolio: {
        allocation: mapWeights(maxSharpePortfolio.weights),
        expectedReturn: maxSharpePortfolio.expectedReturn,
        volatility: maxSharpePortfolio.volatility,
        sharpeRatio: maxSharpePortfolio.sharpeRatio
      },
      minVolatilityPortfolio: {
        allocation: mapWeights(minVolPortfolio.weights),
        expectedReturn: minVolPortfolio.expectedReturn,
        volatility: minVolPortfolio.volatility,
        sharpeRatio: minVolPortfolio.sharpeRatio
      },
      efficientFrontier: simulations.slice(0, 500).map(s => ({
        volatility: s.volatility,
        expectedReturn: s.expectedReturn,
        sharpeRatio: s.sharpeRatio
      }))
    };
  }

  /**
   * 4. Stock Correlation Matrix Generator
   */
  async calculateCorrelationMatrix(symbols) {
    if (!symbols || symbols.length === 0) return { symbols: [], matrix: [] };

    const returnsMap = new Map();
    for (const sym of symbols) {
      const ohlc = await yahooService.getHistoricalOHLC(sym, '6mo', '1d');
      const prices = ohlc.map(d => d.close);
      returnsMap.set(sym, this.calculateDailyReturns(prices));
    }

    const n = symbols.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(1.0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          const retA = returnsMap.get(symbols[i]) || [];
          const retB = returnsMap.get(symbols[j]) || [];
          const cov = this.calculateCovariance(retA, retB);
          const stdA = this.calculateStandardDeviation(retA);
          const stdB = this.calculateStandardDeviation(retB);
          const corr = (stdA * stdB) > 0 ? cov / (stdA * stdB) : 0;
          matrix[i][j] = +corr.toFixed(3);
        }
      }
    }

    return {
      symbols: symbols.map(s => s.toUpperCase()),
      matrix
    };
  }

  /**
   * 5. Advanced Risk Analytics (VaR, CVaR, Volatility, Beta, Alpha)
   */
  async calculateRiskAnalytics(positions, benchmarkSymbol = '^GSPC') {
    const analytics = await this.calculatePortfolioAnalytics(positions, benchmarkSymbol);
    
    // Calculate 95% and 99% Value at Risk (VaR) and Conditional VaR (CVaR)
    let dailyReturns = [];
    if (positions && positions.length > 0) {
      const assetHistories = [];
      for (const pos of positions) {
        const ohlc = await yahooService.getHistoricalOHLC(pos.symbol, '1y', '1d');
        assetHistories.push({ symbol: pos.symbol, ohlc, shares: parseFloat(pos.shares) || 1 });
      }
      const historyLength = assetHistories.reduce((min, a) => Math.min(min, a.ohlc.length), Infinity);
      const equityCurve = [];
      for (let i = 0; i < historyLength; i++) {
        let val = 0;
        for (const a of assetHistories) {
          val += a.shares * (a.ohlc[i]?.close || 0);
        }
        equityCurve.push(val);
      }
      dailyReturns = this.calculateDailyReturns(equityCurve);
    }

    if (dailyReturns.length === 0) {
      return {
        var95: 0,
        var99: 0,
        cvar95: 0,
        cvar99: 0,
        volatility: 0,
        beta: 1.0,
        alpha: 0
      };
    }

    // Sort daily returns in ascending order (worst losses first)
    const sortedReturns = [...dailyReturns].sort((a, b) => a - b);
    const n = sortedReturns.length;

    // 95% VaR index (5th percentile)
    const var95Idx = Math.floor(n * 0.05);
    const var95 = Math.abs(sortedReturns[var95Idx] || 0);

    // 99% VaR index (1st percentile)
    const var99Idx = Math.floor(n * 0.01);
    const var99 = Math.abs(sortedReturns[var99Idx] || 0);

    // CVaR (Expected Shortfall) = mean of returns below VaR
    const returns95 = sortedReturns.slice(0, var95Idx + 1);
    const cvar95 = Math.abs(returns95.reduce((a, b) => a + b, 0) / (returns95.length || 1));

    const returns99 = sortedReturns.slice(0, var99Idx + 1);
    const cvar99 = Math.abs(returns99.reduce((a, b) => a + b, 0) / (returns99.length || 1));

    return {
      var95: +(var95 * 100).toFixed(2),
      var99: +(var99 * 100).toFixed(2),
      cvar95: +(cvar95 * 100).toFixed(2),
      cvar99: +(cvar99 * 100).toFixed(2),
      volatility: analytics.volatility,
      beta: analytics.beta,
      alpha: analytics.alpha,
      sharpeRatio: analytics.sharpeRatio,
      sortinoRatio: analytics.sortinoRatio,
      maxDrawdown: analytics.maxDrawdown
    };
  }
}

module.exports = new QuantService();
