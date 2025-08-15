# 權限系統規格文件

## 系統概述

權限系統採用基於角色的訪問控制（RBAC）架構，結合工班層級的權限隔離，實現細粒度的權限管理。系統支援四個主要角色，每個角色在不同工班中可能擁有不同的權限。

## 角色定義

### 1. 系統角色層級

```
管理員 (Admin)
  ├── 業主 (Owner)
  ├── 工班負責人 (Team Leader)
  └── 一般成員 (Team Member)
```

### 2. 角色權限矩陣

| 功能 | 管理員 | 業主 | 工班負責人 | 一般成員 |
|------|--------|------|------------|----------|
| **系統管理** |
| 系統設定 | ✅ | ❌ | ❌ | ❌ |
| 用戶管理 | ✅ | ❌ | ❌ | ❌ |
| **專案管理** |
| 查看所有專案 | ✅ | ✅ | ❌ | ❌ |
| 建立專案 | ✅ | ❌ | ❌ | ❌ |
| 編輯專案 | ✅ | ❌ | ❌ | ❌ |
| 刪除專案 | ✅ | ❌ | ❌ | ❌ |
| **工班管理** |
| 查看所有工班 | ✅ | ✅ | ❌ | ❌ |
| 查看自己工班 | ✅ | ✅ | ✅ | ✅ |
| 建立工班 | ✅ | ❌ | ❌ | ❌ |
| 編輯工班資料 | ✅ | ❌ | ✅* | ❌ |
| 刪除工班 | ✅ | ❌ | ❌ | ❌ |
| **成員管理** |
| 查看成員列表 | ✅ | ✅ | ✅ | ✅ |
| 新增成員 | ✅ | ❌ | ✅* | ❌ |
| 編輯成員資料 | ✅ | ❌ | ✅* | ❌ |
| 刪除成員 | ✅ | ❌ | ✅* | ❌ |
| 變更成員角色 | ✅ | ❌ | ✅* | ❌ |
| **案場管理** |
| 查看案場資料 | ✅ | ✅ | ✅* | ✅* |
| 編輯案場資料 | ✅ | ❌ | ✅* | ❌ |
| 施工狀態更新 | ✅ | ❌ | ✅* | ✅* |

> 註：* 表示僅限自己所屬工班

## 權限實作

### 1. 權限檢查函數

```javascript
// 獲取當前用戶角色
function getCurrentUserRole() {
    const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    return user.role || 'guest';
}

// 檢查是否為工班負責人
function isCurrentUserTeamLeader(team) {
    const currentUserId = sessionStorage.getItem('userId');
    return team.leaders?.some(leader => leader.userId === currentUserId);
}

// 通用權限檢查
function hasPermission(action, resource, context = {}) {
    const role = getCurrentUserRole();
    
    // 管理員擁有所有權限
    if (role === 'admin') return true;
    
    // 根據資源和動作檢查權限
    switch (resource) {
        case 'team_member':
            return checkTeamMemberPermission(role, action, context);
        case 'project':
            return checkProjectPermission(role, action, context);
        case 'site':
            return checkSitePermission(role, action, context);
        default:
            return false;
    }
}
```

### 2. 工班層級權限

```javascript
// 工班成員權限檢查
function checkTeamMemberPermission(role, action, context) {
    const { team, targetMember } = context;
    
    switch (role) {
        case 'owner':
            // 業主只能查看
            return action === 'view';
            
        case 'team_leader':
            // 工班負責人可以管理自己工班
            if (!isCurrentUserTeamLeader(team)) return false;
            return ['view', 'add', 'edit', 'delete'].includes(action);
            
        case 'team_member':
            // 一般成員只能查看
            return action === 'view';
            
        default:
            return false;
    }
}
```

### 3. 權限繼承機制

```javascript
class PermissionHierarchy {
    constructor() {
        this.hierarchy = {
            admin: ['owner', 'team_leader', 'team_member'],
            owner: ['team_member'],
            team_leader: ['team_member'],
            team_member: []
        };
    }
    
    // 檢查角色是否包含指定權限
    hasInheritedPermission(userRole, requiredRole) {
        if (userRole === requiredRole) return true;
        return this.hierarchy[userRole]?.includes(requiredRole) || false;
    }
}
```

## 權限控制實作範例

### 1. UI 層級控制

```javascript
// 顯示/隱藏編輯按鈕
function renderMemberActions(member, team) {
    const canEdit = hasPermission('edit', 'team_member', { team, targetMember: member });
    
    if (canEdit) {
        return `
            <button onclick="editMember('${member.id}')">編輯</button>
            <button onclick="deleteMember('${member.id}')">刪除</button>
        `;
    }
    return ''; // 無權限則不顯示按鈕
}
```

### 2. API 層級控制

