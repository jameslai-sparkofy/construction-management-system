/**
 * 統一 API 端點配置
 * 集中管理所有 API 端點，支援環境切換
 * Version: 3.0.0 - 2025-08-21
 */

// 環境檢測函數
function detectEnvironment() {
  const hostname = window.location.hostname;
  
  // 生產環境檢測
  if (hostname.includes('construction-management-frontend-prod.pages.dev') || 
      hostname === 'cm-prod.pages.dev') {
    return 'production';
  }
  
  // 開發環境檢測
  if (hostname.includes('construction-management-frontend-dev.pages.dev') ||
      hostname === 'localhost' || 
      hostname === '127.0.0.1') {
    return 'development';
  }
  
  // 預設開發環境
  return 'development';
}

// API 端點配置 - 修復版本 (統一使用同一個 Worker)
const API_ENDPOINTS = {
  development: {
    // 統一 API Gateway (開發環境也使用正式 Worker)
    UNIFIED_API_URL_DEV: 'https://construction-management-unified.lai-jameslai.workers.dev',
    
    // 前端 URL (開發環境)
    FRONTEND_BASE_URL_DEV: 'https://construction-management-frontend-dev.pages.dev',
    
    // 舊版 API (開發環境 - 待棄用)
    LEGACY_API_URL_DEV: 'https://construction-management-api-dev.lai-jameslai.workers.dev',
    
    // CRM API (開發環境)
    CRM_API_URL_DEV: 'https://fx-d1-rest-api.lai-jameslai.workers.dev',
  },
  
  production: {
    // 統一 API Gateway (正式環境)
    UNIFIED_API_URL_PROD: 'https://construction-management-unified.lai-jameslai.workers.dev',
    
    // 前端 URL (正式環境)  
    FRONTEND_BASE_URL_PROD: 'https://construction-management-frontend-prod.pages.dev',
    
    // 舊版 API (正式環境 - 待棄用)
    LEGACY_API_URL_PROD: 'https://construction-management-api.lai-jameslai.workers.dev',
    
    // CRM API (正式環境)
    CRM_API_URL_PROD: 'https://fx-d1-rest-api.lai-jameslai.workers.dev',
  }
};

// 獲取當前環境的 API 配置
function getApiConfig(environment = null) {
  const env = environment || detectEnvironment();
  const isProd = env === 'production';
  
  return {
    // 主要 API - 統一 Gateway
    WORKER_API_URL: isProd 
      ? API_ENDPOINTS.production.UNIFIED_API_URL_PROD 
      : API_ENDPOINTS.development.UNIFIED_API_URL_DEV,
    
    // CRM API
    CRM_API_URL: isProd
      ? API_ENDPOINTS.production.CRM_API_URL_PROD
      : API_ENDPOINTS.development.CRM_API_URL_DEV,
    
    // 前端 BASE URL
    FRONTEND_BASE_URL: isProd
      ? API_ENDPOINTS.production.FRONTEND_BASE_URL_PROD
      : API_ENDPOINTS.development.FRONTEND_BASE_URL_DEV,
      
    // 舊版 API (向後相容)
    LEGACY_API_URL: isProd
      ? API_ENDPOINTS.production.LEGACY_API_URL_PROD
      : API_ENDPOINTS.development.LEGACY_API_URL_DEV,
      
    // 環境資訊
    ENVIRONMENT: env,
    IS_PRODUCTION: isProd,
    
    // API 版本
    API_VERSION: '3.0.0'
  };
}

// 導出配置
const API_CONFIG = getApiConfig();

// 相容性：保持與舊版 CONFIG 物件的相容性
const CONFIG_COMPATIBILITY = {
  API: {
    WORKER_API_URL: API_CONFIG.WORKER_API_URL,
    CRM_API_URL: API_CONFIG.CRM_API_URL,
    LEGACY_API_URL: API_CONFIG.LEGACY_API_URL
  },
  ENVIRONMENT: API_CONFIG.ENVIRONMENT,
  VERSION: API_CONFIG.API_VERSION,
  IS_PRODUCTION: API_CONFIG.IS_PRODUCTION
};

// 環境信息顯示
console.log(`%c🔧 Environment: ${API_CONFIG.ENVIRONMENT} (API Config v${API_CONFIG.API_VERSION})`, 
  API_CONFIG.IS_PRODUCTION ? 'color: green; font-weight: bold;' : 'color: orange; font-weight: bold;');
console.log(`%c🌐 Unified API: ${API_CONFIG.WORKER_API_URL}`, 'color: blue;');
console.log(`%c📊 CRM API: ${API_CONFIG.CRM_API_URL}`, 'color: purple;');

// 導出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_CONFIG, getApiConfig, detectEnvironment, CONFIG_COMPATIBILITY };
} else {
  window.API_CONFIG = API_CONFIG;
  window.getApiConfig = getApiConfig;
  window.detectEnvironment = detectEnvironment;
  window.CONFIG = CONFIG_COMPATIBILITY; // 向後相容性
}