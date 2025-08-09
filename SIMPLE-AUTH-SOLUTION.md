# 簡化身份驗證方案 - 使用 Clerk

## 為什麼選擇 Clerk？
- 5分鐘完成整合
- 內建用戶管理介面
- 支援手機號碼登入
- 自動處理 session 管理
- 與 Cloudflare Workers 原生整合

## 快速設置步驟

### 1. 註冊 Clerk
```bash
# 訪問 https://clerk.com
# 創建應用，選擇 "Phone number" 作為登入方式
```

### 2. 安裝 SDK
```bash
npm install @clerk/backend @clerk/clerk-js
```

### 3. 更新 Worker (極簡版本)
```javascript
// workers/src/index.js
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
});

export default {
  async fetch(request, env) {
    // 驗證用戶
    const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (sessionToken) {
      try {
        const session = await clerk.sessions.verifySession(sessionToken);
        // 用戶已驗證，可以存取資源
        const user = await clerk.users.getUser(session.userId);
        
        // 你的業務邏輯
        return new Response(JSON.stringify({
          user: {
            id: user.id,
            phone: user.phoneNumbers[0]?.phoneNumber,
            role: user.publicMetadata.role || 'member'
          }
        }));
      } catch (error) {
        return new Response('Unauthorized', { status: 401 });
      }
    }
    
    return new Response('No token provided', { status: 401 });
  }
};
```

### 4. 更新前端 (超簡單)
```html
<!-- frontend/login.html -->
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/@clerk/clerk-js@4/dist/clerk.browser.js"></script>
</head>
<body>
  <div id="sign-in"></div>
  
  <script>
    const clerkPublishableKey = 'pk_test_YOUR_KEY';
    const clerk = new Clerk(clerkPublishableKey);
    
    clerk.load().then(() => {
      // 自動渲染登入元件
      clerk.mountSignIn(document.getElementById('sign-in'), {
        appearance: {
          elements: {
            formButtonPrimary: 'bg-blue-500 hover:bg-blue-600'
          }
        }
      });
    });
    
    // 登入後自動跳轉
    clerk.addListener('session.created', () => {
      window.location.href = '/projects';
    });
  </script>
</body>
</html>
```

## 環境變數
```env
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
```

## 優點對比

| 功能 | 現有系統 | Clerk |
|-----|---------|-------|
| 設置時間 | 數小時 | 5分鐘 |
| 維護成本 | 高 | 零 |
| 安全性 | 需自行處理 | 企業級 |
| 用戶管理 UI | 需自行開發 | 內建 |
| Session 管理 | 手動 | 自動 |
| 多租戶 | 複雜 | 內建 |
| 價格 | D1 + KV 成本 | 免費 5000 用戶 |

## 遷移步驟

1. **保留現有資料**
   - 匯出 users 表的手機號碼
   - 在 Clerk 批量創建用戶

2. **漸進式遷移**
   - 新用戶使用 Clerk
   - 舊用戶首次登入時遷移

3. **簡化程式碼**
   - 移除 AuthService
   - 移除 SessionService
   - 移除 TenantMiddleware
   - 程式碼減少 80%

## 其他選擇

### 如果需要完全自主控制：
**Lucia Auth** - 輕量級函式庫
```javascript
import { lucia } from "lucia";
import { d1 } from "@lucia-auth/adapter-sqlite";

export const auth = lucia({
  adapter: d1(env.DB),
  // 簡單配置
});
```

### 如果需要開源方案：
**Supabase** - 完整後端服務
```javascript
// 一行程式碼搞定登入
const { user, error } = await supabase.auth.signInWithPassword({
  phone: '0912345678',
  password: '678'
})
```

## 建議

1. **短期方案**：使用 Clerk，立即解決問題
2. **長期方案**：評估是否需要自建系統
3. **關鍵考量**：
   - 用戶數量預期
   - 安全需求等級
   - 開發維護成本
   - 整合複雜度

## 結論

現有系統過於複雜，建議：
- ✅ 使用 Clerk（最快）
- ✅ 或 Supabase（開源）
- ✅ 專注在業務邏輯
- ✅ 讓專業服務處理認證