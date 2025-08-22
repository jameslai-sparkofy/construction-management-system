const { chromium } = require('playwright');

async function debugIconGeneration() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🐛 調試圖示生成邏輯...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    await page.waitForTimeout(6000);

    const debugResult = await page.evaluate(() => {
      // 設置測試環境
      if (!window.currentSites || window.currentSites.length === 0) {
        return { error: 'No sites data' };
      }

      // 修改第一個案場
      const testSite = window.currentSites[0];
      testSite.field_sF6fn__c = '測試施工前備註內容';
      testSite.construction_completed__c = false;

      // 重新分組
      if (typeof groupSitesByBuilding === 'function') {
        groupSitesByBuilding();
      }

      // 設置建築物
      window.currentBuilding = 'C';

      // 手動執行 renderFloorGrid 中的關鍵邏輯
      const sites = window.sitesGroupedByBuilding[window.currentBuilding] || [];
      console.log(`建築物 ${window.currentBuilding} 有 ${sites.length} 個案場`);

      // 找到我們修改的測試案場
      const modifiedSite = sites.find(site => site._id === testSite._id);
      if (!modifiedSite) {
        return { error: 'Modified site not found in current building' };
      }

      console.log('找到修改的案場:', modifiedSite.name);

      // 手動測試圖示邏輯
      const fieldMapping = {
        completed: 'construction_completed__c',
        beforeNotes: 'field_sF6fn__c'
      };

      const isCompleted = modifiedSite[fieldMapping.completed];
      const beforeNotes = modifiedSite[fieldMapping.beforeNotes] || '';
      const showNotificationIcon = beforeNotes && beforeNotes.trim() !== '' && !isCompleted;

      console.log('圖示邏輯測試:');
      console.log('  beforeNotes:', `"${beforeNotes}"`);
      console.log('  isCompleted:', isCompleted);
      console.log('  beforeNotes.trim() !== "":', beforeNotes.trim() !== '');
      console.log('  !isCompleted:', !isCompleted);
      console.log('  showNotificationIcon:', showNotificationIcon);

      // 測試 HTML 生成
      const iconHtml = showNotificationIcon ? 
        `<div class="notification-icon" title="有施工前備註">⚠</div>` : '';
      
      console.log('生成的圖示 HTML:', iconHtml);

      return {
        success: true,
        testSiteName: modifiedSite.name,
        beforeNotes: beforeNotes,
        isCompleted: isCompleted,
        showNotificationIcon: showNotificationIcon,
        iconHtml: iconHtml,
        fieldMappingBeforeNotes: fieldMapping.beforeNotes,
        fieldMappingCompleted: fieldMapping.completed,
        siteKeys: Object.keys(modifiedSite).filter(key => key.includes('field_sF6fn__c') || key.includes('construction_completed')),
        actualBeforeNotesValue: modifiedSite.field_sF6fn__c,
        actualCompletedValue: modifiedSite.construction_completed__c
      };
    });

    if (debugResult.error) {
      console.log('❌ 錯誤:', debugResult.error);
      return;
    }

    console.log('🔍 詳細調試結果:');
    console.log(`測試案場: ${debugResult.testSiteName}`);
    console.log(`施工前備註: "${debugResult.beforeNotes}"`);
    console.log(`完工狀態: ${debugResult.isCompleted}`);
    console.log(`應顯示圖示: ${debugResult.showNotificationIcon}`);
    console.log(`生成的 HTML: "${debugResult.iconHtml}"`);
    console.log(`備註欄位映射: ${debugResult.fieldMappingBeforeNotes}`);
    console.log(`完工欄位映射: ${debugResult.fieldMappingCompleted}`);
    console.log(`實際備註值: "${debugResult.actualBeforeNotesValue}"`);
    console.log(`實際完工值: ${debugResult.actualCompletedValue}`);
    console.log(`相關欄位: ${debugResult.siteKeys.join(', ')}`);

    console.log('\n🎯 診斷結果:');
    if (debugResult.showNotificationIcon && debugResult.iconHtml) {
      console.log('✅ 圖示邏輯正確，HTML 已生成');
      console.log('❓ 問題可能在於 renderFloorGrid 的其他部分');
      
      // 測試完整的 renderFloorGrid 調用
      console.log('\n🔧 測試完整 renderFloorGrid...');
      
      const fullRenderTest = await page.evaluate(() => {
        // 覆蓋 renderFloorGrid 來添加詳細日誌
        const originalInnerHTML = HTMLElement.prototype.innerHTML;
        let htmlContent = '';
        
        Object.defineProperty(HTMLElement.prototype, 'innerHTML', {
          set: function(value) {
            if (this.id === 'gridContent') {
              htmlContent = value;
              console.log('設置 gridContent innerHTML，長度:', value.length);
              console.log('包含 notification-icon:', value.includes('notification-icon'));
            }
            originalInnerHTML.call(this, value);
          },
          get: function() {
            return originalInnerHTML.call(this);
          }
        });

        // 調用渲染函數
        if (typeof renderFloorGrid === 'function') {
          renderFloorGrid();
        }

        return {
          htmlContent: htmlContent,
          hasNotificationIcon: htmlContent.includes('notification-icon')
        };
      });

      console.log(`HTML 內容長度: ${fullRenderTest.htmlContent.length}`);
      console.log(`包含 notification-icon: ${fullRenderTest.hasNotificationIcon}`);
      
      if (!fullRenderTest.hasNotificationIcon) {
        console.log('❌ renderFloorGrid 沒有生成 notification-icon');
        console.log('💡 可能是條件判斷或資料存取問題');
      } else {
        console.log('✅ renderFloorGrid 成功生成 notification-icon！');
      }
      
    } else {
      console.log('❌ 圖示邏輯有問題');
      if (!debugResult.showNotificationIcon) {
        console.log('   條件判斷返回 false');
        if (debugResult.isCompleted) console.log('   - 案場已完工');
        if (!debugResult.beforeNotes || debugResult.beforeNotes.trim() === '') {
          console.log('   - 施工前備註為空');
        }
      }
    }

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

debugIconGeneration().catch(console.error);