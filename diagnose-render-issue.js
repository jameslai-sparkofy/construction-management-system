const { chromium } = require('playwright');

async function diagnoseRenderIssue() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 診斷渲染問題的根本原因...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    await page.waitForTimeout(6000);

    // 1. 先測試正常情況下是否能渲染
    console.log('📋 測試1: 正常情況下的渲染');
    const normalRenderTest = await page.evaluate(() => {
      let htmlCaptured = '';
      const gridContent = document.getElementById('gridContent');
      
      // 攔截 innerHTML
      const originalSetter = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
      Object.defineProperty(gridContent, 'innerHTML', {
        set: function(value) {
          htmlCaptured = value;
          console.log('正常渲染 - HTML長度:', value.length);
          originalSetter.call(this, value);
        },
        configurable: true
      });

      // 直接調用渲染函數
      if (typeof renderFloorGrid === 'function') {
        renderFloorGrid();
      }

      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            htmlGenerated: htmlCaptured.length > 0,
            htmlLength: htmlCaptured.length,
            containsTable: htmlCaptured.includes('<table'),
            containsGridCell: htmlCaptured.includes('grid-cell')
          });
        }, 1000);
      });
    });

    console.log('正常渲染結果:', normalRenderTest);

    // 2. 測試修改資料後的渲染
    console.log('\n📋 測試2: 修改資料後的渲染');
    const modifiedRenderTest = await page.evaluate(() => {
      // 修改第一個案場
      if (window.currentSites && window.currentSites.length > 0) {
        window.currentSites[0].field_sF6fn__c = '測試備註';
        window.currentSites[0].construction_completed__c = false;
        console.log('已修改第一個案場');
      }

      // 重新分組
      if (typeof groupSitesByBuilding === 'function') {
        groupSitesByBuilding();
        console.log('已重新分組');
      }

      let htmlCaptured2 = '';
      const gridContent = document.getElementById('gridContent');
      
      Object.defineProperty(gridContent, 'innerHTML', {
        set: function(value) {
          htmlCaptured2 = value;
          console.log('修改後渲染 - HTML長度:', value.length);
          originalSetter.call(this, value);
        },
        configurable: true
      });

      if (typeof renderFloorGrid === 'function') {
        renderFloorGrid();
      }

      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            htmlGenerated: htmlCaptured2.length > 0,
            htmlLength: htmlCaptured2.length,
            currentBuilding: window.currentBuilding,
            sitesInCurrentBuilding: window.sitesGroupedByBuilding[window.currentBuilding]?.length || 0
          });
        }, 1000);
      });
    });

    console.log('修改後渲染結果:', modifiedRenderTest);

    // 3. 檢查 renderFloorGrid 函數內部的執行路徑
    console.log('\n📋 測試3: 追蹤函數執行路徑');
    const executionTrace = await page.evaluate(() => {
      // 覆寫 renderFloorGrid 來添加詳細日誌
      const originalRenderFloorGrid = window.renderFloorGrid;
      
      window.renderFloorGrid = function() {
        console.log('🚀 renderFloorGrid 開始執行');
        
        const gridContent = document.getElementById('gridContent');
        if (!gridContent) {
          console.log('❌ gridContent 元素不存在');
          return;
        }
        console.log('✅ gridContent 元素找到');

        // 設置載入狀態
        gridContent.style.opacity = '0.5';
        gridContent.style.pointerEvents = 'none';
        console.log('✅ 設置載入狀態完成');

        // requestAnimationFrame 內的邏輯
        requestAnimationFrame(() => {
          console.log('🎬 requestAnimationFrame 執行');
          
          const currentBuilding = window.currentBuilding || 'A';
          const sites = window.sitesGroupedByBuilding[currentBuilding] || [];
          
          console.log('📍 當前建築物:', currentBuilding);
          console.log('📊 案場數量:', sites.length);
          
          if (sites.length === 0) {
            console.log('❌ 案場數量為0，設置錯誤訊息');
            gridContent.innerHTML = '<div class="error-message">此棟別暫無案場資料</div>';
            gridContent.style.opacity = '1';
            gridContent.style.pointerEvents = 'auto';
            return;
          }
          
          console.log('✅ 開始生成表格HTML');
          // 調用原始函數的主要邏輯...
        });
      };

      // 調用新的函數
      window.renderFloorGrid();

      return { traced: true };
    });

    console.log('執行路徑追蹤:', executionTrace);

    // 等待執行完成
    await page.waitForTimeout(3000);

    console.log('\n🎯 診斷結論:');
    
    if (normalRenderTest.htmlGenerated && !modifiedRenderTest.htmlGenerated) {
      console.log('❌ 問題出現在資料修改後');
      console.log('💡 可能原因: groupSitesByBuilding 函數破壞了資料結構');
    } else if (!normalRenderTest.htmlGenerated) {
      console.log('❌ 基本渲染都有問題');
      console.log('💡 可能原因: 部署問題或基礎環境異常');
    } else {
      console.log('✅ 渲染邏輯正常，問題可能在其他地方');
    }

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ 診斷失敗:', error.message);
  } finally {
    await browser.close();
  }
}

diagnoseRenderIssue().catch(console.error);