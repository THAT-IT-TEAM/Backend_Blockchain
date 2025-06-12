const path = require('path');
const os = require('os');

// Environment variables with defaults
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';

// Base paths
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const LOGS_DIR = path.resolve(ROOT_DIR, 'logs');
const BACKUPS_DIR = path.resolve(ROOT_DIR, 'backups');
const MIGRATIONS_DIR = path.resolve(ROOT_DIR, 'migrations');

// Database configuration
const DB_CONFIG = {
  client: 'sqlite3',
  connection: {
    filename: path.resolve(DATA_DIR, 'blockchain.db'),
  },
  useNullAsDefault: true,
  pool: {
    min: 1,
    max: 10,
    afterCreate: (conn, cb) => {
      conn.run('PRAGMA foreign_keys = ON', cb);
    },
  },
  migrations: {
    directory: MIGRATIONS_DIR,
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.resolve(ROOT_DIR, 'seeds'),
  },
};

// Backup configuration
const BACKUP_CONFIG = {
  // Backup retention in days
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30,
  
  // Maximum number of backups to keep
  maxBackups: parseInt(process.env.BACKUP_MAX_COUNT, 10) || 100,
  
  // Backup compression (true/false)
  compress: process.env.BACKUP_COMPRESS !== 'false',
  
  // Backup format (timestamp format)
  dateFormat: 'YYYY-MM-DD_HH-mm-ss',
  
  // Backup directories
  directories: {
    base: BACKUPS_DIR,
    daily: path.join(BACKUPS_DIR, 'daily'),
    weekly: path.join(BACKUPS_DIR, 'weekly'),
    monthly: path.join(BACKUPS_DIR, 'monthly'),
  },
};

// Scheduler configuration
const SCHEDULER_CONFIG = {
  // Timezone for cron jobs
  timezone: process.env.TZ || 'UTC',
  
  // Default job concurrency
  concurrency: parseInt(process.env.SCHEDULER_CONCURRENCY, 10) || 5,
  
  // Job lock time in milliseconds
  lockLifetime: 30 * 60 * 1000, // 30 minutes
  
  // Job history to keep
  historyLimit: 1000,
};

// Monitoring configuration
const MONITOR_CONFIG = {
  // System metrics collection interval (ms)
  systemInterval: 60 * 1000, // 1 minute
  
  // Database check interval (ms)
  dbInterval: 5 * 60 * 1000, // 5 minutes
  
  // Security check interval (ms)
  securityInterval: 24 * 60 * 60 * 1000, // 24 hours
  
  // Alert configuration
  alerts: {
    // Email alerts
    email: {
      enabled: process.env.EMAIL_ALERTS === 'true',
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to: process.env.EMAIL_TO ? process.env.EMAIL_TO.split(',') : [],
      smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
    },
    
    // Slack alerts
    slack: {
      enabled: process.env.SLACK_ALERTS === 'true',
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL || '#alerts',
      username: process.env.SLACK_USERNAME || 'Blockchain Monitor',
    },
    
    // Alert thresholds
    thresholds: {
      cpu: parseFloat(process.env.ALERT_CPU_THRESHOLD) || 0.9, // 90%
      memory: parseFloat(process.env.ALERT_MEMORY_THRESHOLD) || 0.9, // 90%
      disk: parseFloat(process.env.ALERT_DISK_THRESHOLD) || 0.9, // 90%
      dbSize: parseInt(process.env.ALERT_DB_SIZE_THRESHOLD, 10) || 1024 * 1024 * 1024, // 1GB
      responseTime: parseInt(process.env.ALERT_RESPONSE_THRESHOLD, 10) || 5000, // 5s
    },
    
    // Alert cooldown (ms)
    cooldown: 60 * 60 * 1000, // 1 hour
  },
};

// Logging configuration
const LOGGING_CONFIG = {
  // Log level (error, warn, info, debug, trace)
  level: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
  
  // Log to console
  console: {
    enabled: process.env.LOG_CONSOLE !== 'false',
    level: process.env.LOG_CONSOLE_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
    colorize: process.env.LOG_COLORIZE !== 'false',
  },
  
  // File logging
  file: {
    enabled: process.env.LOG_FILE !== 'false',
    level: process.env.LOG_FILE_LEVEL || 'debug',
    filename: path.join(LOGS_DIR, 'app.log'),
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    tailable: true,
  },
  
  // Error logging (separate file for errors)
  errorFile: {
    enabled: process.env.LOG_ERROR_FILE !== 'false',
    level: 'error',
    filename: path.join(LOGS_DIR, 'error.log'),
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true,
  },
};

// Server configuration
const SERVER_CONFIG = {
  // Server port
  port: parseInt(process.env.PORT, 10) || 3000,
  
  // Server host
  host: process.env.HOST || '0.0.0.0',
  
  // API base path
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
  },
  
  // Request logging
  requestLogging: {
    enabled: true,
    level: 'info',
    format: 'combined',
  },
};

// Export configuration
module.exports = {
  // Environment
  env: NODE_ENV,
  isProduction: IS_PRODUCTION,
  isTest: IS_TEST,
  
  // Paths
  paths: {
    root: ROOT_DIR,
    data: DATA_DIR,
    logs: LOGS_DIR,
    backups: BACKUPS_DIR,
    migrations: MIGRATIONS_DIR,
  },
  
  // Configurations
  db: DB_CONFIG,
  backup: BACKUP_CONFIG,
  scheduler: SCHEDULER_CONFIG,
  monitor: MONITOR_CONFIG,
  logging: LOGGING_CONFIG,
  server: SERVER_CONFIG,
  
  // System information
  system: {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    uptime: os.uptime(),
  },
  
  // Utility function to get configuration for a specific environment
  getEnvConfig: function(env = NODE_ENV) {
    return {
      ...this,
      env,
      isProduction: env === 'production',
      isTest: env === 'test',
    };
  },
};
