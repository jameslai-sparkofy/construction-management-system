const { chromium } = require('playwright');

async function startProjectCreationTest() {
  console.log('🚀 啟動新建專案測試 - Debug 模式');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000  // 每個操作間隔1秒，方便觀察
  });
  const page = await browser.newPage();
  
  try {
    console.log('步驟 1: 登入開發環境...');
    await page.goto('https://construction-management-frontend-dev.pages.dev/login-simple.html');
    await page.waitForLoadState('networkidle');
    
    // 自動登入
    const phoneInput = await page.$('input[type="tel"], input[name="phone"], #phone');
    const passwordInput = await page.$('input[type="password"], input[name="password"], #password');
    const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("登入")');
    
    if (phoneInput && passwordInput && submitButton) {
      await phoneInput.fill('0912345678');
      await passwordInput.fill('678');
      await submitButton.click();
      
      console.log('✅ 已提交登入資料，等待跳轉...');
      await page.waitForTimeout(3000);
    }
    
    // 檢查是否成功跳轉到專案列表
    if (page.url().includes('project-list')) {
      console.log('✅ 登入成功，已跳轉到專案列表');
      
      console.log('步驟 2: 尋找新建專案按鈕...');
      
      // 尋找新建專案按鈕
      const createProjectButton = await page.$('button:has-text("建立新專案"), button:has-text("新建專案"), button:has-text("+ 建立"), .create-project-btn, #create-project');
      
      if (createProjectButton) {
        console.log('✅ 找到新建專案按鈕');
        await createProjectButton.scrollIntoViewIfNeeded();
        await createProjectButton.click();
        console.log('✅ 已點擊新建專案按鈕');
        
        await page.waitForTimeout(2000);
        console.log('當前 URL:', page.url());
      } else {
        console.log('⚠️ 未找到新建專案按鈕，讓我搜尋所有可能的按鈕...');
        
        // 搜尋所有按鈕
        const buttons = await page.$$eval('button, a', elements => 
          elements.map(el => ({
            text: el.textContent.trim(),
            className: el.className,
            id: el.id
          })).filter(btn => btn.text.length > 0)
        );
        
        console.log('頁面上的所有按鈕:', buttons);
      }
    } else {
      console.log('⚠️ 登入可能失敗，當前 URL:', page.url());
    }
    
    console.log('\n📋 Debug 模式已啟動');
    console.log('瀏覽器將保持開啟，等待下一步指示...');
    console.log('輸入 "next" 繼續下一步，或輸入其他指令：');
    
    // 保持程式運行，等待用戶輸入
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (input) => {
      const command = input.toString().trim();
      
      if (command === 'next') {
        console.log('繼續下一步...');
        await debugNextStep(page);
      } else if (command === 'screenshot') {
        console.log('保存截圖...');
        await page.screenshot({ path: `debug-${Date.now()}.png`, fullPage: true });
        console.log('✅ 截圖已保存');
      } else if (command === 'url') {
        console.log('當前 URL:', page.url());
      } else if (command === 'title') {
        console.log('頁面標題:', await page.title());
      } else if (command === 'close') {
        console.log('關閉瀏覽器...');
        await browser.close();
        process.exit(0);
      } else if (command.startsWith('click ')) {
        const selector = command.substring(6);
        try {
          await page.click(selector);
          console.log(`✅ 已點擊: ${selector}`);
        } catch (error) {
          console.log(`❌ 點擊失敗: ${error.message}`);
        }
      } else {
        console.log('可用指令:');
        console.log('  next - 繼續下一步');
        console.log('  screenshot - 保存截圖');
        console.log('  url - 顯示當前URL');
        console.log('  title - 顯示頁面標題');
        console.log('  click <selector> - 點擊元素');
        console.log('  close - 關閉瀏覽器');
      }
    });
    
  } catch (error) {
    console.error('❌ 測試發生錯誤:', error);
    await page.screenshot({ path: 'debug-error.png' });
  }
}

async function debugNextStep(page) {
  console.log('檢查當前頁面狀態...');
  
  // 檢查是否在新建專案頁面
  if (page.url().includes('project-create') || page.url().includes('create')) {
    console.log('✅ 已在新建專案頁面');
    await analyzeCreateProjectForm(page);
  } else {
    console.log('當前頁面:', page.url());
    console.log('尋找新建專案相關元素...');
    
    const createElements = await page.$$eval('*', elements => 
      elements.filter(el => 
        el.textContent && (
          el.textContent.includes('建立') || 
          el.textContent.includes('新建') || 
          el.textContent.includes('創建') ||
          el.textContent.includes('+')
        )
      ).map(el => ({
        tagName: el.tagName,
        text: el.textContent.trim(),
        className: el.className,
        id: el.id
      }))
    );
    
    console.log('找到的建立相關元素:', createElements);
  }
}

async function analyzeCreateProjectForm(page) {
  console.log('分析新建專案表單...');
  
  const formElements = await page.$$eval('input, select, textarea, button', elements =>
    elements.map(el => ({
      tagName: el.tagName,
      type: el.type || 'N/A',
      name: el.name || 'N/A',
      placeholder: el.placeholder || 'N/A',
      id: el.id || 'N/A',
      className: el.className || 'N/A',
      text: el.textContent?.trim() || 'N/A'
    }))
  );
  
  console.log('表單元素:', formElements);
  
  await page.screenshot({ path: 'create-project-form.png', fullPage: true });
  console.log('✅ 已保存表單截圖');
}

startProjectCreationTest();