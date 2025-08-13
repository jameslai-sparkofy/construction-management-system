// 開發環境配置
const CONFIG = {
  API: {
    // 開發環境 API
    WORKER_API_URL: 'https://construction-api-develop.lai-jameslai.workers.dev',
    
    // CRM API (共用)
    CRM_API_URL: 'https://fx-d1-rest-api.lai-jameslai.workers.dev',
    CRM_API_TOKEN: 'fx-crm-api-secret-2025',
    
    // Authentication
    EMERGENCY_LOGIN_ENABLED: true
  },
  
  UI: {
    SHOW_DEBUG_INFO: true,
    ENABLE_MOCK_DATA: false
  },
  
  VERSION: '1.0.0-develop',
  ENVIRONMENT: 'development'
};

// 在控制台顯示環境信息
console.log('%c🔧 Development Environment', 'color: orange; font-weight: bold;');
console.log('API:', CONFIG.API.WORKER_API_URL);