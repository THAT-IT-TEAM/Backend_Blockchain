const _ = require('lodash');
const path = require('path');
const fs = require('fs');

// Load environment
const env = process.env.NODE_ENV || 'development';

// Base configuration
const baseConfig = {
  env,
  app: {
    name: 'Blockchain API',
    version: '1.0.0',
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    apiPrefix: '/api',
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      exposedHeaders: ['Content-Range', 'X-Content-Range']
    },
    uploads: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['*/*'] // Allow all types
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: '7d',
    issuer: 'blockchain-api'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: 'logs',
    maxSize: '20m',
    maxFiles: '14d'
  },
  dataDir: path.join(__dirname, '..', 'data')
};

// Load environment-specific config
let envConfig = {};
const envConfigPath = path.join(__dirname, 'environments', `${env}.js`);
if (fs.existsSync(envConfigPath)) {
  envConfig = require(envConfigPath);
}

// Load services config
const servicesPath = path.join(__dirname, 'services');
const services = {};

if (fs.existsSync(servicesPath)) {
  fs.readdirSync(servicesPath).forEach(file => {
    if (file.endsWith('.js')) {
      const serviceName = path.basename(file, '.js');
      services[serviceName] = require(path.join(servicesPath, file));
    }
  });
}

// Merge configurations
const config = _.merge(
  {},
  baseConfig,
  { services },
  envConfig
);

// Ensure data directory exists
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), config.logging.dir);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = config;
