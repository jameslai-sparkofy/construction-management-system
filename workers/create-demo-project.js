/**
 * 創建示範專案的腳本
 */

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET' && new URL(request.url).pathname === '/create-demo') {
      try {
        // 創建勝興-興安西-2024專案
        const projectId = 'proj_shenxing_xinganxi_2024';
        
        await env.DB_ENGINEERING
          .prepare(`
            INSERT OR REPLACE INTO projects (
              id, opportunity_id, name, status,
              cached_stats, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `)
          .bind(
            projectId,
            'OPP-2024-SX-001',
            '勝興-興安西-2024', 
            'active',
            JSON.stringify({
              building_count: 3,
              unit_count: 224,
              completed_count: 45,
              in_progress_count: 89,
              progress: 20
            }),
            'admin_user'
          )
          .run();

        return new Response(JSON.stringify({
          success: true,
          message: '勝興-興安西-2024專案已成功創建',
          projectId: projectId
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
};