const { Pool } = require('pg');
const { PGlite } = require('@electric-sql/pglite');
const path = require('path');
const fs = require('fs');
const config = require('./env.config');
const logger = require('../utils/logger');

let pool = null;
let pgliteInstance = null;
let dbEngine = null; // 'PG_POOL' or 'PGLITE'
let isConnected = false;

const STORAGE_DIR = path.join(__dirname, '../storage/pgdata');
const STORE_JSON_PATH = path.join(__dirname, '../storage/db_store.json');

/**
 * Reinitialize PGlite instance cleanly without wiping disk files
 */
async function reinitializePGlite() {
  try {
    if (logger && logger.warn) logger.warn('Re-evaluating PGlite connection state...');
    try {
      pgliteInstance = new PGlite(STORAGE_DIR);
      if (pgliteInstance.waitReady) await pgliteInstance.waitReady;
    } catch (_) {
      pgliteInstance = new PGlite();
      if (pgliteInstance.waitReady) await pgliteInstance.waitReady;
    }
    dbEngine = 'PGLITE';
    isConnected = true;
    await createSchemaTables();
    await loadDatabaseFromDisk();
    if (logger && logger.info) logger.info('PGlite reinitialized successfully');
    return true;
  } catch (err) {
    if (logger && logger.error) logger.error(`PGlite reinit failed: ${err.message}`);
    return false;
  }
}

let syncTimer = null;
let disableDiskSync = false;

function scheduleDiskSync() {
  if (disableDiskSync) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncDatabaseToDisk().catch(() => {});
  }, 1000);
}

// Ensure pending disk sync flushes on process exit
process.on('beforeExit', () => {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncDatabaseToDisk().catch(() => {});
  }
});

/**
 * Standardized Query Executor (PostgreSQL Pool & PGlite Compatible)
 */
async function query(text, params = []) {
  if (!isConnected) {
    throw new Error('Database connection not initialized');
  }

  let result;
  if (dbEngine === 'PG_POOL' && pool) {
    result = await pool.query(text, params);
  } else if (dbEngine === 'PGLITE' && pgliteInstance) {
    try {
      if (pgliteInstance.waitReady) await pgliteInstance.waitReady;
      const res = await pgliteInstance.query(text, params);
      result = {
        rows: res.rows || [],
        rowCount: res.rows ? res.rows.length : 0,
        fields: res.fields || []
      };
    } catch (pglErr) {
      const msg = (pglErr && pglErr.message) ? pglErr.message : String(pglErr);
      if (msg.includes('Aborted') || msg.includes('abort') || msg.includes('WASM') || msg.includes('memory')) {
        const recovered = await reinitializePGlite();
        if (recovered) {
          const res = await pgliteInstance.query(text, params);
          result = { rows: res.rows || [], rowCount: res.rows ? res.rows.length : 0, fields: res.fields || [] };
        } else {
          throw pglErr;
        }
      } else {
        throw pglErr;
      }
    }
  } else {
    throw new Error('No active PostgreSQL driver available');
  }

  // Trigger debounced disk sync for mutating statements
  const isMutating = /^\s*(INSERT|UPDATE|DELETE)\b/i.test(text);
  if (isMutating && !disableDiskSync) {
    scheduleDiskSync();
  }

  return result;
}

/**
 * Standardized Multi-Statement DDL Executor
 */
async function exec(sql) {
  if (!isConnected) {
    throw new Error('Database connection not initialized');
  }

  if (dbEngine === 'PG_POOL' && pool) {
    return await pool.query(sql);
  } else if (dbEngine === 'PGLITE' && pgliteInstance) {
    try {
      if (pgliteInstance.waitReady) await pgliteInstance.waitReady;
      return await pgliteInstance.exec(sql);
    } catch (pglErr) {
      const msg = (pglErr && pglErr.message) ? pglErr.message : String(pglErr);
      if (msg.includes('Aborted') || msg.includes('abort') || msg.includes('WASM') || msg.includes('memory')) {
        const recovered = await reinitializePGlite();
        if (recovered) {
          return await pgliteInstance.exec(sql);
        }
      }
      throw pglErr;
    }
  } else {
    throw new Error('No active PostgreSQL driver available');
  }
}

