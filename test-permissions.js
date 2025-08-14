const { createClient } = require('@supabase/supabase-js');

// Supabase 配置
const supabaseUrl = 'https://pbecqosbkuyypsgwxnmq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZWNxb3Nia3V5eXBzZ3d4bm1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NDgyOTcsImV4cCI6MjA3MDIyNDI5N30.RxgJZpII8Fm1ym6UtMEdmw87DExR1MxtJXISag9vszQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 測試用戶資料
const testUsers = {
    admin: {
        email: 'admin@construction.com',
        password: 'admin123456',
        role: 'admin',
        name: '系統管理員'
    },
    foreman: {
        email: 'foreman@construction.com',
        password: 'foreman123456',
        role: 'foreman',
        name: '張工頭'
    },
    worker: {
        email: 'worker@construction.com',
        password: 'worker123456',
        role: 'worker',
        name: '李師傅'
    },
    owner: {
        email: 'owner@construction.com',
        password: 'owner123456',
        role: 'owner',
        name: '王業主'
    }
};

// 測試專案資料
const testProject = {
    project_name: '權限測試專案',
    site_number: 'PERM001',
    address: '台北市測試路100號',
    field_size: 500
};

async function setupTestEnvironment() {
    console.log('=== 權限系統測試環境設定 ===\n');
    
    try {
        // 1. 建立測試用戶
        console.log('1. 建立測試用戶...');
        const userIds = {};
        
        for (const [key, userData] of Object.entries(testUsers)) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        full_name: userData.name,
                        role: userData.role
                    }
                }
            });
            
            if (signUpError) {
                console.log(`   ${key}: ${signUpError.message}`);
                
                // 如果用戶已存在，嘗試登入取得 ID
                const { data: signInData } = await supabase.auth.signInWithPassword({
                    email: userData.email,
                    password: userData.password
                });
                
                if (signInData?.user) {
                    userIds[key] = signInData.user.id;
                    console.log(`   ✓ ${key} 已存在: ${userData.email}`);
                }
            } else {
                userIds[key] = signUpData.user.id;
                console.log(`   ✓ ${key} 建立成功: ${userData.email}`);
            }
        }
        
        // 2. 建立測試專案
        console.log('\n2. 建立測試專案...');
        
        // 使用管理員身份建立專案
        const { data: adminAuth } = await supabase.auth.signInWithPassword({
            email: testUsers.admin.email,
            password: testUsers.admin.password
        });
        
        if (!adminAuth?.session) {
            console.log('   ✗ 管理員登入失敗');
            return;
        }
        
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .insert({
                ...testProject,
                created_by: userIds.admin
            })
            .select()
            .single();
        
        if (projectError) {
            console.log('   ✗ 專案建立失敗:', projectError.message);
            return;
        }
        
        console.log(`   ✓ 專案建立成功: ${project.project_name}`);
        
        // 3. 分配權限
        console.log('\n3. 分配專案權限...');
        
        const permissions = [
            {
                project_id: project.id,
                user_id: userIds.foreman,
                role: 'foreman',
                can_view: true,
                can_edit: true,
                can_manage_members: true,
                can_view_other_teams: true,
                granted_by: userIds.admin
            },
            {
                project_id: project.id,
                user_id: userIds.worker,
                role: 'worker',
                can_view: true,
                can_edit: true,
                can_manage_members: false,
                can_view_other_teams: false,
                granted_by: userIds.admin
            },
            {
                project_id: project.id,
                user_id: userIds.owner,
                role: 'owner',
                can_view: true,
                can_edit: false,
                can_manage_members: false,
                can_view_other_teams: true,
                granted_by: userIds.admin
            }
        ];
        
        const { error: permError } = await supabase
            .from('project_permissions')
            .insert(permissions);
        
        if (permError) {
            console.log('   ✗ 權限分配失敗:', permError.message);
        } else {
            console.log('   ✓ 權限分配成功');
        }
        
        // 4. 測試權限
        console.log('\n4. 測試權限功能...');
        
        // 測試各角色
        for (const [key, userData] of Object.entries(testUsers)) {
            console.log(`\n   測試 ${key} (${userData.name}):`);
            
            // 登入
            const { data: auth } = await supabase.auth.signInWithPassword({
                email: userData.email,
                password: userData.password
            });
            
            if (!auth?.session) {
                console.log('     ✗ 登入失敗');
                continue;
            }
            
            // 查詢可存取的專案
            const { data: projects, error } = await supabase
                .rpc('get_user_projects', { p_user_id: auth.user.id });
            
            if (error) {
                console.log('     ✗ 查詢專案失敗:', error.message);
            } else {
                console.log(`     ✓ 可存取專案數: ${projects?.length || 0}`);
                projects?.forEach(p => {
                    console.log(`       - ${p.project_name} (角色: ${p.role}, 可編輯: ${p.can_edit})`);
                });
            }
            
            // 測試權限檢查
            if (project?.id) {
                const { data: hasEditPerm } = await supabase
                    .rpc('check_user_permission', {
                        p_user_id: auth.user.id,
                        p_project_id: project.id,
                        p_permission: 'edit'
                    });
                
                console.log(`     編輯權限: ${hasEditPerm ? '✓' : '✗'}`);
            }
        }
        
        // 5. 建立工班
        console.log('\n5. 建立工班結構...');
        
        // 使用工班負責人身份
        const { data: foremanAuth } = await supabase.auth.signInWithPassword({
            email: testUsers.foreman.email,
            password: testUsers.foreman.password
        });
        
        if (foremanAuth?.session) {
            const { data: team, error: teamError } = await supabase
                .from('teams')
                .insert({
                    project_id: project.id,
                    name: '測試工班',
                    foreman_id: userIds.foreman
                })
                .select()
                .single();
            
            if (teamError) {
                console.log('   ✗ 工班建立失敗:', teamError.message);
            } else {
                console.log(`   ✓ 工班建立成功: ${team.name}`);
                
                // 加入工班成員
                const { error: memberError } = await supabase
                    .from('team_members')
                    .insert([
                        {
                            team_id: team.id,
                            user_id: userIds.foreman,
                            role: 'foreman'
                        },
                        {
                            team_id: team.id,
                            user_id: userIds.worker,
                            role: 'worker'
                        }
                    ]);
                
                if (memberError) {
                    console.log('   ✗ 成員加入失敗:', memberError.message);
                } else {
                    console.log('   ✓ 工班成員加入成功');
                }
            }
        }
        
        console.log('\n=== 測試環境設定完成 ===');
        
        // 輸出測試帳號資訊
        console.log('\n📋 測試帳號資訊：');
        console.log('-------------------');
        for (const [key, userData] of Object.entries(testUsers)) {
            console.log(`${userData.role}:`);
            console.log(`  Email: ${userData.email}`);
            console.log(`  密碼: ${userData.password}`);
            console.log('');
        }
        
    } catch (error) {
        console.error('錯誤:', error);
    }
}

