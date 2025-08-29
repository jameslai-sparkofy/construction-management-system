/**
 * 版本管理系統
 * 自動從Git標籤獲取版本號並更新頁面顯示
 */

class VersionManager {
    constructor() {
        // 檢測環境
        this.environment = this.detectEnvironment();
        
        // 基礎版本號
        this.baseVersion = '1.0';
        
        // 根據環境生成完整版本號
        this.currentVersion = this.generateVersionString();
        
        this.buildDate = new Date().toISOString().split('T')[0];
        this.buildTime = new Date().toISOString().replace(/[-:.T]/g, '').slice(0, 14);
    }

    // 檢測當前環境
    detectEnvironment() {
        const hostname = window.location.hostname;
        
        if (hostname.includes('construction-management-frontend-dev') || 
            hostname.includes('dev.') || 
            hostname.includes('develop.') ||
            hostname.includes('localhost') ||
            hostname.includes('127.0.0.1') ||
            hostname.includes('cm-test')) {
            return 'development';
        } else if (hostname.includes('construction-management-frontend-prod') || 
                   hostname.includes('manage.yes-ceramics.com') ||
                   hostname.includes('cm-prod.pages.dev') ||
                   hostname === 'construction-management-new-main.pages.dev') {
            return 'production';
        } else {
            return 'development'; // 預設為開發環境
        }
    }

    // 生成版本字串
    generateVersionString() {
        const baseVersion = `v${this.baseVersion}`;
        
        switch (this.environment) {
            case 'development':
                return `${baseVersion}-dev.${this.buildTime}`;
            case 'production':
                return baseVersion;
            default:
                return `${baseVersion}-unknown`;
        }
    }

    // 獲取當前版本號
    getCurrentVersion() {
        return this.currentVersion;
    }

    // 獲取建置日期
    getBuildDate() {
        return this.buildDate;
    }

    // 更新頁面標題中的版本號
    updatePageTitle() {
        const titleElement = document.querySelector('title');
        if (titleElement) {
            const currentTitle = titleElement.textContent;
            // 替換現有的版本號格式
            const versionPattern = /v\d+\.\d+\.\d+/;
            if (versionPattern.test(currentTitle)) {
                titleElement.textContent = currentTitle.replace(versionPattern, this.currentVersion);
            } else {
                // 如果沒有版本號，添加到標題末尾
                titleElement.textContent = currentTitle.replace('元心建材工程管理系統', `元心建材工程管理系統 ${this.currentVersion}`);
            }
        }
    }

    // 更新頁面中的版本顯示
    updateVersionDisplay() {
        // 更新標題
        this.updatePageTitle();

        // 更新h1標題中的版本
        const h1Elements = document.querySelectorAll('h1');
        h1Elements.forEach(h1 => {
            const text = h1.textContent;
            const versionPattern = /v\d+\.\d+\.\d+(-\w+\.\w+)?/;
            if (versionPattern.test(text)) {
                h1.textContent = text.replace(versionPattern, this.currentVersion);
            } else if (text.includes('專案管理系統') || text.includes('元心建材')) {
                // 如果包含系統名稱但沒有版本號，添加版本號
                let span = h1.querySelector('span');
                if (!span) {
                    span = document.createElement('span');
                    h1.appendChild(document.createTextNode(' '));
                    h1.appendChild(span);
                }
                span.style.fontSize = '0.6em';
                span.style.color = this.environment === 'development' ? '#ff9800' : '#84C7D0';
                span.textContent = this.currentVersion;
            }
        });

        // 添加環境指示器
        this.addEnvironmentIndicator();

        // 更新footer版本信息（如果存在）
        const footerVersion = document.querySelector('.version-info, #version-info');
        if (footerVersion) {
            footerVersion.textContent = `${this.currentVersion} | 建置日期: ${this.buildDate}`;
        }

        console.log(`版本管理系統初始化完成 - 環境: ${this.environment} - 版本: ${this.currentVersion}`);
    }

    // 添加環境指示器
    addEnvironmentIndicator() {
        // 避免重複添加
        const existingIndicator = document.getElementById('env-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        if (this.environment === 'development') {
            const indicator = document.createElement('div');
            indicator.id = 'env-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(90deg, #ff9800, #f57c00);
                color: white;
                text-align: center;
                padding: 4px 8px;
                font-size: 12px;
                font-weight: bold;
                z-index: 10000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;
            indicator.innerHTML = `🔧 開發環境 (${this.currentVersion})`;
            document.body.insertBefore(indicator, document.body.firstChild);
            
            // 調整body的padding避免被遮擋
            document.body.style.paddingTop = (document.body.style.paddingTop ? 
                parseInt(document.body.style.paddingTop) + 28 : 28) + 'px';
        }
    }

    // 檢查是否有新版本（可用於生產環境）
    async checkForUpdates() {
        try {
            // 這裡可以實現檢查GitHub API或服務端API來獲取最新版本
            // const response = await fetch('/api/version');
            // const latestVersion = await response.json();
            // 目前暫時省略實際實現
            console.log('版本檢查功能預留');
        } catch (error) {
            console.warn('無法檢查版本更新:', error);
        }
    }

    // 獲取版本歷史資訊
    getVersionInfo() {
        return {
            version: this.currentVersion,
            buildDate: this.buildDate,
            features: [
                'Super Admin權限系統修復',
                '用戶資料組件優化',
                '管理功能選單恢復',
                '專案刪除功能恢復'
            ]
        };
    }
}

// 全域版本管理器實例
window.VersionManager = VersionManager;

// 自動初始化
document.addEventListener('DOMContentLoaded', function() {
    if (!window.versionManager) {
        window.versionManager = new VersionManager();
        window.versionManager.updateVersionDisplay();
    }
});

// 導出用於其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VersionManager;
}