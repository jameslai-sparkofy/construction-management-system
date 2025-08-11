const { test, expect } = require('@playwright/test');

test.describe('專案詳情頁面按鈕測試', () => {
    const projectId = '650fe201d184e50001102aee';
    const baseUrl = 'file:///mnt/c/claude/工程管理/frontend';
    
    test.beforeEach(async ({ page }) => {
        // Navigate to project detail page
        await page.goto(`${baseUrl}/project-detail.html?id=${projectId}`);
        await page.waitForLoadState('networkidle');
    });
    
    test('報表按鈕顯示權限提示', async ({ page }) => {
        // Click report button
        await page.click('.btn-report');
        
        // Check permission alert appears
        await expect(page.locator('#permissionAlertModal')).toBeVisible();
        await expect(page.locator('#permissionMessage')).toContainText('報表功能');
        
        // Close alert
        await page.click('button:has-text("確定")');
        await expect(page.locator('#permissionAlertModal')).toBeHidden();
    });
    
    test('匯出按鈕顯示權限提示', async ({ page }) => {
        // Click export button
        await page.click('.btn-export');
        
        // Check permission alert appears
        await expect(page.locator('#permissionAlertModal')).toBeVisible();
        await expect(page.locator('#permissionMessage')).toContainText('匯出功能');
        
        // Close alert
        await page.click('button:has-text("確定")');
        await expect(page.locator('#permissionAlertModal')).toBeHidden();
    });
    
    test('設定按鈕跳轉到編輯頁面', async ({ page }) => {
        // Click settings button
        await page.click('.btn-settings');
        
        // Check navigation to edit page
        await page.waitForURL(/project-create-v2\.html.*mode=edit.*step=4/);
        
        // Check edit mode UI
        await expect(page.locator('.header h1')).toContainText('編輯專案設定');
        await expect(page.locator('#step4-submit')).toContainText('儲存設定');
        
        // Check step 4 is active
        await expect(page.locator('#step4-content')).toBeVisible();
    });
    
    test('分頁 URL 測試 - SPC工程', async ({ page }) => {
        // SPC tab should be active by default
        await expect(page.locator('.nav-tab[data-tab="spc"]')).toHaveClass(/active/);
        
        // Check URL has tab parameter
        const url = page.url();
        expect(url).toContain('tab=spc');
    });
    
    test('分頁 URL 測試 - 浴櫃工程', async ({ page }) => {
        // Click cabinet tab
        await page.click('.nav-tab[data-tab="cabinet"]');
        
        // Check URL updated
        await page.waitForFunction(() => window.location.href.includes('tab=cabinet'));
        
        // Check tab is active
        await expect(page.locator('.nav-tab[data-tab="cabinet"]')).toHaveClass(/active/);
        
        // Check content changed
        await expect(page.locator('#gridContent')).toContainText('本專案未包含浴櫃工程服務');
    });
    
    test('分頁 URL 測試 - 維修單', async ({ page }) => {
        // Click maintenance tab
        await page.click('.nav-tab[data-tab="maintenance"]');
        
        // Check URL updated
        await page.waitForFunction(() => window.location.href.includes('tab=maintenance'));
        
        // Check tab is active
        await expect(page.locator('.nav-tab[data-tab="maintenance"]')).toHaveClass(/active/);
        
        // Check content changed
        await expect(page.locator('#gridContent')).toContainText('維修單管理');
    });
    
    test('分頁 URL 測試 - 進度公告', async ({ page }) => {
        // Click announcements tab
        await page.click('.nav-tab[data-tab="announcements"]');
        
        // Check URL updated
        await page.waitForFunction(() => window.location.href.includes('tab=announcements'));
        
        // Check tab is active
        await expect(page.locator('.nav-tab[data-tab="announcements"]')).toHaveClass(/active/);
    });
    
    test('直接連結到特定分頁', async ({ page }) => {
        // Navigate directly to maintenance tab
        await page.goto(`${baseUrl}/project-detail.html?id=${projectId}&tab=maintenance`);
        await page.waitForLoadState('networkidle');
        
        // Check maintenance tab is active
        await expect(page.locator('.nav-tab[data-tab="maintenance"]')).toHaveClass(/active/);
        await expect(page.locator('#gridContent')).toContainText('維修單管理');
    });
});