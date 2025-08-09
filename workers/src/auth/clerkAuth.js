/**
 * Simplified Authentication with Clerk
 * 極簡的 Clerk 整合方案
 */
import { verifyToken } from '@clerk/backend';

export class ClerkAuth {
  constructor(publicKey, secretKey) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
  }

  /**
   * 驗證請求中的 JWT Token
   */
  async verifyRequest(request) {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { 
          success: false, 
          error: 'No authorization header' 
        };
      }

      const token = authHeader.substring(7);
      
      // 使用 Clerk 驗證 token
      const payload = await verifyToken(token, {
        secretKey: this.secretKey,
        authorizedParties: ['*'] // 允許所有來源（生產環境請設定具體域名）
      });

      return {
        success: true,
        userId: payload.sub,
        sessionId: payload.sid,
        phoneNumber: payload.phone_number,
        metadata: payload.public_metadata || {}
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 從 Clerk 用戶資料創建本地用戶資料
   */
  createUserFromClerk(clerkData) {
    return {
      id: clerkData.userId,
      phone: clerkData.phoneNumber,
      name: clerkData.metadata.name || '用戶',
      role: clerkData.metadata.role || 'member',
      permissions: this.getRolePermissions(clerkData.metadata.role),
      tenantId: clerkData.metadata.tenantId || 'yes-ceramics'
    };
  }

  /**
   * 根據角色獲取權限
   */
  getRolePermissions(role) {
    switch (role) {
      case 'admin':
        return ['read', 'write', 'delete', 'admin'];
      case 'manager':
        return ['read', 'write', 'delete'];
      case 'member':
      default:
        return ['read', 'write'];
    }
  }
}

/**
 * Clerk 中間件 - 簡化版
 */
export function withClerkAuth(handler, clerkAuth) {
  return async (request, env, ctx) => {
    // 驗證用戶
    const authResult = await clerkAuth.verifyRequest(request);
    
    if (!authResult.success) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized',
        error: authResult.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 附加用戶資料到請求
    request.user = clerkAuth.createUserFromClerk(authResult);
    
    // 執行原始處理器
    return handler(request, env, ctx);
  };
}