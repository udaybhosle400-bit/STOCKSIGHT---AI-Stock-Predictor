const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * In-Memory Fallback Feature Store
 * Used when PostgreSQL database is offline.
 */
const inMemoryFeatureStore = {
  // Map: symbol -> Map(date -> Map(featureName -> record))
  features: new Map(),
  stats: {
    totalRecords: 0,
    featuresByCategory: {
      technical: 0,
      price: 0,
      volume: 0,
      fundamental: 0,
      market: 0,
      news: 0
    },
    lastGeneratedAt: null,
    executionTimeMs: 0,
    failedCompanies: 0,
    skippedCompanies: 0
  }
};

class FeatureModel {
  /**
   * Save a batch of engineered feature records
   * @param {Array<Object>} records - Array of { symbol, date, featureName, featureValue, featureCategory }
   */
  async saveBatchFeatures(records) {
    if (!Array.isArray(records) || records.length === 0) return 0;

    let savedCount = 0;
    const isDb = db.isDbConnected();

    if (isDb) {
      for (const rec of records) {
        try {
          await db.query(
            `INSERT INTO engineered_features (symbol, date, feature_name, feature_value, feature_category)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (symbol, date, feature_name)
             DO UPDATE SET feature_value = EXCLUDED.feature_value, created_at = CURRENT_TIMESTAMP`,
            [rec.symbol.toUpperCase(), rec.date, rec.featureName, parseFloat(rec.featureValue), rec.featureCategory]
          );
          savedCount++;
        } catch (err) {
          logger.error(`FeatureModel DB Insert Error for ${rec.symbol}/${rec.featureName}: ${err.message}`);
        }
      }
    } else {
      // In-Memory Storage
      for (const rec of records) {
        const sym = rec.symbol.toUpperCase();
        if (!inMemoryFeatureStore.features.has(sym)) {
          inMemoryFeatureStore.features.set(sym, new Map());
        }
        const symMap = inMemoryFeatureStore.features.get(sym);
        const dateKey = typeof rec.date === 'string' ? rec.date : new Date(rec.date).toISOString().split('T')[0];

        if (!symMap.has(dateKey)) {
          symMap.set(dateKey, new Map());
        }
        const dateMap = symMap.get(dateKey);

        const recordObj = {
          symbol: sym,
          date: dateKey,
          feature_name: rec.featureName,
          feature_value: parseFloat(rec.featureValue),
          feature_category: rec.featureCategory,
          timestamp: new Date().toISOString()
        };

        dateMap.set(rec.featureName, recordObj);

        // Update category metrics
        const cat = (rec.featureCategory || 'technical').toLowerCase();
        if (inMemoryFeatureStore.stats.featuresByCategory[cat] !== undefined) {
          inMemoryFeatureStore.stats.featuresByCategory[cat]++;
        }
        savedCount++;
      }
      inMemoryFeatureStore.stats.totalRecords += savedCount;
      inMemoryFeatureStore.stats.lastGeneratedAt = new Date().toISOString();
    }

    return savedCount;
  }

  /**
   * Get all engineered features for a symbol
   * @param {string} symbol
   * @param {string} [category]
   */
  async getSymbolFeatures(symbol, category) {
    const sym = symbol.toUpperCase();

    if (db.isDbConnected()) {
      let q = `SELECT * FROM engineered_features WHERE symbol = $1`;
      const params = [sym];
      if (category) {
        q += ` AND feature_category = $2`;
        params.push(category.toLowerCase());
      }
      q += ` ORDER BY date DESC, feature_name ASC`;
      const res = await db.query(q, params);
      return res.rows;
    } else {
      const symMap = inMemoryFeatureStore.features.get(sym);
      if (!symMap) return [];

      const result = [];
      const catFilter = category ? category.toLowerCase() : null;

      for (const [dateStr, dateMap] of symMap.entries()) {
        for (const [featName, rec] of dateMap.entries()) {
          if (!catFilter || rec.feature_category.toLowerCase() === catFilter) {
            result.push(rec);
          }
        }
      }
      return result;
    }
  }

