/**
 * Logger Utility
 * Centralized logging with different levels and structured output
 */

export class Logger {
  constructor(context, env) {
    this.context = context;
    this.env = env;
    this.logLevel = env?.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Check if should log based on level
   */
  shouldLog(level) {
    const currentLevel = this.levels[this.logLevel] || 2;
    const requestedLevel = this.levels[level] || 2;
    return requestedLevel <= currentLevel;
  }

  /**
   * Format log message
   */
  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      context: this.context,
      message,
      ...data
    };

    // Add request context if available
    if (this.env?.request) {
      logEntry.request = {
        method: this.env.request.method,
        url: this.env.request.url,
        cf: this.env.request.cf
      };
    }

    return logEntry;
  }

  /**
   * Log to console and optionally to external service
   */
  async log(level, message, data = {}) {
    if (!this.shouldLog(level)) return;

    const logEntry = this.formatMessage(level, message, data);

    // Console output
    console[level](JSON.stringify(logEntry));

    // Send to external logging service if configured
    if (this.env?.LOGGING_ENDPOINT) {
      try {
        await this.sendToLoggingService(logEntry);
      } catch (error) {
        console.error('Failed to send log to external service:', error);
      }
    }

    // Store critical errors in KV for monitoring
    if (level === 'error' && this.env?.KV_LOGS) {
      try {
        await this.storeErrorLog(logEntry);
      } catch (error) {
        console.error('Failed to store error log:', error);
      }
    }
  }

  /**
   * Send log to external service
   */
  async sendToLoggingService(logEntry) {
    if (!this.env.LOGGING_ENDPOINT) return;

    const response = await fetch(this.env.LOGGING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.LOGGING_API_KEY}`
      },
      body: JSON.stringify(logEntry)
    });

    if (!response.ok) {
      throw new Error(`Logging service returned ${response.status}`);
    }
  }

  /**
   * Store error logs in KV for analysis
   */
  async storeErrorLog(logEntry) {
    if (!this.env.KV_LOGS) return;

    const key = `error:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    await this.env.KV_LOGS.put(key, JSON.stringify(logEntry), {
      expirationTtl: 7 * 24 * 60 * 60 // Keep for 7 days
    });
  }

  /**
   * Log levels
   */
  error(message, data = {}) {
    return this.log('error', message, data);
  }

  warn(message, data = {}) {
    return this.log('warn', message, data);
  }

  info(message, data = {}) {
    return this.log('info', message, data);
  }

  debug(message, data = {}) {
    return this.log('debug', message, data);
  }

  /**
   * Log API request
   */
  logRequest(request, response, duration) {
    const data = {
      request: {
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries())
      },
      response: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      },
      duration: `${duration}ms`,
      cf: request.cf
    };

    if (response.status >= 500) {
      return this.error('Server error', data);
    } else if (response.status >= 400) {
      return this.warn('Client error', data);
    } else {
      return this.info('Request processed', data);
    }
  }

  /**
   * Log database query
   */
  logQuery(query, params, duration, error = null) {
    const data = {
      query,
      params,
      duration: `${duration}ms`
    };

    if (error) {
      data.error = error.message;
      return this.error('Database query failed', data);
    } else {
      return this.debug('Database query executed', data);
    }
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext) {
    const childLogger = new Logger(
      `${this.context}:${additionalContext}`,
      this.env
    );
    childLogger.logLevel = this.logLevel;
    return childLogger;
  }
}

/**
 * Middleware for request logging
 */
export function loggingMiddleware(logger) {
  return async (request, env, ctx, next) => {
    const startTime = Date.now();
    const requestLogger = logger.child(`${request.method}:${new URL(request.url).pathname}`);

    // Log incoming request
    requestLogger.info('Incoming request', {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });

    try {
      // Process request
      const response = await next(request, env, ctx);

      // Log response
      const duration = Date.now() - startTime;
      await requestLogger.logRequest(request, response, duration);

      // Add request ID to response headers
      const requestId = crypto.randomUUID();
      response.headers.set('X-Request-Id', requestId);

      return response;
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime;
      requestLogger.error('Request failed', {
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`
      });

      throw error;
    }
  };
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  constructor(logger) {
    this.logger = logger;
    this.metrics = new Map();
  }

  /**
   * Start timing an operation
   */
  start(operation) {
    this.metrics.set(operation, Date.now());
  }

  /**
   * End timing and log
   */
  end(operation, metadata = {}) {
    const startTime = this.metrics.get(operation);
    if (!startTime) {
      this.logger.warn(`No start time found for operation: ${operation}`);
      return;
    }

    const duration = Date.now() - startTime;
    this.metrics.delete(operation);

    this.logger.debug(`Performance: ${operation}`, {
      duration: `${duration}ms`,
      ...metadata
    });

    return duration;
  }

  /**
   * Measure async function execution time
   */
  async measure(operation, fn, metadata = {}) {
    this.start(operation);
    try {
      const result = await fn();
      this.end(operation, { ...metadata, status: 'success' });
      return result;
    } catch (error) {
      this.end(operation, { ...metadata, status: 'error', error: error.message });
      throw error;
    }
  }
}

/**
 * Error tracking
 */
export class ErrorTracker {
  constructor(logger, env) {
    this.logger = logger;
    this.env = env;
  }

  /**
   * Track and report error
   */
  async track(error, context = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context,
      timestamp: new Date().toISOString(),
      environment: this.env.ENVIRONMENT || 'development'
    };

    // Log error
    await this.logger.error('Error tracked', errorData);

    // Send to error tracking service (e.g., Sentry)
    if (this.env.SENTRY_DSN) {
      await this.sendToSentry(errorData);
    }

    // Store in KV for analysis
    if (this.env.KV_ERRORS) {
      await this.storeError(errorData);
    }
  }

  /**
   * Send error to Sentry
   */
  async sendToSentry(errorData) {
    // Implement Sentry integration
    // This is a placeholder for Sentry API call
  }

  /**
   * Store error in KV
   */
  async storeError(errorData) {
    const key = `error:${Date.now()}:${crypto.randomUUID()}`;
    await this.env.KV_ERRORS.put(key, JSON.stringify(errorData), {
      expirationTtl: 30 * 24 * 60 * 60 // Keep for 30 days
    });
  }
}

export default Logger;