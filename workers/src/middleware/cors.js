/**
 * CORS middleware for handling cross-origin requests
 */
export class CorsMiddleware {
  constructor(options = {}) {
    this.options = {
      origin: options.origin || '*',
      methods: options.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: options.allowedHeaders || [
        'Content-Type',
        'Authorization',
        'X-Tenant-ID',
        'X-Requested-With'
      ],
      credentials: options.credentials || true,
      maxAge: options.maxAge || 86400, // 24 hours
      ...options
    };
  }

  /**
   * Add CORS headers to response
   * @param {Response} response - Response object
   * @param {Request} request - Request object
   * @returns {Response} Response with CORS headers
   */
  addCorsHeaders(response, request) {
    const origin = request.headers.get('Origin');
    
    // Create new response with CORS headers
    const corsResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'Access-Control-Allow-Origin': this.getAllowedOrigin(origin),
        'Access-Control-Allow-Methods': this.options.methods.join(', '),
        'Access-Control-Allow-Headers': this.options.allowedHeaders.join(', '),
        'Access-Control-Max-Age': this.options.maxAge.toString(),
        ...(this.options.credentials && { 'Access-Control-Allow-Credentials': 'true' })
      }
    });

    return corsResponse;
  }

  /**
   * Handle preflight OPTIONS request
   * @param {Request} request - Request object
   * @returns {Response} Preflight response
   */
  handlePreflight(request) {
    const origin = request.headers.get('Origin');
    
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': this.getAllowedOrigin(origin),
        'Access-Control-Allow-Methods': this.options.methods.join(', '),
        'Access-Control-Allow-Headers': this.options.allowedHeaders.join(', '),
        'Access-Control-Max-Age': this.options.maxAge.toString(),
        ...(this.options.credentials && { 'Access-Control-Allow-Credentials': 'true' })
      }
    });
  }

  /**
   * Get allowed origin based on configuration
   * @param {string} origin - Request origin
   * @returns {string} Allowed origin
   */
  getAllowedOrigin(origin) {
    if (this.options.origin === '*') {
      return '*';
    }

    if (Array.isArray(this.options.origin)) {
      return this.options.origin.includes(origin) ? origin : this.options.origin[0];
    }

    if (typeof this.options.origin === 'string') {
      return this.options.origin;
    }

    if (typeof this.options.origin === 'function') {
      return this.options.origin(origin) ? origin : 'null';
    }

    return '*';
  }

  /**
   * Check if request is a preflight request
   * @param {Request} request - Request object
   * @returns {boolean} Is preflight request
   */
  isPreflight(request) {
    return request.method === 'OPTIONS' &&
           request.headers.has('Access-Control-Request-Method');
  }
}