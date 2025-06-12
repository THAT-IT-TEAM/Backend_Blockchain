const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, json, errors } = format;
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { isProduction, isTest } = config;

// Ensure logs directory exists
const logDir = path.dirname(config.logging.file.filename);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }
  
  return log;
});

// Custom format for file output
const fileFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const log = {
    timestamp,
    level,
    message,
    ...(stack && { stack }),
    ...(Object.keys(meta).length > 0 && { meta })
  };
  
  return JSON.stringify(log);
});

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  trace: 5
};

// Colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  trace: 'cyan'
};

winston.addColors(colors);

// Create the logger
const logger = createLogger({
  levels,
  level: config.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    isProduction ? json() : format.simple()
  ),
  defaultMeta: { service: 'blockchain-api' },
  transports: [
    // Console transport
    new transports.Console({
      level: config.logging.console.level,
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      ),
      silent: isTest || !config.logging.console.enabled,
    })
  ],
  exitOnError: false, // Don't exit on handled exceptions
});

// Add file transport if enabled
if (config.logging.file.enabled) {
  logger.add(new transports.File({
    level: config.logging.file.level,
    filename: config.logging.file.filename,
    maxsize: config.logging.file.maxsize,
    maxFiles: config.logging.file.maxFiles,
    tailable: config.logging.file.tailable,
    format: combine(timestamp(), fileFormat),
    silent: isTest,
  }));
}

// Add error file transport if enabled
if (config.logging.errorFile.enabled) {
  logger.add(new transports.File({
    level: 'error',
    filename: config.logging.errorFile.filename,
    maxsize: config.logging.errorFile.maxsize,
    maxFiles: config.logging.errorFile.maxFiles,
    tailable: config.logging.errorFile.tailable,
    format: combine(timestamp(), fileFormat),
    silent: isTest,
  }));
}

// Add request logging middleware
logger.requestLogger = () => {
  return (req, res, next) => {
    const { method, originalUrl, ip, body, query, params } = req;
    
    // Skip logging for health checks
    if (originalUrl === '/health') {
      return next();
    }
    
    const start = Date.now();
    
    // Log request
    logger.http('Incoming Request', {
      method,
      url: originalUrl,
      ip,
      body: method !== 'GET' ? body : undefined,
      query,
      params,
    });
    
    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      
      logger.http('Request Completed', {
        method,
        url: originalUrl,
        statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('content-length'),
      });
    });
    
    next();
  };
};

// Add error handling middleware
logger.errorHandler = (err, req, res, next) => {
  const { method, originalUrl, ip, body, query, params } = req;
  
  logger.error('Unhandled Error', {
    message: err.message,
    stack: err.stack,
    request: {
      method,
      url: originalUrl,
      ip,
      body,
      query,
      params,
    },
  });
  
  // Don't leak stack traces in production
  const errorResponse = {
    error: {
      message: isProduction ? 'Internal Server Error' : err.message,
      ...(!isProduction && { stack: err.stack }),
    },
  };
  
  res.status(err.status || 500).json(errorResponse);
};

// Handle uncaught exceptions and unhandled rejections
if (isProduction) {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error });
    // Don't exit immediately, give time to log the error
    setTimeout(() => process.exit(1), 1000);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
  });
}

// Create a child logger with additional context
logger.child = (context) => {
  return logger.child(context);
};

module.exports = logger;
