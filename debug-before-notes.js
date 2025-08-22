const { chromium } = require('playwright');

async function debugBeforeNotes() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 調試施工前備註資料...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待載入完成
    await page.waitForTimeout(6000);

    // 檢查原始資料中的施工前備註
    const dataAnalysis = await page.evaluate(() => {
      if (!window.currentSites || window.currentSites.length === 0) {
        return { error: 'No currentSites data available' };
      }

      const fieldMapping = {
        beforeNotes: 'field_sF6fn__c',
        completed: 'construction_completed__c'
      };

      const analysis = {
        totalSites: window.currentSites.length,
        sitesWithBeforeNotes: 0,
        completedSites: 0,
        potentialIconSites: 0,
        sampleData: []
      };

      window.currentSites.forEach((site, index) => {
        const beforeNotes = site[fieldMapping.beforeNotes] || '';
        const isCompleted = site[fieldMapping.completed];
        const hasBeforeNotes = beforeNotes && beforeNotes.trim() !== '';
        const shouldShowIcon = hasBeforeNotes && !isCompleted;

        if (hasBeforeNotes) {
          analysis.sitesWithBeforeNotes++;
        }
        
        if (isCompleted) {
          analysis.completedSites++;
        }

        if (shouldShowIcon) {
          analysis.potentialIconSites++;
        }

        // 收集前 10 個案場的詳細資料
        if (index < 10) {
          analysis.sampleData.push({
            siteName: site.name || `Site ${index + 1}`,
            building: site.field_WD7k1__c || 'unknown',
            unit: site.field_XuJP2__c || 'unknown', 
            beforeNotes: beforeNotes,
            hasBeforeNotes: hasBeforeNotes,
            isCompleted: isCompleted,
            shouldShowIcon: shouldShowIcon,
            beforeNotesField: fieldMapping.beforeNotes,
            completedField: fieldMapping.completed
          });
        }
      });

      return analysis;
    });

    console.log('📊 施工前備註資料分析:\n');
    
    if (dataAnalysis.error) {
      console.log('❌ 錯誤:', dataAnalysis.error);
      return;
    }

    console.log(`總案場數: ${dataAnalysis.totalSites}`);
    console.log(`有施工前備註的案場: ${dataAnalysis.sitesWithBeforeNotes}`);
    console.log(`已完工案場: ${dataAnalysis.completedSites}`);
    console.log(`應顯示通知圖示的案場: ${dataAnalysis.potentialIconSites}\n`);

    console.log('🔍 前10個案場詳細資料:');
    dataAnalysis.sampleData.forEach((site, i) => {
      console.log(`${i+1}. ${site.siteName} (${site.building}-${site.unit})`);
      console.log(`   施工前備註: "${site.beforeNotes}"`);
      console.log(`   有備註: ${site.hasBeforeNotes}`);
      console.log(`   已完工: ${site.isCompleted}`);
      console.log(`   應顯示圖示: ${site.shouldShowIcon}`);
      console.log('');
    });

    // 檢查欄位映射
    console.log('🔧 欄位映射檢查:');
    console.log(`施工前備註欄位: ${dataAnalysis.sampleData[0]?.beforeNotesField}`);
    console.log(`完工狀態欄位: ${dataAnalysis.sampleData[0]?.completedField}`);

    // 診斷
    console.log('\n🎯 診斷結果:');
    if (dataAnalysis.potentialIconSites > 0) {
      console.log(`✅ 應該有 ${dataAnalysis.potentialIconSites} 個通知圖示`);
      console.log('❌ 但實際沒有顯示，檢查前端渲染邏輯');
    } else if (dataAnalysis.sitesWithBeforeNotes > 0) {
      console.log('⚠️ 有案場有施工前備註，但都已完工');
      console.log('✅ 功能邏輯正確：已完工案場不顯示圖示');
    } else {
      console.log('⚠️ 測試資料中沒有任何施工前備註');
      console.log('💡 建議手動添加測試資料');
    }

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

debugBeforeNotes().catch(console.error);