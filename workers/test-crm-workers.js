// 測試查詢 CRM 資料庫中的工班成員資料

export default {
  async fetch(request, env, ctx) {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    try {
      // 1. 查詢愛德美特工班的 ID
      const supplierQuery = await env.DB_CRM.prepare(`
        SELECT _id, name 
        FROM SupplierObj 
        WHERE name LIKE '%愛德美特%'
        LIMIT 5
      `).all();

      console.log('愛德美特工班查詢結果:', supplierQuery);

      // 2. 先查詢表結構
      const schemaQuery = await env.DB_CRM.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='object_50hj8__c'
      `).first();

      // 3. 查詢前10筆工班成員看看實際資料
      const sampleQuery = await env.DB_CRM.prepare(`
        SELECT * FROM object_50hj8__c
        LIMIT 10
      `).all();

      // 4. 嘗試模糊搜尋賴俊穎
      let laiQuery = { results: [] };
      try {
        laiQuery = await env.DB_CRM.prepare(`
          SELECT * FROM object_50hj8__c
          WHERE name LIKE '%賴俊穎%'
          LIMIT 5
        `).all();
      } catch (e) {
        console.log('賴俊穎查詢失敗:', e.message);
      }

      // 5. 嘗試搜尋愛德美特相關資料
      let workersQuery1 = { results: [] };
      // 動態構建查詢，根據實際欄位
      if (sampleQuery.results && sampleQuery.results.length > 0) {
        const firstRow = sampleQuery.results[0];
        const columns = Object.keys(firstRow);
        console.log('Available columns:', columns);
        
        // 找出可能包含工班資訊的欄位
        const teamColumns = columns.filter(col => 
          col.includes('shift') || 
          col.includes('team') || 
          col.includes('工班') ||
          col.includes('班')
        );
        
        if (teamColumns.length > 0) {
          const whereClause = teamColumns.map(col => `${col} LIKE '%愛德美特%'`).join(' OR ');
          try {
            workersQuery1 = await env.DB_CRM.prepare(`
              SELECT * FROM object_50hj8__c
              WHERE ${whereClause}
              LIMIT 10
            `).all();
          } catch (e) {
            console.log('愛德美特查詢失敗:', e.message);
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          表結構: schemaQuery?.sql || '未找到',
          愛德美特工班: supplierQuery.results || [],
          愛德美特工班成員: workersQuery1.results || [],
          賴俊穎查詢: laiQuery.results || [],
          樣本資料: sampleQuery.results || [],
          資料欄位: sampleQuery.results && sampleQuery.results.length > 0 ? Object.keys(sampleQuery.results[0]) : []
        }
      }, null, 2), { headers });

    } catch (error) {
      console.error('查詢錯誤:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }, null, 2), { status: 500, headers });
    }
  }
};