/**
 * 檢查開發版資料庫狀態
 */

const { chromium } = require('playwright');

async function checkDevDatabase() {
    console.log('🔍 檢查開發版資料庫狀態');
    
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000
    });
    const page = await browser.newPage();
    
    try {
        // 1. 登入開發版
        console.log('1. 登入開發版...');
        await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
        await page.waitForLoadState('networkidle');
        
        await page.fill('input[type="tel"]', '0912345678');
        await page.fill('input[type="password"]', '678');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        
        // 2. 檢查多個專案的案場資料
        console.log('2. 檢查專案列表...');
        
        const projectListCheck = await page.evaluate(async () => {
            try {
                const token = localStorage.getItem('token');
                const apiUrl = 'https://construction-management-api-dev.lai-jameslai.workers.dev';
                
                // 獲取專案列表
                const projectsResponse = await fetch(`${apiUrl}/api/v1/projects`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const projectsData = await projectsResponse.json();
                const projects = projectsData.projects || [];
                
                console.log(`找到 ${projects.length} 個專案`);
                
                // 檢查每個專案的案場數量
                const projectSiteCounts = [];
                for (const project of projects.slice(0, 5)) { // 只檢查前5個
                    try {
                        const projectResponse = await fetch(`${apiUrl}/api/v1/projects/${project.id}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        const projectData = await projectResponse.json();
                        projectSiteCounts.push({
                            id: project.id,
                            name: project.name,
                            sitesCount: projectData.sites?.length || 0,
                            opportunityId: project.opportunity_id
                        });
                    } catch (error) {
                        console.error(`檢查專案 ${project.id} 時出錯:`, error);
                    }
                }
                
                return {
                    success: true,
                    totalProjects: projects.length,
                    projectSiteCounts: projectSiteCounts,
                    firstProjectDetails: projects[0]
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        console.log('專案檢查結果:', JSON.stringify(projectListCheck, null, 2));
        
        // 3. 檢查 CRM 外部 API
        console.log('3. 檢查 CRM 外部 API...');
        
        const crmApiCheck = await page.evaluate(async () => {
            try {
                // 嘗試直接呼叫 CRM API
                const crmUrl = 'https://d1.yes-ceramics.com/rest/object_8W9cb__c?limit=10';
                const response = await fetch(crmUrl, {
                    headers: {
                        'Authorization': 'Bearer fx-crm-api-secret-2025'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    return {
                        success: true,
                        status: response.status,
                        totalSites: data.results?.length || 0,
                        sampleSite: data.results?.[0] || null
                    };
                } else {
                    return {
                        success: false,
                        status: response.status,
                        statusText: response.statusText
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        console.log('CRM API 檢查結果:', crmApiCheck);
        
        // 4. 檢查是否有任何專案有案場
        const hasAnySites = projectListCheck.projectSiteCounts?.some(p => p.sitesCount > 0);
        
        console.log('\n=== 診斷結果 ===');
        console.log(`總專案數: ${projectListCheck.totalProjects || 0}`);
        console.log(`有案場的專案: ${projectListCheck.projectSiteCounts?.filter(p => p.sitesCount > 0).length || 0}`);
        console.log(`CRM API 可訪問: ${crmApiCheck.success ? '是' : '否'}`);
        console.log(`CRM 中的案場數: ${crmApiCheck.totalSites || 0}`);
        
        if (!hasAnySites && crmApiCheck.success && crmApiCheck.totalSites > 0) {
            console.log('\n🔧 建議修復方案:');
            console.log('1. CRM 有案場資料但開發版沒有');
            console.log('2. 需要執行案場資料同步');
            console.log('3. 或檢查專案與案場的關聯 (opportunity_id)');
        }
        
        await page.screenshot({ path: 'dev-database-check.png', fullPage: true });
        
    } catch (error) {
        console.error('❌ 檢查過程發生錯誤:', error);
    } finally {
        console.log('\n瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

checkDevDatabase();