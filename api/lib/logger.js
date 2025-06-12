const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, json, errors } = format;
const DailyRotateFile = require('winston-daily-rotate-file');
const Config = require('./config');

// Ensure log directory exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  if (stack) {
    msg += `\n${stack}`;
  }
  
  if (Object.keys(meta).length > 0) {
    msg += `\n${JSON.stringify(meta, null, 2)}`;
  }
  
  return msg;
});

// Custom format for file output
const fileFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };
  
  if (stack) {
    logEntry.stack = stack;
  }
  
  return JSON.stringify(logEntry);
});

// Create a logger instance
const logger = createLogger({
  level: Config.get('logging.level', 'info'),
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: {
    service: 'blockchain-api',
    environment: Config.get('NODE_ENV', 'development'),
    hostname: require('os').hostname(),
    pid: process.pid
  },
  transports: [
    // Console transport for development
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      ),
      level: Config.get('logging.console.level', 'debug')
    }),
    
    // Daily rotate file transport for all logs
    new DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        fileFormat
      ),
      level: Config.get('logging.file.level', 'info')
    }),
    
    // Error logs
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        fileFormat
      )
    })
  ],
  exceptionHandlers: [
    new transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        fileFormat
      )
    })
  ],
  exitOnError: false
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Don't exit if in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Create a stream for morgan (HTTP request logging)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Add custom methods for different log levels
logger.request = (req, res, next) => {
  const start = process.hrtime();
  const requestId = req.headers['x-request-id'] || require('crypto').randomBytes(8).toString('hex');
  
  // Add request ID to the request object
  req.requestId = requestId;
  
  // Log the request
  logger.info('Request received', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    referrer: req.headers.referer || '',
    body: req.body,
    query: req.query,
    params: req.params,
    headers: {
      ...req.headers,
      authorization: req.headers.authorization ? '[REDACTED]' : undefined,
      cookie: req.headers.cookie ? '[REDACTED]' : undefined
    }
  });
  
  // Log the response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const diff = process.hrtime(start);
    const responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(3);
    
    logger.info('Response sent', {
      requestId,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length') || 0,
      contentType: res.get('Content-Type') || ''
    });
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Add a method to log database queries
logger.query = (query, params, options = {}) => {
  logger.debug('Database query', {
    query,
    params,
    ...options
  });
};

// Add a method to log API calls
logger.api = (method, url, statusCode, responseTime, metadata = {}) => {
  logger.info('API Call', {
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`,
    ...metadata
  });
};

// Add a method to log security events
logger.security = (event, user, metadata = {}) => {
  logger.warn('Security Event', {
    event,
    userId: user?.id || 'anonymous',
    ip: metadata.ip || 'unknown',
    userAgent: metadata.userAgent || 'unknown',
    ...metadata
  });
};

// Add a method to log performance metrics
logger.metric = (name, value, metadata = {}) => {
  logger.info('Performance Metric', {
    metric: name,
    value,
    ...metadata
  });
};

// Add a method to log audit events
exports.audit = (action, user, resource, status, metadata = {}) => {
  logger.info('Audit Log', {
    action,
    userId: user?.id || 'system',
    resourceType: resource?.constructor?.name || typeof resource,
    resourceId: resource?.id || 'unknown',
    status,
    ...metadata
  });
};

module.exports = logger;
