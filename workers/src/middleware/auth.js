import { ResponseHelper } from '../utils/response.js';
import { AuthService } from '../auth/authService.js';

/**
 * Authentication middleware
 */
export class AuthMiddleware {
  constructor(sessionsKV, usersKV, apiBaseUrl) {
    this.authService = new AuthService(sessionsKV, usersKV, apiBaseUrl);
  }

  /**
   * Require authentication middleware
   * @param {Request} request - Request object
   * @returns {Promise<{user: object, error: Response|null}>} Auth result
   */
  async requireAuth(request) {
    const session = await this.authService.getSessionFromRequest(request);
    
    if (!session) {
      return {
        user: null,
        error: ResponseHelper.unauthorized('Authentication required')
      };
    }

    return {
      user: session,
      error: null
    };
  }

  /**
   * Optional authentication middleware
   * @param {Request} request - Request object
   * @returns {Promise<object|null>} User session or null
   */
  async optionalAuth(request) {
    return await this.authService.getSessionFromRequest(request);
  }

  /**
   * Require specific permission
   * @param {string} permission - Required permission
   * @returns {Function} Middleware function
   */
  requirePermission(permission) {
    return async (request) => {
      const authResult = await this.requireAuth(request);
      
      if (authResult.error) {
        return authResult;
      }

      const hasPermission = this.authService.hasPermission(authResult.user.userInfo, permission);
      
      if (!hasPermission) {
        return {
          user: authResult.user,
          error: ResponseHelper.forbidden(`Permission '${permission}' required`)
        };
      }

      return authResult;
    };
  }

  /**
   * Require specific role
   * @param {string} role - Required role
   * @returns {Function} Middleware function
   */
  requireRole(role) {
    return async (request) => {
      const authResult = await this.requireAuth(request);
      
      if (authResult.error) {
        return authResult;
      }

      const hasRole = this.authService.hasRole(authResult.user.userInfo, role);
      
      if (!hasRole) {
        return {
          user: authResult.user,
          error: ResponseHelper.forbidden(`Role '${role}' required`)
        };
      }

      return authResult;
    };
  }

  /**
   * Require one of multiple permissions
   * @param {string[]} permissions - Array of permissions (user needs at least one)
   * @returns {Function} Middleware function
   */
  requireAnyPermission(permissions) {
    return async (request) => {
      const authResult = await this.requireAuth(request);
      
      if (authResult.error) {
        return authResult;
      }

      const hasAnyPermission = permissions.some(permission => 
        this.authService.hasPermission(authResult.user.userInfo, permission)
      );
      
      if (!hasAnyPermission) {
        return {
          user: authResult.user,
          error: ResponseHelper.forbidden(`One of these permissions required: ${permissions.join(', ')}`)
        };
      }

      return authResult;
    };
  }

  /**
   * Require all specified permissions
   * @param {string[]} permissions - Array of permissions (user needs all)
   * @returns {Function} Middleware function
   */
  requireAllPermissions(permissions) {
    return async (request) => {
      const authResult = await this.requireAuth(request);
      
      if (authResult.error) {
        return authResult;
      }

      const hasAllPermissions = permissions.every(permission => 
        this.authService.hasPermission(authResult.user.userInfo, permission)
      );
      
      if (!hasAllPermissions) {
        return {
          user: authResult.user,
          error: ResponseHelper.forbidden(`All these permissions required: ${permissions.join(', ')}`)
        };
      }

      return authResult;
    };
  }
}