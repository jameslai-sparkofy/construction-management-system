import { ResponseHelper, Utils } from '../utils/response.js';

/**
 * Tenant isolation middleware
 */
export class TenantMiddleware {
  constructor() {
    this.allowedTenants = new Set(); // In production, this would be loaded from a configuration
  }

  /**
   * Extract and validate tenant from request
   * @param {Request} request - Request object
   * @returns {Promise<{tenantId: string, error: Response|null}>} Tenant validation result
   */
  async validateTenant(request) {
    const tenantId = Utils.extractTenantId(request);
    
    if (!tenantId) {
      return {
        tenantId: null,
        error: ResponseHelper.validationError('Tenant ID is required')
      };
    }

    // In production, you would validate against a list of allowed tenants
    // For now, we'll accept any non-empty tenant ID
    if (!this.isValidTenantId(tenantId)) {
      return {
        tenantId: null,
        error: ResponseHelper.forbidden('Invalid tenant ID')
      };
    }

    return {
      tenantId,
      error: null
    };
  }

  /**
   * Require tenant validation middleware
   * @param {Request} request - Request object
   * @returns {Promise<{tenantId: string, error: Response|null}>} Validation result
   */
  async requireTenant(request) {
    return await this.validateTenant(request);
  }

  /**
   * Ensure user belongs to the requested tenant
   * @param {Request} request - Request object
   * @param {object} userSession - User session object
   * @returns {Promise<{allowed: boolean, error: Response|null}>} Access validation result
   */
  async validateTenantAccess(request, userSession) {
    const tenantValidation = await this.validateTenant(request);
    
    if (tenantValidation.error) {
      return {
        allowed: false,
        error: tenantValidation.error
      };
    }

    const requestedTenantId = tenantValidation.tenantId;
    const userTenantId = userSession.tenantId;

    // Check if user belongs to the requested tenant
    if (userTenantId !== requestedTenantId) {
      return {
        allowed: false,
        error: ResponseHelper.forbidden('Access denied: You do not belong to this tenant')
      };
    }

    return {
      allowed: true,
      error: null
    };
  }

  /**
   * Add tenant context to request
   * @param {Request} request - Request object
   * @param {string} tenantId - Tenant ID
   * @returns {Request} Request with tenant context
   */
  addTenantContext(request, tenantId) {
    // Since Request objects are immutable, we'll store tenant context in a way
    // that can be accessed later. In practice, you might use request.env or similar.
    const url = new URL(request.url);
    url.searchParams.set('_tenant', tenantId);
    
    return new Request(url.toString(), {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'X-Tenant-ID': tenantId
      },
      body: request.body
    });
  }

  /**
   * Validate tenant ID format
   * @param {string} tenantId - Tenant ID to validate
   * @returns {boolean} Is valid tenant ID
   */
  isValidTenantId(tenantId) {
    if (!tenantId || typeof tenantId !== 'string') {
      return false;
    }

    // Basic validation: alphanumeric, hyphens, underscores, 3-50 characters
    const tenantRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    return tenantRegex.test(tenantId);
  }

  /**
   * Add tenant to allowed list (for configuration)
   * @param {string} tenantId - Tenant ID to allow
   */
  addAllowedTenant(tenantId) {
    if (this.isValidTenantId(tenantId)) {
      this.allowedTenants.add(tenantId);
    }
  }

  /**
   * Remove tenant from allowed list
   * @param {string} tenantId - Tenant ID to remove
   */
  removeAllowedTenant(tenantId) {
    this.allowedTenants.delete(tenantId);
  }

  /**
   * Check if tenant is in allowed list
   * @param {string} tenantId - Tenant ID to check
   * @returns {boolean} Is tenant allowed
   */
  isTenantAllowed(tenantId) {
    // If no specific tenants are configured, allow all valid tenant IDs
    if (this.allowedTenants.size === 0) {
      return this.isValidTenantId(tenantId);
    }

    return this.allowedTenants.has(tenantId);
  }

  /**
   * Get tenant-specific cache key
   * @param {string} tenantId - Tenant ID
   * @param {string} key - Base cache key
   * @returns {string} Tenant-specific cache key
   */
  getTenantCacheKey(tenantId, key) {
    return `tenant:${tenantId}:${key}`;
  }

  /**
   * Get tenant-specific API URL
   * @param {string} tenantId - Tenant ID
   * @param {string} baseUrl - Base API URL
   * @param {string} endpoint - API endpoint
   * @returns {string} Tenant-specific API URL
   */
  getTenantApiUrl(tenantId, baseUrl, endpoint) {
    // You might want to route different tenants to different API endpoints
    // For now, we'll just add the tenant ID as a header or query parameter
    const url = new URL(endpoint, baseUrl);
    url.searchParams.set('tenant', tenantId);
    return url.toString();
  }
}