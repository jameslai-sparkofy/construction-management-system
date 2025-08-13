export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };
    
    if (method === 'OPTIONS') {
      return new Response(null, { headers });
    }
    
    // Health check with version
    if (path === '/health' || path === '/') {
      return new Response(JSON.stringify({ 
        name: '工程管理系統 API',
        status: 'healthy',
        version: '3.0.0-unified',
        timestamp: new Date().toISOString(),
        endpoints: {
          auth: ['/api/v1/auth/login'],
          projects: ['/api/v1/projects']
        }
      }), { headers });
    }
    
    // Test login
    if (path === '/api/v1/auth/login' && method === 'POST') {
      try {
        const body = await request.json();
        const { phone, password } = body;
        
        if (!phone || !password) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing credentials',
            debug: { phone: !!phone, password: !!password }
          }), { status: 400, headers });
        }
        
        // Test credentials
        if (phone === '0912345678' && password === '678') {
          return new Response(JSON.stringify({
            success: true,
            data: {
              user: { id: 'admin', name: '系統管理員' },
              token: 'test-token-' + Date.now()
            }
          }), { headers });
        }
        
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid credentials'
        }), { status: 401, headers });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Parse error: ' + error.message
        }), { status: 500, headers });
      }
    }
    
    // Projects endpoint - GET list
    if (path === '/api/v1/projects' && method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      
      // Simple auth check
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }), { status: 401, headers });
      }
      
      // Return demo projects
      return new Response(JSON.stringify({
        success: true,
        projects: [
          {
            id: 'proj_2025081201',
            name: '建功段建案',
            opportunity_id: 'opp_001',
            opportunity_name: '建功段',
            status: 'planning',
            progress: 25,
            created_at: '2025-08-01T00:00:00Z',
            site_count: 3,
            file_count: 5
          },
          {
            id: 'proj_2025081202',
            name: '興安西建案',
            opportunity_id: 'opp_002',
            opportunity_name: '興安西',
            status: 'in_progress',
            progress: 60,
            created_at: '2025-07-15T00:00:00Z',
            site_count: 2,
            file_count: 12
          },
          {
            id: 'proj_2025081203',
            name: '竹北高鐵特區',
            opportunity_id: 'opp_003',
            opportunity_name: '竹北高鐵',
            status: 'in_progress',
            progress: 45,
            created_at: '2025-06-20T00:00:00Z',
            site_count: 5,
            file_count: 8
          }
        ],
        source: 'demo'
      }), { headers });
    }
    
    // Projects endpoint - CREATE
    if (path === '/api/v1/projects' && method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized'
        }), { status: 401, headers });
      }
      
      const data = await request.json();
      
      if (!data.name || !data.opportunity_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Missing required fields: name, opportunity_id'
        }), { status: 400, headers });
      }
      
      const projectId = data.id || `proj_${Date.now()}`;
      
      return new Response(JSON.stringify({
        success: true,
        project: {
          id: projectId,
          name: data.name,
          opportunity_id: data.opportunity_id,
          opportunity_name: data.opportunity_name || data.name,
          status: data.status || 'planning',
          progress: data.progress || 0,
          created_at: new Date().toISOString()
        }
      }), { headers });
    }
    
    // Opportunities endpoint
    if (path === '/api/v1/opportunities' && method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        opportunities: [
          {
            id: 'opp_001',
            name: '建功段',
            address: '新竹市東區建功一路',
            status: 'active'
          },
          {
            id: 'opp_002',
            name: '興安西',
            address: '新竹市北區興安西路',
            status: 'active'
          },
          {
            id: 'opp_003',
            name: '竹北高鐵特區',
            address: '新竹縣竹北市高鐵七路',
            status: 'active'
          }
        ]
      }), { headers });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Not found',
      path: path,
      method: method
    }), { status: 404, headers });
  }
};