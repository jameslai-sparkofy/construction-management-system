/**
 * Monitoring and Analytics Utility
 * Track application metrics and performance
 */

export class MetricsCollector {
  constructor(env) {
    this.env = env;
    this.metrics = new Map();
    this.bufferSize = 100;
    this.flushInterval = 60000; // 1 minute
    this.buffer = [];
  }

  /**
   * Record a metric
   */
  record(name, value, tags = {}) {
    const metric = {
      name,
      value,
      tags,
      timestamp: Date.now()
    };

    this.buffer.push(metric);

    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Increment a counter
   */
  increment(name, value = 1, tags = {}) {
    this.record(name, value, { ...tags, type: 'counter' });
  }

  /**
   * Record a gauge value
   */
  gauge(name, value, tags = {}) {
    this.record(name, value, { ...tags, type: 'gauge' });
  }

  /**
   * Record timing
   */
  timing(name, duration, tags = {}) {
    this.record(name, duration, { ...tags, type: 'timing', unit: 'ms' });
  }

  /**
   * Flush metrics to analytics engine
   */
  async flush() {
    if (this.buffer.length === 0) return;

    const metrics = [...this.buffer];
    this.buffer = [];

    try {
      if (this.env?.ANALYTICS) {
        // Send to Cloudflare Analytics Engine
        for (const metric of metrics) {
          this.env.ANALYTICS.writeDataPoint({
            blobs: [metric.name],
            doubles: [metric.value],
            indexes: [JSON.stringify(metric.tags)]
          });
        }
      }

      // Send to external monitoring service
      if (this.env?.MONITORING_ENDPOINT) {
        await this.sendToMonitoring(metrics);
      }
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      // Re-add metrics to buffer if flush failed
      this.buffer.unshift(...metrics);
    }
  }

