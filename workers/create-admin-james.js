/**
 * Script to create admin account for James
 * Run with: node create-admin-james.js
 */

export default {
  async fetch(request, env) {
    try {
      // 1. 更新測試帳號名稱
      await env.DB_ENGINEERING.prepare(`
        UPDATE users 
        SET name = '測試帳號' 
        WHERE phone = '0912345678'
      `).run();
      
      console.log('Updated test account name');
      
      // 2. 創建詹姆士管理員帳號
      await env.DB_ENGINEERING.prepare(`
        INSERT OR REPLACE INTO users (
          id, 
          phone, 
          password_suffix, 
          name, 
          global_role, 
          source_type,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        'admin_james',
        '0963922033',
        '033',
        '詹姆士',
        'admin',
        'system'
      ).run();
      
      console.log('Created James admin account');
      
      // 3. 查詢所有管理員
      const admins = await env.DB_ENGINEERING.prepare(`
        SELECT id, name, phone, global_role 
        FROM users 
        WHERE global_role = 'admin'
        ORDER BY created_at DESC
      `).all();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Admin accounts updated',
        admins: admins.results
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};