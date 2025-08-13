import { Utils } from '../utils/response.js';

/**
 * Session management service using Cloudflare Workers KV
 */
export class SessionService {
  constructor(sessionsKV, usersKV) {
    this.sessionsKV = sessionsKV;
    this.usersKV = usersKV;
    this.sessionTTL = 24 * 60 * 60; // 24 hours in seconds
  }

  /**
   * Create a new session
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {object} userInfo - User information
   * @param {string} clientIp - Client IP address
   * @returns {Promise<string>} Session ID
   */
  async createSession(userId, tenantId, userInfo, clientIp = 'unknown') {
    const sessionId = Utils.generateSessionId();
    const sessionData = {
      userId,
      tenantId,
      userInfo,
      clientIp,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      isActive: true
    };

    // Store session in KV with TTL
    await this.sessionsKV.put(
      sessionId, 
      JSON.stringify(sessionData),
      { expirationTtl: this.sessionTTL }
    );

    // Also store user's current session ID for session management
    const userSessionKey = `user_session:${tenantId}:${userId}`;
    await this.sessionsKV.put(
      userSessionKey,
      sessionId,
      { expirationTtl: this.sessionTTL }
    );

    return sessionId;
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Promise<object|null>} Session data or null if not found
   */
  async getSession(sessionId) {
    if (!sessionId) return null;

    const sessionData = await this.sessionsKV.get(sessionId);
    if (!sessionData) return null;

    const session = Utils.parseJson(sessionData);
    if (!session || !session.isActive) return null;

    // Update last accessed time
    session.lastAccessedAt = new Date().toISOString();
    await this.sessionsKV.put(
      sessionId,
      JSON.stringify(session),
      { expirationTtl: this.sessionTTL }
    );

    return session;
  }

  /**
   * Validate session and return user info
   * @param {string} sessionId - Session ID
   * @returns {Promise<object|null>} User session info or null if invalid
   */
  async validateSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    return {
      userId: session.userId,
      tenantId: session.tenantId,
      userInfo: session.userInfo,
      sessionId
    };
  }

  /**
   * Destroy a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} Success status
   */
  async destroySession(sessionId) {
    if (!sessionId) return false;

    try {
      // Get session data first to clean up user session reference
      const sessionData = await this.sessionsKV.get(sessionId);
      if (sessionData) {
        const session = Utils.parseJson(sessionData);
        if (session) {
          const userSessionKey = `user_session:${session.tenantId}:${session.userId}`;
          await this.sessionsKV.delete(userSessionKey);
        }
      }

      // Delete the session
      await this.sessionsKV.delete(sessionId);
      return true;
    } catch (error) {
      console.error('Error destroying session:', error);
      return false;
    }
  }

  /**
   * Destroy all sessions for a user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<boolean>} Success status
   */
  async destroyUserSessions(userId, tenantId) {
    try {
      const userSessionKey = `user_session:${tenantId}:${userId}`;
      const currentSessionId = await this.sessionsKV.get(userSessionKey);
      
      if (currentSessionId) {
        await this.destroySession(currentSessionId);
      }

      return true;
    } catch (error) {
      console.error('Error destroying user sessions:', error);
      return false;
    }
  }

  /**
   * Refresh session TTL
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} Success status
   */
  async refreshSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    // getSession already updates the TTL, so just return true
    return true;
  }

  /**
   * Get session from authorization header
   * @param {Request} request - Request object
   * @returns {Promise<object|null>} Session info or null
   */
  async getSessionFromRequest(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const sessionId = authHeader.substring(7); // Remove 'Bearer ' prefix
    return await this.validateSession(sessionId);
  }

  /**
   * Store user information in KV
   * @param {string} phone - User phone number
   * @param {string} tenantId - Tenant ID
   * @param {object} userInfo - User information
   * @returns {Promise<void>}
   */
  async storeUserInfo(phone, tenantId, userInfo) {
    const userKey = `user:${tenantId}:${phone}`;
    await this.usersKV.put(
      userKey,
      JSON.stringify({
        ...userInfo,
        phone,
        tenantId,
        lastLoginAt: new Date().toISOString()
      })
    );
  }

  /**
   * Get user information from KV
   * @param {string} phone - User phone number
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<object|null>} User info or null
   */
  async getUserInfo(phone, tenantId) {
    const userKey = `user:${tenantId}:${phone}`;
    const userData = await this.usersKV.get(userKey);
    if (!userData) return null;

    return Utils.parseJson(userData);
  }
}