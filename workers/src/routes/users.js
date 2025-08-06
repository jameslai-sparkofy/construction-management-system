import { ResponseHelper } from '../utils/response.js';

/**
 * Users routes
 */
export class UsersRoutes {
  constructor(d1ProxyService, authMiddleware, tenantMiddleware) {
    this.d1ProxyService = d1ProxyService;
    this.authMiddleware = authMiddleware;
    this.tenantMiddleware = tenantMiddleware;
  }

  /**
   * Get all users
   * @param {Request} request - Request object
   * @param {object} user - Authenticated user
   * @returns {Promise<Response>} Users response
   */
  async getUsers(request, user) {
    try {
      // Check permissions
      const permissionCheck = await this.authMiddleware.requirePermission('users:read')(request);
      if (permissionCheck.error) {
        return permissionCheck.error;
      }

      // Validate tenant access
      const tenantAccess = await this.tenantMiddleware.validateTenantAccess(request, user);
      if (!tenantAccess.allowed) {
        return tenantAccess.error;
      }

      // Parse query parameters for filtering
      const url = new URL(request.url);
      const filters = {
        role: url.searchParams.get('role'),
        search: url.searchParams.get('search'),
        active: url.searchParams.get('active'),
        limit: url.searchParams.get('limit') || '20',
        offset: url.searchParams.get('offset') || '0'
      };

      // Remove null/undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === null || filters[key] === undefined) {
          delete filters[key];
        }
      });

      return await this.d1ProxyService.getUsers(user.tenantId, user, filters);

    } catch (error) {
      console.error('Get users error:', error);
      return ResponseHelper.error('Failed to get users');
    }
  }
}