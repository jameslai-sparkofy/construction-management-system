const { chromium } = require('playwright');

async function testNotificationIcon() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 測試施工前備註通知圖示功能...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待載入完成
    await page.waitForTimeout(6000);

    // 檢查通知圖示功能
    const iconTestResult = await page.evaluate(() => {
      const gridCells = document.querySelectorAll('.grid-cell');
      const results = {
        totalCells: gridCells.length,
        cellsWithIcons: 0,
        iconExamples: [],
        cellsWithoutIcons: 0,
        errorCells: []
      };

      Array.from(gridCells).forEach((cell, index) => {
        try {
          const notificationIcon = cell.querySelector('.notification-icon');
          const cellContent = cell.querySelector('.cell-content');
          const hasContent = cellContent && cellContent.textContent.trim() !== '';
          
          if (hasContent) {
            if (notificationIcon) {
              results.cellsWithIcons++;
              results.iconExamples.push({
                index: index,
                cellText: cellContent.textContent.trim().substring(0, 20),
                iconText: notificationIcon.textContent,
                iconTitle: notificationIcon.title || 'no-title',
                isCompleted: cell.classList.contains('completed')
              });
            } else {
              results.cellsWithoutIcons++;
            }
          }
        } catch (e) {
          results.errorCells.push(`Cell ${index}: ${e.message}`);
        }
      });

      return results;
    });

    console.log('📊 通知圖示測試結果:\n');
    console.log(`總表格單元格數: ${iconTestResult.totalCells}`);
    console.log(`有通知圖示的單元格: ${iconTestResult.cellsWithIcons}`);
    console.log(`無通知圖示的單元格: ${iconTestResult.cellsWithoutIcons}`);
    
    if (iconTestResult.iconExamples.length > 0) {
      console.log('\n🔸 通知圖示範例:');
      iconTestResult.iconExamples.slice(0, 5).forEach((example, i) => {
        console.log(`   ${i+1}. 單元格內容: "${example.cellText}"`);
        console.log(`      圖示文字: "${example.iconText}"`);
        console.log(`      提示訊息: "${example.iconTitle}"`);
        console.log(`      是否已完工: ${example.isCompleted}`);
        console.log('');
      });
    } else {
      console.log('\n❌ 未發現任何通知圖示');
    }

    if (iconTestResult.errorCells.length > 0) {
      console.log('\n⚠️ 錯誤單元格:');
      iconTestResult.errorCells.forEach(error => {
        console.log(`   ${error}`);
      });
    }

    // 檢查 CSS 樣式是否正確載入
    const cssTest = await page.evaluate(() => {
      const testIcon = document.querySelector('.notification-icon');
      if (!testIcon) return { hasIcon: false };

      const styles = window.getComputedStyle(testIcon);
      return {
        hasIcon: true,
        position: styles.position,
        backgroundColor: styles.backgroundColor,
        borderRadius: styles.borderRadius,
        width: styles.width,
        height: styles.height,
        zIndex: styles.zIndex
      };
    });

    console.log('\n🎨 CSS 樣式檢查:');
    if (cssTest.hasIcon) {
      console.log('✅ 通知圖示樣式已載入');
      console.log(`   位置: ${cssTest.position}`);
      console.log(`   背景色: ${cssTest.backgroundColor}`);
      console.log(`   圓角: ${cssTest.borderRadius}`);
      console.log(`   尺寸: ${cssTest.width} × ${cssTest.height}`);
      console.log(`   層級: ${cssTest.zIndex}`);
    } else {
      console.log('❌ 無通知圖示樣式');
    }

    // 診斷
    console.log('\n🎯 功能診斷:');
    if (iconTestResult.cellsWithIcons > 0) {
      console.log('✅ 通知圖示功能運作正常');
      console.log(`✅ 發現 ${iconTestResult.cellsWithIcons} 個案場有施工前備註`);
    } else {
      console.log('⚠️ 未發現通知圖示，可能原因:');
      console.log('   1. 測試案場資料中沒有施工前備註');
      console.log('   2. 所有有備註的案場都已完工');
      console.log('   3. 資料欄位對應錯誤');
      console.log('   4. JavaScript 執行錯誤');
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

testNotificationIcon().catch(console.error);