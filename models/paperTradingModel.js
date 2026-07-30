const db = require('../config/database');

const DEFAULT_INITIAL_BALANCE = 1000000.00; // ₹10,00,000

// In-memory fallback stores
const inMemoryAccounts = new Map();  // userId -> account object
const inMemoryHoldings = new Map();  // userId -> Map(symbol -> holding)
const inMemoryTrades = new Map();    // userId -> Array of trade records
let nextTradeId = 1;

class PaperTradingModel {
  /**
   * Get paper trading account or initialize default
   */
  async getAccount(userId) {
    const uid = userId || 1; // Default to ID 1 if unauthenticated demo user

    if (db.isDbConnected()) {
      let res = await db.query(`SELECT * FROM paper_accounts WHERE user_id = $1`, [uid]);
      if (res.rows.length === 0) {
        res = await db.query(
          `INSERT INTO paper_accounts (user_id, balance, initial_balance) 
           VALUES ($1, $2, $2) 
           RETURNING *`,
          [uid, DEFAULT_INITIAL_BALANCE]
        );
      }
      return {
        id: res.rows[0].id,
        user_id: res.rows[0].user_id,
        balance: parseFloat(res.rows[0].balance),
        initial_balance: parseFloat(res.rows[0].initial_balance),
        created_at: res.rows[0].created_at
      };
    } else {
      if (!inMemoryAccounts.has(uid)) {
        inMemoryAccounts.set(uid, {
          id: uid,
          user_id: uid,
          balance: DEFAULT_INITIAL_BALANCE,
          initial_balance: DEFAULT_INITIAL_BALANCE,
          created_at: new Date().toISOString()
        });
      }
      return inMemoryAccounts.get(uid);
    }
  }

  /**
   * Reset account back to default initial balance ₹10,00,000
   */
  async resetAccount(userId, newInitialBalance = DEFAULT_INITIAL_BALANCE) {
    const uid = userId || 1;

    if (db.isDbConnected()) {
      await db.query(`DELETE FROM paper_holdings WHERE user_id = $1`, [uid]);
      await db.query(`DELETE FROM paper_trades WHERE user_id = $1`, [uid]);
      const res = await db.query(
        `UPDATE paper_accounts SET balance = $2, initial_balance = $2 WHERE user_id = $1 RETURNING *`,
        [uid, newInitialBalance]
      );
      return res.rows[0];
    } else {
      inMemoryAccounts.set(uid, {
        id: uid,
        user_id: uid,
        balance: newInitialBalance,
        initial_balance: newInitialBalance,
        created_at: new Date().toISOString()
      });
      inMemoryHoldings.set(uid, new Map());
      inMemoryTrades.set(uid, []);
      return inMemoryAccounts.get(uid);
    }
  }

  /**
   * Update virtual cash balance
   */
  async updateBalance(userId, newBalance) {
    const uid = userId || 1;
    const nb = parseFloat(newBalance);

    if (db.isDbConnected()) {
      await db.query(`UPDATE paper_accounts SET balance = $2 WHERE user_id = $1`, [uid, nb]);
    } else {
      const acc = await this.getAccount(uid);
      acc.balance = nb;
    }
  }

  /**
   * Get all active holdings for user
   */
  async getHoldings(userId) {
    const uid = userId || 1;

    if (db.isDbConnected()) {
      const res = await db.query(
        `SELECT symbol, shares, average_price, updated_at FROM paper_holdings WHERE user_id = $1 AND shares > 0 ORDER BY symbol ASC`,
        [uid]
      );
      return res.rows.map(h => ({
        symbol: h.symbol,
        shares: parseFloat(h.shares),
        average_price: parseFloat(h.average_price),
        updated_at: h.updated_at
      }));
    } else {
      const map = inMemoryHoldings.get(uid) || new Map();
      return Array.from(map.values()).filter(h => h.shares > 0);
    }
  }

