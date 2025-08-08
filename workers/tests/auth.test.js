/**
 * Authentication Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from '../src/services/authService';
import { createMockEnv, createMockRequest } from './helpers/mocks';

describe('AuthService', () => {
  let authService;
  let mockEnv;

  beforeEach(() => {
    mockEnv = createMockEnv();
    authService = new AuthService(mockEnv);
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      // Arrange
      const credentials = {
        phone: '0912345678',
        password: '678'
      };

      // Mock database response
      mockEnv.DB_ENGINEERING.prepare = () => ({
        bind: () => ({
          first: async () => ({
            id: 'user-123',
            phone: '0912345678',
            password_suffix: '678',
            name: 'Test User',
            role: 'member'
          })
        })
      });

      // Act
      const result = await authService.login(credentials);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.token).toBeDefined();
      expect(result.data.user.phone).toBe('0912345678');
    });

    it('should fail with invalid phone', async () => {
      // Arrange
      const credentials = {
        phone: '0912345679',
        password: '678'
      };

      // Mock database response
      mockEnv.DB_ENGINEERING.prepare = () => ({
        bind: () => ({
          first: async () => null
        })
      });

      // Act
      const result = await authService.login(credentials);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('手機號碼或密碼錯誤');
    });

    it('should fail with invalid password', async () => {
      // Arrange
      const credentials = {
        phone: '0912345678',
        password: '123'
      };

      // Mock database response
      mockEnv.DB_ENGINEERING.prepare = () => ({
        bind: () => ({
          first: async () => ({
            id: 'user-123',
            phone: '0912345678',
            password_suffix: '678',
            name: 'Test User',
            role: 'member'
          })
        })
      });

      // Act
      const result = await authService.login(credentials);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('手機號碼或密碼錯誤');
    });

    it('should handle inactive users', async () => {
      // Arrange
      const credentials = {
        phone: '0912345678',
        password: '678'
      };

      // Mock database response
      mockEnv.DB_ENGINEERING.prepare = () => ({
        bind: () => ({
          first: async () => ({
            id: 'user-123',
            phone: '0912345678',
            password_suffix: '678',
            name: 'Test User',
            role: 'member',
            is_active: false
          })
        })
      });

      // Act
      const result = await authService.login(credentials);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('帳號已被停用');
    });

    it('should log successful login', async () => {
      // Arrange
      const credentials = {
        phone: '0912345678',
        password: '678'
      };

      let loggedData = null;

      // Mock database response
      mockEnv.DB_ENGINEERING.prepare = (sql) => {
        if (sql.includes('INSERT INTO login_logs')) {
          return {
            bind: (...args) => {
              loggedData = args;
              return { run: async () => ({}) };
            }
          };
        }
        return {
          bind: () => ({
            first: async () => ({
              id: 'user-123',
              phone: '0912345678',
              password_suffix: '678',
              name: 'Test User',
              role: 'member'
            })
          })
        };
      };

      // Act
      await authService.login(credentials);

      // Assert
      expect(loggedData).not.toBeNull();
      expect(loggedData[0]).toBe('user-123');
      expect(loggedData[1]).toBe('0912345678');
      expect(loggedData[2]).toBe('success');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      // Arrange
      const token = 'valid.jwt.token';
      const decodedPayload = {
        userId: 'user-123',
        role: 'member',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      // Mock JWT verification
      authService.verifyJWT = async () => decodedPayload;

      // Mock session check
      mockEnv.SESSION_STORE.get = async () => JSON.stringify({
        userId: 'user-123',
        token
      });

      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.role).toBe('member');
    });

    it('should reject expired token', async () => {
      // Arrange
      const token = 'expired.jwt.token';
      const decodedPayload = {
        userId: 'user-123',
        role: 'member',
        exp: Math.floor(Date.now() / 1000) - 3600
      };

      // Mock JWT verification
      authService.verifyJWT = async () => decodedPayload;

      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should reject token without session', async () => {
      // Arrange
      const token = 'valid.jwt.token';
      const decodedPayload = {
        userId: 'user-123',
        role: 'member',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      // Mock JWT verification
      authService.verifyJWT = async () => decodedPayload;

      // Mock session check
      mockEnv.SESSION_STORE.get = async () => null;

      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session not found');
    });
  });

  describe('logout', () => {
    it('should clear session on logout', async () => {
      // Arrange
      const userId = 'user-123';
      let deletedKey = null;

      mockEnv.SESSION_STORE.delete = async (key) => {
        deletedKey = key;
      };

      // Act
      const result = await authService.logout(userId);

      // Assert
      expect(result.success).toBe(true);
      expect(deletedKey).toBe(`session:${userId}`);
    });
  });

  describe('changePassword', () => {
    it('should change password with valid old password', async () => {
      // Arrange
      const userId = 'user-123';
      const oldPassword = '678';
      const newPassword = '123';

      let updatedPassword = null;

      // Mock database responses
      mockEnv.DB_ENGINEERING.prepare = (sql) => {
        if (sql.includes('SELECT')) {
          return {
            bind: () => ({
              first: async () => ({
                password_suffix: '678'
              })
            })
          };
        }
        if (sql.includes('UPDATE')) {
          return {
            bind: (...args) => {
              updatedPassword = args[0];
              return { run: async () => ({}) };
            }
          };
        }
      };

      // Act
      const result = await authService.changePassword(userId, oldPassword, newPassword);

      // Assert
      expect(result.success).toBe(true);
      expect(updatedPassword).toBe('123');
    });

    it('should fail with invalid old password', async () => {
      // Arrange
      const userId = 'user-123';
      const oldPassword = '999';
      const newPassword = '123';

      // Mock database response
      mockEnv.DB_ENGINEERING.prepare = () => ({
        bind: () => ({
          first: async () => ({
            password_suffix: '678'
          })
        })
      });

      // Act
      const result = await authService.changePassword(userId, oldPassword, newPassword);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('舊密碼錯誤');
    });
  });

  describe('getUserById', () => {
    it('should get user by ID', async () => {
      // Arrange
      const userId = 'user-123';

      // Mock database response
      mockEnv.DB_ENGINEERING.prepare = () => ({
        bind: () => ({
          first: async () => ({
            id: 'user-123',
            phone: '0912345678',
            name: 'Test User',
            role: 'member',
            email: 'test@example.com'
          })
        })
      });

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('user-123');
      expect(result.data.password_suffix).toBeUndefined();
    });

    it('should handle user not found', async () => {
      // Arrange
      const userId = 'non-existent';

      // Mock database response
      mockEnv.DB_ENGINEERING.prepare = () => ({
        bind: () => ({
          first: async () => null
        })
      });

      // Act
      const result = await authService.getUserById(userId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('使用者不存在');
    });
  });
});

describe('Auth Middleware', () => {
  it('should allow request with valid token', async () => {
    // Arrange
    const mockRequest = createMockRequest({
      headers: {
        'Authorization': 'Bearer valid.token'
      }
    });

    const mockEnv = createMockEnv();
    const authService = new AuthService(mockEnv);

    // Mock token validation
    authService.validateToken = async () => ({
      valid: true,
      userId: 'user-123',
      role: 'member'
    });

    // Act
    const result = await authService.requireAuth(mockRequest);

    // Assert
    expect(result.authenticated).toBe(true);
    expect(result.userId).toBe('user-123');
  });

  it('should reject request without token', async () => {
    // Arrange
    const mockRequest = createMockRequest({});
    const mockEnv = createMockEnv();
    const authService = new AuthService(mockEnv);

    // Act
    const result = await authService.requireAuth(mockRequest);

    // Assert
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('No token provided');
  });

  it('should reject request with invalid token', async () => {
    // Arrange
    const mockRequest = createMockRequest({
      headers: {
        'Authorization': 'Bearer invalid.token'
      }
    });

    const mockEnv = createMockEnv();
    const authService = new AuthService(mockEnv);

    // Mock token validation
    authService.validateToken = async () => ({
      valid: false,
      error: 'Invalid token'
    });

    // Act
    const result = await authService.requireAuth(mockRequest);

    // Assert
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Invalid token');
  });
});