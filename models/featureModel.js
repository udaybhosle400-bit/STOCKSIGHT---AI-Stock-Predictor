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

    // Always update In-Memory Storage for instant <1ms lookup
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
      savedCount++;
    }

    if (isDb) {
      try {
        const values = [];
        const params = [];
        let pIdx = 1;
        for (const rec of records) {
          values.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
          params.push(rec.symbol.toUpperCase(), rec.date, rec.featureName, parseFloat(rec.featureValue), rec.featureCategory);
        }
        await db.query(
          `INSERT INTO engineered_features (symbol, date, feature_name, feature_value, feature_category)
           VALUES ${values.join(', ')}
           ON CONFLICT (symbol, date, feature_name)
           DO UPDATE SET feature_value = EXCLUDED.feature_value, created_at = CURRENT_TIMESTAMP`,
          params
        );
      } catch (err) {
        logger.error(`FeatureModel DB Insert Error: ${err.message}`);
      }
    }

    return savedCount;
  }

  /**
   * Get latest snapshot of engineered features for a symbol
   * @param {string} symbol
   */
  async getLatestFeatures(symbol) {
    const sym = symbol.toUpperCase();

    // Check RAM store first for instant <1ms access
    const symMap = inMemoryFeatureStore.features.get(sym);
    if (symMap && symMap.size > 0) {
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
