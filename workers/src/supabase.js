// Supabase 整合模組
import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const SUPABASE_URL = 'https://pbecqosbkuyypsgwxnmq.supabase.co';

// 初始化 Supabase 客戶端
export function createSupabaseClient(env) {
    // 使用 service role key (從環境變數取得)
    const supabaseKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY;
    
    if (!supabaseKey) {
        throw new Error('SUPABASE_SERVICE_KEY not configured');
    }
    
    return createClient(SUPABASE_URL, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
    });
}

// 驗證用戶 Token
export async function verifySupabaseToken(token, env) {
    try {
        const supabase = createSupabaseClient(env);
        
        // 驗證並取得用戶資訊
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return { valid: false, error: error?.message || 'Invalid token' };
        }
        
        return {
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                metadata: user.user_metadata,
                created_at: user.created_at,
            }
        };
    } catch (error) {
        console.error('Token verification error:', error);
        return { valid: false, error: error.message };
    }
}

// 建立用戶 Session
export async function createUserSession(userId, metadata, env) {
    try {
        const sessionId = crypto.randomUUID();
        const sessionData = {
            userId,
            metadata,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小時
        };
        
        // 儲存到 KV
        await env.SESSIONS.put(
            `session:${sessionId}`,
            JSON.stringify(sessionData),
            { expirationTtl: 86400 } // 24小時
        );
        
        return { sessionId, ...sessionData };
    } catch (error) {
        console.error('Session creation error:', error);
        throw error;
    }
}

// 驗證 Session
export async function verifySession(sessionId, env) {
    try {
        const sessionData = await env.SESSIONS.get(`session:${sessionId}`);
        
        if (!sessionData) {
            return { valid: false, error: 'Session not found' };
        }
        
        const session = JSON.parse(sessionData);
        
        // 檢查是否過期
        if (new Date(session.expiresAt) < new Date()) {
            await env.SESSIONS.delete(`session:${sessionId}`);
            return { valid: false, error: 'Session expired' };
        }
        
        return { valid: true, session };
    } catch (error) {
        console.error('Session verification error:', error);
        return { valid: false, error: error.message };
    }
}

// Supabase Auth API 路由處理
export async function handleSupabaseAuth(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 驗證 Token
    if (path === '/api/v1/auth/supabase/verify') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No token provided'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const token = authHeader.substring(7);
        const result = await verifySupabaseToken(token, env);
        
        if (result.valid) {
            // 建立內部 session
            const session = await createUserSession(result.user.id, result.user, env);
            
            return new Response(JSON.stringify({
                success: true,
                data: {
                    user: result.user,
                    sessionId: session.sessionId,
                    expiresAt: session.expiresAt
                }
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({
                success: false,
                error: result.error
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    // Session 驗證
    if (path === '/api/v1/auth/session/verify') {
        const body = await request.json();
        const { sessionId } = body;
        
        if (!sessionId) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No session ID provided'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const result = await verifySession(sessionId, env);
        
        if (result.valid) {
            return new Response(JSON.stringify({
                success: true,
                data: result.session
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({
                success: false,
                error: result.error
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    // 登出
    if (path === '/api/v1/auth/logout') {
        const body = await request.json();
        const { sessionId } = body;
        
        if (sessionId) {
            await env.SESSIONS.delete(`session:${sessionId}`);
        }
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Logged out successfully'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return new Response('Not Found', { status: 404 });
}

// Middleware: 驗證 Supabase 認證
export async function requireSupabaseAuth(request, env) {
    // 先檢查 Session
    const sessionId = request.headers.get('X-Session-ID');
    if (sessionId) {
        const result = await verifySession(sessionId, env);
        if (result.valid) {
            return { authenticated: true, user: result.session.metadata };
        }
    }
    
    // 再檢查 Supabase Token
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const result = await verifySupabaseToken(token, env);
        if (result.valid) {
            return { authenticated: true, user: result.user };
        }
    }
    
    return { authenticated: false };
}