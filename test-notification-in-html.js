const { chromium } = require('playwright');

async function testNotificationInHtml() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🎯 正確測試通知圖示是否包含在生成的HTML中...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    await page.waitForTimeout(6000);

    const testResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        // 1. 修改測試資料
        if (!window.currentSites || window.currentSites.length === 0) {
          resolve({ error: 'No sites data' });
          return;
        }

        // 找到當前建築物的案場並修改
        const currentBuilding = window.currentBuilding || 'A';
        const sitesInCurrentBuilding = window.sitesGroupedByBuilding[currentBuilding] || [];
        
        if (sitesInCurrentBuilding.length === 0) {
          resolve({ error: 'No sites in current building' });
          return;
        }

        // 修改前3個案場
        const testSites = sitesInCurrentBuilding.slice(0, 3);
        testSites.forEach((site, index) => {
          site.field_sF6fn__c = `重要施工前備註 ${index + 1}`;
          site.construction_completed__c = false;
          console.log(`✅ 修改案場 ${index + 1}: ${site.name}`);
        });

        console.log('📊 測試資料設置完成');

        // 2. 攔截HTML生成
        let capturedHtml = '';
        const gridContent = document.getElementById('gridContent');
        
        const originalSetter = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
        Object.defineProperty(gridContent, 'innerHTML', {
          set: function(value) {
            capturedHtml = value;
            console.log('📝 捕獲HTML，長度:', value.length);
            
            // 立即檢查HTML內容
            const hasNotificationIcon = value.includes('notification-icon');
            const hasWarningSymbol = value.includes('⚠');
            const hasBeforeNotesTitle = value.includes('有施工前備註');
            
            console.log('📝 包含 notification-icon:', hasNotificationIcon);
            console.log('📝 包含 ⚠ 符號:', hasWarningSymbol);
            console.log('📝 包含備註標題:', hasBeforeNotesTitle);
            
            // 搜尋包含通知圖示的片段
            if (hasNotificationIcon) {
              const iconMatches = value.match(/<div class="notification-icon"[^>]*>.*?<\/div>/g);
              console.log('📝 找到', iconMatches ? iconMatches.length : 0, '個通知圖示');
              if (iconMatches) {
                iconMatches.slice(0, 2).forEach((match, i) => {
                  console.log(`   圖示 ${i+1}:`, match);
                });
              }
            }
            
            originalSetter.call(this, value);
          },
          configurable: true
        });

        // 3. 調用渲染函數
        if (typeof renderFloorGrid === 'function') {
          renderFloorGrid();
        }

        // 4. 等待渲染完成並檢查結果
        setTimeout(() => {
          const finalIcons = document.querySelectorAll('.notification-icon');
          const visibleIcons = Array.from(finalIcons).filter(icon => 
            icon.offsetHeight > 0 && icon.offsetWidth > 0
          );

          resolve({
            success: true,
            currentBuilding: currentBuilding,
            sitesInBuilding: sitesInCurrentBuilding.length,
            testSitesModified: testSites.length,
            capturedHtmlLength: capturedHtml.length,
            htmlContainsNotificationIcon: capturedHtml.includes('notification-icon'),
            htmlContainsWarningSymbol: capturedHtml.includes('⚠'),
            finalIconsInDom: finalIcons.length,
            visibleIconsCount: visibleIcons.length,
            sampleHtml: capturedHtml.substring(0, 1000) + '...'
          });
        }, 2000);
      });
    });

    console.log('📊 測試結果:');
    
    if (testResult.error) {
      console.log('❌ 錯誤:', testResult.error);
      return;
    }

    console.log(`當前建築物: ${testResult.currentBuilding}`);
    console.log(`建築物內案場數: ${testResult.sitesInBuilding}`);
    console.log(`修改的測試案場數: ${testResult.testSitesModified}`);
    console.log(`生成的HTML長度: ${testResult.capturedHtmlLength}`);
    console.log(`HTML包含notification-icon: ${testResult.htmlContainsNotificationIcon ? '✅' : '❌'}`);
    console.log(`HTML包含⚠符號: ${testResult.htmlContainsWarningSymbol ? '✅' : '❌'}`);
    console.log(`DOM中圖示總數: ${testResult.finalIconsInDom}`);
    console.log(`可見圖示數量: ${testResult.visibleIconsCount}`);

    console.log('\n🎯 最終結論:');
    if (testResult.visibleIconsCount > 0) {
      console.log('🎉 SUCCESS! 通知圖示功能完全正常！');
      console.log(`✅ 成功顯示 ${testResult.visibleIconsCount} 個可見的通知圖示`);
    } else if (testResult.htmlContainsNotificationIcon) {
      console.log('🔧 HTML包含圖示但DOM中不可見');
      console.log('💡 可能是CSS樣式或DOM操作問題');
    } else {
      console.log('❌ HTML中沒有生成通知圖示');
      console.log('💡 通知圖示的生成邏輯有問題');
      
      console.log('\n📄 HTML範例:');
      console.log(testResult.sampleHtml);
    }

    // 讓用戶看到最終結果
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

testNotificationInHtml().catch(console.error);