  /**
   * Send metrics to external monitoring service
   */
  async sendToMonitoring(metrics) {
    const response = await fetch(this.env.MONITORING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.MONITORING_API_KEY}`
      },
      body: JSON.stringify({ metrics })
    });

    if (!response.ok) {
      throw new Error(`Monitoring service returned ${response.status}`);
    }
  }
}

/**
 * Health check service
 */
export class HealthCheck {
  constructor(env) {
    this.env = env;
    this.checks = new Map();
  }

  /**
   * Register a health check
   */
  register(name, checkFn) {
    this.checks.set(name, checkFn);
  }

  /**
   * Run all health checks
   */
  async runAll() {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };

    for (const [name, checkFn] of this.checks.entries()) {
      try {
        const startTime = Date.now();
        const result = await checkFn();
        const duration = Date.now() - startTime;

        results.checks[name] = {
          status: result.status || 'healthy',
          message: result.message,
          duration: `${duration}ms`,
          metadata: result.metadata
        };

        if (result.status === 'unhealthy') {
          results.status = 'unhealthy';
        } else if (result.status === 'degraded' && results.status !== 'unhealthy') {
          results.status = 'degraded';
        }
      } catch (error) {
        results.checks[name] = {
          status: 'unhealthy',
          error: error.message
        };
        results.status = 'unhealthy';
      }
    }

    return results;
  }

  /**
   * Default health checks
   */
  registerDefaultChecks() {
    // Database health check
    this.register('database', async () => {
      try {
        if (this.env.DB_ENGINEERING) {
          const result = await this.env.DB_ENGINEERING.prepare('SELECT 1').first();
          return { status: 'healthy', message: 'Database connection OK' };
        }
        return { status: 'degraded', message: 'Database not configured' };
      } catch (error) {
        return { status: 'unhealthy', message: error.message };
      }
    });

    // KV health check
    this.register('kv_storage', async () => {
      try {
        if (this.env.SESSION_STORE) {
          const testKey = 'health_check_test';
          await this.env.SESSION_STORE.put(testKey, 'test', { expirationTtl: 60 });
          await this.env.SESSION_STORE.delete(testKey);
          return { status: 'healthy', message: 'KV storage OK' };
        }
        return { status: 'degraded', message: 'KV storage not configured' };
      } catch (error) {
        return { status: 'unhealthy', message: error.message };
      }
    });

    // R2 health check
    this.register('r2_storage', async () => {
      try {
        if (this.env.R2_BUCKET) {
          await this.env.R2_BUCKET.list({ limit: 1 });
          return { status: 'healthy', message: 'R2 storage OK' };
        }
        return { status: 'degraded', message: 'R2 storage not configured' };
      } catch (error) {
        return { status: 'unhealthy', message: error.message };
      }
    });

    // External API health check
    this.register('crm_api', async () => {
      try {
        const response = await fetch(`${this.env.FX_API_BASE_URL}/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.env.FX_API_TOKEN}`
          },
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          return { status: 'healthy', message: 'CRM API OK' };
        }
        return { status: 'degraded', message: `CRM API returned ${response.status}` };
      } catch (error) {
        return { status: 'unhealthy', message: error.message };
      }
    });
  }
}

/**
 * Request analytics
 */
export class RequestAnalytics {
  constructor(metrics) {
    this.metrics = metrics;
  }

  /**
   * Track request
   */
  track(request, response, duration) {
    const url = new URL(request.url);
    const tags = {
      method: request.method,
      path: url.pathname,
      status: response.status,
      status_category: Math.floor(response.status / 100) + 'xx'
    };

    // Track request count
    this.metrics.increment('request.count', 1, tags);

    // Track response time
    this.metrics.timing('request.duration', duration, tags);

    // Track error rate
    if (response.status >= 400) {
      this.metrics.increment('request.errors', 1, tags);
    }

    // Track specific endpoints
    if (url.pathname.startsWith('/api/v1/projects')) {
      this.metrics.increment('api.projects.requests', 1, tags);
    } else if (url.pathname.startsWith('/api/v1/auth')) {
      this.metrics.increment('api.auth.requests', 1, tags);
    }
  }

  /**
   * Track user activity
   */
  trackUserActivity(userId, action, metadata = {}) {
    this.metrics.increment('user.activity', 1, {
      user_id: userId,
      action,
      ...metadata
    });
  }

  /**
   * Track business metrics
   */
  trackBusinessMetric(metric, value, tags = {}) {
    this.metrics.gauge(`business.${metric}`, value, tags);
  }
}

/**
 * Alert manager
 */
export class AlertManager {
  constructor(env) {
    this.env = env;
    this.thresholds = {
      errorRate: 0.05, // 5% error rate
      responseTime: 1000, // 1 second
      requestRate: 1000 // 1000 requests per minute
    };
  }

  /**
   * Check thresholds and send alerts
   */
  async checkThresholds(metrics) {
    const alerts = [];

    // Check error rate
    const errorRate = metrics.get('error_rate');
    if (errorRate > this.thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'high',
        message: `Error rate is ${errorRate * 100}%`,
        value: errorRate
      });
    }

    // Check response time
    const responseTime = metrics.get('avg_response_time');
    if (responseTime > this.thresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        severity: 'medium',
        message: `Average response time is ${responseTime}ms`,
        value: responseTime
      });
    }

    // Send alerts
    if (alerts.length > 0) {
      await this.sendAlerts(alerts);
    }
  }

  /**
   * Send alerts to notification channels
   */
  async sendAlerts(alerts) {
    // Send to webhook
    if (this.env.ALERT_WEBHOOK) {
      await fetch(this.env.ALERT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts })
      });
    }

    // Log alerts
    console.error('Alerts triggered:', alerts);
  }
}

/**
 * Create monitoring middleware
 */
export function monitoringMiddleware(metrics, analytics) {
  return async (request, env, ctx, next) => {
    const startTime = Date.now();

    try {
      const response = await next(request, env, ctx);
      const duration = Date.now() - startTime;

      // Track request analytics
      analytics.track(request, response, duration);

      // Add performance headers
      response.headers.set('X-Response-Time', `${duration}ms`);
      response.headers.set('X-Server-Region', env.CF_REGION || 'unknown');

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Track error
      metrics.increment('request.exceptions', 1, {
        error: error.name,
        message: error.message
      });

      throw error;
    }
  };
}

export default {
  MetricsCollector,
  HealthCheck,
  RequestAnalytics,
  AlertManager,
  monitoringMiddleware
};