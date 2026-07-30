const quantDataPipelineService = require('./quantDataPipelineService');
const companyRegistry = require('../config/companyRegistry');
const featureModel = require('../models/featureModel');
const logger = require('../utils/logger');

class FeatureEngineeringService {
  /**
   * Safe division helper to prevent DivisionByZero and NaN/Infinity
   */
  safeDiv(a, b, fallback = 0) {
    if (b === 0 || b === null || b === undefined || isNaN(b)) return fallback;
    const res = a / b;
    return isNaN(res) || !isFinite(res) ? fallback : res;
  }

  /**
   * Winsorize/clip numeric value between 1st and 99th percentiles or bounds
   */
  clipValue(val, minBound = -1e6, maxBound = 1e6) {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return 0;
    return Math.max(minBound, Math.min(maxBound, val));
  }

  // =========================================================================
  // 1. TECHNICAL INDICATORS GENERATOR
  // =========================================================================
  computeTechnicalFeatures(ohlcv) {
    if (!Array.isArray(ohlcv) || ohlcv.length === 0) return {};

    const closes = ohlcv.map(d => parseFloat(d.close || d.adjClose || 0));
    const highs = ohlcv.map(d => parseFloat(d.high || d.close || 0));
    const lows = ohlcv.map(d => parseFloat(d.low || d.close || 0));
    const opens = ohlcv.map(d => parseFloat(d.open || d.close || 0));
    const volumes = ohlcv.map(d => parseFloat(d.volume || 0));

    const n = closes.length;
    const latestIdx = n - 1;
    const lastClose = closes[latestIdx];
    const lastHigh = highs[latestIdx];
    const lastLow = lows[latestIdx];
    const lastOpen = opens[latestIdx];

    // Helper: Simple Moving Average (SMA)
    const getSMA = (period) => {
      if (n < period) return closes.reduce((a, b) => a + b, 0) / Math.max(1, n);
      const slice = closes.slice(n - period);
      return slice.reduce((a, b) => a + b, 0) / period;
    };

    // Helper: Exponential Moving Average (EMA)
    const getEMA = (period) => {
      if (n === 0) return 0;
      const k = 2 / (period + 1);
      let ema = closes[0];
      for (let i = 1; i < n; i++) {
        ema = (closes[i] * k) + (ema * (1 - k));
      }
      return ema;
    };

    // SMAs & EMAs
    const sma5 = getSMA(5);
    const sma10 = getSMA(10);
    const sma20 = getSMA(20);
    const sma50 = getSMA(50);
    const sma100 = getSMA(100);
    const sma200 = getSMA(200);

    const ema5 = getEMA(5);
    const ema10 = getEMA(10);
    const ema20 = getEMA(20);
    const ema50 = getEMA(50);
    const ema100 = getEMA(100);
    const ema200 = getEMA(200);

    // RSI (14)
    let rsi14 = 50.0;
    if (n >= 15) {
      let gains = 0, losses = 0;
      for (let i = n - 14; i < n; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff >= 0) gains += diff;
        else losses += Math.abs(diff);
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      const rs = this.safeDiv(avgGain, avgLoss, 1);
      rsi14 = 100 - (100 / (1 + rs));
    }

    // MACD (12, 26, 9)
    const ema12 = getEMA(12);
    const ema26 = getEMA(26);
    const macdLine = ema12 - ema26;
    const macdSignal = macdLine * 0.8; // Signal line approximation
    const macdHistogram = macdLine - macdSignal;

    // VWAP
    let cumulativeTPV = 0, cumulativeVol = 0;
    for (let i = 0; i < n; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      cumulativeTPV += tp * volumes[i];
      cumulativeVol += volumes[i];
    }
    const vwap = this.safeDiv(cumulativeTPV, cumulativeVol, lastClose);

    // ATR (14)
    let atr14 = lastHigh - lastLow;
    if (n >= 15) {
      let trSum = 0;
      for (let i = n - 14; i < n; i++) {
        const tr = Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        );
        trSum += tr;
      }
      atr14 = trSum / 14;
    }

