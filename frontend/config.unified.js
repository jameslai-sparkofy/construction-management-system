/**
 * 前端統一配置檔
 * 自動根據域名環境切換 API 端點
 */

// 環境檢測函數
function detectEnvironment() {
  const hostname = window.location.hostname;
  
  // 生產環境檢測
  if (hostname === 'construction-management-new-main.pages.dev') {
    return 'production';
  }
  
  // 舊生產環境 (保持向後兼容)
  if (hostname.includes('frontend-prod.pages.dev') || 
      hostname === 'cm-prod.pages.dev') {
    return 'production_legacy';
  }
  
  // 開發環境檢測  
  if (hostname.includes('frontend-dev.pages.dev') ||
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
    case 'production_legacy':
      return 'https://construction-management-api-prod.lai-jameslai.workers.dev';
    case 'development':
    default:
      return 'https://construction-management-api-dev.lai-jameslai.workers.dev';
  }
}

// 統一配置
const ENVIRONMENT = detectEnvironment();
const IS_PRODUCTION = ENVIRONMENT === 'production' || ENVIRONMENT === 'production_legacy';

const CONFIG = {
  // API 配置
  API: {
    // 主要 API Worker URL
    WORKER_API_URL: getApiUrl(ENVIRONMENT),
    
    // CRM REST API (共用)
    CRM_API_URL: 'https://fx-d1-rest-api.lai-jameslai.workers.dev',
    CRM_API_TOKEN: 'fx-crm-api-secret-2025',
    
    // API 版本
    API_VERSION: 'v1',
    
    // Supabase 配置 (共用)
    SUPABASE_URL: 'https://pbecqosbkuyypsgwxnmq.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZWNxb3Nia3V5eXBzZ3d4bm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NDgyOTcsImV4cCI6MjA3MDIyNDI5N30.RxgJZpII8Fm1ym6UtMEdmw87DExR1MxtJXISag9vszQ'
  },
  
  // 環境設定
  ENV: {
    // 當前環境
    ENVIRONMENT: ENVIRONMENT,
    
    // 是否為生產環境
    IS_PRODUCTION: IS_PRODUCTION,
    
    // 除錯模式
    DEBUG: !IS_PRODUCTION,
    
    // 日誌級別
    LOG_LEVEL: IS_PRODUCTION ? 'error' : 'debug'
  },
  
  // 應用設定
  APP: {
    // 應用名稱
    NAME: '元心建材工程管理系統',
    
    // 版本號
    VERSION: '1.1.0',
    
    // Session 持續時間（小時）
    SESSION_DURATION: 24,
    
    // 檔案上傳限制（MB）
    MAX_FILE_SIZE: 10,
    
    // 分頁設定
    PAGE_SIZE: 20
  },
  
  // 功能開關
  FEATURES: {
    // 啟用除錯工具
    ENABLE_DEBUG: !IS_PRODUCTION,
    
    // 啟用檔案上傳
    ENABLE_FILE_UPLOAD: true,
    
    // 啟用跨工班查看
    ENABLE_CROSS_VIEW: false,
    
    // 緊急登入功能 (只在開發環境啟用)
    EMERGENCY_LOGIN_ENABLED: !IS_PRODUCTION
  }
};

// API 輔助函數
const API = {
  /**
   * 獲取完整的 API URL
   */
  getUrl(endpoint) {
    const baseUrl = CONFIG.API.WORKER_API_URL;
    const version = CONFIG.API.API_VERSION;
    return `${baseUrl}/api/${version}${endpoint}`;
  },
  
  /**
   * 獲取授權標頭
   */
  getAuthHeaders() {
    // 優先使用 Clerk token
    const clerkToken = localStorage.getItem('clerk_token');
    if (clerkToken) {
      return { 'Authorization': `Bearer ${clerkToken}` };
    }
    
    // 向後兼容舊的 auth_token
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },
  
  /**
   * 發送 API 請求
   */
  async request(method, endpoint, data = null) {
    const url = this.getUrl(endpoint);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders()
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(url, options);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'API 請求失敗');
      }
      
      return result;
    } catch (error) {
      Logger.error('API Error:', error);
      throw error;
    }
  },
  
  // 便捷方法
  get(endpoint) {
    return this.request('GET', endpoint);
  },
  
  post(endpoint, data) {
    return this.request('POST', endpoint, data);
  },
  
  put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  },
  
  delete(endpoint) {
    return this.request('DELETE', endpoint);
  }
};

// 日誌工具
const Logger = {
  debug(...args) {
    if (CONFIG.ENV.LOG_LEVEL === 'debug') {
      console.log(`[DEBUG] [${ENVIRONMENT}]`, ...args);
    }
  },
  
  info(...args) {
    if (['debug', 'info'].includes(CONFIG.ENV.LOG_LEVEL)) {
      console.info(`[INFO] [${ENVIRONMENT}]`, ...args);
    }
  },
  
  warn(...args) {
    if (['debug', 'info', 'warn'].includes(CONFIG.ENV.LOG_LEVEL)) {
      console.warn(`[WARN] [${ENVIRONMENT}]`, ...args);
    }
  },
  
  error(...args) {
    console.error(`[ERROR] [${ENVIRONMENT}]`, ...args);
  }
};

// 環境信息顯示
if (CONFIG.ENV.DEBUG) {
  console.log(`%c🔧 Environment: ${ENVIRONMENT}`, 'color: orange; font-weight: bold;');
  console.log(`%c🌐 API: ${CONFIG.API.WORKER_API_URL}`, 'color: blue;');
  console.log(`%c📦 Version: ${CONFIG.APP.VERSION}`, 'color: green;');
}

// 導出到全域
window.CONFIG = CONFIG;
window.API = API;
window.Logger = Logger;
window.ENVIRONMENT = ENVIRONMENT;