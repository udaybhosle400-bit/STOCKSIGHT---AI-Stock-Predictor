const db = require('../config/database');

const inMemoryPredictions = [];
let nextPredictionId = 1;

class PredictionModel {
  async savePrediction(userId, symbol, predictedPrice, targetDate, confidenceScore) {
    const cleanSym = symbol.toUpperCase();
    const px = parseFloat(predictedPrice);
    const conf = parseFloat(confidenceScore || 85.0);

    if (db.isDbConnected()) {
      const res = await db.query(
        `INSERT INTO prediction_history (user_id, symbol, predicted_price, target_date, confidence_score)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, cleanSym, px, targetDate || new Date(), conf]
      );
      return res.rows[0];
    } else {
      const pred = {
        id: nextPredictionId++,
        user_id: userId,
        symbol: cleanSym,
        predicted_price: px,
        target_date: targetDate || new Date().toISOString(),
        confidence_score: conf,
        created_at: new Date().toISOString()
      };
      inMemoryPredictions.push(pred);
      return pred;
    }
  }

  async getUserPredictions(userId, symbol) {
    if (db.isDbConnected()) {
      let queryText = `SELECT * FROM prediction_history WHERE user_id = $1`;
      const params = [userId];
      if (symbol) {
        queryText += ` AND symbol = $2`;
        params.push(symbol.toUpperCase());
      }
      queryText += ` ORDER BY created_at DESC LIMIT 50`;
      const res = await db.query(queryText, params);
      return res.rows;
    } else {
      return inMemoryPredictions
        .filter(p => p.user_id === userId && (!symbol || p.symbol === symbol.toUpperCase()))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  }
}

module.exports = new PredictionModel();
