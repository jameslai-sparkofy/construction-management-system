/**
 * Script to create test users in Supabase
 * Run this in the browser console on the test-permissions.html page
 */

async function createTestUsers() {
    if (!window.supabase) {
        console.error('Supabase not initialized');
        return;
    }
    
    const testUsers = [
        {
            phone: '0900000001',
            name: '系統管理員',
            role: 'admin',
            d1_user_id: 'admin_001'
        },
        {
            phone: '0912345678',
            name: '張工班長',
            role: 'foreman',
            d1_user_id: 'foreman_001'
        },
        {
            phone: '0987654321',
            name: '王業主',
            role: 'owner',
            d1_user_id: 'owner_001'
        },
        {
            phone: '0955555555',
            name: '李師傅',
            role: 'worker',
            d1_user_id: 'worker_001'
        }
    ];
    
    console.log('開始建立測試用戶...');
    
    for (const user of testUsers) {
        const email = `${user.phone}@construction.local`;
        const password = user.phone.slice(-3); // 密碼為電話末3碼
        
        try {
            console.log(`建立用戶: ${user.name} (${user.phone})`);
            
            // 1. 建立 Supabase Auth 用戶
            const { data, error } = await window.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        phone: user.phone,
                        full_name: user.name,
                        role: user.role
                    }
                }
            });
            
            if (error) {
                if (error.message.includes('already registered')) {
                    console.log(`  ⚠️ 用戶已存在: ${email}`);
                    
                    // 獲取現有用戶 ID
                    const { data: users } = await window.supabase
                        .from('auth.users')
                        .select('id')
                        .eq('email', email)
                        .single();
                    
                    if (users) {
                        await createMapping(users.id, user);
                    }
                } else {
                    console.error(`  ❌ 建立失敗: ${error.message}`);
                    continue;
                }
            } else if (data?.user) {
                console.log(`  ✅ 用戶建立成功`);
                
                // 2. 建立用戶檔案
                await createUserProfile(data.user.id, user);
                
                // 3. 建立認證映射
                await createMapping(data.user.id, user);
            }
            
        } catch (err) {
            console.error(`  ❌ 錯誤: ${err.message}`);
        }
    }
    
    console.log('\n測試用戶建立完成！');
    console.log('測試帳號列表：');
    testUsers.forEach(user => {
        console.log(`  ${user.role.padEnd(10)} - ${user.phone} / ${user.phone.slice(-3)} (${user.name})`);
    });
}

async function createUserProfile(authUserId, user) {
    try {
        const { error } = await window.supabase
            .from('user_profiles')
            .upsert({
                auth_user_id: authUserId,
                phone: user.phone,
                name: user.name
            });
        
        if (error) {
            console.log(`    ⚠️ 用戶檔案建立失敗: ${error.message}`);
        } else {
            console.log(`    ✅ 用戶檔案已建立`);
        }
    } catch (err) {
        console.error(`    ❌ 建立用戶檔案錯誤: ${err.message}`);
    }
}

async function createMapping(authUserId, user) {
    try {
        const { error } = await window.supabase
            .from('auth_mapping')
            .upsert({
                auth_user_id: authUserId,
                d1_user_id: user.d1_user_id,
                d1_user_phone: user.phone,
                last_synced_at: new Date().toISOString()
            });
        
        if (error) {
            console.log(`    ⚠️ 映射建立失敗: ${error.message}`);
        } else {
            console.log(`    ✅ 認證映射已建立`);
        }
    } catch (err) {
        console.error(`    ❌ 建立映射錯誤: ${err.message}`);
    }
}

// 檢查映射狀態
async function checkMappingStatus() {
    if (!window.supabase) {
        console.error('Supabase not initialized');
        return;
    }
    
    try {
        const { data: mappings } = await window.supabase
            .from('auth_mapping')
            .select('*');
        
        console.log('\n認證映射狀態：');
        console.table(mappings || []);
        
        const { data: profiles } = await window.supabase
            .from('user_profiles')
            .select('*');
        
        console.log('\n用戶檔案：');
        console.table(profiles || []);
        
    } catch (error) {
        console.error('查詢失敗:', error);
    }
}

// 清理測試資料（謹慎使用）
async function cleanupTestData() {
    if (!confirm('確定要清理所有測試資料嗎？這將刪除所有測試用戶！')) {
        return;
    }
    
    const testEmails = [
        '0900000001@construction.local',
        '0912345678@construction.local',
        '0987654321@construction.local',
        '0955555555@construction.local'
    ];
    
    console.log('開始清理測試資料...');
    
    // 注意：刪除 auth.users 需要 service_role 權限
    // 這裡只清理映射和檔案
    
    try {
        // 清理映射
        const { error: mappingError } = await window.supabase
            .from('auth_mapping')
            .delete()
            .in('d1_user_phone', ['0900000001', '0912345678', '0987654321', '0955555555']);
        
        if (mappingError) {
            console.error('清理映射失敗:', mappingError);
        } else {
            console.log('✅ 映射已清理');
        }
        
        // 清理用戶檔案
        const { error: profileError } = await window.supabase
            .from('user_profiles')
            .delete()
            .in('phone', ['0900000001', '0912345678', '0987654321', '0955555555']);
        
        if (profileError) {
            console.error('清理用戶檔案失敗:', profileError);
        } else {
            console.log('✅ 用戶檔案已清理');
        }
        
        console.log('\n清理完成！');
        
    } catch (error) {
        console.error('清理失敗:', error);
    }
}

// 使用說明
console.log(`
========================================
測試用戶管理工具
========================================

可用命令：
1. createTestUsers()     - 建立所有測試用戶
2. checkMappingStatus()  - 檢查映射狀態
3. cleanupTestData()     - 清理測試資料（謹慎）

測試帳號：
- 管理員: 0900000001 / 001
- 工班長: 0912345678 / 678
- 業主:   0987654321 / 321
- 工人:   0955555555 / 555

請在 test-permissions.html 頁面的控制台執行這些命令
`);