```javascript
// API 端點權限檢查
async function updateMember(request, env) {
    const user = await getUserFromToken(request, env);
    const { projectId, teamId, memberId } = request.params;
    
    // 獲取工班資訊
    const team = await getTeam(teamId, env.DB);
    
    // 權限檢查
    if (!canEditTeamMember(user, team)) {
        return new Response(JSON.stringify({
            error: 'Permission denied'
        }), { status: 403 });
    }
    
    // 執行更新...
}
```

### 3. 資料層級控制

```sql
-- 使用視圖限制資料訪問
CREATE VIEW user_accessible_teams AS
SELECT t.*
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
WHERE 
    -- 管理員看所有
    :userRole = 'admin'
    OR
    -- 業主看所有
    :userRole = 'owner'
    OR
    -- 成員看自己的工班
    tm.user_id = :userId;
```

## 多工班權限處理

### 1. 權限聚合

當用戶屬於多個工班時，權限採用最高權限原則：

```javascript
function getHighestTeamRole(user, teams) {
    let highestRole = 'team_member';
    
    for (const team of teams) {
        if (team.leaders?.includes(user.id)) {
            return 'team_leader'; // 最高權限
        }
    }
    
    return highestRole;
}
```

### 2. 工班切換上下文

```javascript
class TeamContext {
    constructor(userId) {
        this.userId = userId;
        this.currentTeam = null;
    }
    
    // 切換當前工班上下文
    switchTeam(teamId) {
        this.currentTeam = teamId;
        this.refreshPermissions();
    }
    
    // 刷新權限
    refreshPermissions() {
        const team = getTeam(this.currentTeam);
        const role = getUserRoleInTeam(this.userId, team);
        updateUIBasedOnRole(role);
    }
}
```

## 安全考量

### 1. 防止權限提升

- 前端權限檢查僅用於 UI 控制
- 所有關鍵操作必須在後端再次驗證
- 使用 Token 驗證身份

### 2. 審計日誌

```javascript
// 記錄權限相關操作
async function logPermissionAction(user, action, resource, result) {
    await env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, result, timestamp)
        VALUES (?, ?, ?, ?, ?)
    `).bind(user.id, action, resource, result, new Date().toISOString()).run();
}
```

### 3. 權限快取

```javascript
class PermissionCache {
    constructor() {
        this.cache = new Map();
        this.ttl = 300000; // 5 分鐘
    }
    
    getCacheKey(userId, resource, action) {
        return `${userId}:${resource}:${action}`;
    }
    
    get(userId, resource, action) {
        const key = this.getCacheKey(userId, resource, action);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.result;
        }
        
        return null;
    }
    
    set(userId, resource, action, result) {
        const key = this.getCacheKey(userId, resource, action);
        this.cache.set(key, {
            result,
            timestamp: Date.now()
        });
    }
}
```

## 權限配置範例

### 1. 環境變數配置

```javascript
// wrangler.toml
[vars]
ENABLE_PERMISSION_CACHE = true
PERMISSION_CACHE_TTL = 300
AUDIT_LOG_ENABLED = true
```

### 2. 動態權限配置

```javascript
const PERMISSION_CONFIG = {
    features: {
        team_management: {
            enabled: true,
            roles: ['admin', 'team_leader']
        },
        site_editing: {
            enabled: true,
            roles: ['admin', 'team_leader']
        },
        report_generation: {
            enabled: true,
            roles: ['admin', 'owner']
        }
    }
};
```

## 測試案例

### 1. 權限測試矩陣

| 測試案例 | 用戶角色 | 操作 | 預期結果 |
|----------|----------|------|----------|
| TC001 | 管理員 | 編輯任意成員 | ✅ 成功 |
| TC002 | 業主 | 編輯成員 | ❌ 拒絕 |
| TC003 | 工班負責人 | 編輯自己工班成員 | ✅ 成功 |
| TC004 | 工班負責人 | 編輯其他工班成員 | ❌ 拒絕 |
| TC005 | 一般成員 | 查看成員列表 | ✅ 成功 |
| TC006 | 一般成員 | 編輯成員 | ❌ 拒絕 |

### 2. 測試代碼

```javascript
describe('Permission System', () => {
    it('should allow admin to edit any member', async () => {
        const user = { role: 'admin' };
        const result = hasPermission('edit', 'team_member', {});
        expect(result).toBe(true);
    });
    
    it('should prevent member from editing', async () => {
        const user = { role: 'team_member' };
        const result = hasPermission('edit', 'team_member', {});
        expect(result).toBe(false);
    });
});
```

## 版本歷史

### v1.0.0 (2025-08-15)
- 初始權限系統實作
- 四層角色架構
- 工班層級權限隔離

## 未來規劃

1. **細粒度權限**
   - 欄位級別權限控制
   - 時間範圍權限限制
   - 地理位置權限限制

2. **動態權限**
   - 臨時權限授予
   - 權限委派機制
   - 權限審批流程

3. **權限分析**
   - 權限使用統計
   - 異常行為檢測
   - 權限優化建議

---

最後更新：2025-08-15