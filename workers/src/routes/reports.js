import { ResponseHelper } from '../utils/response.js';

/**
 * Reports routes
 */
export class ReportsRoutes {
  constructor(d1ProxyService, authMiddleware, tenantMiddleware) {
    this.d1ProxyService = d1ProxyService;
    this.authMiddleware = authMiddleware;
    this.tenantMiddleware = tenantMiddleware;
  }

  /**
   * Get reports
   * @param {Request} request - Request object
   * @param {object} user - Authenticated user
   * @returns {Promise<Response>} Reports response
   */
  async getReports(request, user) {
    try {
      // Check permissions
      const permissionCheck = await this.authMiddleware.requirePermission('reports:read')(request);
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
        type: url.searchParams.get('type'),
        dateFrom: url.searchParams.get('dateFrom'),
        dateTo: url.searchParams.get('dateTo'),
        projectId: url.searchParams.get('projectId'),
        format: url.searchParams.get('format') || 'json'
      };

      // Remove null/undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === null || filters[key] === undefined) {
          delete filters[key];
        }
      });

      return await this.d1ProxyService.getReports(user.tenantId, user, filters);

    } catch (error) {
      console.error('Get reports error:', error);
      return ResponseHelper.error('Failed to get reports');
    }
  }
}