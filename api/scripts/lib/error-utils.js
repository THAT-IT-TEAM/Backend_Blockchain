const logger = require('./logger');

/**
 * Base error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code || `ERR_${this.name.toUpperCase()}`;
    this.details = details;
    this.isOperational = true;
    
    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Create a new AppError from another error
   */
  static fromError(error, options = {}) {
    if (error instanceof AppError) return error;
    
    const { 
      message = error.message || 'An unexpected error occurred',
      statusCode = 500,
      code = 'INTERNAL_ERROR',
      details = null,
    } = options;
    
    const appError = new AppError(message, statusCode, code, details);
    appError.originalError = error;
    appError.stack = error.stack;
    
    return appError;
  }
  
  /**
   * Convert error to a plain object
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
      ...(process.env.NODE_ENV !== 'production' && { stack: this.stack }),
    };
  }
}

/**
 * Error types
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service, message = 'Service unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE', { service });
  }
}

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Default to 500 if status code not set
  const statusCode = err.statusCode || 500;
  
  // Log the error
  if (statusCode >= 500) {
    logger.error('Server error:', err);
  } else if (statusCode >= 400) {
    logger.warn('Client error:', err);
  }
  
  // Don't leak error details in production for non-API routes
  if (!req.originalUrl.startsWith('/api/') && process.env.NODE_ENV === 'production') {
    return res.status(500).send('Internal Server Error');
  }
  
  // Format the error response
  const response = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV !== 'production' && { 
        stack: err.stack,
        ...(err.originalError && { originalError: err.originalError.message })
      }),
    },
  };
  
  res.status(statusCode).json(response);
}

/**
 * Async error handler wrapper for Express routes
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle uncaught exceptions
 */
function handleUncaughtExceptions() {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Give time to flush logs before exiting
    setTimeout(() => process.exit(1), 1000);
  });
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejections() {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

module.exports = {
  // Base error class
  AppError,
  
  // Error classes
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  
  // Error handling utilities
  errorHandler,
  asyncHandler,
  handleUncaughtExceptions,
  handleUnhandledRejections,
  
  // Error codes
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
    CONFLICT_ERROR: 'CONFLICT_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
};
