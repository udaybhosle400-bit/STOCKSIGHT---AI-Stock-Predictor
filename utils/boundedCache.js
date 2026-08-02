/**
 * Bounded LRU Cache with TTL Expiration
 * Prevents memory exhaustion (Render Status 137) while maintaining sub-second performance.
 */
class BoundedLRUCache {
  constructor(maxSize = 50, ttlMs = 15 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const item = this.cache.get(key);
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest item
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  values() {
    const items = [];
    for (const item of this.cache.values()) {
      if (Date.now() <= item.expiresAt) {
        items.push(item.value);
      }
    }
    return items;
  }

  get size() {
    return this.cache.size;
  }
}

module.exports = BoundedLRUCache;
