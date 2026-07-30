const db = require('../config/database');

const inMemoryPortfolios = new Map(); // userId -> Map(symbol -> position)

class PortfolioModel {
  async addOrUpdatePosition(userId, symbol, shares, averagePrice) {
    const cleanSym = symbol.toUpperCase();
    const sh = parseFloat(shares);
    const avgPx = parseFloat(averagePrice);

    if (db.isDbConnected()) {
      const res = await db.query(
        `INSERT INTO portfolio (user_id, symbol, shares, average_price, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, symbol) 
         DO UPDATE SET shares = $3, average_price = $4, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, cleanSym, sh, avgPx]
      );
      return res.rows[0];
    } else {
      if (!inMemoryPortfolios.has(userId)) {
        inMemoryPortfolios.set(userId, new Map());
      }
      const pos = { user_id: userId, symbol: cleanSym, shares: sh, average_price: avgPx, updated_at: new Date().toISOString() };
      inMemoryPortfolios.get(userId).set(cleanSym, pos);
      return pos;
    }
  }

  async deletePosition(userId, symbol) {
    const cleanSym = symbol.toUpperCase();
    if (db.isDbConnected()) {
      await db.query(`DELETE FROM portfolio WHERE user_id = $1 AND symbol = $2`, [userId, cleanSym]);
    } else {
      if (inMemoryPortfolios.has(userId)) {
        inMemoryPortfolios.get(userId).delete(cleanSym);
      }
    }
    return true;
  }

  async getUserPortfolio(userId) {
    if (db.isDbConnected()) {
      const res = await db.query(
        `SELECT symbol, shares, average_price, updated_at FROM portfolio WHERE user_id = $1 ORDER BY symbol ASC`,
        [userId]
      );
      return res.rows;
    } else {
      const userMap = inMemoryPortfolios.get(userId) || new Map();
      return Array.from(userMap.values());
    }
  }
}

module.exports = new PortfolioModel();
