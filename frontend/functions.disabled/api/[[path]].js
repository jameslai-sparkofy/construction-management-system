// Cloudflare Pages Functions - API 代理
// 這個函數將前端的 API 調用代理到我們的 Worker

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // 從 URL 中提取 API 路徑
  const apiPath = url.pathname.replace('/api/', '/api/');
  
  try {
    // 使用 Service Binding 調用 Worker
    if (env.API_SERVICE) {
      // 創建新的請求，但使用 Worker 的路徑
      const workerRequest = new Request(apiPath, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      
      // 直接調用 Worker
      const response = await env.API_SERVICE.fetch(workerRequest);
      return response;
    }
    
    // 如果沒有 Service Binding，嘗試直接調用
    const workerUrl = `https://construction-management-api-clerk.lai-jameslai.workers.dev${apiPath}`;
    const response = await fetch(workerUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    
    return response;
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'API proxy error: ' + error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
}