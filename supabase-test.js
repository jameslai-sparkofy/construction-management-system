const { createClient } = require('@supabase/supabase-js');

// Supabase 配置
const supabaseUrl = 'https://pbecqosbkuyypsgwxnmq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZWNxb3Nia3V5eXBzZ3d4bm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NDgyOTcsImV4cCI6MjA3MDIyNDI5N30.RxgJZpII8Fm1ym6UtMEdmw87DExR1MxtJXISag9vszQ';

// 建立 Supabase 客戶端
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabase() {
    console.log('=== Supabase 測試開始 ===\n');
    
    // 1. 建立測試帳號
    console.log('1. 建立測試帳號...');
    const testEmail = `test${Date.now()}@construction.com`;
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: 'test123456',
        options: {
            data: {
                full_name: '測試用戶',
                company: '元心建材'
            }
        }
    });
    
    if (signUpError) {
        console.log('   註冊錯誤:', signUpError.message);
        
        // 如果用戶已存在，嘗試登入
        if (signUpError.message.includes('already registered')) {
            console.log('   用戶已存在，嘗試登入...');
        }
    } else {
        console.log('   ✓ 註冊成功:', signUpData.user?.email);
    }
    
    // 2. 測試登入
    console.log('\n2. 測試登入...');
    const loginEmail = signUpData?.user?.email || testEmail;
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: 'test123456'
    });
    
    if (signInError) {
        console.log('   ✗ 登入失敗:', signInError.message);
        return;
    } else {
        console.log('   ✓ 登入成功!');
        console.log('   - User ID:', signInData.user.id);
        console.log('   - Email:', signInData.user.email);
        console.log('   - Session:', signInData.session ? '有效' : '無效');
    }
    
    // 3. 測試資料庫存取
    console.log('\n3. 測試資料庫存取...');
    
    // 檢查用戶資料表
    const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', signInData.user.id)
        .single();
    
    if (profileError) {
        console.log('   用戶資料表不存在或無法存取:', profileError.message);
        console.log('   需要執行 setup.sql 來建立資料表');
    } else {
        console.log('   ✓ 用戶資料:', profileData);
    }
    
    // 4. 測試專案資料表
    console.log('\n4. 測試專案資料表...');
    const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .limit(5);
    
    if (projectsError) {
        console.log('   專案資料表不存在或無法存取:', projectsError.message);
    } else {
        console.log('   ✓ 專案資料表可存取');
        console.log('   - 專案數量:', projectsData.length);
    }
    
    // 5. 建立測試專案
    console.log('\n5. 建立測試專案...');
    const { data: newProject, error: createError } = await supabase
        .from('projects')
        .insert({
            project_name: '測試專案 - ' + new Date().toISOString(),
            site_number: 'TEST001',
            phone: '0912345678',
            address: '台北市測試路123號',
            field_size: 100.5,
            is_completed: false,
            created_by: signInData.user.id
        })
        .select()
        .single();
    
    if (createError) {
        console.log('   ✗ 建立專案失敗:', createError.message);
    } else {
        console.log('   ✓ 專案建立成功:', newProject.project_name);
        console.log('   - Project ID:', newProject.id);
    }
    
    // 6. 測試登出
    console.log('\n6. 測試登出...');
    const { error: signOutError } = await supabase.auth.signOut();
    
    if (signOutError) {
        console.log('   ✗ 登出失敗:', signOutError.message);
    } else {
        console.log('   ✓ 登出成功');
    }
    
    console.log('\n=== 測試完成 ===');
}

// 執行測試
testSupabase().catch(console.error);