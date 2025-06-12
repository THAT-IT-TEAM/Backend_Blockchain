const path = require('path');
const fs = require('fs').promises;
const { parse } = require('yaml');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const merge = require('deepmerge');
const { logger } = require('./logger');
const { AppError } = require('./error-utils');

class ConfigManager {
  constructor(options = {}) {
    this.config = {};
    this.sources = [];
    this.env = {};
    this.options = {
      envPath: '.env',
      configDir: 'config',
      envPrefix: 'APP_',
      envExpand: true,
      ...options,
    };
  }

  /**
   * Load configuration from all sources
   */
  async load() {
    // Load environment variables
    await this.loadEnv();
    
    // Load config files
    await this.loadConfigFiles();
    
    // Apply environment overrides
    this.applyEnvOverrides();
    
    logger.debug('Configuration loaded', { sources: this.sources.map(s => s.type) });
    return this.config;
  }

  /**
   * Load environment variables from .env file
   */
  async loadEnv() {
    const { envPath, envExpand } = this.options;
    
    try {
      const envContent = await fs.readFile(envPath, 'utf8');
      const parsed = dotenv.parse(envContent);
      
      // Expand variables if enabled
      if (envExpand) {
        dotenvExpand({ parsed });
      }
      
      // Store the parsed environment variables
      this.env = { ...process.env, ...parsed };
      
      // Update process.env
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
      
      this.sources.push({
        type: 'env',
        path: envPath,
        config: parsed,
      });
      
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug(`No ${envPath} file found, using process.env`);
        this.env = { ...process.env };
        return {};
      }
      throw new AppError(
        `Failed to load ${envPath}: ${error.message}`,
        500,
        'ENV_LOAD_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * Load configuration files from config directory
   */
  async loadConfigFiles() {
    const { configDir } = this.options;
    
    try {
      const files = await fs.readdir(configDir);
      const configFiles = files.filter(file => 
        ['.json', '.yaml', '.yml'].includes(path.extname(file).toLowerCase())
      );
      
      for (const file of configFiles) {
        try {
          const filePath = path.join(configDir, file);
          const ext = path.extname(file).toLowerCase();
          let config;
          
          switch (ext) {
            case '.json':
              config = JSON.parse(await fs.readFile(filePath, 'utf8'));
              break;
              
            case '.yaml':
            case '.yml':
              config = parse(await fs.readFile(filePath, 'utf8'));
              break;
          }
          
          if (config) {
            this.config = merge(this.config, config);
            this.sources.push({
              type: 'file',
              path: filePath,
              config,
            });
          }
        } catch (error) {
          logger.warn(`Failed to load config file ${file}:`, error);
        }
      }
      
      return this.config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug(`Config directory ${configDir} not found, skipping config files`);
        return {};
      }
      throw new AppError(
        `Failed to load config files: ${error.message}`,
        500,
        'CONFIG_LOAD_ERROR',
        { cause: error }
      );
    }
  }

  /**
   * Apply environment variable overrides
   */
  applyEnvOverrides() {
    const { envPrefix } = this.options;
    const overrides = {};
    
    for (const [key, value] of Object.entries(this.env)) {
      if (key.startsWith(envPrefix)) {
        const configPath = key
          .slice(envPrefix.length)
          .toLowerCase()
          .split('__')
          .map(part => part.replace(/_([a-z])/g, (_, c) => c.toUpperCase()));
        
        this.setNestedValue(overrides, configPath, this.parseValue(value));
      }
    }
    
    this.config = merge(this.config, overrides);
    
    if (Object.keys(overrides).length > 0) {
      this.sources.push({
        type: 'env-override',
        config: overrides,
      });
    }
    
    return overrides;
  }

  /**
   * Set a nested value in an object
   */
  setNestedValue(obj, path, value) {
    let current = obj;
    
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      
      if (i === path.length - 1) {
        current[key] = value;
      } else {
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key];
      }
    }
    
    return obj;
  }

  /**
   * Parse a value from string to appropriate type
   */
  parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    
    // Check if it's a number
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    
    // Check if it's a JSON string
    try {
      return JSON.parse(value);
    } catch (e) {
      // Not a JSON string
    }
    
    return value;
  }

  /**
   * Get a value from the configuration
   */
  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let value = this.config;
    
    for (const key of keys) {
      if (value === null || typeof value !== 'object' || !(key in value)) {
        return defaultValue;
      }
      value = value[key];
    }
    
    return value !== undefined ? value : defaultValue;
  }
}

// Create a singleton instance
const configManager = new ConfigManager();

module.exports = {
  ConfigManager,
  config: configManager,
};
