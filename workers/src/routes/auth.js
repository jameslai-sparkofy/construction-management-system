import { ResponseHelper, Utils } from '../utils/response.js';

/**
 * Authentication routes
 */
export class AuthRoutes {
  constructor(authService, tenantMiddleware) {
    this.authService = authService;
    this.tenantMiddleware = tenantMiddleware;
  }

  /**
   * Handle login request
   * @param {Request} request - Request object
   * @returns {Promise<Response>} Login response
   */
  async login(request) {
    try {
      // Try to validate tenant, but use default if not provided
      const tenantValidation = await this.tenantMiddleware.validateTenant(request);
      
      // Use default tenant if no tenant ID is provided
      let tenantId = 'yes-ceramics'; // Default tenant
      if (!tenantValidation.error && tenantValidation.tenantId) {
        tenantId = tenantValidation.tenantId;
      }

      // Parse request body
      const body = await request.json();
      const { phone, password } = body;

      if (!phone || !password) {
        return ResponseHelper.validationError('Phone number and password are required');
      }

      // Get client IP
      const clientIp = Utils.getClientIp(request);

      // Authenticate user
      return await this.authService.login(
        phone,
        password,
        tenantId,
        clientIp
      );

    } catch (error) {
      console.error('Login route error:', error);
      if (error instanceof SyntaxError) {
        return ResponseHelper.validationError('Invalid JSON in request body');
      }
      return ResponseHelper.error('Login failed');
    }
  }

  /**
   * Handle logout request
   * @param {Request} request - Request object
   * @returns {Promise<Response>} Logout response
   */
  async logout(request) {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ResponseHelper.validationError('Authorization header required');
      }

      const sessionId = authHeader.substring(7);
      return await this.authService.logout(sessionId);

    } catch (error) {
      console.error('Logout route error:', error);
      return ResponseHelper.error('Logout failed');
    }
  }

  /**
   * Handle session refresh request
   * @param {Request} request - Request object
   * @returns {Promise<Response>} Refresh response
   */
  async refresh(request) {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ResponseHelper.validationError('Authorization header required');
      }

      const sessionId = authHeader.substring(7);
      return await this.authService.refreshSession(sessionId);

    } catch (error) {
      console.error('Refresh route error:', error);
      return ResponseHelper.error('Session refresh failed');
    }
  }

  /**
   * Handle user profile request
   * @param {Request} request - Request object
   * @param {object} user - Authenticated user
   * @returns {Promise<Response>} Profile response
   */
  async profile(request, user) {
    try {
      return ResponseHelper.success({
        user: {
          id: user.userId,
          ...user.userInfo
        },
        tenantId: user.tenantId,
        sessionId: user.sessionId
      }, 'Profile retrieved successfully');

    } catch (error) {
      console.error('Profile route error:', error);
      return ResponseHelper.error('Failed to get profile');
    }
  }
}