const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * In-Memory Fallback Backtest Store
 * Used when PostgreSQL database is offline.
 */
const inMemoryBacktestStore = {
  // Map: runId -> runRecord
  runs: new Map(),
  // Map: runId -> Array<tradeRecord>
  trades: new Map(),
  nextRunId: 1,
  nextTradeId: 1,
  stats: {
    totalRuns: 0,
    totalTrades: 0,
    companiesProcessed: 0,
    executionTimeMs: 0,
    lastRunAt: null
  }
};

class BacktestModel {
  /**
   * Save a completed backtest run and its executed trades
   */
  async saveBacktestRun(runData) {
    const sym = runData.symbol.toUpperCase();
    const strat = runData.strategyName || 'AI_PREDICTION';
    const isDb = db.isDbConnected();

    if (isDb) {
      try {
        const runRes = await db.query(
          `INSERT INTO quant_backtest_runs (
            symbol, strategy_name, initial_capital, final_equity, total_return,
            cagr, sharpe_ratio, sortino_ratio, max_drawdown, win_rate, metrics, equity_curve, benchmark_comparison
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [
            sym,
            strat,
            runData.initialCapital,
            runData.finalEquity,
            runData.totalReturnPct,
            runData.cagr,
            runData.sharpeRatio,
            runData.sortinoRatio,
            runData.maxDrawdownPct,
            runData.winRatePct,
            JSON.stringify(runData.metrics || {}),
            JSON.stringify(runData.equityCurve || []),
            JSON.stringify(runData.benchmarkComparison || {})
          ]
        );

        const runRecord = runRes.rows[0];
        const runId = runRecord.id;

        if (Array.isArray(runData.trades) && runData.trades.length > 0) {
          for (const t of runData.trades) {
            await db.query(
              `INSERT INTO quant_backtest_trades (
                backtest_run_id, symbol, entry_date, exit_date, entry_price,
                exit_price, quantity, pnl, return_pct, holding_period_days, signal, trade_reason
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                runId, sym, t.entryDate, t.exitDate, t.entryPrice,
                t.exitPrice, t.quantity, t.pnl, t.returnPct, t.holdingPeriodDays, t.signal, t.tradeReason
              ]
            );
          }
        }

        return runRecord;
      } catch (err) {
        logger.error(`BacktestModel DB Insert Error for ${sym}/${strat}: ${err.message}`);
        return runData;
      }
    } else {
      const runId = inMemoryBacktestStore.nextRunId++;
      const runObj = {
        id: runId,
        symbol: sym,
        strategy_name: strat,
        initial_capital: runData.initialCapital,
        final_equity: runData.finalEquity,
        total_return: runData.totalReturnPct,
        cagr: runData.cagr,
        sharpe_ratio: runData.sharpeRatio,
        sortino_ratio: runData.sortinoRatio,
        max_drawdown: runData.maxDrawdownPct,
        win_rate: runData.winRatePct,
        metrics: runData.metrics || {},
        equity_curve: runData.equityCurve || [],
        benchmark_comparison: runData.benchmarkComparison || {},
        created_at: new Date().toISOString()
      };

      inMemoryBacktestStore.runs.set(runId, runObj);

      const tradeList = [];
      if (Array.isArray(runData.trades)) {
        runData.trades.forEach(t => {
          tradeList.push({
            id: inMemoryBacktestStore.nextTradeId++,
            backtest_run_id: runId,
            symbol: sym,
            entry_date: t.entryDate,
            exit_date: t.exitDate,
            entry_price: t.entryPrice,
            exit_price: t.exitPrice,
            quantity: t.quantity,
            pnl: t.pnl,
            return_pct: t.returnPct,
            holding_period_days: t.holdingPeriodDays,
            signal: t.signal,
            trade_reason: t.tradeReason
          });
        });
      }
      inMemoryBacktestStore.trades.set(runId, tradeList);

      inMemoryBacktestStore.stats.totalRuns++;
      inMemoryBacktestStore.stats.totalTrades += tradeList.length;
      inMemoryBacktestStore.stats.lastRunAt = new Date().toISOString();

      return runObj;
    }
  }

  /**
   * Get latest backtest run for a symbol and strategy
   */
  async getLatestRun(symbol, strategyName = 'AI_PREDICTION') {
    const sym = symbol.toUpperCase();

    if (db.isDbConnected()) {
      const res = await db.query(
        `SELECT * FROM quant_backtest_runs
         WHERE symbol = $1 AND strategy_name = $2
         ORDER BY created_at DESC LIMIT 1`,
        [sym, strategyName]
      );
      return res.rows[0] || null;
    } else {
      for (const run of Array.from(inMemoryBacktestStore.runs.values()).reverse()) {
        if (run.symbol === sym && run.strategy_name === strategyName) {
          return run;
        }
      }
      return null;
    }
  }

  /**
   * Get trade history for a backtest run ID or symbol
   */
  async getTradeLedger(runId, symbol) {
    if (db.isDbConnected()) {
      let q = `SELECT * FROM quant_backtest_trades WHERE 1=1`;
      const params = [];
      if (runId) {
        params.push(runId);
        q += ` AND backtest_run_id = $${params.length}`;
      }
      if (symbol) {
        params.push(symbol.toUpperCase());
        q += ` AND symbol = $${params.length}`;
      }
      q += ` ORDER BY entry_date DESC LIMIT 100`;
      const res = await db.query(q, params);
      return res.rows;
    } else {
      if (runId) {
        return inMemoryBacktestStore.trades.get(parseInt(runId, 10)) || [];
      }
      const allTrades = [];
      for (const trades of inMemoryBacktestStore.trades.values()) {
        for (const t of trades) {
          if (!symbol || t.symbol === symbol.toUpperCase()) {
            allTrades.push(t);
          }
        }
      }
      return allTrades.slice(0, 100);
    }
  }

  /**
   * Save AI Prediction Validation result
   */
  async saveAiValidation(valData) {
    const sym = (valData.symbol || 'AAPL').toUpperCase();
    if (db.isDbConnected()) {
      try {
        const res = await db.query(
          `INSERT INTO quant_ai_validation (
            symbol, mae, rmse, mape, directional_accuracy, buy_accuracy, sell_accuracy, hold_accuracy, eval_metrics
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            sym,
            valData.mae || 0,
            valData.rmse || 0,
            valData.mape || 0,
            valData.directionalAccuracy || 0,
            valData.buyAccuracy || 0,
            valData.sellAccuracy || 0,
            valData.holdAccuracy || 0,
            JSON.stringify(valData.evalMetrics || {})
          ]
        );
        return res.rows[0];
      } catch (err) {
        logger.error(`BacktestModel DB AI Validation Insert Error for ${sym}: ${err.message}`);
        return valData;
      }
    } else {
      if (!inMemoryBacktestStore.aiValidation) inMemoryBacktestStore.aiValidation = new Map();
      inMemoryBacktestStore.aiValidation.set(sym, {
        symbol: sym,
        mae: valData.mae || 0,
        rmse: valData.rmse || 0,
        mape: valData.mape || 0,
        directional_accuracy: valData.directionalAccuracy || 0,
        buy_accuracy: valData.buyAccuracy || 0,
        sell_accuracy: valData.sellAccuracy || 0,
        hold_accuracy: valData.holdAccuracy || 0,
        eval_metrics: valData.evalMetrics || {},
        created_at: new Date().toISOString()
      });
      return inMemoryBacktestStore.aiValidation.get(sym);
    }
  }

  /**
   * Get AI Prediction Validation result for symbol
   */
  async getAiValidation(symbol) {
    const sym = symbol.toUpperCase();
    if (db.isDbConnected()) {
      const res = await db.query(
        `SELECT * FROM quant_ai_validation WHERE symbol = $1 ORDER BY created_at DESC LIMIT 1`,
        [sym]
      );
      return res.rows[0] || null;
    } else {
      if (!inMemoryBacktestStore.aiValidation) return null;
      return inMemoryBacktestStore.aiValidation.get(sym) || null;
    }
  }

  /**
   * Get all runs for a given symbol across different strategies
   */
  async getRunsForSymbol(symbol) {
    const sym = symbol.toUpperCase();
    if (db.isDbConnected()) {
      const res = await db.query(
        `SELECT * FROM quant_backtest_runs WHERE symbol = $1 ORDER BY created_at DESC`,
        [sym]
      );
      return res.rows;
    } else {
      const runs = [];
      for (const run of inMemoryBacktestStore.runs.values()) {
        if (run.symbol === sym) {
          runs.push(run);
        }
      }
      return runs;
    }
  }

  /**
   * Get backtest engine monitoring stats
   */
  async getBacktestStats() {
    if (db.isDbConnected()) {
      const runRes = await db.query(`SELECT COUNT(*) as total_runs, COUNT(DISTINCT symbol) as companies FROM quant_backtest_runs`);
      const tradeRes = await db.query(`SELECT COUNT(*) as total_trades FROM quant_backtest_trades`);
      const latestRes = await db.query(`SELECT MAX(created_at) as last_run FROM quant_backtest_runs`);

      return {
        databaseStatus: 'PostgreSQL Backtest Store Active',
        companiesProcessed: parseInt(runRes.rows[0].companies || 0, 10),
        totalBacktestRuns: parseInt(runRes.rows[0].total_runs || 0, 10),
        totalTradesExecuted: parseInt(tradeRes.rows[0].total_trades || 0, 10),
        lastRunAt: latestRes.rows[0] ? latestRes.rows[0].last_run : new Date().toISOString()
      };
    } else {
      return {
        databaseStatus: 'In-Memory Backtest Store Active (PostgreSQL Offline)',
        companiesProcessed: inMemoryBacktestStore.stats.companiesProcessed || inMemoryBacktestStore.runs.size,
        totalBacktestRuns: inMemoryBacktestStore.stats.totalRuns,
        totalTradesExecuted: inMemoryBacktestStore.stats.totalTrades,
        executionTimeMs: inMemoryBacktestStore.stats.executionTimeMs,
        lastRunAt: inMemoryBacktestStore.stats.lastRunAt
      };
    }
  }

  updateExecutionStats({ executionTimeMs, companiesProcessed }) {
    inMemoryBacktestStore.stats.executionTimeMs = executionTimeMs;
    inMemoryBacktestStore.stats.companiesProcessed = companiesProcessed;
  }
}

module.exports = new BacktestModel();
