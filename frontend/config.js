/**
 * 🚀 統一 API 前端配置檔 - v3.0.0 - 2025-08-21 重構版本
 * 使用集中化配置管理，環境變數優先
 * 支援 .env.dev, .env.prod 環境文件
 */

// 導入統一配置
// 如果有單獨的配置文件，優先使用
if (typeof API_CONFIG === 'undefined') {
  // 內建環境檢測函數
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

  // 統一 API 端點配置 (修復 URL 映射)
  function getApiUrl(environment) {
    const env = environment || detectEnvironment();
    
    // 修復：開發環境應該使用正式 Worker，因為我們只有一個 Worker
    // 環境變數優先 (從 .env.dev 或 .env.prod 讀取)
    if (env === 'production') {
      return window.ENV?.API_BASE_URL_PROD || 'https://construction-management-unified.lai-jameslai.workers.dev';
    }
    // 開發環境也使用同一個 Worker (因為只有一個部署)
    return window.ENV?.API_BASE_URL_DEV || 'https://construction-management-unified.lai-jameslai.workers.dev';
  }
} else {
  // 使用外部配置
  const detectEnvironment = window.detectEnvironment;
  const getApiUrl = (env) => window.API_CONFIG.WORKER_API_URL;
}

// 統一配置
const ENVIRONMENT = detectEnvironment();
const IS_PRODUCTION = ENVIRONMENT === 'production';

const CONFIG = {
  // 統一 API 配置 - 所有功能合併至單一端點
  API: {
    // 統一 API Gateway URL - 取代原有的多個微服務
    WORKER_API_URL: getApiUrl(ENVIRONMENT),
    
    // 移除舊的分散式 API 配置（已整合至統一 API）
    // CRM_API_URL: 已整合至 /api/v1/crm/*
    // CRM_API_TOKEN: 由統一 API 內部處理
    
    // Authentication - 統一處理
    EMERGENCY_LOGIN_ENABLED: !IS_PRODUCTION,
    
    // Supabase 配置 - 透過統一 API 代理
    SUPABASE_URL: 'https://pbecqosbkuyypsgwxnmq.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZWNxb3Nia3V5eXBzZ3d4bm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NDgyOTcsImV4cCI6MjA3MDIyNDI5N30.RxgJZpII8Fm1ym6UtMEdmw87DExR1MxtJXISag9vszQ'
  },
  
  UI: {
    SHOW_DEBUG_INFO: !IS_PRODUCTION,
    ENABLE_MOCK_DATA: false,
    SHOW_MIGRATION_INFO: true // 顯示遷移資訊
  },
  
  VERSION: IS_PRODUCTION ? '2.0.0-unified-prod' : '2.0.0-unified-dev',
  ENVIRONMENT: ENVIRONMENT,
  
  // 遷移資訊
  MIGRATION: {
    DATE: '2025-08-21',
    FROM: 'Microservices Architecture',
    TO: 'Unified API Gateway',
    STATUS: 'ACTIVE'
  }
};

// 環境信息顯示
console.log(`%c🔧 Environment: ${ENVIRONMENT} (Unified API)`, IS_PRODUCTION ? 'color: green; font-weight: bold;' : 'color: orange; font-weight: bold;');
console.log(`%c🌐 API: ${CONFIG.API.WORKER_API_URL}`, 'color: blue;');
console.log(`%c📦 Version: ${CONFIG.VERSION}`, 'color: green;');
console.log(`%c🚀 Migration: ${CONFIG.MIGRATION.FROM} → ${CONFIG.MIGRATION.TO} (${CONFIG.MIGRATION.DATE})`, 'color: purple; font-weight: bold;');