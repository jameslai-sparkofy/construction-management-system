// 欄位權限應用範例
// 這個檔案展示如何在編輯表單時應用欄位權限控制

/**
 * 檢查用戶對特定欄位的編輯權限
 * @param {Object} project - 專案資料（包含權限設定）
 * @param {string} objectApiName - 對象 API 名稱（如 'object_8W9cb__c'）
 * @param {string} fieldApiName - 欄位 API 名稱
 * @param {string} currentUserRole - 當前用戶角色 ('worker', 'owner', 'admin')
 * @param {string} currentUserId - 當前用戶 ID
 * @returns {boolean} 是否有編輯權限
 */
function canEditField(project, objectApiName, fieldApiName, currentUserRole, currentUserId) {
    // 檢查專案是否有權限設定
    if (!project.permissions || !project.permissions.fieldPermissions) {
        // 沒有權限設定，預設只有管理員可編輯
        return currentUserRole === 'admin';
    }
    
    const fieldPerms = project.permissions.fieldPermissions[objectApiName];
    if (!fieldPerms || !fieldPerms[fieldApiName]) {
        // 沒有該欄位的權限設定，預設只有管理員可編輯
        return currentUserRole === 'admin';
    }
    
    const perm = fieldPerms[fieldApiName];
    
    // 根據角色檢查權限
    switch (currentUserRole) {
        case 'admin':
            return perm.canEditByAdmin !== false; // 管理員預設有權限
        case 'owner':
            // 檢查是否為專案業主
            if (project.permissions.owners && project.permissions.owners.includes(currentUserId)) {
                return perm.canEditByOwner === true;
            }
            return false;
        case 'worker':
            // 檢查是否為專案工班成員或負責人
            const isLeader = project.permissions.leaders && project.permissions.leaders.includes(currentUserId);
            const isMember = project.permissions.members && project.permissions.members.includes(currentUserId);
            if (isLeader || isMember) {
                return perm.canEditByWorker === true;
            }
            return false;
        default:
            return false;
    }
}

/**
 * 根據權限設定表單欄位的可編輯狀態
 * @param {Object} project - 專案資料
 * @param {string} objectApiName - 對象 API 名稱
 * @param {string} currentUserRole - 當前用戶角色
 * @param {string} currentUserId - 當前用戶 ID
 */
function applyFieldPermissions(project, objectApiName, currentUserRole, currentUserId) {
    // 獲取表單中的所有欄位
    const formFields = document.querySelectorAll('[data-field-api-name]');
    
    formFields.forEach(field => {
        const fieldApiName = field.dataset.fieldApiName;
        const canEdit = canEditField(project, objectApiName, fieldApiName, currentUserRole, currentUserId);
        
        if (canEdit) {
            // 啟用欄位
            field.disabled = false;
            field.classList.remove('field-disabled');
            field.classList.add('field-enabled');
            
            // 移除唯讀提示
            const readOnlyTip = field.parentElement.querySelector('.readonly-tip');
            if (readOnlyTip) {
                readOnlyTip.style.display = 'none';
            }
        } else {
            // 禁用欄位
            field.disabled = true;
            field.classList.add('field-disabled');
            field.classList.remove('field-enabled');
            
            // 顯示唯讀提示
            let readOnlyTip = field.parentElement.querySelector('.readonly-tip');
            if (!readOnlyTip) {
                readOnlyTip = document.createElement('div');
                readOnlyTip.className = 'readonly-tip';
                readOnlyTip.innerHTML = '<i class="icon-lock"></i> 此欄位為唯讀';
                readOnlyTip.style.color = '#6b7280';
                readOnlyTip.style.fontSize = '0.85rem';
                readOnlyTip.style.marginTop = '0.25rem';
                field.parentElement.appendChild(readOnlyTip);
            }
            readOnlyTip.style.display = 'block';
        }
    });
}

