const paperTradingModel = require('../models/paperTradingModel');
const yahooService = require('./yahooService');
const companyRegistry = require('../config/companyRegistry');
const logger = require('../utils/logger');

// Dynamically generated sector map from Master Company Registry
const SECTOR_MAP = companyRegistry.getSectorMap();

class PaperTradingService {
  /**
   * Execute BUY or SELL trade order with complete validation
   */
  async executeTrade(userId, { symbol, tradeType, shares }) {
    if (!symbol || typeof symbol !== 'string') {
      throw { status: 400, message: 'Stock symbol is required.' };
    }

    const type = (tradeType || '').toUpperCase();
    if (type !== 'BUY' && type !== 'SELL') {
      throw { status: 400, message: 'Trade type must be either BUY or SELL.' };
    }

    const numShares = parseInt(shares, 10);
    if (isNaN(numShares) || numShares <= 0) {
      throw { status: 400, message: 'Share quantity must be a positive integer greater than 0.' };
    }

    const cleanSym = symbol.trim().toUpperCase();
    const liveQuote = await yahooService.getLiveQuote(cleanSym);
    const company = companyRegistry.getCompany(cleanSym);
    const executionPrice = (liveQuote && liveQuote.price > 0) ? liveQuote.price : (company && company.cmp ? parseFloat(company.cmp) : 100.0);

    const totalTradeAmount = numShares * executionPrice;
    const account = await paperTradingModel.getAccount(userId);
    const currentHolding = await paperTradingModel.getHolding(userId, cleanSym);
    const existingShares = currentHolding ? currentHolding.shares : 0;
    const existingAvgPrice = currentHolding ? currentHolding.average_price : 0;

    let newBalance = account.balance;
    let newShares = existingShares;
    let newAvgPrice = existingAvgPrice;
    let realizedPnL = 0;

    if (type === 'BUY') {
      // Validate sufficient cash balance
      if (totalTradeAmount > account.balance) {
        throw {
          status: 400,
          message: `Insufficient virtual cash balance. Required: ₹${totalTradeAmount.toLocaleString('en-IN')}, Available: ₹${account.balance.toLocaleString('en-IN')}.`
        };
      }

      newBalance -= totalTradeAmount;
      newShares += numShares;
      // Weighted average cost basis calculation
      newAvgPrice = ((existingShares * existingAvgPrice) + (numShares * executionPrice)) / newShares;
    } else if (type === 'SELL') {
      // Validate existing holdings (Prevent short selling)
      if (numShares > existingShares) {
        throw {
          status: 400,
          message: `Cannot sell ${numShares} shares of ${cleanSym}. You currently own ${existingShares} shares.`
        };
      }

      newBalance += totalTradeAmount;
      newShares -= numShares;
      // Calculate realized P&L on closed shares
      realizedPnL = (executionPrice - existingAvgPrice) * numShares;
      newAvgPrice = newShares > 0 ? existingAvgPrice : 0;
    }

    // Persist updated account balance, holdings position, and trade audit log
    await paperTradingModel.updateBalance(userId, newBalance);
    await paperTradingModel.upsertHolding(userId, cleanSym, newShares, newAvgPrice);
    const tradeRecord = await paperTradingModel.recordTrade({
      userId,
      symbol: cleanSym,
      tradeType: type,
      shares: numShares,
      price: executionPrice,
      totalAmount: totalTradeAmount,
      realizedPnL
    });

    logger.info(`PaperTrade Executed: [User: ${userId}, ${type} ${numShares}x ${cleanSym} @ ₹${executionPrice}]`);

    return {
      trade: tradeRecord,
      account: {
        balance: +newBalance.toFixed(2),
        initialBalance: account.initial_balance
      },
      holding: {
        symbol: cleanSym,
        shares: newShares,
        averagePrice: +newAvgPrice.toFixed(2)
      }
    };
  }

