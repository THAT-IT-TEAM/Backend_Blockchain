const path = require('path');
const _ = require('lodash');

// Load environment variables
require('dotenv').config();

// Load main config
let config = {};
try {
  config = require('../config');
} catch (err) {
  console.error('Failed to load config:', err);
  process.exit(1);
}

class Config {
  /**
   * Get configuration value by path
   * @param {string} path - Path to the config value (e.g., 'app.port')
   * @param {*} defaultValue - Default value if not found
   * @returns {*}
   */
  static get(path, defaultValue = null) {
    return _.get(config, path, defaultValue);
  }

  /**
   * Check if a configuration exists
   * @param {string} path - Path to the config value
   * @returns {boolean}
   */
  static has(path) {
    return _.has(config, path);
  }

  /**
   * Get environment name
   * @returns {string}
   */
  static get env() {
    return process.env.NODE_ENV || 'development';
  }

  /**
   * Check if current environment is production
   * @returns {boolean}
   */
  static isProduction() {
    return this.env === 'production';
  }

  /**
   * Check if current environment is development
   * @returns {boolean}
   */
  static isDevelopment() {
    return this.env === 'development';
  }

  /**
   * Get database configuration
   * @param {string} [connection='default'] - Connection name
   * @returns {object}
   */
  static database(connection = 'default') {
    return this.get(`services.database.${connection}`);
  }

  /**
   * Get storage configuration
   * @param {string} [storage='local'] - Storage name
   * @returns {object}
   */
  static storage(storage = 'local') {
    return this.get(`services.storage.${storage}`);
  }

  /**
   * Get blockchain configuration
   * @param {string} [network='ethereum'] - Network name
   * @returns {object}
   */
  static blockchain(network = 'ethereum') {
    return this.get(`services.blockchain.${network}`);
  }

  /**
   * Get API configuration
   * @returns {object}
   */
  static get api() {
    return this.get('services.api');
  }
}

// Validate required configuration in production
if (Config.isProduction()) {
  try {
    Config.validate([
      'JWT_SECRET',
      'DATABASE_URL',
      'STORAGE_PROVIDER'
    ]);
  } catch (error) {
    console.error('Configuration error:', error.message);
    process.exit(1);
  }
}

module.exports = Config;
