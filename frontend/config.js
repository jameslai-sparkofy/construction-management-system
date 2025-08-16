// 開發環境配置
const CONFIG = {
  API: {
    // 開發環境 API
    WORKER_API_URL: 'https://construction-management-api.lai-jameslai.workers.dev',
    
    // CRM API (共用)
    CRM_API_URL: 'https://fx-d1-rest-api.lai-jameslai.workers.dev',
    CRM_API_TOKEN: 'fx-crm-api-secret-2025',
    
    // Authentication
    EMERGENCY_LOGIN_ENABLED: true,
    
    // Supabase Configuration
    SUPABASE_URL: 'https://pbecqosbkuyypsgwxnmq.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZWNxb3Nia3V5eXBzZ3d4bm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NDgyOTcsImV4cCI6MjA3MDIyNDI5N30.RxgJZpII8Fm1ym6UtMEdmw87DExR1MxtJXISag9vszQ'
  },
  
  UI: {
    SHOW_DEBUG_INFO: true,
    ENABLE_MOCK_DATA: false
  },
  
  VERSION: '1.1.0-develop',
  ENVIRONMENT: 'development'
};

// 在控制台顯示環境信息
console.log('%c🔧 Development Environment', 'color: orange; font-weight: bold;');
console.log('API:', CONFIG.API.WORKER_API_URL);