// 測試權限操作
async function testPermissionOperations() {
    console.log('\n=== 測試權限操作 ===\n');
    
    // 1. 測試工班負責人新增成員
    console.log('1. 測試工班負責人新增成員...');
    const { data: foremanAuth } = await supabase.auth.signInWithPassword({
        email: testUsers.foreman.email,
        password: testUsers.foreman.password
    });
    
    if (foremanAuth?.session) {
        // 建立新成員
        const newWorker = {
            email: `worker${Date.now()}@construction.com`,
            password: 'worker123456'
        };
        
        const { data: newUser, error } = await supabase.auth.signUp({
            email: newWorker.email,
            password: newWorker.password,
            options: {
                data: {
                    full_name: '新工人',
                    role: 'worker',
                    added_by: foremanAuth.user.id
                }
            }
        });
        
        if (error) {
            console.log('   ✗ 新增成員失敗:', error.message);
        } else {
            console.log(`   ✓ 新成員建立成功: ${newWorker.email}`);
        }
    }
    
    // 2. 測試業主查看權限
    console.log('\n2. 測試業主唯讀權限...');
    const { data: ownerAuth } = await supabase.auth.signInWithPassword({
        email: testUsers.owner.email,
        password: testUsers.owner.password
    });
    
    if (ownerAuth?.session) {
        // 嘗試編輯專案（應該失敗）
        const { data, error } = await supabase
            .from('projects')
            .update({ field_size: 600 })
            .eq('created_by', ownerAuth.user.id);
        
        if (error) {
            console.log('   ✓ 業主無法編輯（正確）');
        } else {
            console.log('   ✗ 業主可以編輯（錯誤）');
        }
    }
    
    // 3. 測試管理員權限
    console.log('\n3. 測試管理員全權限...');
    const { data: adminAuth } = await supabase.auth.signInWithPassword({
        email: testUsers.admin.email,
        password: testUsers.admin.password
    });
    
    if (adminAuth?.session) {
        // 查詢所有專案
        const { data: allProjects, error } = await supabase
            .from('projects')
            .select('*');
        
        if (error) {
            console.log('   ✗ 查詢失敗:', error.message);
        } else {
            console.log(`   ✓ 管理員可查看所有專案: ${allProjects?.length || 0} 個`);
        }
    }
}

// 執行測試
async function runTests() {
    await setupTestEnvironment();
    await testPermissionOperations();
}

runTests().catch(console.error);