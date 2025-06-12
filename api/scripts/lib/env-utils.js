const path = require('path');
const fs = require('fs').promises;
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const logger = require('./logger');

class EnvUtils {
  /**
   * Load environment variables from .env files
   */
  static async loadEnv(envPath = null) {
    try {
      // Default .env file path
      const defaultEnvPath = path.resolve(process.cwd(), '.env');
      
      // If no path provided, try to load from default location
      const envFile = envPath || defaultEnvPath;
      
      // Check if file exists
      try {
        await fs.access(envFile);
      } catch (error) {
        if (envPath || process.env.NODE_ENV !== 'production') {
          logger.warn(`Environment file not found: ${envFile}`);
        }
        return {};
      }
      
      // Load and parse .env file
      const envConfig = dotenv.parse(await fs.readFile(envFile));
      
      // Expand variables
      const expandedConfig = dotenvExpand.expand({ parsed: envConfig }).parsed;
      
      // Set environment variables if not already set
      for (const key in expandedConfig) {
        if (process.env[key] === undefined) {
          process.env[key] = expandedConfig[key];
        }
      }
      
      logger.debug(`Loaded environment from ${envFile}`);
      return expandedConfig;
    } catch (error) {
      logger.error('Failed to load environment variables:', error);
      throw error;
    }
  }
  
  /**
   * Get environment variable with fallback
   */
  static get(key, defaultValue = null, options = {}) {
    const {
      required = false,
      type = 'string',
      allowedValues = null,
    } = options;
    
    const value = process.env[key] !== undefined ? process.env[key] : defaultValue;
    
    if (required && value === undefined) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    
    if (value === undefined || value === null) {
      return value;
    }
    
    // Convert type
    let convertedValue;
    switch (type.toLowerCase()) {
      case 'number':
        convertedValue = parseFloat(value);
        if (isNaN(convertedValue)) {
          throw new Error(`Invalid number value for environment variable: ${key}=${value}`);
        }
        break;
        
      case 'integer':
        convertedValue = parseInt(value, 10);
        if (isNaN(convertedValue)) {
          throw new Error(`Invalid integer value for environment variable: ${key}=${value}`);
        }
        break;
        
      case 'boolean':
        if (value.toLowerCase() === 'true' || value === '1') {
          convertedValue = true;
        } else if (value.toLowerCase() === 'false' || value === '0' || value === '') {
          convertedValue = false;
        } else {
          throw new Error(`Invalid boolean value for environment variable: ${key}=${value}`);
        }
        break;
        
      case 'array':
        convertedValue = value.split(',').map(item => item.trim()).filter(Boolean);
        break;
        
      case 'json':
        try {
          convertedValue = JSON.parse(value);
        } catch (error) {
          throw new Error(`Invalid JSON value for environment variable: ${key}=${value}`);
        }
        break;
        
      case 'string':
      default:
        convertedValue = value;
    }
    
    // Check allowed values
    if (allowedValues && !allowedValues.includes(convertedValue)) {
      throw new Error(
        `Invalid value for environment variable: ${key}=${value}. ` +
        `Allowed values: ${allowedValues.join(', ')}`
      );
    }
    
    return convertedValue;
  }
  
  /**
   * Get all environment variables with a prefix
   */
  static getPrefixed(prefix, options = {}) {
    const { stripPrefix = true, ...getOptions } = options;
    const result = {};
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const newKey = stripPrefix ? key.slice(prefix.length) : key;
        result[newKey] = this.get(key, value, getOptions);
      }
    }
    
    return result;
  }
  
  /**
   * Validate required environment variables
   */
  static validate(requiredVars) {
    const missing = [];
    const invalid = [];
    
    for (const [key, options] of Object.entries(requiredVars)) {
      const value = process.env[key];
      
      if (value === undefined || value === '') {
        if (options.required !== false) {
          missing.push(key);
        }
        continue;
      }
      
      try {
        // Validate type if specified
        if (options.type) {
          this.get(key, undefined, options);
        }
      } catch (error) {
        invalid.push({ key, error: error.message });
      }
    }
    
    if (missing.length > 0 || invalid.length > 0) {
      const errors = [
        ...missing.map(key => `Missing required environment variable: ${key}`),
        ...invalid.map(({ key, error }) => `Invalid environment variable ${key}: ${error}`),
      ];
      
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }
  }
  
  /**
   * Create an example .env file
   */
  static async createExampleEnv(examplePath = '.env.example', envPath = '.env') {
    try {
      // Read the current .env file
      const envContent = await fs.readFile(envPath, 'utf8');
      
      // Create example content by removing values
      const exampleContent = envContent
        .split('\n')
        .map(line => {
          // Skip comments and empty lines
          if (!line.trim() || line.trim().startsWith('#')) {
            return line;
          }
          
          // Extract key and comment
          const [keyValue, ...comments] = line.split('#');
          const [key, value] = keyValue.split('=');
          
          if (!key || !key.trim()) {
            return line;
          }
          
          // Create example line with empty value and original comment
          const comment = comments.length > 0 ? ` # ${comments.join('#')}` : '';
          return `${key}=${comment}`;
        })
        .join('\n');
      
      // Write the example file
      await fs.writeFile(examplePath, exampleContent);
      logger.info(`Created example environment file: ${examplePath}`);
      
      return examplePath;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Source environment file not found: ${envPath}`);
      }
      logger.error('Failed to create example environment file:', error);
      throw error;
    }
  }
}

module.exports = EnvUtils;
