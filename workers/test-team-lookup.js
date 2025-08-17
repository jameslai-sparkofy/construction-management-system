// 測試工班查詢邏輯

export default {
  async fetch(request, env, ctx) {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    try {
      // 測試 ID
      const testTeamId = '66a21ce3f0032b000142088f';
      
      // 1. 查詢 SupplierObj 表
      const supplierQuery = await env.DB_CRM.prepare(`
        SELECT _id, name 
        FROM SupplierObj 
        WHERE _id = ?
      `).bind(testTeamId).first();
      
      // 2. 查詢所有包含"周華龍"的 SupplierObj
      const zhouQuery = await env.DB_CRM.prepare(`
        SELECT _id, name 
        FROM SupplierObj 
        WHERE name LIKE '%周華龍%'
        LIMIT 5
      `).all();
      
      // 3. 直接查詢周華龍工班的成員
      const workersQuery = await env.DB_CRM.prepare(`
        SELECT 
          _id,
          name,
          phone_number__c,
          field_D1087__c,
          field_D1087__c__r
        FROM object_50hj8__c
        WHERE field_D1087__c__r LIKE '%周華龍%'
        AND is_deleted = 0
        AND life_status = 'normal'
      `).all();

      return new Response(JSON.stringify({
        success: true,
        data: {
          測試ID查詢: supplierQuery || '未找到',
          周華龍工班查詢: zhouQuery.results || [],
          周華龍工班成員: workersQuery.results || []
        }
      }, null, 2), { headers });

    } catch (error) {
      console.error('查詢錯誤:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }, null, 2), { status: 500, headers });
    }
  }
};