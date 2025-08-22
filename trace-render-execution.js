const { chromium } = require('playwright');

async function traceRenderExecution() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('📋 追蹤 renderFloorGrid 執行過程...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    await page.waitForTimeout(6000);

    const traceResult = await page.evaluate(() => {
      // 設置測試環境
      const testSite = window.currentSites[0];
      testSite.field_sF6fn__c = '重要施工前備註';
      testSite.construction_completed__c = false;

      if (typeof groupSitesByBuilding === 'function') {
        groupSitesByBuilding();
      }
      window.currentBuilding = 'C';

      // 攔截 innerHTML 設置
      const gridContent = document.getElementById('gridContent');
      let capturedHTML = '';
      
      const originalSetInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
      Object.defineProperty(gridContent, 'innerHTML', {
        set: function(value) {
          capturedHTML = value;
          console.log('捕獲到的 HTML 長度:', value.length);
          console.log('包含 notification-icon:', value.includes('notification-icon'));
          
          // 搜尋測試案場的 HTML
          const testSiteId = testSite._id;
          const siteHtmlRegex = new RegExp(`onclick="openSiteModal\\('${testSiteId}'\\)"[^>]*>([\\s\\S]*?)</td>`, 'g');
          const match = siteHtmlRegex.exec(value);
          if (match) {
            console.log('找到測試案場的 HTML:');
            console.log(match[1]);
          }
          
          originalSetInnerHTML.call(this, value);
        }
      });

      // 調用渲染函數
      if (typeof renderFloorGrid === 'function') {
        renderFloorGrid();
      }

      return {
        success: true,
        capturedHTML: capturedHTML,
        hasNotificationIcon: capturedHTML.includes('notification-icon'),
        testSiteId: testSite._id,
        testSiteName: testSite.name,
        htmlLength: capturedHTML.length
      };
    });

    console.log('📊 追蹤結果:');
    console.log(`HTML 捕獲成功: ${traceResult.success}`);
    console.log(`HTML 長度: ${traceResult.htmlLength}`);
    console.log(`包含 notification-icon: ${traceResult.hasNotificationIcon}`);
    console.log(`測試案場: ${traceResult.testSiteName} (${traceResult.testSiteId})`);

    if (traceResult.hasNotificationIcon) {
      console.log('\n✅ renderFloorGrid 確實生成了 notification-icon！');
      console.log('🎉 通知圖示功能正常工作');
      
      // 檢查最終 DOM 狀態
      const finalCheck = await page.evaluate(() => {
        return {
          iconCount: document.querySelectorAll('.notification-icon').length,
          iconVisible: Array.from(document.querySelectorAll('.notification-icon')).some(icon => 
            icon.offsetHeight > 0 && icon.offsetWidth > 0)
        };
      });
      
      console.log(`最終 DOM 中的圖示數量: ${finalCheck.iconCount}`);
      console.log(`圖示可見: ${finalCheck.iconVisible}`);
      
    } else {
      console.log('\n❌ renderFloorGrid 沒有生成 notification-icon');
      
      // 檢查 HTML 片段
      const htmlSample = traceResult.capturedHTML.substring(0, 1000);
      console.log('\nHTML 範例 (前 1000 字元):');
      console.log(htmlSample);
    }

    // 讓用戶看到結果
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ 追蹤失敗:', error.message);
  } finally {
    await browser.close();
  }
}

traceRenderExecution().catch(console.error);