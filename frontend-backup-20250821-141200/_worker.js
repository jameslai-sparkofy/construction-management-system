// Cloudflare Pages 的 _worker.js
// 這會替代 Functions 並提供 Service Binding 訪問

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 如果是 API 調用，代理到 Worker
    if (url.pathname.startsWith('/api/')) {
      try {
        // 使用 Service Binding 直接調用 Worker
        if (env.API_SERVICE) {
          const response = await env.API_SERVICE.fetch(request);
          return response;
        }
        
        // 如果沒有 Service Binding，返回錯誤
        return new Response(JSON.stringify({
          success: false,
          error: 'Service Binding not configured',
          hint: 'API_SERVICE binding is missing'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Worker proxy error: ' + error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    // 對於靜態文件，使用默認行為
    return env.ASSETS.fetch(request);
  }
};