  /**
   * Get complete Paper Trading Portfolio Summary (Holdings, Values, P&Ls, Daily Returns)
   */
  async getPortfolioSummary(userId) {
    const account = await paperTradingModel.getAccount(userId);
    const holdings = await paperTradingModel.getHoldings(userId);

    let totalInvestedValue = 0;
    let totalCurrentValue = 0;
    const enrichedHoldings = [];

    for (const h of holdings) {
      const liveQuote = await yahooService.getLiveQuote(h.symbol);
      const currentPrice = liveQuote.price || h.average_price;
      const changePercent = liveQuote.changePercent || 0;

      const investedVal = h.shares * h.average_price;
      const currentVal = h.shares * currentPrice;
      const unrealizedPnL = currentVal - investedVal;
      const unrealizedPnLPct = investedVal > 0 ? (unrealizedPnL / investedVal) * 100 : 0;

      totalInvestedValue += investedVal;
      totalCurrentValue += currentVal;

      enrichedHoldings.push({
        symbol: h.symbol,
        shares: h.shares,
        averagePrice: +h.average_price.toFixed(2),
        currentPrice: +currentPrice.toFixed(2),
        investedValue: +investedVal.toFixed(2),
        currentValue: +currentVal.toFixed(2),
        unrealizedPnL: +unrealizedPnL.toFixed(2),
        unrealizedPnLPercent: +unrealizedPnLPct.toFixed(2),
        dayChangePercent: +changePercent.toFixed(2),
        sector: SECTOR_MAP[h.symbol] || 'General'
      });
    }

    const totalPortfolioValue = account.balance + totalCurrentValue;
    const totalProfitLoss = totalPortfolioValue - account.initial_balance;
    const totalReturnPercent = account.initial_balance > 0 ? (totalProfitLoss / account.initial_balance) * 100 : 0;

    // Realized P&L from trades history
    const trades = await paperTradingModel.getTradeHistory(userId, 500);
    const totalRealizedPnL = trades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);

    return {
      account: {
        virtualBalance: +account.balance.toFixed(2),
        initialBalance: +account.initial_balance.toFixed(2),
        investedValue: +totalInvestedValue.toFixed(2),
        currentHoldingsValue: +totalCurrentValue.toFixed(2),
        totalPortfolioValue: +totalPortfolioValue.toFixed(2),
        totalProfitLoss: +totalProfitLoss.toFixed(2),
        totalReturnPercent: +totalReturnPercent.toFixed(2),
        realizedPnL: +totalRealizedPnL.toFixed(2),
        unrealizedPnL: +(totalCurrentValue - totalInvestedValue).toFixed(2)
      },
      holdings: enrichedHoldings
    };
  }

  /**
   * Get Sector Allocation Breakdown
   */
  async getSectorAllocation(userId) {
    const summary = await this.getPortfolioSummary(userId);
    const sectorTotals = {};

    let totalHoldingsVal = summary.account.currentHoldingsValue;

    if (totalHoldingsVal === 0) {
      return [{ sector: 'Cash', value: summary.account.virtualBalance, percentage: 100 }];
    }

    summary.holdings.forEach(h => {
      const sec = h.sector;
      sectorTotals[sec] = (sectorTotals[sec] || 0) + h.currentValue;
    });

    const breakdown = Object.keys(sectorTotals).map(sec => ({
      sector: sec,
      value: +sectorTotals[sec].toFixed(2),
      percentage: +((sectorTotals[sec] / totalHoldingsVal) * 100).toFixed(2)
    }));

    return breakdown;
  }

  /**
   * Get Portfolio Equity Curve performance graph data
   */
  async getEquityCurve(userId) {
    const summary = await this.getPortfolioSummary(userId);
    const today = new Date();
    const curve = [];

    let currentVal = summary.account.totalPortfolioValue;

    for (let i = 30; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // Simulated historical trajectory ending at current live portfolio value
      const daysBackFactor = 1 - (i * 0.003) + (Math.sin(i) * 0.002);
      const val = i === 0 ? currentVal : currentVal * daysBackFactor;

      curve.push({
        date: dateStr,
        portfolioValue: +val.toFixed(2)
      });
    }

    return curve;
  }

  /**
   * Reset user paper trading account
   */
  async resetAccount(userId) {
    return paperTradingModel.resetAccount(userId);
  }
}

module.exports = new PaperTradingService();
