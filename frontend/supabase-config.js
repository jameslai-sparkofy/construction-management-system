// Supabase 配置
const SUPABASE_CONFIG = {
    // 開發環境
    development: {
        url: 'https://your-project.supabase.co',
        anonKey: 'your-anon-key-here',
        // 這些需要你從 Supabase Dashboard 取得
    },
    
    // 生產環境
    production: {
        url: 'https://your-project.supabase.co',
        anonKey: 'your-anon-key-here',
    }
};

// 取得當前環境配置
function getSupabaseConfig() {
    const hostname = window.location.hostname;
    const isDevelopment = hostname.includes('dev') || hostname === 'localhost';
    
    return isDevelopment ? SUPABASE_CONFIG.development : SUPABASE_CONFIG.production;
}

// 初始化 Supabase 客戶端
async function initSupabase() {
    const config = getSupabaseConfig();
    
    if (!config.url || config.url === 'https://your-project.supabase.co') {
        console.warn('請先設定 Supabase 專案資訊');
        return null;
    }
    
    // 動態載入 Supabase SDK
    if (!window.supabase) {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        window.supabaseClient = createClient(config.url, config.anonKey);
    }
    
    return window.supabaseClient;
}

// 工具函數
const supabaseAuth = {
    // 電話號碼登入
    async signInWithPhone(phone, password) {
        const supabase = await initSupabase();
        if (!supabase) return { error: 'Supabase 未初始化' };
        
        // Supabase 支援電話號碼驗證
        const { data, error } = await supabase.auth.signInWithOtp({
            phone: phone,
        });
        
        return { data, error };
    },
    
    // Email 登入
    async signInWithEmail(email, password) {
        const supabase = await initSupabase();
        if (!supabase) return { error: 'Supabase 未初始化' };
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });
        
        return { data, error };
    },
    
    // OAuth 登入 (Google, GitHub 等)
    async signInWithOAuth(provider) {
        const supabase = await initSupabase();
        if (!supabase) return { error: 'Supabase 未初始化' };
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider, // 'google', 'github', etc.
            options: {
                redirectTo: window.location.origin + '/project-list.html'
            }
        });
        
        return { data, error };
    },
    
    // 註冊
    async signUp(email, password, metadata = {}) {
        const supabase = await initSupabase();
        if (!supabase) return { error: 'Supabase 未初始化' };
        
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: metadata // 額外的用戶資料
            }
        });
        
        return { data, error };
    },
    
    // 登出
    async signOut() {
        const supabase = await initSupabase();
        if (!supabase) return { error: 'Supabase 未初始化' };
        
        const { error } = await supabase.auth.signOut();
        return { error };
    },
    
    // 取得當前用戶
    async getUser() {
        const supabase = await initSupabase();
        if (!supabase) return null;
        
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },
    
    // 監聽認證狀態變化
    async onAuthStateChange(callback) {
        const supabase = await initSupabase();
        if (!supabase) return null;
        
        return supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    },
    
    // 驗證 OTP
    async verifyOtp(phone, token) {
        const supabase = await initSupabase();
        if (!supabase) return { error: 'Supabase 未初始化' };
        
        const { data, error } = await supabase.auth.verifyOtp({
            phone: phone,
            token: token,
            type: 'sms'
        });
        
        return { data, error };
    }
};

// 匯出供其他頁面使用
window.supabaseAuth = supabaseAuth;