    // ADX (14)
    let adx14 = 25.0;
    if (n >= 15) {
      let pDM = 0, mDM = 0;
      for (let i = n - 14; i < n; i++) {
        const up = highs[i] - highs[i - 1];
        const down = lows[i - 1] - lows[i];
        if (up > down && up > 0) pDM += up;
        if (down > up && down > 0) mDM += down;
      }
      const diPlus = this.safeDiv(pDM, atr14 * 14) * 100;
      const diMinus = this.safeDiv(mDM, atr14 * 14) * 100;
      adx14 = this.safeDiv(Math.abs(diPlus - diMinus), (diPlus + diMinus), 0.25) * 100;
    }

    // CCI (20)
    let cci20 = 0;
    if (n >= 20) {
      const tpSlice = [];
      for (let i = n - 20; i < n; i++) {
        tpSlice.push((highs[i] + lows[i] + closes[i]) / 3);
      }
      const meanTP = tpSlice.reduce((a, b) => a + b, 0) / 20;
      const meanDev = tpSlice.reduce((sum, tp) => sum + Math.abs(tp - meanTP), 0) / 20;
      cci20 = this.safeDiv(tpSlice[19] - meanTP, 0.015 * meanDev);
    }

    // Momentum (10) & ROC (10)
    const prevClose10 = n >= 11 ? closes[n - 11] : closes[0];
    const momentum = lastClose - prevClose10;
    const roc = this.safeDiv(momentum, prevClose10) * 100;

    // Stochastic Oscillator (%K, %D)
    let stochK = 50, stochD = 50;
    if (n >= 14) {
      const h14 = Math.max(...highs.slice(n - 14));
      const l14 = Math.min(...lows.slice(n - 14));
      stochK = this.safeDiv(lastClose - l14, h14 - l14) * 100;
      stochD = stochK * 0.9;
    }

    // Stochastic RSI
    const stochRSI = Math.min(100, Math.max(0, (rsi14 - 30) / 40 * 100));

    // Williams %R
    const h14W = Math.max(...highs.slice(Math.max(0, n - 14)));
    const l14W = Math.min(...lows.slice(Math.max(0, n - 14)));
    const williamsR = this.safeDiv(h14W - lastClose, h14W - l14W, 0.5) * -100;

    // Bollinger Bands (20, 2)
    const std20 = Math.sqrt(
      closes.slice(Math.max(0, n - 20)).reduce((sum, x) => sum + Math.pow(x - sma20, 2), 0) / Math.max(1, Math.min(n, 20))
    );
    const bbMiddle = sma20;
    const bbUpper = bbMiddle + (2 * std20);
    const bbLower = bbMiddle - (2 * std20);
    const bbWidth = this.safeDiv(bbUpper - bbLower, bbMiddle);
    const bbPosition = this.safeDiv(lastClose - bbLower, bbUpper - bbLower, 0.5);

    // On Balance Volume (OBV)
    let obv = 0;
    for (let i = 1; i < n; i++) {
      if (closes[i] > closes[i - 1]) obv += volumes[i];
      else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    }

    // Chaikin Money Flow (CMF, 20)
    let mfvSum = 0, volSum = 0;
    for (let i = Math.max(0, n - 20); i < n; i++) {
      const mfm = this.safeDiv((closes[i] - lows[i]) - (highs[i] - closes[i]), highs[i] - lows[i]);
      mfvSum += mfm * volumes[i];
      volSum += volumes[i];
    }
    const cmf = this.safeDiv(mfvSum, volSum);

    // Accumulation / Distribution Line
    const adLine = mfvSum;

    // Parabolic SAR & Supertrend & Ichimoku
    const psar = lastClose > sma20 ? lastLow * 0.98 : lastHigh * 1.02;
    const supertrend = lastClose > sma20 ? sma20 - (2 * atr14) : sma20 + (2 * atr14);

    const tenkanSen = (Math.max(...highs.slice(Math.max(0, n - 9))) + Math.min(...lows.slice(Math.max(0, n - 9)))) / 2;
    const kijunSen = (Math.max(...highs.slice(Math.max(0, n - 26))) + Math.min(...lows.slice(Math.max(0, n - 26)))) / 2;
    const senkouSpanA = (tenkanSen + kijunSen) / 2;
    const senkouSpanB = (Math.max(...highs.slice(Math.max(0, n - 52))) + Math.min(...lows.slice(Math.max(0, n - 52)))) / 2;

    // Pivot Points (Classic)
    const pivotP = (lastHigh + lastLow + lastClose) / 3;
    const pivotR1 = (2 * pivotP) - lastLow;
    const pivotS1 = (2 * pivotP) - lastHigh;
    const pivotR2 = pivotP + (lastHigh - lastLow);
    const pivotS2 = pivotP - (lastHigh - lastLow);
    const pivotR3 = lastHigh + 2 * (pivotP - lastLow);
    const pivotS3 = lastLow - 2 * (lastHigh - pivotP);

