const { chromium } = require('playwright');

async function debugRenderProcess() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔧 調試渲染過程和通知圖示邏輯...\n');
    
    await page.goto('https://construction-management-frontend-dev.pages.dev/');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'dev-token-for-testing');
    });

    await page.goto('https://construction-management-frontend-dev.pages.dev/project-detail.html?id=proj_1755824357367');
    
    // 等待載入完成
    await page.waitForTimeout(6000);

    // 調試渲染過程
    const debugResult = await page.evaluate(() => {
      // 檢查 renderFloorGrid 函數是否存在
      const hasRenderFloorGrid = typeof renderFloorGrid === 'function';
      
      if (!hasRenderFloorGrid) {
        return { error: 'renderFloorGrid function not found' };
      }

      // 檢查 currentSites 和建築物資料
      const hasSites = window.currentSites && window.currentSites.length > 0;
      const currentBuilding = window.currentBuilding || 'unknown';
      const sitesGrouped = window.sitesGroupedByBuilding && window.sitesGroupedByBuilding[currentBuilding];

      // 手動添加測試資料
      if (hasSites && window.currentSites.length > 0) {
        console.log('🔧 正在修改測試資料...');
        
        // 找到第一個案場並修改
        const firstSite = window.currentSites[0];
        firstSite.field_sF6fn__c = '這是測試施工前備註';
        firstSite.construction_completed__c = false;
        
        console.log('修改後的案場資料:');
        console.log(`  案場名稱: ${firstSite.name}`);
        console.log(`  施工前備註: ${firstSite.field_sF6fn__c}`);
        console.log(`  完工狀態: ${firstSite.construction_completed__c}`);
        
        // 重新分組資料
        if (typeof groupSitesByBuilding === 'function') {
          groupSitesByBuilding();
        }
      }

      return {
        success: true,
        hasRenderFloorGrid,
        hasSites,
        sitesCount: window.currentSites ? window.currentSites.length : 0,
        currentBuilding,
        hasSitesGrouped: !!sitesGrouped,
        sitesInCurrentBuilding: sitesGrouped ? sitesGrouped.length : 0
      };
    });

    if (debugResult.error) {
      console.log('❌ 錯誤:', debugResult.error);
      return;
    }

    console.log('📊 渲染環境檢查:');
    console.log(`renderFloorGrid函數存在: ${debugResult.hasRenderFloorGrid}`);
    console.log(`有案場資料: ${debugResult.hasSites}`);
    console.log(`案場總數: ${debugResult.sitesCount}`);
    console.log(`當前建築物: ${debugResult.currentBuilding}`);
    console.log(`建築物案場數: ${debugResult.sitesInCurrentBuilding}\n`);

    // 手動調用 renderFloorGrid 並監控過程
    const renderResult = await page.evaluate(() => {
      // 監控渲染過程
      console.log('🎯 開始手動渲染...');
      
      // 覆寫 renderFloorGrid 來添加調試資訊
      const originalRenderFloorGrid = renderFloorGrid;
      window.renderFloorGrid = function() {
        console.log('🔄 renderFloorGrid 被調用');
        
        const gridContent = document.getElementById('gridContent');
        if (!gridContent) {
          console.log('❌ gridContent 元素不存在');
          return;
        }

        const sites = window.sitesGroupedByBuilding[window.currentBuilding] || [];
        console.log(`📋 當前建築物案場數: ${sites.length}`);
        
        if (sites.length === 0) {
          console.log('❌ 當前建築物無案場資料');
          return;
        }

        // 檢查前幾個案場的備註資料
        sites.slice(0, 3).forEach((site, i) => {
          const beforeNotes = site.field_sF6fn__c || '';
          const isCompleted = site.construction_completed__c;
          const shouldShowIcon = beforeNotes && beforeNotes.trim() !== '' && !isCompleted;
          
          console.log(`案場 ${i + 1}: ${site.name}`);
          console.log(`  備註: "${beforeNotes}"`);
          console.log(`  完工: ${isCompleted}`);
          console.log(`  應顯示圖示: ${shouldShowIcon}`);
        });

        // 調用原始函數
        return originalRenderFloorGrid.call(this);
      };

      // 調用渲染函數
      try {
        renderFloorGrid();
        return { success: true };
      } catch (e) {
        return { error: e.message, stack: e.stack };
      }
    });

    if (renderResult.error) {
      console.log('❌ 渲染失敗:', renderResult.error);
      console.log('堆疊:', renderResult.stack);
    } else {
      console.log('✅ 渲染完成');
    }

    // 等待渲染完成
    await page.waitForTimeout(3000);

    // 最終檢查通知圖示
    const finalCheck = await page.evaluate(() => {
      const icons = document.querySelectorAll('.notification-icon');
      const cells = document.querySelectorAll('.grid-cell');
      
      const iconData = Array.from(icons).map((icon, i) => ({
        index: i,
        text: icon.textContent,
        title: icon.title,
        visible: icon.offsetHeight > 0 && icon.offsetWidth > 0
      }));

      return {
        iconCount: icons.length,
        cellCount: cells.length,
        iconData: iconData
      };
    });

    console.log('\n📊 最終檢查結果:');
    console.log(`通知圖示數量: ${finalCheck.iconCount}`);
    console.log(`表格單元格數量: ${finalCheck.cellCount}`);
    
    if (finalCheck.iconCount > 0) {
      console.log('✅ 找到通知圖示！');
      finalCheck.iconData.forEach((icon, i) => {
        console.log(`  圖示 ${i + 1}: "${icon.text}" (可見: ${icon.visible})`);
      });
    } else {
      console.log('❌ 仍然沒有通知圖示');
    }

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
  } finally {
    await browser.close();
  }
}

debugRenderProcess().catch(console.error);