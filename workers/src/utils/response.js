/**
 * Response utility functions for consistent API responses
 */

export const ResponseHelper = {
  /**
   * Create a success response
   * @param {any} data - Response data
   * @param {string} message - Success message
   * @param {number} status - HTTP status code
   * @returns {Response}
   */
  success(data = null, message = 'Success', status = 200) {
    return new Response(JSON.stringify({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    }), {
      status,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  },

  /**
   * Create an error response
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   * @param {string} code - Error code
   * @param {any} details - Additional error details
   * @returns {Response}
   */
  error(message = 'Internal Server Error', status = 500, code = null, details = null) {
    return new Response(JSON.stringify({
      success: false,
      message,
      code,
      details,
      timestamp: new Date().toISOString()
    }), {
      status,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  },

  /**
   * Create a validation error response
   * @param {string} message - Validation error message
   * @param {any} errors - Validation errors object
   * @returns {Response}
   */
  validationError(message = 'Validation failed', errors = null) {
    return this.error(message, 400, 'VALIDATION_ERROR', errors);
  },

  /**
   * Create an unauthorized response
   * @param {string} message - Unauthorized message
   * @returns {Response}
   */
  unauthorized(message = 'Unauthorized') {
    return this.error(message, 401, 'UNAUTHORIZED');
  },

  /**
   * Create a forbidden response
   * @param {string} message - Forbidden message
   * @returns {Response}
   */
  forbidden(message = 'Forbidden') {
    return this.error(message, 403, 'FORBIDDEN');
  },

  /**
   * Create a not found response
   * @param {string} message - Not found message
   * @returns {Response}
   */
  notFound(message = 'Resource not found') {
    return this.error(message, 404, 'NOT_FOUND');
  },

  /**
   * Create a method not allowed response
   * @param {string} message - Method not allowed message
   * @returns {Response}
   */
  methodNotAllowed(message = 'Method not allowed') {
    return this.error(message, 405, 'METHOD_NOT_ALLOWED');
  }
};

/**
 * Utility functions for common operations
 */
export const Utils = {
  /**
   * Generate a random string
   * @param {number} length - Length of the string
   * @returns {string}
   */
  generateRandomString(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Generate a session ID
   * @returns {string}
   */
  generateSessionId() {
    return `session_${Date.now()}_${this.generateRandomString(16)}`;
  },

  /**
   * Validate phone number format
   * @param {string} phone - Phone number
   * @returns {boolean}
   */
  isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    // Taiwan phone number format: 09XX-XXX-XXX or 09XXXXXXXX
    const phoneRegex = /^09\d{8}$/;
    return phoneRegex.test(phone.replace(/[-\s]/g, ''));
  },

  /**
   * Validate password (last 3 digits)
   * @param {string} password - Password
   * @returns {boolean}
   */
  isValidPassword(password) {
    if (!password || typeof password !== 'string') return false;
    // Must be exactly 3 digits
    return /^\d{3}$/.test(password);
  },

  /**
   * Parse JSON safely
   * @param {string} jsonString - JSON string to parse
   * @param {any} defaultValue - Default value if parsing fails
   * @returns {any}
   */
  parseJson(jsonString, defaultValue = null) {
    try {
      return JSON.parse(jsonString);
    } catch {
      return defaultValue;
    }
  },

  /**
   * Extract tenant ID from request or headers
   * @param {Request} request - Request object
   * @returns {string|null}
   */
  extractTenantId(request) {
    // Try to get tenant ID from headers first
    const tenantIdHeader = request.headers.get('X-Tenant-ID');
    if (tenantIdHeader) return tenantIdHeader;

    // Try to get from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tenantIndex = pathParts.findIndex(part => part === 'tenant');
    if (tenantIndex !== -1 && pathParts[tenantIndex + 1]) {
      return pathParts[tenantIndex + 1];
    }

    return null;
  },

  /**
   * Get request IP address
   * @param {Request} request - Request object
   * @returns {string}
   */
  getClientIp(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For') || 
           request.headers.get('X-Real-IP') || 
           'unknown';
  }
};