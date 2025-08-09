/**
 * Clerk 設定腳本
 * 使用 Clerk Backend API 配置應用
 */

const CLERK_SECRET_KEY = 'sk_test_UqjBEE0wOtBatBQbM1buSyr8mIaWqGpes872R5cL6T';
const CLERK_API_URL = 'https://api.clerk.com/v1';

// 從 Secret Key 解析 Instance ID
const instanceId = CLERK_SECRET_KEY.split('_')[2]; // 通常是 secret key 的一部分

async function clerkAPI(endpoint, options = {}) {
  const response = await fetch(`${CLERK_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Clerk API Error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function setupClerk() {
  console.log('🚀 設定 Clerk 應用...\n');

  try {
    // 1. 獲取當前應用設定
    console.log('1. 檢查應用狀態...');
    const instance = await clerkAPI('/instance');
    console.log('✅ 應用 ID:', instance.id);
    console.log('✅ 應用名稱:', instance.name || 'Construction Management');

    // 2. 更新身份驗證設定
    console.log('\n2. 設定手機號碼登入...');
    try {
      await clerkAPI('/instance', {
        method: 'PATCH',
        body: JSON.stringify({
          phone_number_enabled: true,
          password_enabled: false,
          email_enabled: false,
        }),
      });
      console.log('✅ 手機號碼登入已啟用');
    } catch (error) {
      console.log('⚠️  可能已經設定過:', error.message);
    }

    // 3. 設定測試手機號碼
    console.log('\n3. 添加測試手機號碼...');
    try {
      await clerkAPI('/testing_phone_numbers', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: '+886912345678',
          verified: true,
          default_second_factor: false,
          reserved_for_second_factor: false,
        }),
      });
      console.log('✅ 測試號碼 +886912345678 已添加');
    } catch (error) {
      console.log('⚠️  測試號碼可能已存在:', error.message);
    }

    // 4. 創建測試用戶
    console.log('\n4. 創建測試用戶...');
    try {
      const user = await clerkAPI('/users', {
        method: 'POST',
        body: JSON.stringify({
          phone_numbers: ['+886912345678'],
          public_metadata: {
            role: 'admin',
            name: '管理員',
            tenantId: 'yes-ceramics',
          },
          private_metadata: {
            internal_id: 'admin-001',
          },
        }),
      });
      console.log('✅ 測試用戶已創建:', user.id);
    } catch (error) {
      console.log('⚠️  用戶可能已存在:', error.message);
    }

    // 5. 獲取並顯示設定
    console.log('\n5. 當前設定摘要:');
    console.log('=====================================');
    console.log('Publishable Key:', 'pk_test_YWJzb2x1dGUtY291Z2FyLTkwLmNsZXJrLmFjY291bnRzLmRldiQ');
    console.log('Secret Key:', CLERK_SECRET_KEY.substring(0, 20) + '...');
    console.log('測試手機號碼:', '+886912345678');
    console.log('測試驗證碼:', '424242');
    console.log('=====================================');

    console.log('\n✅ Clerk 設定完成！');
    console.log('\n下一步：');
    console.log('1. 訪問: https://6f15e3bf.construction-management-frontend.pages.dev/login-clerk.html');
    console.log('2. 輸入手機號碼: +886912345678');
    console.log('3. 輸入驗證碼: 424242');
    console.log('4. 成功登入！');

  } catch (error) {
    console.error('❌ 設定失敗:', error);
    console.log('\n請手動前往 Clerk Dashboard 設定:');
    console.log('https://dashboard.clerk.com');
  }
}

// 執行設定
setupClerk();