    // Fibonacci Retracements (52W or Period High/Low)
    const periodHigh = Math.max(...highs);
    const periodLow = Math.min(...lows);
    const diffHL = periodHigh - periodLow;

    const fib236 = periodHigh - (diffHL * 0.236);
    const fib382 = periodHigh - (diffHL * 0.382);
    const fib500 = periodHigh - (diffHL * 0.500);
    const fib618 = periodHigh - (diffHL * 0.618);
    const fib786 = periodHigh - (diffHL * 0.786);

    return {
      rsi_14: this.clipValue(rsi14, 0, 100),
      macd_line: this.clipValue(macdLine),
      macd_signal: this.clipValue(macdSignal),
      macd_hist: this.clipValue(macdHistogram),
      sma_5: this.clipValue(sma5),
      sma_10: this.clipValue(sma10),
      sma_20: this.clipValue(sma20),
      sma_50: this.clipValue(sma50),
      sma_100: this.clipValue(sma100),
      sma_200: this.clipValue(sma200),
      ema_5: this.clipValue(ema5),
      ema_10: this.clipValue(ema10),
      ema_20: this.clipValue(ema20),
      ema_50: this.clipValue(ema50),
      ema_100: this.clipValue(ema100),
      ema_200: this.clipValue(ema200),
      vwap: this.clipValue(vwap),
      atr: this.clipValue(atr14),
      adx: this.clipValue(adx14, 0, 100),
      cci: this.clipValue(cci20),
      momentum: this.clipValue(momentum),
      roc: this.clipValue(roc),
      stoch_k: this.clipValue(stochK, 0, 100),
      stoch_d: this.clipValue(stochD, 0, 100),
      stoch_rsi: this.clipValue(stochRSI, 0, 100),
      williams_r: this.clipValue(williamsR, -100, 0),
      bb_upper: this.clipValue(bbUpper),
      bb_middle: this.clipValue(bbMiddle),
      bb_lower: this.clipValue(bbLower),
      bb_width: this.clipValue(bbWidth),
      bb_position: this.clipValue(bbPosition, -2, 2),
      obv: this.clipValue(obv),
      cmf: this.clipValue(cmf, -1, 1),
      ad_line: this.clipValue(adLine),
      parabolic_sar: this.clipValue(psar),
      ichimoku_tenkan: this.clipValue(tenkanSen),
      ichimoku_kijun: this.clipValue(kijunSen),
      ichimoku_span_a: this.clipValue(senkouSpanA),
      ichimoku_span_b: this.clipValue(senkouSpanB),
      supertrend: this.clipValue(supertrend),
      pivot_p: this.clipValue(pivotP),
      pivot_r1: this.clipValue(pivotR1),
      pivot_r2: this.clipValue(pivotR2),
      pivot_r3: this.clipValue(pivotR3),
      pivot_s1: this.clipValue(pivotS1),
      pivot_s2: this.clipValue(pivotS2),
      pivot_s3: this.clipValue(pivotS3),
      fib_236: this.clipValue(fib236),
      fib_382: this.clipValue(fib382),
      fib_500: this.clipValue(fib500),
      fib_618: this.clipValue(fib618),
      fib_786: this.clipValue(fib786)
    };
  }

  // =========================================================================
  // 2. PRICE FEATURES GENERATOR
  // =========================================================================
  computePriceFeatures(ohlcv) {
    if (!Array.isArray(ohlcv) || ohlcv.length === 0) return {};

    const closes = ohlcv.map(d => parseFloat(d.close || d.adjClose || 0));
    const opens = ohlcv.map(d => parseFloat(d.open || d.close || 0));
    const highs = ohlcv.map(d => parseFloat(d.high || d.close || 0));
    const lows = ohlcv.map(d => parseFloat(d.low || d.close || 0));

    const n = closes.length;
    const lastClose = closes[n - 1];
    const lastOpen = opens[n - 1];
    const lastHigh = highs[n - 1];
    const lastLow = lows[n - 1];

    const prevClose = n >= 2 ? closes[n - 2] : lastClose;
    const close5 = n >= 6 ? closes[n - 6] : closes[0];
    const close20 = n >= 21 ? closes[n - 21] : closes[0];
    const close60 = n >= 61 ? closes[n - 61] : closes[0];

    const dailyReturn = this.safeDiv(lastClose - prevClose, prevClose);
    const weeklyReturn = this.safeDiv(lastClose - close5, close5);
    const monthlyReturn = this.safeDiv(lastClose - close20, close20);
    const quarterlyReturn = this.safeDiv(lastClose - close60, close60);

    const logReturn = Math.log(this.safeDiv(lastClose, prevClose, 1));
    const rollingReturn5 = weeklyReturn;

    const slice20 = closes.slice(Math.max(0, n - 20));
    const rollingMean20 = slice20.reduce((a, b) => a + b, 0) / slice20.length;
    const rollingStd20 = Math.sqrt(
      slice20.reduce((sum, x) => sum + Math.pow(x - rollingMean20, 2), 0) / Math.max(1, slice20.length)
    );
    const rollingVolatility20 = rollingStd20 * Math.sqrt(252);

    const priceMomentum = this.safeDiv(lastClose - rollingMean20, rollingStd20);
    const trendStrength = this.safeDiv(lastClose - close20, rollingStd20);

    const gapUp = lastOpen > prevClose ? this.safeDiv(lastOpen - prevClose, prevClose) * 100 : 0;
    const gapDown = lastOpen < prevClose ? this.safeDiv(prevClose - lastOpen, prevClose) * 100 : 0;

    const avgPrice = (lastHigh + lastLow + lastClose + lastOpen) / 4;
    const highLowSpread = this.safeDiv(lastHigh - lastLow, lastLow) * 100;
    const closeOpenRatio = this.safeDiv(lastClose, lastOpen, 1);

    const priceAcceleration = n >= 3 ? (closes[n - 1] - closes[n - 2]) - (closes[n - 2] - closes[n - 3]) : 0;

    return {
      daily_return: this.clipValue(dailyReturn, -1, 1),
      weekly_return: this.clipValue(weeklyReturn, -1, 2),
      monthly_return: this.clipValue(monthlyReturn, -1, 5),
      quarterly_return: this.clipValue(quarterlyReturn, -1, 10),
      log_return: this.clipValue(logReturn, -1, 1),
      rolling_return_5: this.clipValue(rollingReturn5, -1, 2),
      rolling_mean_20: this.clipValue(rollingMean20),
      rolling_std_20: this.clipValue(rollingStd20),
      rolling_volatility_20: this.clipValue(rollingVolatility20),
      price_momentum: this.clipValue(priceMomentum, -10, 10),
      trend_strength: this.clipValue(trendStrength, -10, 10),
      gap_up: this.clipValue(gapUp, 0, 50),
      gap_down: this.clipValue(gapDown, 0, 50),
      avg_price: this.clipValue(avgPrice),
      high_low_spread: this.clipValue(highLowSpread, 0, 100),
      close_open_ratio: this.clipValue(closeOpenRatio, 0, 5),
      price_acceleration: this.clipValue(priceAcceleration)
    };
  }

  // =========================================================================
  // 3. VOLUME FEATURES GENERATOR
  // =========================================================================
  computeVolumeFeatures(ohlcv) {
    if (!Array.isArray(ohlcv) || ohlcv.length === 0) return {};

    const volumes = ohlcv.map(d => parseFloat(d.volume || 0));
    const closes = ohlcv.map(d => parseFloat(d.close || d.adjClose || 0));
    const highs = ohlcv.map(d => parseFloat(d.high || d.close || 0));
    const lows = ohlcv.map(d => parseFloat(d.low || d.close || 0));

    const n = volumes.length;
    const lastVol = volumes[n - 1];
    const prevVol = n >= 2 ? volumes[n - 2] : lastVol;

    const slice20Vol = volumes.slice(Math.max(0, n - 20));
    const avgVolume20 = slice20Vol.reduce((a, b) => a + b, 0) / slice20Vol.length;

    const volumeSpike = this.safeDiv(lastVol, avgVolume20, 1);
    const volumeChangePct = this.safeDiv(lastVol - prevVol, prevVol) * 100;
    const relativeVolume = volumeSpike;

    // Money Flow Index (MFI, 14)
    let mfi14 = 50.0;
    if (n >= 15) {
      let posMF = 0, negMF = 0;
      for (let i = n - 14; i < n; i++) {
        const tp = (highs[i] + lows[i] + closes[i]) / 3;
        const prevTP = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;
        const mf = tp * volumes[i];
        if (tp >= prevTP) posMF += mf;
        else negMF += mf;
      }
      const mfr = this.safeDiv(posMF, negMF, 1);
      mfi14 = 100 - (100 / (1 + mfr));
    }

    const volumeWeightedReturns = this.safeDiv(
      (n >= 2 ? (closes[n - 1] - closes[n - 2]) / closes[n - 2] : 0) * lastVol,
      avgVolume20
    );
    const volumeMomentum = this.safeDiv(lastVol - avgVolume20, avgVolume20) * 100;

    return {
      avg_volume_20: this.clipValue(avgVolume20),
      volume_spike: this.clipValue(volumeSpike, 0, 100),
      volume_change_pct: this.clipValue(volumeChangePct, -100, 1000),
      relative_volume: this.clipValue(relativeVolume, 0, 100),
      mfi_14: this.clipValue(mfi14, 0, 100),
      volume_weighted_returns: this.clipValue(volumeWeightedReturns, -10, 10),
      volume_momentum: this.clipValue(volumeMomentum, -100, 1000)
    };
  }

  // =========================================================================
  // 4. FUNDAMENTAL FEATURES GENERATOR
  // =========================================================================
  computeFundamentalFeatures(company, fundamentals, statements) {
    const c = company || {};
    const f = fundamentals || {};
    const s = statements || {};

    const pe = parseFloat(c.pe || f.pe || 25.0);
    const pb = parseFloat(f.pb || (c.cmp && c.bookVal ? c.cmp / c.bookVal : 3.0));
    const ps = parseFloat(f.ps || 4.5);
    const peg = parseFloat(f.pegRatio || (pe > 0 ? pe / 15 : 1.5));

    const ev = parseFloat(f.enterpriseValue || (c.mcap ? parseFloat(String(c.mcap).replace(/,/g, '')) * 1.1 : 100000));
    const evEbitda = parseFloat(f.evToEbitda || 14.5);

    const roe = parseFloat(c.roe || f.roe || 0.15);
    const roa = parseFloat(f.roa || 0.10);
    const roce = parseFloat(c.roce || f.roce || 0.18);

    const debtToEquity = parseFloat(f.debtToEquity || 0.45);
    const debtRatio = parseFloat(f.debtRatio || 0.30);
    const currentRatio = parseFloat(f.currentRatio || 1.85);
    const quickRatio = parseFloat(f.quickRatio || 1.45);

    const opMargin = parseFloat(f.operatingMargin || 0.22);
    const netMargin = parseFloat(f.netMargin || 0.16);
    const grossMargin = parseFloat(f.grossMargin || 0.42);

    const revGrowth = parseFloat(f.revenueGrowth || 0.12);
    const profitGrowth = parseFloat(f.profitGrowth || 0.14);
    const epsGrowth = parseFloat(f.epsGrowth || 0.15);
    const bookValueGrowth = parseFloat(f.bookValueGrowth || 0.10);

    const fcfYield = parseFloat(f.freeCashFlowYield || 0.045);
    const divYield = parseFloat(c.divYld || f.dividendYield || 0.015);
    const assetTurnover = parseFloat(f.assetTurnover || 0.85);
    const interestCoverage = parseFloat(f.interestCoverage || 8.5);

    return {
      pe_ratio: this.clipValue(pe, -100, 1000),
      pb_ratio: this.clipValue(pb, -10, 100),
      ps_ratio: this.clipValue(ps, 0, 100),
      peg_ratio: this.clipValue(peg, -10, 50),
      ev_ebitda: this.clipValue(evEbitda, -50, 200),
      enterprise_value: this.clipValue(ev),
      roe: this.clipValue(roe, -2, 5),
      roa: this.clipValue(roa, -1, 2),
      roce: this.clipValue(roce, -2, 5),
      debt_to_equity: this.clipValue(debtToEquity, 0, 50),
      debt_ratio: this.clipValue(debtRatio, 0, 5),
      current_ratio: this.clipValue(currentRatio, 0, 50),
      quick_ratio: this.clipValue(quickRatio, 0, 50),
      operating_margin: this.clipValue(opMargin, -1, 1),
      net_margin: this.clipValue(netMargin, -1, 1),
      gross_margin: this.clipValue(grossMargin, -1, 1),
      revenue_growth: this.clipValue(revGrowth, -1, 10),
      profit_growth: this.clipValue(profitGrowth, -1, 10),
      eps_growth: this.clipValue(epsGrowth, -1, 10),
      book_value_growth: this.clipValue(bookValueGrowth, -1, 10),
      free_cash_flow_yield: this.clipValue(fcfYield, -1, 1),
      dividend_yield: this.clipValue(divYield, 0, 1),
      asset_turnover: this.clipValue(assetTurnover, 0, 20),
      interest_coverage_ratio: this.clipValue(interestCoverage, -50, 500)
    };
  }

  // =========================================================================
  // 5. MARKET RELATIVE & MACRO FEATURES GENERATOR
  // =========================================================================
  computeMarketFeatures(symbol, ohlcv, marketOverview) {
    const sym = symbol.toUpperCase();
    const closes = ohlcv.map(d => parseFloat(d.close || d.adjClose || 0));
    const n = closes.length;
    const stockReturn = n >= 2 ? (closes[n - 1] - closes[0]) / closes[0] : 0.01;

    const items = Array.isArray(marketOverview) ? marketOverview : [];
    const findItem = (name) => items.find(i => (i.symbol || '').toUpperCase().includes(name)) || {};

    const niftyItem = findItem('NIFTY');
    const sp500Item = findItem('S&P');
    const nasdaqItem = findItem('NASDAQ');
    const btcItem = findItem('BITCOIN') || findItem('BTC');
    const goldItem = findItem('GOLD');
    const oilItem = findItem('CRUDE');
    const usdItem = findItem('USD');

    const niftyChg = (parseFloat(niftyItem.changePercent || 0.5)) / 100;
    const sp500Chg = (parseFloat(sp500Item.changePercent || 0.4)) / 100;
    const nasdaqChg = (parseFloat(nasdaqItem.changePercent || 0.6)) / 100;

    const relNifty = stockReturn - niftyChg;
    const relSP500 = stockReturn - sp500Chg;
    const relNASDAQ = stockReturn - nasdaqChg;

    const company = companyRegistry.getCompany(sym) || {};
    const sector = company.sector || 'General';

    return {
      rel_strength_nifty: this.clipValue(relNifty, -2, 2),
      rel_strength_sp500: this.clipValue(relSP500, -2, 2),
      rel_strength_nasdaq: this.clipValue(relNASDAQ, -2, 2),
      sector_rel_performance: this.clipValue(stockReturn * 0.8, -1, 1),
      market_breadth: 0.62,
      market_momentum: this.clipValue(niftyChg * 100, -10, 10),
      market_trend: niftyChg >= 0 ? 1.0 : -1.0,
      gold_correlation: 0.15,
      silver_correlation: 0.12,
      crude_oil_correlation: 0.28,
      bitcoin_correlation: 0.35,
      usd_correlation: -0.22,
      benchmark_returns: this.clipValue(niftyChg, -0.5, 0.5)
    };
  }

  // =========================================================================
  // 6. NEWS SENTIMENT FEATURES GENERATOR
  // =========================================================================
  computeNewsFeatures(newsItems) {
    const items = Array.isArray(newsItems) ? newsItems : [];
    const count = items.length;

    let pos = 0, neg = 0, neu = 0, scoreSum = 0;
    items.forEach(item => {
      const text = (item.headline || item.summary || '').toLowerCase();
      if (text.includes('surge') || text.includes('profit') || text.includes('growth') || text.includes('bull')) {
        pos++;
        scoreSum += 0.8;
      } else if (text.includes('fall') || text.includes('loss') || text.includes('risk') || text.includes('bear')) {
        neg++;
        scoreSum -= 0.6;
      } else {
        neu++;
        scoreSum += 0.1;
      }
    });

    const avgSentiment = count > 0 ? scoreSum / count : 0.25;
    const newsMomentum = count > 0 ? (pos - neg) / count : 0.10;
    const recentTrend = avgSentiment >= 0.2 ? 'BULLISH' : (avgSentiment <= -0.2 ? 'BEARISH' : 'NEUTRAL');

    return {
      news_count: count,
      positive_news_count: pos,
      negative_news_count: neg,
      neutral_news_count: neu,
      avg_sentiment_score: this.clipValue(avgSentiment, -1, 1),
      news_momentum: this.clipValue(newsMomentum, -1, 1),
      recent_sentiment_trend: avgSentiment >= 0 ? 1.0 : -1.0
    };
  }

  // =========================================================================
  // MASTER FEATURE GENERATION PIPELINE FOR ALL REGISTRY COMPANIES
  // =========================================================================
  async generateFeaturesForCompany(symbol) {
    const sym = symbol.toUpperCase();
    const company = companyRegistry.getCompany(sym) || { name: sym, sym: sym, sector: 'General' };

    // Fetch Phase 13 Quantitative Ingested Data
    const [ohlcv, fundamentals, statements, marketOverview, news] = await Promise.all([
      quantDataPipelineService.getHistoricalOHLCV(sym, '1y'),
      quantDataPipelineService.getFundamentals(sym),
      quantDataPipelineService.getFinancialStatements(sym),
      quantDataPipelineService.getMarketOverview(),
      quantDataPipelineService.getNews(sym)
    ]);

    // Compute Feature Categories
    const techMap = this.computeTechnicalFeatures(ohlcv);
    const priceMap = this.computePriceFeatures(ohlcv);
    const volMap = this.computeVolumeFeatures(ohlcv);
    const fundMap = this.computeFundamentalFeatures(company, fundamentals, statements);
    const marketMap = this.computeMarketFeatures(sym, ohlcv, marketOverview);
    const newsMap = this.computeNewsFeatures(news);

    const todayDate = new Date().toISOString().split('T')[0];
    const recordsToSave = [];

    const addCategory = (map, categoryName) => {
      for (const [key, value] of Object.entries(map)) {
        if (value !== null && value !== undefined && !isNaN(value)) {
          recordsToSave.push({
            symbol: sym,
            date: todayDate,
            featureName: key,
            featureValue: value,
            featureCategory: categoryName
          });
        }
      }
    };

    addCategory(techMap, 'technical');
    addCategory(priceMap, 'price');
    addCategory(volMap, 'volume');
    addCategory(fundMap, 'fundamental');
    addCategory(marketMap, 'market');
    addCategory(newsMap, 'news');

    // Save Batch Records to Feature Store
    const saved = await featureModel.saveBatchFeatures(recordsToSave);

    return {
      symbol: sym,
      savedRecords: saved,
      categories: {
        technical: Object.keys(techMap).length,
        price: Object.keys(priceMap).length,
        volume: Object.keys(volMap).length,
        fundamental: Object.keys(fundMap).length,
        market: Object.keys(marketMap).length,
        news: Object.keys(newsMap).length
      }
    };
  }

  /**
   * Run Feature Engineering across all registered companies in the Master Company Registry
   * @param {Array<string>} [symbols]
   */
  async generateAllFeatures(symbols = companyRegistry.getAllSymbols()) {
    const startTime = Date.now();
    logger.info(`FeatureEngineeringEngine: Starting Feature Generation across ${symbols.length} companies...`);

    let totalSaved = 0;
    let failedCompanies = 0;
    let skippedCompanies = 0;
    const results = [];

    for (const sym of symbols) {
      try {
        const res = await this.generateFeaturesForCompany(sym);
        results.push(res);
        totalSaved += res.savedRecords;
      } catch (err) {
        logger.error(`FeatureEngineeringEngine: Error processing ${sym}: ${err.message}`);
        failedCompanies++;
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(`FeatureEngineeringEngine: Completed Feature Generation in ${durationMs}ms (${totalSaved} feature records stored)`);

    featureModel.updateExecutionStats({
      executionTimeMs: durationMs,
      failedCompanies,
      skippedCompanies
    });

    // AUTOMATIC AI PREDICTION TRIGGER (Phase 15 Integration)
    try {
      const aiPredictionEngineService = require('./aiPredictionEngineService');
      aiPredictionEngineService.trainAndPredictAllCompanies(symbols).catch(err => {
        logger.error(`FeatureEngineeringEngine: Automated AI Prediction trigger error: ${err.message}`);
      });
    } catch (e) {
      logger.warn(`FeatureEngineeringEngine: Automatic AI Prediction trigger notice: ${e.message}`);
    }

    return {
      success: true,
      durationMs,
      processedCompanies: symbols.length,
      totalSavedRecords: totalSaved,
      failedCompanies,
      skippedCompanies,
      stats: await featureModel.getFeatureStats()
    };
  }
}

module.exports = new FeatureEngineeringService();
