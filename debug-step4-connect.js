const { chromium } = require('playwright');

async function debugStep4() {
  console.log('🔍 連接到現有瀏覽器調試第四步問題');
  
  try {
    // 嘗試連接到現有的瀏覽器
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // 導航到第四步
    await page.goto('https://construction-management-frontend-dev.pages.dev/project-create.html');
    await page.waitForLoadState('networkidle');
    
    console.log('🔐 自動登入...');
    // 檢查是否在登入頁面
    if (page.url().includes('login')) {
      const phoneInput = await page.$('input[type="tel"], input[name="phone"], #phone');
      const passwordInput = await page.$('input[type="password"], input[name="password"], #password');
      const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("登入")');
      
      if (phoneInput && passwordInput && submitButton) {
        await phoneInput.fill('0912345678');
        await passwordInput.fill('678');
        await submitButton.click();
        await page.waitForTimeout(3000);
      }
    }
    
    console.log('⚡ 執行調試腳本...');
    
    // 執行調試腳本
    const debugResults = await page.evaluate(() => {
      // 檢查第四步的狀態
      const step4Element = document.getElementById('step-4');
      const step4Content = document.getElementById('step-content-4');
      const submitButton = document.getElementById('step4-submit');
      
      const results = {
        currentStep: window.currentStep || 'unknown',
        step4Active: step4Element?.classList.contains('active'),
        step4ContentActive: step4Content?.classList.contains('active'),
        submitButtonExists: !!submitButton,
        submitButtonDisabled: submitButton?.disabled,
        submitButtonText: submitButton?.textContent,
        hasOnClick: !!submitButton?.onclick,
        selectedOpportunity: window.selectedOpportunity || null,
        selectedEngineeringTypes: window.selectedEngineeringTypes || [],
        engineeringStats: window.engineeringStats || {},
        configExists: !!window.CONFIG,
        authToken: !!localStorage.getItem('auth_token')
      };
      
      // 檢查是否有 JavaScript 錯誤
      results.consoleErrors = [];
      
      // 檢查 createProject 函數
      results.createProjectExists = typeof window.createProject === 'function';
      
      // 檢查表單元素
      const ownerSelect = document.getElementById('projectOwner');
      results.ownerSelectExists = !!ownerSelect;
      results.selectedOwners = ownerSelect ? Array.from(ownerSelect.selectedOptions).length : 0;
      
      return results;
    });
    
    console.log('🔍 調試結果:');
    console.log(JSON.stringify(debugResults, null, 2));
    
    // 如果不在第四步，導航到第四步
    if (!debugResults.step4Active) {
      console.log('📋 不在第四步，嘗試導航...');
      
      // 先選擇一個商機（模擬）
      await page.evaluate(() => {
        // 模擬選擇第一個商機
        const firstRadio = document.querySelector('input[name="opportunity"]');
        if (firstRadio) {
          firstRadio.click();
        }
        
        // 設置必要的全域變數
        window.selectedOpportunity = {
          id: 'test-opportunity-id',
          name: '測試商機',
          company: '測試公司'
        };
        
        window.selectedEngineeringTypes = ['SPC'];
        window.engineeringStats = {
          'SPC': {
            siteCount: 1,
            teamCount: 1,
            maintenanceCount: 0,
            announcementCount: 0
          }
        };
      });
      
      // 跳到第四步
      await page.evaluate(() => {
        if (typeof jumpToStep === 'function') {
          jumpToStep(4);
        }
      });
      
      await page.waitForTimeout(2000);
    }
    
    console.log('🧪 測試按鈕點擊...');
    
    // 測試點擊按鈕
    const clickResult = await page.evaluate(() => {
      const submitButton = document.getElementById('step4-submit');
      if (submitButton) {
        try {
          // 手動觸發點擊事件
          submitButton.click();
          return { success: true, message: '按鈕點擊成功' };
        } catch (error) {
          return { success: false, error: error.message };
        }
      } else {
        return { success: false, error: '找不到提交按鈕' };
      }
    });
    
    console.log('點擊結果:', clickResult);
    
    // 等待一下看是否有彈窗或錯誤
    await page.waitForTimeout(3000);
    
    // 最終截圖
    await page.screenshot({ path: 'debug-step4-final.png', fullPage: true });
    console.log('✅ 截圖已保存: debug-step4-final.png');
    
    console.log('\n🔍 調試完成，瀏覽器將保持開啟...');
    console.log('你現在可以手動檢查第四步的狀態');
    
    // 保持瀏覽器開啟
    setTimeout(() => {}, 300000); // 5分鐘後自動關閉
    
  } catch (error) {
    console.error('❌ 調試過程發生錯誤:', error);
  }
}

debugStep4();