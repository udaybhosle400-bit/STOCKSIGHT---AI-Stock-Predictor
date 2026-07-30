const db = require('../config/database');

const inMemoryWatchlists = new Map(); // userId -> Set of symbols

class WatchlistModel {
  async addToWatchlist(userId, symbol) {
    const cleanSym = symbol.toUpperCase();
    if (db.isDbConnected()) {
      const res = await db.query(
        `INSERT INTO watchlist (user_id, symbol) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id, symbol) DO NOTHING 
         RETURNING *`,
        [userId, cleanSym]
      );
      return res.rows[0] || { user_id: userId, symbol: cleanSym };
    } else {
      if (!inMemoryWatchlists.has(userId)) {
        inMemoryWatchlists.set(userId, new Set());
      }
      inMemoryWatchlists.get(userId).add(cleanSym);
      return { user_id: userId, symbol: cleanSym };
    }
  }

  async removeFromWatchlist(userId, symbol) {
    const cleanSym = symbol.toUpperCase();
    if (db.isDbConnected()) {
      await db.query(`DELETE FROM watchlist WHERE user_id = $1 AND symbol = $2`, [userId, cleanSym]);
    } else {
      if (inMemoryWatchlists.has(userId)) {
        inMemoryWatchlists.get(userId).delete(cleanSym);
      }
    }
    return true;
  }

  async getUserWatchlist(userId) {
    if (db.isDbConnected()) {
      const res = await db.query(
        `SELECT symbol, created_at FROM watchlist WHERE user_id = $1 ORDER BY created_at DESC`, 
        [userId]
      );
      return res.rows;
    } else {
      const set = inMemoryWatchlists.get(userId) || new Set();
      return Array.from(set).map(sym => ({ symbol: sym, created_at: new Date().toISOString() }));
    }
  }
}

module.exports = new WatchlistModel();
