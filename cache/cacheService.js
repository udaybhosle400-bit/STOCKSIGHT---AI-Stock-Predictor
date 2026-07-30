const NodeCache = require('node-cache');
const config = require('../config/env.config');

class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.cache.ttlPrice, // Default 30 seconds
      checkperiod: 60,
      useClones: false
    });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, val, ttl) {
    if (ttl !== undefined) {
      return this.cache.set(key, val, ttl);
    }
    return this.cache.set(key, val);
  }

  del(key) {
    return this.cache.del(key);
  }

  flush() {
    return this.cache.flushAll();
  }

  async getOrSet(key, fetchFn, ttl) {
    const cachedVal = this.get(key);
    if (cachedVal !== undefined) {
      return cachedVal;
    }

    try {
      const freshVal = await fetchFn();
      if (freshVal !== undefined && freshVal !== null) {
        this.set(key, freshVal, ttl);
      }
      return freshVal;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new CacheService();
