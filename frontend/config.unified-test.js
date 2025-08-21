/**
 * 測試版前端配置檔 - 指向新的統一 API
 * 用於測試統一 API Gateway 的功能
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

// 新的統一 API 端點配置
function getUnifiedApiUrl(environment) {
  if (environment === 'production') {
    return 'https://construction-management-unified.lai-jameslai.workers.dev';
  }
  return 'https://construction-management-unified-dev.lai-jameslai.workers.dev';
}

// 統一配置
const ENVIRONMENT = detectEnvironment();
const IS_PRODUCTION = ENVIRONMENT === 'production';

const CONFIG = {
  // API 配置 - 使用新的統一 API
  API: {
    // 統一 API Gateway URL
    WORKER_API_URL: getUnifiedApiUrl(ENVIRONMENT),
    
    // 移除舊的分散式 API 配置
    // CRM_API_URL: 不再需要
    // CRM_API_TOKEN: 統一在 Worker 中處理
    
    // Authentication - 統一在新 API 中處理
    EMERGENCY_LOGIN_ENABLED: !IS_PRODUCTION,
    
    // Supabase 配置 - 新 API 會代理這些請求
    SUPABASE_URL: 'https://pbecqosbkuyypsgwxnmq.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZWNxb3Nia3V5eXBzZ3d4bm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NDgyOTcsImV4cCI6MjA3MDIyNDI5N30.RxgJZpII8Fm1ym6UtMEdmw87DExR1MxtJXISag9vszQ'
  },
  
  UI: {
    SHOW_DEBUG_INFO: !IS_PRODUCTION,
    ENABLE_MOCK_DATA: false,
    SHOW_API_VERSION: true // 顯示新 API 版本資訊
  },
  
  VERSION: IS_PRODUCTION ? '2.0.0-unified-prod' : '2.0.0-unified-dev',
  ENVIRONMENT: ENVIRONMENT,
  API_MIGRATION: {
    USING_UNIFIED_API: true,
    MIGRATION_DATE: '2025-08-21',
    OLD_API_DEPRECATED: true
  }
};

// 環境信息顯示
console.log(`%c🔧 Environment: ${ENVIRONMENT} (Unified API)`, IS_PRODUCTION ? 'color: green; font-weight: bold;' : 'color: orange; font-weight: bold;');
console.log(`%c🌐 Unified API: ${CONFIG.API.WORKER_API_URL}`, 'color: blue;');
console.log(`%c📦 Version: ${CONFIG.VERSION}`, 'color: green;');
console.log(`%c🚀 API Migration: Active`, 'color: purple; font-weight: bold;');

// 相容性檢查 - 確保前端代碼能正確使用新 API
function checkApiCompatibility() {
  const requiredEndpoints = [
    '/health',
    '/api/v1/auth/status',
    '/api/v1/projects',
    '/api/v1/sites',
    '/api/v1/users',
    '/api/v1/files',
    '/api/v1/crm'
  ];
  
  console.log('%c📋 Required API Endpoints:', 'color: cyan;');
  requiredEndpoints.forEach(endpoint => {
    console.log(`   ✓ ${CONFIG.API.WORKER_API_URL}${endpoint}`);
  });
  
  return true;
}

// 執行相容性檢查
if (CONFIG.UI.SHOW_DEBUG_INFO) {
  checkApiCompatibility();
}

// API 測試函數
async function testUnifiedAPI() {
  if (!CONFIG.UI.SHOW_DEBUG_INFO) return;
  
  console.log('%c🔍 Testing Unified API...', 'color: yellow;');
  
  try {
    // 測試健康檢查
    const healthResponse = await fetch(`${CONFIG.API.WORKER_API_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('%c✅ Health Check:', 'color: green;', healthData);
    
    // 測試認證狀態
    const authResponse = await fetch(`${CONFIG.API.WORKER_API_URL}/api/v1/auth/status`);
    const authData = await authResponse.json();
    console.log('%c✅ Auth Status:', 'color: green;', authData);
    
    return true;
  } catch (error) {
    console.error('%c❌ API Test Failed:', 'color: red;', error);
    return false;
  }
}

// 在頁面載入後執行 API 測試
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(testUnifiedAPI, 1000);
  });
}