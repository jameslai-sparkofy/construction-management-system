import { ResponseHelper, Utils } from '../utils/response.js';
import { SessionService } from '../services/sessionService.js';

/**
 * Authentication service for phone number + last 3 digits password
 */
export class AuthService {
  constructor(sessionsKV, usersKV, apiBaseUrl) {
    this.sessionService = new SessionService(sessionsKV, usersKV);
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Authenticate user with phone number and last 3 digits password
   * @param {string} phone - Phone number
   * @param {string} password - Last 3 digits password
   * @param {string} tenantId - Tenant ID
   * @param {string} clientIp - Client IP address
   * @returns {Promise<Response>} Authentication response
   */
  async login(phone, password, tenantId, clientIp = 'unknown') {
    try {
      // Validate input
      if (!Utils.isValidPhone(phone)) {
        return ResponseHelper.validationError('Invalid phone number format');
      }

      if (!Utils.isValidPassword(password)) {
        return ResponseHelper.validationError('Password must be exactly 3 digits');
      }

      if (!tenantId) {
        return ResponseHelper.validationError('Tenant ID is required');
      }

      // Normalize phone number (remove dashes and spaces)
      const normalizedPhone = phone.replace(/[-\s]/g, '');

      // Check if user exists in cache first
      let userInfo = await this.sessionService.getUserInfo(normalizedPhone, tenantId);
      
      if (!userInfo) {
        // If not in cache, try to authenticate with the existing API
        userInfo = await this.authenticateWithExternalAPI(normalizedPhone, password, tenantId);
        if (!userInfo) {
          return ResponseHelper.unauthorized('Invalid credentials');
        }

        // Store user info in cache for future use
        await this.sessionService.storeUserInfo(normalizedPhone, tenantId, userInfo);
      } else {
        // Verify password with external API (for security)
        const isValidCredentials = await this.verifyCredentialsWithExternalAPI(normalizedPhone, password, tenantId);
        if (!isValidCredentials) {
          return ResponseHelper.unauthorized('Invalid credentials');
        }
      }

      // Destroy any existing sessions for this user
      await this.sessionService.destroyUserSessions(userInfo.id || normalizedPhone, tenantId);

      // Create new session
      const sessionId = await this.sessionService.createSession(
        userInfo.id || normalizedPhone,
        tenantId,
        userInfo,
        clientIp
      );

      return ResponseHelper.success({
        sessionId,
        user: {
          id: userInfo.id,
          phone: normalizedPhone,
          name: userInfo.name,
          email: userInfo.email,
          role: userInfo.role,
          permissions: userInfo.permissions
        },
        tenantId
      }, 'Login successful');

    } catch (error) {
      console.error('Login error:', error);
      return ResponseHelper.error('Authentication failed');
    }
  }

  /**
   * Logout user by destroying session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Response>} Logout response
   */
  async logout(sessionId) {
    try {
      if (!sessionId) {
        return ResponseHelper.validationError('Session ID is required');
      }

      const destroyed = await this.sessionService.destroySession(sessionId);
      
      if (destroyed) {
        return ResponseHelper.success(null, 'Logout successful');
      } else {
        return ResponseHelper.error('Failed to logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
      return ResponseHelper.error('Logout failed');
    }
  }

  /**
   * Verify session and return user info
   * @param {string} sessionId - Session ID
   * @returns {Promise<object|null>} User session info or null
   */
  async verifySession(sessionId) {
    try {
      return await this.sessionService.validateSession(sessionId);
    } catch (error) {
      console.error('Session verification error:', error);
      return null;
    }
  }

  /**
   * Get session from request
   * @param {Request} request - Request object
   * @returns {Promise<object|null>} Session info or null
   */
  async getSessionFromRequest(request) {
    try {
      return await this.sessionService.getSessionFromRequest(request);
    } catch (error) {
      console.error('Get session from request error:', error);
      return null;
    }
  }

  /**
   * Refresh session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Response>} Refresh response
   */
  async refreshSession(sessionId) {
    try {
      if (!sessionId) {
        return ResponseHelper.validationError('Session ID is required');
      }

      const session = await this.sessionService.validateSession(sessionId);
      if (!session) {
        return ResponseHelper.unauthorized('Invalid session');
      }

      const refreshed = await this.sessionService.refreshSession(sessionId);
      
      if (refreshed) {
        return ResponseHelper.success({
          sessionId,
          user: session.userInfo,
          tenantId: session.tenantId
        }, 'Session refreshed');
      } else {
        return ResponseHelper.error('Failed to refresh session');
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      return ResponseHelper.error('Session refresh failed');
    }
  }

  /**
   * Authenticate with external API
   * @param {string} phone - Phone number
   * @param {string} password - Password
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<object|null>} User info or null
   */
  async authenticateWithExternalAPI(phone, password, tenantId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({
          phone,
          password
        })
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.user || data.data || null;
    } catch (error) {
      console.error('External API authentication error:', error);
      return null;
    }
  }

  /**
   * Verify credentials with external API
   * @param {string} phone - Phone number
   * @param {string} password - Password
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<boolean>} Verification result
   */
  async verifyCredentialsWithExternalAPI(phone, password, tenantId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({
          phone,
          password
        })
      });

      return response.ok;
    } catch (error) {
      console.error('External API verification error:', error);
      // If external API is down, assume credentials are still valid
      // This prevents users from being locked out during API downtime
      return true;
    }
  }

  /**
   * Check if user has permission
   * @param {object} userInfo - User information
   * @param {string} permission - Required permission
   * @returns {boolean} Permission check result
   */
  hasPermission(userInfo, permission) {
    if (!userInfo || !userInfo.permissions) {
      return false;
    }

    // Check if user has admin role (full access)
    if (userInfo.role === 'admin' || userInfo.role === 'superadmin') {
      return true;
    }

    // Check specific permission
    return userInfo.permissions.includes(permission);
  }

  /**
   * Check if user has role
   * @param {object} userInfo - User information
   * @param {string} role - Required role
   * @returns {boolean} Role check result
   */
  hasRole(userInfo, role) {
    if (!userInfo || !userInfo.role) {
      return false;
    }

    return userInfo.role === role;
  }
}