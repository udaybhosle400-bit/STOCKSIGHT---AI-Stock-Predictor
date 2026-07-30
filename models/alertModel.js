const db = require('../config/database');

const inMemoryAlerts = [];
let nextAlertId = 1;

class AlertModel {
  async createAlert(userId, symbol, targetPrice, alertType = 'ABOVE') {
    const cleanSym = symbol.toUpperCase();
    const px = parseFloat(targetPrice);
    const type = alertType.toUpperCase();

    if (db.isDbConnected()) {
      const res = await db.query(
        `INSERT INTO alerts (user_id, symbol, target_price, alert_type)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, cleanSym, px, type]
      );
      return res.rows[0];
    } else {
      const alert = {
        id: nextAlertId++,
        user_id: userId,
        symbol: cleanSym,
        target_price: px,
        alert_type: type,
        is_triggered: false,
        created_at: new Date().toISOString()
      };
      inMemoryAlerts.push(alert);
      return alert;
    }
  }

  async deleteAlert(userId, alertId) {
    if (db.isDbConnected()) {
      await db.query(`DELETE FROM alerts WHERE id = $1 AND user_id = $2`, [alertId, userId]);
    } else {
      const index = inMemoryAlerts.findIndex(a => a.id === parseInt(alertId, 10) && a.user_id === userId);
      if (index !== -1) inMemoryAlerts.splice(index, 1);
    }
    return true;
  }

  async getUserAlerts(userId) {
    if (db.isDbConnected()) {
      const res = await db.query(
        `SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      return res.rows;
    } else {
      return inMemoryAlerts.filter(a => a.user_id === userId);
    }
  }
}

module.exports = new AlertModel();