  /**
   * Get latest snapshot of engineered features for a symbol
   * @param {string} symbol
   */
  async getLatestFeatures(symbol) {
    const sym = symbol.toUpperCase();

    if (db.isDbConnected()) {
      const res = await db.query(
        `SELECT DISTINCT ON (feature_name) feature_name, feature_value, feature_category, date, created_at
         FROM engineered_features
         WHERE symbol = $1
         ORDER BY feature_name, date DESC`,
        [sym]
      );
      
      const featureMap = {};
      const byCategory = {};

      res.rows.forEach(r => {
        const val = parseFloat(r.feature_value);
        featureMap[r.feature_name] = val;
        const cat = r.feature_category || 'other';
        if (!byCategory[cat]) byCategory[cat] = {};
        byCategory[cat][r.feature_name] = val;
      });

      return {
        symbol: sym,
        totalFeatures: res.rows.length,
        featureMap,
        byCategory,
        asOf: res.rows[0] ? res.rows[0].date : new Date().toISOString()
      };
    } else {
      const symMap = inMemoryFeatureStore.features.get(sym);
      if (!symMap || symMap.size === 0) {
        return { symbol: sym, totalFeatures: 0, featureMap: {}, byCategory: {}, asOf: null };
      }

      // Get latest date
      const dates = Array.from(symMap.keys()).sort().reverse();
      const latestDate = dates[0];
      const dateMap = symMap.get(latestDate);

      const featureMap = {};
      const byCategory = {};

      for (const [featName, rec] of dateMap.entries()) {
        const val = rec.feature_value;
        featureMap[featName] = val;
        const cat = rec.feature_category || 'other';
        if (!byCategory[cat]) byCategory[cat] = {};
        byCategory[cat][featName] = val;
      }

      return {
        symbol: sym,
        totalFeatures: Object.keys(featureMap).length,
        featureMap,
        byCategory,
        asOf: latestDate
      };
    }
  }

  /**
   * Get feature store monitoring stats
   */
  async getFeatureStats() {
    if (db.isDbConnected()) {
      const totalRes = await db.query(`SELECT COUNT(*) as total, COUNT(DISTINCT symbol) as companies FROM engineered_features`);
      const catRes = await db.query(`SELECT feature_category, COUNT(*) as count FROM engineered_features GROUP BY feature_category`);

      const categories = {};
      catRes.rows.forEach(r => {
        categories[r.feature_category] = parseInt(r.count, 10);
      });

      return {
        databaseStatus: 'PostgreSQL Feature Store Active',
        totalCompanies: parseInt(totalRes.rows[0].companies || 0, 10),
        totalFeaturesGenerated: parseInt(totalRes.rows[0].total || 0, 10),
        categories,
        lastGeneratedAt: new Date().toISOString()
      };
    } else {
      return {
        databaseStatus: 'In-Memory Feature Store Active (PostgreSQL Offline)',
        totalCompanies: inMemoryFeatureStore.features.size,
        totalFeaturesGenerated: inMemoryFeatureStore.stats.totalRecords,
        categories: inMemoryFeatureStore.stats.featuresByCategory,
        lastGeneratedAt: inMemoryFeatureStore.stats.lastGeneratedAt,
        executionTimeMs: inMemoryFeatureStore.stats.executionTimeMs,
        failedCompanies: inMemoryFeatureStore.stats.failedCompanies,
        skippedCompanies: inMemoryFeatureStore.stats.skippedCompanies
      };
    }
  }

  /**
   * Update feature store stats for monitoring
   */
  updateExecutionStats({ executionTimeMs, failedCompanies, skippedCompanies }) {
    inMemoryFeatureStore.stats.executionTimeMs = executionTimeMs;
    inMemoryFeatureStore.stats.failedCompanies = failedCompanies;
    inMemoryFeatureStore.stats.skippedCompanies = skippedCompanies;
  }
}

module.exports = new FeatureModel();
