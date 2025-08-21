/**
 * 前端統一配置檔
 * 自動根據域名環境切換 API 端點
 */

// 環境檢測函數
function detectEnvironment() {
  const hostname = window.location.hostname;
  
  // 生產環境檢測 - 修正域名匹配
  if (hostname.includes('construction-management-frontend-prod.pages.dev') || 
      hostname === 'cm-prod.pages.dev') {
    return 'production';
  }
  
  // 開發環境檢測 - 修正域名匹配
  if (hostname.includes('construction-management-frontend-dev.pages.dev') ||
      hostname === 'localhost' || 
      hostname === '127.0.0.1') {
    return 'development';
  }
  
  // 預設開發環境
  return 'development';
}

// 根據環境獲取 API URL
function getApiUrl(environment) {
  switch (environment) {
    case 'production':
      return 'https://construction-management-api-prod.lai-jameslai.workers.dev';
    case 'development':
    default:
      return 'https://construction-management-api-dev.lai-jameslai.workers.dev';
  }
}

// 統一配置
const ENVIRONMENT = detectEnvironment();
const IS_PRODUCTION = ENVIRONMENT === 'production';

const CONFIG = {
  // API 配置
  API: {
    // 主要 API Worker URL
    WORKER_API_URL: getApiUrl(ENVIRONMENT),
    
    // CRM REST API (共用)
    CRM_API_URL: 'https://fx-d1-rest-api.lai-jameslai.workers.dev',
    CRM_API_TOKEN: 'fx-crm-api-secret-2025',
    
    // Authentication
    EMERGENCY_LOGIN_ENABLED: !IS_PRODUCTION,
    
    // Supabase Configuration
    SUPABASE_URL: 'https://pbecqosbkuyypsgwxnmq.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZWNxb3Nia3V5eXBzZ3d4bm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NDgyOTcsImV4cCI6MjA3MDIyNDI5N30.RxgJZpII8Fm1ym6UtMEdmw87DExR1MxtJXISag9vszQ'
  },
  
  UI: {
    SHOW_DEBUG_INFO: !IS_PRODUCTION,
    ENABLE_MOCK_DATA: false
  },
  
  VERSION: '1.1.0-unified',
  ENVIRONMENT: ENVIRONMENT
};

// 環境信息顯示
console.log(`%c🔧 Environment: ${ENVIRONMENT}`, IS_PRODUCTION ? 'color: green; font-weight: bold;' : 'color: orange; font-weight: bold;');
console.log(`%c🌐 API: ${CONFIG.API.WORKER_API_URL}`, 'color: blue;');
console.log(`%c📦 Version: ${CONFIG.VERSION}`, 'color: green;');