/**
 * 載入專案並應用權限
 * @param {string} projectId - 專案 ID
 */
async function loadProjectAndApplyPermissions(projectId) {
    try {
        // 1. 獲取當前用戶資訊
        const currentUser = await getCurrentUser();
        const currentUserRole = currentUser.role; // 'admin', 'owner', 'worker'
        const currentUserId = currentUser.id;
        
        // 2. 載入專案資料（包含權限設定）
        // 從工程管理系統的 API 載入，而非 D1
        const WORKER_API_URL = window.location.hostname === 'localhost' 
            ? 'http://localhost:8787' 
            : 'https://construction-management-api.workers.dev';
            
        const response = await fetch(`${WORKER_API_URL}/api/v1/projects/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load project');
        
        const project = await response.json();
        
        // 3. 應用權限到表單
        const objectApiName = 'object_8W9cb__c'; // 或從 URL 參數獲取
        applyFieldPermissions(project.data, objectApiName, currentUserRole, currentUserId);
        
        // 4. 設定表單提交處理
        const form = document.getElementById('edit-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // 收集只有編輯權限的欄位資料
                const formData = new FormData(form);
                const editableData = {};
                
                for (const [key, value] of formData.entries()) {
                    const fieldElement = form.querySelector(`[name="${key}"]`);
                    if (fieldElement && !fieldElement.disabled) {
                        editableData[key] = value;
                    }
                }
                
                // 提交編輯資料
                await submitFormData(projectId, objectApiName, editableData);
            });
        }
        
    } catch (error) {
        console.error('Error loading project permissions:', error);
        alert('載入專案權限失敗');
    }
}

/**
 * 獲取當前用戶資訊
 */
async function getCurrentUser() {
    // 實際實作中，從 API 或 session 獲取用戶資訊
    const response = await fetch('/api/v1/user/current', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
    });
    
    if (!response.ok) throw new Error('Failed to get current user');
    
    const userData = await response.json();
    return userData.data;
}

/**
 * 提交表單資料
 * 資料會送到 D1 資料庫，但權限檢查是基於專案內的設定
 */
async function submitFormData(projectId, objectApiName, data) {
    try {
        // 資料儲存到 D1 資料庫
        const D1_API_URL = 'https://fx-d1-rest-api.lai-jameslai.workers.dev';
        
        const response = await fetch(`${D1_API_URL}/api/crud/${objectApiName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer fx-crm-api-secret-2025`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) throw new Error('Failed to save data');
        
        alert('資料已成功儲存');
        
    } catch (error) {
        console.error('Error saving data:', error);
        alert('儲存資料失敗');
    }
}

/**
 * 批量設定欄位權限
 * 在專案設定頁面使用
 * 注意：權限儲存在工程管理系統的專案資料中，而非 D1 資料庫
 */
async function batchUpdateFieldPermissions(projectId, objectApiName, permissions) {
    try {
        const WORKER_API_URL = window.location.hostname === 'localhost' 
            ? 'http://localhost:8787' 
            : 'https://construction-management-api.workers.dev';
            
        // 更新專案內的權限設定
        const response = await fetch(`${WORKER_API_URL}/api/v1/projects/${projectId}/permissions/fields/${objectApiName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ permissions })
        });
        
        if (!response.ok) throw new Error('Failed to update permissions');
        
        alert('權限設定已更新');
        
    } catch (error) {
        console.error('Error updating permissions:', error);
        alert('更新權限失敗');
    }
}

// 使用範例：在編輯頁面載入時
document.addEventListener('DOMContentLoaded', function() {
    // 從 URL 獲取專案 ID
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');
    
    if (projectId) {
        // 載入專案並應用權限
        loadProjectAndApplyPermissions(projectId);
    }
});

// 匯出函數供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        canEditField,
        applyFieldPermissions,
        loadProjectAndApplyPermissions,
        batchUpdateFieldPermissions
    };
}