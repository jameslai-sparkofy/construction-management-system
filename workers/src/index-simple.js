export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    // Handle OPTIONS
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({ 
        status: 'healthy',
        version: 'simple-1.0',
        timestamp: new Date().toISOString()
      }), { headers: corsHeaders });
    }

    // Test login endpoint
    if (path === '/api/v1/auth/login' && method === 'POST') {
      try {
        const body = await request.text();
        console.log('Received body:', body);
        
        const data = JSON.parse(body);
        const { phone, password } = data;
        
        if (!phone || !password) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Phone and password required',
            received: { phone: !!phone, password: !!password }
          }), { status: 400, headers: corsHeaders });
        }
        
        // Check credentials
        if (phone === '0912345678' && password === '678') {
          const token = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Create admin user if not exists
          if (env.DB_ENGINEERING) {
            await env.DB_ENGINEERING.prepare(`
              INSERT OR REPLACE INTO users (
                id, phone, password_suffix, name, global_role, source_type, session_token
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
              'admin',
              '0912345678',
              '678',
              '系統管理員',
              'admin',
              'system',
              token
            ).run();
          }
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              user: {
                id: 'admin',
                name: '系統管理員',
                phone: '0912345678',
                role: 'admin'
              },
              token: token
            }
          }), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid credentials'
          }), { status: 401, headers: corsHeaders });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Error processing request: ' + error.message
        }), { status: 500, headers: corsHeaders });
      }
    }

    // Projects endpoint
    if (path === '/api/v1/projects' && method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No authorization token'
        }), { status: 401, headers: corsHeaders });
      }
      
      try {
        if (env.DB_ENGINEERING) {
          const { results } = await env.DB_ENGINEERING.prepare(`
            SELECT * FROM projects WHERE status = 'active' ORDER BY created_at DESC
          `).all();
          
          return new Response(JSON.stringify({
            success: true,
            projects: results || [],
            total: results ? results.length : 0
          }), { headers: corsHeaders });
        } else {
          return new Response(JSON.stringify({
            success: true,
            projects: [],
            total: 0
          }), { headers: corsHeaders });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Database error: ' + error.message
        }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ 
      error: 'Endpoint not found',
      path: path,
      method: method
    }), { status: 404, headers: corsHeaders });
  }
};