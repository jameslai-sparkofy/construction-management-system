const { chromium } = require('playwright');

async function testIconWithMockData() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🧪 使用模擬資料測試通知圖示功能...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待載入完成
    await page.waitForTimeout(6000);

    // 注入測試資料
    const injectionResult = await page.evaluate(() => {
      if (!window.currentSites || window.currentSites.length === 0) {
        return { error: 'No currentSites data available' };
      }

      console.log('🔧 開始注入測試資料...');

      // 修改前3個案場：添加施工前備註並設為未完工
      for (let i = 0; i < 3 && i < window.currentSites.length; i++) {
        const site = window.currentSites[i];
        
        // 添加施工前備註
        site.field_sF6fn__c = `測試備註 ${i + 1}: 需要注意地面不平整`;
        
        // 設為未完工
        site.construction_completed__c = false;
        
        console.log(`✅ 修改案場 ${i + 1}: ${site.name}`);
        console.log(`   施工前備註: ${site.field_sF6fn__c}`);
        console.log(`   完工狀態: ${site.construction_completed__c}`);
      }

      // 修改第4、5個案場：添加備註但保持已完工（不應顯示圖示）
      for (let i = 3; i < 5 && i < window.currentSites.length; i++) {
        const site = window.currentSites[i];
        site.field_sF6fn__c = `已完工案場備註 ${i + 1}`;
        // 保持 construction_completed__c = true
        
        console.log(`✅ 修改案場 ${i + 1}: ${site.name} (已完工，不應顯示圖示)`);
      }

      return { success: true };
    });

    if (injectionResult.error) {
      console.log('❌ 注入失敗:', injectionResult.error);
      return;
    }

    console.log('✅ 測試資料注入完成\n');

    // 重新渲染表格
    await page.evaluate(() => {
      if (typeof renderFloorGrid === 'function') {
        renderFloorGrid();
      }
    });

    // 等待渲染完成
    await page.waitForTimeout(2000);

    // 檢查通知圖示
    const testResult = await page.evaluate(() => {
      const gridCells = document.querySelectorAll('.grid-cell');
      const results = {
        totalCells: gridCells.length,
        cellsWithIcons: 0,
        iconDetails: [],
        cellsWithoutIcons: 0
      };

      Array.from(gridCells).forEach((cell, index) => {
        const notificationIcon = cell.querySelector('.notification-icon');
        const cellContent = cell.querySelector('.cell-content');
        const hasContent = cellContent && cellContent.textContent.trim() !== '';
        
        if (hasContent) {
          if (notificationIcon) {
            results.cellsWithIcons++;
            const styles = window.getComputedStyle(notificationIcon);
            results.iconDetails.push({
              cellIndex: index,
              cellText: cellContent.textContent.trim(),
              iconText: notificationIcon.textContent,
              iconTitle: notificationIcon.title,
              backgroundColor: styles.backgroundColor,
              borderRadius: styles.borderRadius,
              position: styles.position,
              width: styles.width,
              height: styles.height
            });
          } else {
            results.cellsWithoutIcons++;
          }
        }
      });

      return results;
    });

    console.log('📊 測試結果:\n');
    console.log(`總表格單元格數: ${testResult.totalCells}`);
    console.log(`有通知圖示的單元格: ${testResult.cellsWithIcons}`);
    console.log(`無通知圖示的單元格: ${testResult.cellsWithoutIcons}\n`);

    if (testResult.cellsWithIcons > 0) {
      console.log('🔸 通知圖示詳細資訊:');
      testResult.iconDetails.forEach((icon, i) => {
        console.log(`   ${i+1}. 圖示 ${icon.cellIndex + 1}:`);
        console.log(`      單元格內容: "${icon.cellText}"`);
        console.log(`      圖示文字: "${icon.iconText}"`);
        console.log(`      提示訊息: "${icon.iconTitle}"`);
        console.log(`      樣式: ${icon.backgroundColor}, ${icon.borderRadius}, ${icon.width}×${icon.height}`);
        console.log('');
      });
      
      console.log('✅ 通知圖示功能測試成功！');
      console.log(`✅ 應該有 3 個圖示，實際有 ${testResult.cellsWithIcons} 個`);
    } else {
      console.log('❌ 未發現通知圖示');
      console.log('❌ 功能可能存在問題，需要進一步調試');
    }

    // 檢查 console 錯誤
    const consoleErrors = await page.evaluate(() => {
      return window.lastErrors || [];
    });

    if (consoleErrors.length > 0) {
      console.log('\n⚠️ Console 錯誤:');
      consoleErrors.forEach(error => {
        console.log(`   ${error}`);
      });
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

testIconWithMockData().catch(console.error);