  /**
   * Get single holding
   */
  async getHolding(userId, symbol) {
    const uid = userId || 1;
    const cleanSym = symbol.toUpperCase();

    if (db.isDbConnected()) {
      const res = await db.query(`SELECT * FROM paper_holdings WHERE user_id = $1 AND symbol = $2`, [uid, cleanSym]);
      if (res.rows.length === 0) return null;
      return {
        symbol: res.rows[0].symbol,
        shares: parseFloat(res.rows[0].shares),
        average_price: parseFloat(res.rows[0].average_price)
      };
    } else {
      const map = inMemoryHoldings.get(uid) || new Map();
      return map.get(cleanSym) || null;
    }
  }

  /**
   * Upsert holding position
   */
  async upsertHolding(userId, symbol, shares, averagePrice) {
    const uid = userId || 1;
    const cleanSym = symbol.toUpperCase();
    const sh = parseFloat(shares);
    const avgPx = parseFloat(averagePrice);

    if (db.isDbConnected()) {
      if (sh <= 0) {
        await db.query(`DELETE FROM paper_holdings WHERE user_id = $1 AND symbol = $2`, [uid, cleanSym]);
        return null;
      }
      const res = await db.query(
        `INSERT INTO paper_holdings (user_id, symbol, shares, average_price, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, symbol)
         DO UPDATE SET shares = $3, average_price = $4, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [uid, cleanSym, sh, avgPx]
      );
      return res.rows[0];
    } else {
      if (!inMemoryHoldings.has(uid)) inMemoryHoldings.set(uid, new Map());
      const map = inMemoryHoldings.get(uid);

      if (sh <= 0) {
        map.delete(cleanSym);
        return null;
      }

      const holding = { symbol: cleanSym, shares: sh, average_price: avgPx, updated_at: new Date().toISOString() };
      map.set(cleanSym, holding);
      return holding;
    }
  }

  /**
   * Record trade in transaction audit ledger
   */
  async recordTrade({ userId, symbol, tradeType, shares, price, totalAmount, realizedPnL = 0 }) {
    const uid = userId || 1;
    const cleanSym = symbol.toUpperCase();

    if (db.isDbConnected()) {
      const res = await db.query(
        `INSERT INTO paper_trades (user_id, symbol, trade_type, shares, price, total_amount, realized_pnl)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [uid, cleanSym, tradeType.toUpperCase(), shares, price, totalAmount, realizedPnL]
      );
      return res.rows[0];
    } else {
      if (!inMemoryTrades.has(uid)) inMemoryTrades.set(uid, []);
      const trade = {
        id: nextTradeId++,
        user_id: uid,
        symbol: cleanSym,
        trade_type: tradeType.toUpperCase(),
        shares: parseFloat(shares),
        price: parseFloat(price),
        total_amount: parseFloat(totalAmount),
        realized_pnl: parseFloat(realizedPnL),
        executed_at: new Date().toISOString()
      };
      inMemoryTrades.get(uid).unshift(trade);
      return trade;
    }
  }

  /**
   * Get transaction history ledger
   */
  async getTradeHistory(userId, limit = 50) {
    const uid = userId || 1;

    if (db.isDbConnected()) {
      const res = await db.query(
        `SELECT * FROM paper_trades WHERE user_id = $1 ORDER BY executed_at DESC LIMIT $2`,
        [uid, limit]
      );
      return res.rows.map(t => ({
        id: t.id,
        symbol: t.symbol,
        tradeType: t.trade_type,
        shares: parseFloat(t.shares),
        price: parseFloat(t.price),
        totalAmount: parseFloat(t.total_amount),
        realizedPnL: parseFloat(t.realized_pnl),
        executedAt: t.executed_at
      }));
    } else {
      const list = inMemoryTrades.get(uid) || [];
      return list.slice(0, limit).map(t => ({
        id: t.id,
        symbol: t.symbol,
        tradeType: t.trade_type,
        shares: t.shares,
        price: t.price,
        totalAmount: t.total_amount,
        realizedPnL: t.realized_pnl,
        executedAt: t.executed_at
      }));
    }
  }
}

module.exports = new PaperTradingModel();
