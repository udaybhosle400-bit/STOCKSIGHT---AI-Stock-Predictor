const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * MASTER COMPANY REGISTRY (Single Source of Truth)
 * Centralized registry of all supported companies/stocks across StockSight.
 */
let masterCompanies = [];
try {
  const jsonPath = path.join(__dirname, 'companyRegistry.json');
  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    masterCompanies = JSON.parse(rawData);
  }
} catch (err) {
  if (logger && logger.error) {
    logger.error('Failed to load companyRegistry.json:', err.message);
  } else {
    console.error('Failed to load companyRegistry.json:', err.message);
  }
}

class CompanyRegistry {
  constructor() {
    this.companies = masterCompanies;
  }

  /**
   * Get all registered companies
   * @returns {Array<Object>}
   */
  getAllCompanies() {
    return this.companies;
  }

  /**
   * Get total count of registered companies
   * @returns {number}
   */
  getCompanyCount() {
    return this.companies.length;
  }

  /**
   * Get list of all ticker symbols for external market APIs (e.g. Yahoo Finance)
   * @returns {Array<string>}
   */
  getAllSymbols() {
    return this.companies.map(c => c.ns || c.sym);
  }

  /**
   * Get list of short stock symbols
   * @returns {Array<string>}
   */
  getAllShortSymbols() {
    return this.companies.map(c => c.sym);
  }

  /**
   * Find company by symbol, Yahoo ticker, or name
   * @param {string} symbolOrName
   * @returns {Object|null}
   */
  getCompany(symbolOrName) {
    if (!symbolOrName) return null;
    const query = String(symbolOrName).trim().toUpperCase();
    return this.companies.find(c => 
      (c.sym && c.sym.toUpperCase() === query) ||
      (c.ns && c.ns.toUpperCase() === query) ||
      (c.name && c.name.toUpperCase() === query)
    ) || null;
  }

  /**
   * Filter companies matching a search string (name, symbol, sector)
   * @param {string} searchQuery
   * @returns {Array<Object>}
   */
  filterCompanies(searchQuery) {
    if (!searchQuery) return this.companies;
    const q = searchQuery.toLowerCase();
    return this.companies.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.sym && c.sym.toLowerCase().includes(q)) ||
      (c.sector && c.sector.toLowerCase().includes(q))
    );
  }

  /**
   * Get sector mapping for all registered companies
   * @returns {Object} { SYMBOL: 'Sector' }
   */
  getSectorMap() {
    const map = {};
    for (const c of this.companies) {
      if (c.sym) map[c.sym] = c.sector || 'General';
      if (c.ns) map[c.ns] = c.sector || 'General';
    }
    return map;
  }
}

const registryInstance = new CompanyRegistry();
module.exports = registryInstance;
