# 🚀 Supabase 5分鐘快速設置

## 為什麼選 Supabase？
- ✅ **完全免費** 50,000 用戶
- ✅ **內建資料庫**（不需要 D1）
- ✅ **即時同步**功能
- ✅ **開源**可自託管
- ✅ **極簡整合**

## Step 1: 建立 Supabase 專案（2分鐘）

1. 訪問 https://supabase.com
2. 點擊 "Start your project"
3. 用 GitHub 登入
4. 創建新專案：
   - Project name: `construction-management`
   - Database Password: 自動生成
   - Region: `Southeast Asia (Singapore)`

## Step 2: 啟用手機登入（1分鐘）

進入 Dashboard > Authentication > Providers
- 啟用 Phone
- 關閉 Email

## Step 3: 獲取 API Keys（30秒）

Settings > API > 複製：
- `anon` public key
- `service_role` secret key
- Project URL

## Step 4: 極簡前端程式碼

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
    <div id="app">
        <h1>工程管理系統</h1>
        <input type="tel" id="phone" placeholder="0912345678" value="0912345678">
        <button onclick="login()">發送驗證碼</button>
        
        <div id="verify" style="display:none">
            <input type="text" id="otp" placeholder="驗證碼">
            <button onclick="verify()">確認登入</button>
        </div>
    </div>

    <script>
        // 初始化 Supabase
        const supabaseUrl = 'YOUR_SUPABASE_URL'
        const supabaseKey = 'YOUR_ANON_KEY'
        const supabase = createClient(supabaseUrl, supabaseKey)

        async function login() {
            const phone = '+886' + document.getElementById('phone').value.substring(1)
            const { error } = await supabase.auth.signInWithOtp({ phone })
            
            if (!error) {
                document.getElementById('verify').style.display = 'block'
                alert('驗證碼已發送！')
            }
        }

        async function verify() {
            const phone = '+886' + document.getElementById('phone').value.substring(1)
            const token = document.getElementById('otp').value
            
            const { data, error } = await supabase.auth.verifyOtp({
                phone,
                token,
                type: 'sms'
            })
            
            if (data.user) {
                alert('登入成功！')
                window.location.href = '/projects'
            }
        }

        // 檢查登入狀態
        supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                console.log('已登入:', session.user)
            }
        })
    </script>
</body>
</html>
```

## Step 5: Cloudflare Worker 整合

```javascript
import { createClient } from '@supabase/supabase-js'

export default {
  async fetch(request, env) {
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_KEY
    )

    // 驗證用戶
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (user) {
        // 用戶已驗證
        return new Response(JSON.stringify({
          user: {
            id: user.id,
            phone: user.phone,
            role: user.user_metadata?.role || 'member'
          }
        }))
      }
    }
    
    return new Response('Unauthorized', { status: 401 })
  }
}
```

## 優勢對比

| 功能 | Clerk | Supabase |
|------|-------|----------|
| 免費額度 | 5,000 | **50,000** |
| 資料庫 | 無 | **內建 PostgreSQL** |
| 即時同步 | 無 | **有** |
| 開源 | 否 | **是** |
| 設置時間 | 複雜 | **5分鐘** |
| 文檔 | 英文 | **中文友好** |

## 額外功能

Supabase 還提供：
- **即時資料庫同步**
- **檔案儲存**（類似 R2）
- **Edge Functions**（類似 Workers）
- **Vector embeddings**（AI 功能）

## 開始使用

1. 註冊：https://supabase.com
2. 創建專案（免費）
3. 5分鐘完成整合！