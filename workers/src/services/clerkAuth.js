/**
 * Clerk 認證服務
 * 處理 Clerk token 驗證和用戶同步
 */

import { verifyToken } from '@clerk/backend';

/**
 * 驗證 Clerk token 並同步用戶資料
 */
export async function verifyClerkToken(token, env) {
  try {
    // 驗證 Clerk token
    const verified = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      authorizedParties: ['https://construction-management-frontend.pages.dev', 'http://localhost:8787']
    });
    
    // 提取用戶資訊
    const userInfo = {
      clerkId: verified.sub,
      email: verified.email || '',
      phone: verified.phoneNumber || '',
      firstName: verified.firstName || '',
      lastName: verified.lastName || '',
      fullName: `${verified.firstName || ''} ${verified.lastName || ''}`.trim() || '用戶',
      imageUrl: verified.imageUrl || ''
    };
    
    // 同步用戶到 D1
    const localUser = await syncUserToD1(userInfo, env);
    
    return { 
      success: true, 
      user: localUser,
      clerkUser: userInfo,
      sessionToken: localUser.session_token
    };
  } catch (error) {
    console.error('Clerk token verification failed:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * 將 Clerk 用戶同步到本地 D1 database
 */
async function syncUserToD1(clerkUser, env) {
  // 生成 session token
  const sessionToken = `clerk_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // 檢查用戶是否已存在
    const existingUser = await env.DB_ENGINEERING.prepare(`
      SELECT * FROM users WHERE clerk_id = ?
    `).bind(clerkUser.clerkId).first();
    
    if (existingUser) {
      // 更新現有用戶
      await env.DB_ENGINEERING.prepare(`
        UPDATE users 
        SET 
          name = ?,
          phone = ?,
          email = ?,
          session_token = ?,
          last_login = CURRENT_TIMESTAMP
        WHERE clerk_id = ?
      `).bind(
        clerkUser.fullName,
        clerkUser.phone,
        clerkUser.email,
        sessionToken,
        clerkUser.clerkId
      ).run();
      
      return {
        ...existingUser,
        name: clerkUser.fullName,
        phone: clerkUser.phone,
        email: clerkUser.email,
        session_token: sessionToken
      };
    } else {
      // 創建新用戶
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await env.DB_ENGINEERING.prepare(`
        INSERT INTO users (
          id, 
          clerk_id,
          phone, 
          email,
          password_suffix,
          name, 
          global_role, 
          source_type,
          session_token,
          created_at,
          last_login
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        userId,
        clerkUser.clerkId,
        clerkUser.phone || '',
        clerkUser.email || '',
        '000', // 預設密碼後綴（Clerk 用戶不使用）
        clerkUser.fullName,
        'admin', // 預設角色，可根據需求調整
        'clerk',
        sessionToken
      ).run();
      
      return {
        id: userId,
        clerk_id: clerkUser.clerkId,
        name: clerkUser.fullName,
        phone: clerkUser.phone,
        email: clerkUser.email,
        global_role: 'admin',
        session_token: sessionToken
      };
    }
  } catch (error) {
    console.error('Error syncing user to D1:', error);
    throw error;
  }
}

/**
 * 生成緊急登入 token
 */
export function generateEmergencyToken() {
  return `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 驗證緊急登入憑證
 */
export function verifyEmergencyCredentials(phone, code, env) {
  // 檢查是否啟用緊急登入
  if (env.ENABLE_EMERGENCY_LOGIN !== 'true') {
    return { success: false, error: 'Emergency login is disabled' };
  }
  
  // 驗證憑證
  if (phone === env.EMERGENCY_ADMIN_PHONE && code === env.EMERGENCY_ADMIN_CODE) {
    const token = generateEmergencyToken();
    
    return {
      success: true,
      user: {
        id: 'emergency_admin',
        name: '緊急管理員',
        phone: phone,
        global_role: 'admin',
        source_type: 'emergency'
      },
      token: token,
      warning: '⚠️ 緊急登入模式，請儘快恢復正常認證'
    };
  }
  
  return { success: false, error: 'Invalid emergency credentials' };
}