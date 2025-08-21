/**
 * 追蹤 opportunity_id 的來源
 */

const { chromium } = require('playwright');

async function traceOpportunityId() {
    console.log('🔍 追蹤 opportunity_id: 650e90b1111f83000184a8a7');
    
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
        
        // 2. 檢查這個 ID 在 CRM 中的詳細資訊
        console.log('2. 檢查 CRM 中的 opportunity 資料...');
        
        const crmOpportunityCheck = await page.evaluate(async () => {
            try {
                const opportunityId = '650e90b1111f83000184a8a7';
                const crmBaseUrl = 'https://d1.yes-ceramics.com/rest';
                
                // 檢查這個 ID 是否存在於 opportunities 表中
                const opportunityResponse = await fetch(`${crmBaseUrl}/opportunity/${opportunityId}`, {
                    headers: {
                        'Authorization': 'Bearer fx-crm-api-secret-2025'
                    }
                });
                
                let opportunityData = null;
                if (opportunityResponse.ok) {
                    opportunityData = await opportunityResponse.json();
                }
                
                // 搜尋所有與這個 ID 相關的案場
                const sitesResponse = await fetch(`${crmBaseUrl}/object_8W9cb__c?field_1P96q__c=${opportunityId}&limit=100`, {
                    headers: {
                        'Authorization': 'Bearer fx-crm-api-secret-2025'
                    }
                });
                
                let sitesData = null;
                if (sitesResponse.ok) {
                    sitesData = await sitesResponse.json();
                }
                
                return {
                    opportunityId: opportunityId,
                    opportunityExists: opportunityResponse.ok,
                    opportunityStatus: opportunityResponse.status,
                    opportunityData: opportunityData,
                    sitesCount: sitesData?.results?.length || 0,
                    sampleSites: sitesData?.results?.slice(0, 3) || []
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        console.log('CRM Opportunity 檢查結果:', JSON.stringify(crmOpportunityCheck, null, 2));
        
        // 3. 檢查我們專案中是否有這個 opportunity_id
        console.log('3. 檢查我們的專案中是否有這個 opportunity_id...');
        
        const projectCheck = await page.evaluate(async () => {
            try {
                const token = localStorage.getItem('token');
                const apiUrl = 'https://construction-management-api-dev.lai-jameslai.workers.dev';
                const targetOpportunityId = '650e90b1111f83000184a8a7';
                
                const projectsResponse = await fetch(`${apiUrl}/api/v1/projects`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const projectsData = await projectsResponse.json();
                const projects = projectsData.projects || [];
                
                const matchingProject = projects.find(p => p.opportunity_id === targetOpportunityId);
                
                return {
                    allProjects: projects.map(p => ({
                        id: p.id,
                        name: p.name,
                        opportunity_id: p.opportunity_id
                    })),
                    matchingProject: matchingProject || null,
                    hasMatch: !!matchingProject
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        console.log('專案檢查結果:', JSON.stringify(projectCheck, null, 2));
        
        // 4. 如果沒有匹配的專案，檢查是否需要創建
        if (!projectCheck.hasMatch && crmOpportunityCheck.sitesCount > 0) {
            console.log('\n🔧 發現孤立的案場資料！');
            console.log(`CRM 中有 ${crmOpportunityCheck.sitesCount} 個案場，但沒有對應的專案`);
            console.log('建議：為這些案場創建對應的專案，或將案場關聯到現有專案');
        }
        
        // 5. 檢查相似的 opportunity_id (可能是版本差異)
        console.log('5. 檢查相似的 opportunity_id...');
        
        const similarIds = projectCheck.allProjects.map(p => p.opportunity_id);
        const targetId = '650e90b1111f83000184a8a7';
        
        console.log('\n=== ID 比較 ===');
        console.log(`目標 ID: ${targetId}`);
        console.log('專案中的 IDs:');
        similarIds.forEach(id => {
            const similarity = id.substring(0, 10) === targetId.substring(0, 10);
            console.log(`  ${id} ${similarity ? '(前10位相同)' : ''}`);
        });
        
        await page.screenshot({ path: 'opportunity-id-trace.png', fullPage: true });
        
    } catch (error) {
        console.error('❌ 追蹤過程發生錯誤:', error);
    } finally {
        console.log('\n瀏覽器將保持開啟 60 秒供檢查...');
        setTimeout(() => browser.close(), 60000);
    }
}

traceOpportunityId();