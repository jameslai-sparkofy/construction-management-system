/**
 * Clerk 認證系統配置
 * 版本: v1.3.0
 * 更新日期: 2025-08-14
 */

// Clerk 配置
const CLERK_CONFIG = {
    // 測試環境 Keys
    development: {
        publishableKey: 'pk_test_YWJzb2x1dGUtY291Z2FyLTkwLmNsZXJrLmFjY291bnRzLmRldiQ',
        domain: 'absolute-cougar-90.clerk.accounts.dev',
        environment: 'test'
    },
    
    // 生產環境 Keys (需要更換為正式的)
    production: {
        publishableKey: 'pk_test_YWJzb2x1dGUtY291Z2FyLTkwLmNsZXJrLmFjY291bnRzLmRldiQ', // TODO: 更換為生產 key
        domain: 'absolute-cougar-90.clerk.accounts.dev', // TODO: 更換為生產 domain
        environment: 'production'
    }
};

// 根據當前環境選擇配置
const currentEnv = window.location.hostname.includes('prod') ? 'production' : 'development';
const CLERK_PUBLISHABLE_KEY = CLERK_CONFIG[currentEnv].publishableKey;
const CLERK_DOMAIN = CLERK_CONFIG[currentEnv].domain;

// Clerk 前端 API URL
const CLERK_FRONTEND_API = `https://${CLERK_DOMAIN}`;

// 初始化 Clerk
async function initializeClerk() {
    if (typeof window.Clerk === 'undefined') {
        console.error('Clerk SDK not loaded');
        return false;
    }
    
    try {
        await window.Clerk.load({
            publishableKey: CLERK_PUBLISHABLE_KEY,
            appearance: {
                elements: {
                    formButtonPrimary: {
                        backgroundColor: '#764ba2',
                        '&:hover': {
                            backgroundColor: '#667eea'
                        }
                    },
                    card: {
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }
                },
                variables: {
                    colorPrimary: '#764ba2',
                    colorTextOnPrimaryBackground: '#ffffff',
                    borderRadius: '0.5rem'
                },
                layout: {
                    socialButtonsPlacement: 'bottom',
                    socialButtonsVariant: 'iconButton'
                }
            },
            localization: {
                locale: 'zh-TW'
            }
        });
        
        console.log('✅ Clerk 初始化成功');
        return true;
    } catch (error) {
        console.error('❌ Clerk 初始化失敗:', error);
        return false;
    }
}

// 檢查用戶是否已登入
function isUserSignedIn() {
    return window.Clerk && window.Clerk.user;
}

// 獲取當前用戶資訊
function getCurrentUser() {
    if (!isUserSignedIn()) return null;
    
    const user = window.Clerk.user;
    return {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        phone: user.primaryPhoneNumber?.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        imageUrl: user.imageUrl,
        createdAt: user.createdAt
    };
}

// 獲取 Session Token
async function getSessionToken() {
    if (!window.Clerk || !window.Clerk.session) {
        return null;
    }
    
    try {
        const token = await window.Clerk.session.getToken();
        return token;
    } catch (error) {
        console.error('Failed to get session token:', error);
        return null;
    }
}

// 登出
async function signOut() {
    if (window.Clerk) {
        await window.Clerk.signOut();
        window.location.href = '/';
    }
}

// 導出配置和函數
window.ClerkConfig = {
    CLERK_PUBLISHABLE_KEY,
    CLERK_DOMAIN,
    CLERK_FRONTEND_API,
    initializeClerk,
    isUserSignedIn,
    getCurrentUser,
    getSessionToken,
    signOut
};