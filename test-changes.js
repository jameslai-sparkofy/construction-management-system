const puppeteer = require('puppeteer');

async function testChanges() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        console.log('開始測試網站變更...\n');

        // Test 1: 專案列表頁面
        console.log('測試 1: 檢查專案列表頁面是否使用表格佈局');
        await page.goto('https://construction-management-frontend.pages.dev/project-list.html', {
            waitUntil: 'networkidle2'
        });

        // Check for table elements
        const hasTable = await page.evaluate(() => {
            const table = document.querySelector('.projects-table');
            const thead = document.querySelector('.projects-table thead');
            const tbody = document.querySelector('#projectsTableBody');
            return {
                hasTable: Boolean(table),
                hasThead: Boolean(thead),
                hasTbody: Boolean(tbody),
                headers: thead ? Array.from(thead.querySelectorAll('th')).map(th => th.textContent.trim()) : []
            };
        });

        console.log('專案列表頁面結果:');
        console.log('- 有表格元素:', hasTable.hasTable);
        console.log('- 表格標題:', hasTable.headers.join(', '));

        // Check for delete functionality
        const hasDeleteModal = await page.evaluate(() => {
            return Boolean(document.querySelector('#deleteModal'));
        });
        console.log('- 有刪除功能:', hasDeleteModal);

        // Test 2: 專案建立頁面
        console.log('\n測試 2: 檢查專案建立頁面步驟1是否使用表格佈局');
        await page.goto('https://construction-management-frontend.pages.dev/project-create-v2.html', {
            waitUntil: 'networkidle2'
        });

        // Check for search functionality in step 1
        const hasSearchInStep1 = await page.evaluate(() => {
            const searchInput = document.querySelector('#opportunitySearch');
            const table = document.querySelector('#opportunities-table');
            return {
                hasSearchInput: Boolean(searchInput),
                hasTable: Boolean(table),
                searchPlaceholder: searchInput ? searchInput.placeholder : null
            };
        });

        console.log('專案建立頁面步驟1結果:');
        console.log('- 有搜尋輸入框:', hasSearchInStep1.hasSearchInput);
        console.log('- 搜尋提示文字:', hasSearchInStep1.searchPlaceholder);
        console.log('- 有表格佈局:', hasSearchInStep1.hasTable);

        console.log('\n測試完成！');

    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
    } finally {
        await browser.close();
    }
}

testChanges();