/**
 * Update primary key sequences for PostgreSQL / PGlite tables
 */
async function updateSequences() {
  const seqs = [
    { table: 'users', seq: 'users_id_seq' },
    { table: 'user_preferences', seq: 'user_preferences_id_seq' },
    { table: 'watchlist', seq: 'watchlist_id_seq' },
    { table: 'portfolio', seq: 'portfolio_id_seq' },
    { table: 'prediction_history', seq: 'prediction_history_id_seq' },
    { table: 'alerts', seq: 'alerts_id_seq' },
    { table: 'experiments', seq: 'experiments_id_seq' },
    { table: 'paper_accounts', seq: 'paper_accounts_id_seq' },
    { table: 'paper_holdings', seq: 'paper_holdings_id_seq' },
    { table: 'paper_trades', seq: 'paper_trades_id_seq' }
  ];

  for (const item of seqs) {
    try {
      await query(`SELECT setval('${item.seq}', COALESCE((SELECT MAX(id) FROM ${item.table}), 1))`);
    } catch (_) {
      // Ignore if sequence not present
    }
  }
}

/**
 * Persist current state of database tables to disk (db_store.json)
 */
async function syncDatabaseToDisk() {
  try {
    const tables = [
      'users', 'user_preferences', 'watchlist', 'portfolio',
      'prediction_history', 'alerts', 'experiments', 'paper_accounts',
      'paper_holdings', 'paper_trades', 'ai_predictions', 'quant_backtest_runs',
      'quant_backtest_trades', 'saved_reports', 'mlops_models'
    ];
    const snapshot = {};
    for (const table of tables) {
      try {
        const res = await (dbEngine === 'PG_POOL' ? pool.query(`SELECT * FROM ${table}`) : pgliteInstance.query(`SELECT * FROM ${table}`));
        snapshot[table] = res.rows || [];
      } catch (_) {
        snapshot[table] = [];
      }
    }
    if (!fs.existsSync(path.dirname(STORE_JSON_PATH))) {
      fs.mkdirSync(path.dirname(STORE_JSON_PATH), { recursive: true });
    }
    fs.writeFileSync(STORE_JSON_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (err) {
    if (logger && logger.error) logger.error(`Disk sync error: ${err.message}`);
  }
}

/**
 * Load database snapshot from db_store.json back into DB tables
 */
async function loadDatabaseFromDisk() {
  if (!fs.existsSync(STORE_JSON_PATH)) return false;

  disableDiskSync = true;
  try {
    const raw = fs.readFileSync(STORE_JSON_PATH, 'utf8');
    if (!raw.trim()) return false;
    const snapshot = JSON.parse(raw);

    // Restore users
    if (Array.isArray(snapshot.users)) {
      for (const u of snapshot.users) {
        await query(
          `INSERT INTO users (id, email, password_hash, name, refresh_token, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash,
             name = EXCLUDED.name,
             refresh_token = EXCLUDED.refresh_token`,
          [u.id, u.email, u.password_hash, u.name || '', u.refresh_token || null, u.created_at || new Date()]
        );
      }
    }

    // Restore user_preferences
    if (Array.isArray(snapshot.user_preferences)) {
      for (const p of snapshot.user_preferences) {
        await query(
          `INSERT INTO user_preferences (id, user_id, theme, default_symbol, settings, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id) DO UPDATE SET
             theme = EXCLUDED.theme,
             default_symbol = EXCLUDED.default_symbol,
             settings = EXCLUDED.settings,
             updated_at = EXCLUDED.updated_at`,
          [p.id, p.user_id, p.theme, p.default_symbol, typeof p.settings === 'object' ? JSON.stringify(p.settings) : p.settings, p.updated_at || new Date()]
        );
      }
    }

    // Restore watchlist
    if (Array.isArray(snapshot.watchlist)) {
      for (const w of snapshot.watchlist) {
        await query(
          `INSERT INTO watchlist (id, user_id, symbol, created_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, symbol) DO NOTHING`,
          [w.id, w.user_id, w.symbol, w.created_at || new Date()]
        );
      }
    }

    // Restore portfolio
    if (Array.isArray(snapshot.portfolio)) {
      for (const pf of snapshot.portfolio) {
        await query(
          `INSERT INTO portfolio (id, user_id, symbol, shares, average_price, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, symbol) DO UPDATE SET
             shares = EXCLUDED.shares,
             average_price = EXCLUDED.average_price,
             updated_at = EXCLUDED.updated_at`,
          [pf.id, pf.user_id, pf.symbol, pf.shares, pf.average_price, pf.created_at || new Date(), pf.updated_at || new Date()]
        );
      }
    }

    // Restore prediction_history
    if (Array.isArray(snapshot.prediction_history)) {
      for (const ph of snapshot.prediction_history) {
        await query(
          `INSERT INTO prediction_history (id, user_id, symbol, predicted_price, target_date, confidence_score, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [ph.id, ph.user_id, ph.symbol, ph.predicted_price, ph.target_date, ph.confidence_score, ph.created_at || new Date()]
        );
      }
    }

    // Restore alerts
    if (Array.isArray(snapshot.alerts)) {
      for (const a of snapshot.alerts) {
        await query(
          `INSERT INTO alerts (id, user_id, symbol, target_price, alert_type, is_triggered, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [a.id, a.user_id, a.symbol, a.target_price, a.alert_type, a.is_triggered, a.created_at || new Date()]
        );
      }
    }

    // Restore paper_accounts
    if (Array.isArray(snapshot.paper_accounts)) {
      for (const pa of snapshot.paper_accounts) {
        await query(
          `INSERT INTO paper_accounts (id, user_id, balance, initial_balance, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id) DO UPDATE SET
             balance = EXCLUDED.balance,
             initial_balance = EXCLUDED.initial_balance`,
          [pa.id, pa.user_id, pa.balance, pa.initial_balance, pa.created_at || new Date()]
        );
      }
    }

    // Restore paper_holdings
    if (Array.isArray(snapshot.paper_holdings)) {
      for (const ph of snapshot.paper_holdings) {
        await query(
          `INSERT INTO paper_holdings (id, user_id, symbol, shares, average_price, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, symbol) DO UPDATE SET
             shares = EXCLUDED.shares,
             average_price = EXCLUDED.average_price,
             updated_at = EXCLUDED.updated_at`,
          [ph.id, ph.user_id, ph.symbol, ph.shares, ph.average_price, ph.created_at || new Date(), ph.updated_at || new Date()]
        );
      }
    }

    // Restore paper_trades
    if (Array.isArray(snapshot.paper_trades)) {
      for (const pt of snapshot.paper_trades) {
        await query(
          `INSERT INTO paper_trades (id, user_id, symbol, trade_type, shares, price, total_amount, realized_pnl, executed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [pt.id, pt.user_id, pt.symbol, pt.trade_type, pt.shares, pt.price, pt.total_amount, pt.realized_pnl, pt.executed_at || new Date()]
        );
      }
    }

    await updateSequences();
    return true;
  } catch (err) {
    if (logger && logger.error) logger.error(`Disk restore error: ${err.message}`);
    return false;
  } finally {
    disableDiskSync = false;
  }
}

/**
 * Execute DDL Schema Creation Statements Sequentially
 */
async function createSchemaTables() {
  const SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      refresh_token TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS user_preferences (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      theme VARCHAR(20) DEFAULT 'light',
      default_symbol VARCHAR(50) DEFAULT 'AAPL',
      settings JSONB DEFAULT '{}',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS watchlist (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, symbol)
    );`,
    `CREATE TABLE IF NOT EXISTS portfolio (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      shares NUMERIC(15, 4) NOT NULL DEFAULT 0,
      average_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, symbol)
    );`,
    `CREATE TABLE IF NOT EXISTS prediction_history (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      predicted_price NUMERIC(15, 4) NOT NULL,
      target_date TIMESTAMP WITH TIME ZONE,
      confidence_score NUMERIC(5, 2),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      target_price NUMERIC(15, 4) NOT NULL,
      alert_type VARCHAR(20) DEFAULT 'ABOVE',
      is_triggered BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS experiments (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      model_name VARCHAR(50) NOT NULL,
      strategy_name VARCHAR(50),
      date_range VARCHAR(50),
      indicators JSONB,
      metrics JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS paper_accounts (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      balance NUMERIC(15, 2) NOT NULL DEFAULT 1000000.00,
      initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 1000000.00,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS paper_holdings (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      shares NUMERIC(15, 4) NOT NULL DEFAULT 0,
      average_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, symbol)
    );`,
    `CREATE TABLE IF NOT EXISTS paper_trades (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      trade_type VARCHAR(10) NOT NULL,
      shares NUMERIC(15, 4) NOT NULL,
      price NUMERIC(15, 4) NOT NULL,
      total_amount NUMERIC(15, 2) NOT NULL,
      realized_pnl NUMERIC(15, 2) DEFAULT 0,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS quant_ohlcv (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
      open NUMERIC(15, 4) NOT NULL,
      high NUMERIC(15, 4) NOT NULL,
      low NUMERIC(15, 4) NOT NULL,
      close NUMERIC(15, 4) NOT NULL,
      adj_close NUMERIC(15, 4) NOT NULL,
      volume NUMERIC(20, 0) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, timestamp)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_quant_ohlcv_sym_time ON quant_ohlcv(symbol, timestamp DESC);`,
    `CREATE TABLE IF NOT EXISTS quant_fundamentals (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      market_cap NUMERIC(20, 2),
      enterprise_value NUMERIC(20, 2),
      revenue NUMERIC(20, 2),
      net_income NUMERIC(20, 2),
      gross_profit NUMERIC(20, 2),
      operating_income NUMERIC(20, 2),
      operating_margin NUMERIC(10, 4),
      eps NUMERIC(15, 4),
      book_value NUMERIC(15, 4),
      roe NUMERIC(10, 4),
      roa NUMERIC(10, 4),
      debt_to_equity NUMERIC(10, 4),
      current_ratio NUMERIC(10, 4),
      quick_ratio NUMERIC(10, 4),
      dividend_yield NUMERIC(10, 4),
      free_cash_flow NUMERIC(20, 2),
      total_assets NUMERIC(20, 2),
      total_liabilities NUMERIC(20, 2),
      cash NUMERIC(20, 2),
      shares_outstanding NUMERIC(20, 0),
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, timestamp)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_quant_fundamentals_sym ON quant_fundamentals(symbol, timestamp DESC);`,
    `CREATE TABLE IF NOT EXISTS quant_financial_statements (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      statement_type VARCHAR(50) NOT NULL,
      period_type VARCHAR(20) NOT NULL,
      statement_date VARCHAR(50),
      data JSONB NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, statement_type, period_type, statement_date)
    );`,
    `CREATE TABLE IF NOT EXISTS quant_market_data (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      price NUMERIC(15, 4) NOT NULL,
      change NUMERIC(15, 4),
      change_percent NUMERIC(10, 4),
      day_high NUMERIC(15, 4),
      day_low NUMERIC(15, 4),
      fifty_two_high NUMERIC(15, 4),
      fifty_two_low NUMERIC(15, 4),
      volume NUMERIC(20, 0),
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, timestamp)
    );`,
    `CREATE TABLE IF NOT EXISTS quant_news (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      headline TEXT NOT NULL,
      publisher VARCHAR(255),
      published_time TIMESTAMP WITH TIME ZONE,
      summary TEXT,
      url TEXT NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, url)
    );`,
    `CREATE TABLE IF NOT EXISTS engineered_features (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      date TIMESTAMP WITH TIME ZONE NOT NULL,
      feature_name VARCHAR(100) NOT NULL,
      feature_value NUMERIC(20, 6) NOT NULL,
      feature_category VARCHAR(50) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, date, feature_name)
    );`,
    `CREATE INDEX IF NOT EXISTS idx_eng_features_sym_cat ON engineered_features(symbol, feature_category, date DESC);`,
    `CREATE TABLE IF NOT EXISTS ai_models (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      model_name VARCHAR(100) NOT NULL,
      model_version VARCHAR(50) NOT NULL,
      model_type VARCHAR(50) NOT NULL,
      metrics JSONB NOT NULL,
      hyperparameters JSONB,
      trained_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, model_name, model_version)
    );`,
    `CREATE TABLE IF NOT EXISTS ai_predictions (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      current_price NUMERIC(15, 4) NOT NULL,
      predicted_price NUMERIC(15, 4) NOT NULL,
      predicted_return NUMERIC(10, 4) NOT NULL,
      signal VARCHAR(20) NOT NULL,
      confidence_score NUMERIC(5, 2) NOT NULL,
      expected_volatility NUMERIC(10, 4),
      expected_risk VARCHAR(50),
      prob_increase NUMERIC(5, 2),
      return_5d NUMERIC(10, 4),
      return_7d NUMERIC(10, 4),
      return_30d NUMERIC(10, 4),
      top_features JSONB,
      xai_reasons JSONB,
      best_model VARCHAR(100),
      model_version VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE INDEX IF NOT EXISTS idx_ai_preds_sym ON ai_predictions(symbol, created_at DESC);`,
    `CREATE TABLE IF NOT EXISTS quant_backtest_runs (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      strategy_name VARCHAR(100) NOT NULL,
      initial_capital NUMERIC(15, 2) NOT NULL,
      final_equity NUMERIC(15, 2) NOT NULL,
      total_return NUMERIC(10, 4) NOT NULL,
      cagr NUMERIC(10, 4),
      sharpe_ratio NUMERIC(10, 4),
      sortino_ratio NUMERIC(10, 4),
      max_drawdown NUMERIC(10, 4),
      win_rate NUMERIC(10, 4),
      metrics JSONB NOT NULL,
      equity_curve JSONB,
      benchmark_comparison JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS quant_backtest_trades (
      id SERIAL PRIMARY KEY,
      backtest_run_id INT REFERENCES quant_backtest_runs(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      entry_date TIMESTAMP WITH TIME ZONE NOT NULL,
      exit_date TIMESTAMP WITH TIME ZONE,
      entry_price NUMERIC(15, 4) NOT NULL,
      exit_price NUMERIC(15, 4),
      quantity NUMERIC(15, 4) NOT NULL,
      pnl NUMERIC(15, 2),
      return_pct NUMERIC(10, 4),
      holding_period_days INT,
      signal VARCHAR(20),
      trade_reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS quant_portfolio_snapshots (
      id SERIAL PRIMARY KEY,
      backtest_run_id INT REFERENCES quant_backtest_runs(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      date TIMESTAMP WITH TIME ZONE NOT NULL,
      equity NUMERIC(15, 2) NOT NULL,
      cash NUMERIC(15, 2) NOT NULL,
      drawdown_pct NUMERIC(10, 4) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS quant_ai_validation (
      id SERIAL PRIMARY KEY,
      symbol VARCHAR(50) NOT NULL,
      mae NUMERIC(15, 4) NOT NULL,
      rmse NUMERIC(15, 4) NOT NULL,
      mape NUMERIC(10, 4) NOT NULL,
      directional_accuracy NUMERIC(10, 4) NOT NULL,
      buy_accuracy NUMERIC(10, 4) NOT NULL,
      sell_accuracy NUMERIC(10, 4) NOT NULL,
      hold_accuracy NUMERIC(10, 4) NOT NULL,
      eval_metrics JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS saved_reports (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      symbol VARCHAR(50) NOT NULL,
      report_title VARCHAR(255) NOT NULL,
      report_type VARCHAR(50) NOT NULL,
      report_data JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS company_registry (
      id SERIAL PRIMARY KEY,
      sym VARCHAR(50) UNIQUE NOT NULL,
      ns VARCHAR(50),
      name VARCHAR(255) NOT NULL,
      sector VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS mlops_models (
      id VARCHAR(100) PRIMARY KEY,
      version VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      accuracy NUMERIC(10, 2) NOT NULL,
      dir_accuracy VARCHAR(50) NOT NULL,
      rmse NUMERIC(10, 4) NOT NULL,
      mae NUMERIC(10, 4) NOT NULL,
      mape NUMERIC(10, 4) NOT NULL,
      latency_p95_ms INT NOT NULL,
      trained_at VARCHAR(100) NOT NULL,
      author VARCHAR(100) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`
  ];

  for (const stmt of SCHEMA_STATEMENTS) {
    if (dbEngine === 'PG_POOL' && pool) {
      await pool.query(stmt);
    } else if (dbEngine === 'PGLITE' && pgliteInstance) {
      await pgliteInstance.exec(stmt);
    }
  }
}

/**
 * Auto-initialize PostgreSQL Database Schema & Persistent Connection
 */
async function initDatabase() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  // 1. Attempt connection to PostgreSQL Server (via pg.Pool)
  try {
    const tempPool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });

    const client = await tempPool.connect();
    client.release();
    pool = tempPool;
    dbEngine = 'PG_POOL';
    isConnected = true;
    if (logger && logger.info) logger.info('Successfully connected to external PostgreSQL Server');
  } catch (err) {
    // 2. Fallback to Embedded PostgreSQL (PGlite) storing database files in STORAGE_DIR
    try {
      pgliteInstance = new PGlite(STORAGE_DIR);
      if (pgliteInstance.waitReady) await pgliteInstance.waitReady;
      dbEngine = 'PGLITE';
      isConnected = true;
      if (logger && logger.info) logger.info(`Initialized Embedded PostgreSQL Engine at ${STORAGE_DIR}`);
    } catch (pgLiteErr) {
      try {
        pgliteInstance = new PGlite();
        if (pgliteInstance.waitReady) await pgliteInstance.waitReady;
        dbEngine = 'PGLITE';
        isConnected = true;
        if (logger && logger.info) logger.info(`Initialized In-Memory Embedded PostgreSQL Engine`);
      } catch (err2) {
        if (logger && logger.error) logger.error(`Failed to initialize PostgreSQL: ${err2.message}`);
        isConnected = false;
        return false;
      }
    }
  }

  // 3. Create Schema Tables (IF NOT EXISTS)
  try {
    await createSchemaTables();

    // Restore disk snapshot if available
    await loadDatabaseFromDisk();

    // 4. Seed Default User & Default Paper Account if empty
    await query(`
      INSERT INTO users (id, email, password_hash, name)
      VALUES (1, 'investor@stocksight.com', '$2a$10$demo_hash_key', 'Investor')
      ON CONFLICT (id) DO NOTHING;
    `);

    await query(`
      INSERT INTO paper_accounts (user_id, balance, initial_balance)
      VALUES (1, 1000000.00, 1000000.00)
      ON CONFLICT (user_id) DO NOTHING;
    `);

    // 5. Seed Company Registry if empty (Single Batch Insert)
    const compCheck = await query(`SELECT COUNT(*) as cnt FROM company_registry`);
    if (parseInt((compCheck.rows[0] && compCheck.rows[0].cnt) || 0, 10) === 0) {
      try {
        const companyRegistryData = require('./companyRegistry');
        const allComps = companyRegistryData.getAllCompanies();
        const values = [];
        const params = [];
        let idx = 1;
        for (const c of allComps) {
          if (c.sym) {
            values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
            params.push(c.sym, c.ns || null, c.name || c.sym, c.sector || 'General');
          }
        }
        if (values.length > 0) {
          await query(
            `INSERT INTO company_registry (sym, ns, name, sector)
             VALUES ${values.join(', ')}
             ON CONFLICT (sym) DO NOTHING`,
            params
          );
        }
      } catch (e) {
        if (logger && logger.error) logger.error(`Company registry seed error: ${e.message}`);
      }
    }

    // 6. Seed MLOps Models if empty (Single Batch Insert)
    const mlopsCheck = await query(`SELECT COUNT(*) as cnt FROM mlops_models`);
    if (parseInt((mlopsCheck.rows[0] && mlopsCheck.rows[0].cnt) || 0, 10) === 0) {
      const initialModels = [
        { id: 'm-350', version: 'v3.5.0 Ensemble', name: 'Transformer + XGBoost + LSTM Stack', status: 'CHAMPION', accuracy: 95.8, dirAccuracy: '93.8%', rmse: 1.15, mae: 0.92, mape: 0.82, latencyP95Ms: 24, trainedAt: '2026-07-26 08:30:00', author: 'QuantML-Engine' },
        { id: 'm-340', version: 'v3.4.0 LSTM', name: 'Deep Recurrent Neural Net', status: 'ACTIVE', accuracy: 94.2, dirAccuracy: '92.1%', rmse: 1.28, mae: 1.02, mape: 0.94, latencyP95Ms: 18, trainedAt: '2026-07-24 14:15:00', author: 'QuantML-Engine' },
        { id: 'm-320', version: 'v3.2.0 XGBoost', name: 'Gradient Boosted Tree Ensemble', status: 'ACTIVE', accuracy: 92.6, dirAccuracy: '90.5%', rmse: 1.42, mae: 1.15, mape: 1.08, latencyP95Ms: 12, trainedAt: '2026-07-20 11:00:00', author: 'QuantML-Engine' },
        { id: 'm-300', version: 'v3.0.0 Transformer', name: 'Temporal Attention Net', status: 'STAGING', accuracy: 93.8, dirAccuracy: '91.8%', rmse: 1.31, mae: 1.04, mape: 0.99, latencyP95Ms: 32, trainedAt: '2026-07-15 09:45:00', author: 'QuantML-Engine' },
        { id: 'm-280', version: 'v2.8.0 Random Forest', name: 'Tree Decision Forest', status: 'DEPRECATED', accuracy: 89.4, dirAccuracy: '87.2%', rmse: 1.68, mae: 1.38, mape: 1.25, latencyP95Ms: 10, trainedAt: '2026-06-30 16:20:00', author: 'QuantML-Engine' }
      ];
      const mValues = [];
      const mParams = [];
      let mIdx = 1;
      for (const m of initialModels) {
        mValues.push(`($${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++})`);
        mParams.push(m.id, m.version, m.name, m.status, m.accuracy, m.dirAccuracy, m.rmse, m.mae, m.mape, m.latencyP95Ms, m.trainedAt, m.author);
      }
      await query(
        `INSERT INTO mlops_models (id, version, name, status, accuracy, dir_accuracy, rmse, mae, mape, latency_p95_ms, trained_at, author)
         VALUES ${mValues.join(', ')}
         ON CONFLICT (id) DO NOTHING`,
        mParams
      );
    }

    await updateSequences();
    await syncDatabaseToDisk();

    return true;
  } catch (schemaErr) {
    if (logger && logger.error) logger.error(`Database schema initialization error: ${schemaErr.message}`);
    return false;
  }
}

module.exports = {
  pool,
  query,
  exec,
  initDatabase,
  isDbConnected: () => isConnected,
  getDbEngine: () => (dbEngine === 'PG_POOL' ? 'PostgreSQL (PG Pool)' : 'PostgreSQL (Embedded PGlite)')
};

