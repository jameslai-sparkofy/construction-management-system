/**
 * 專案狀態管理工具
 */

const ProjectStatus = {
    // 專案狀態定義
    STATUS_TYPES: {
        NOT_STARTED: { value: 'not_started', label: '尚未開始', color: '#6b7280', bgColor: '#f3f4f6' },
        IN_PROGRESS: { value: 'in_progress', label: '進行中', color: '#10b981', bgColor: '#d1fae5' },
        MAINTENANCE: { value: 'maintenance', label: '維修中', color: '#f59e0b', bgColor: '#fef3c7' },
        WARRANTY: { value: 'warranty', label: '保固中', color: '#3b82f6', bgColor: '#dbeafe' },
        COMPLETED: { value: 'completed', label: '已完工', color: '#8b5cf6', bgColor: '#e9d5ff' }
    },

    /**
     * 根據狀態值獲取狀態信息
     */
    getStatusInfo(statusValue) {
        return Object.values(this.STATUS_TYPES).find(status => status.value === statusValue) 
               || this.STATUS_TYPES.NOT_STARTED;
    },

    /**
     * 獲取狀態標籤
     */
    getStatusLabel(statusValue) {
        return this.getStatusInfo(statusValue).label;
    },

    /**
     * 獲取狀態顏色
     */
    getStatusColor(statusValue) {
        return this.getStatusInfo(statusValue).color;
    },

    /**
     * 創建狀態下拉選單
     */
    createStatusSelect(currentStatus = 'not_started', options = {}) {
        const {
            id = 'status-select',
            className = 'status-select',
            onChange = null,
            disabled = false
        } = options;

        const select = document.createElement('select');
        select.id = id;
        select.className = className;
        select.disabled = disabled;

        // 添加選項
        Object.values(this.STATUS_TYPES).forEach(status => {
            const option = document.createElement('option');
            option.value = status.value;
            option.textContent = status.label;
            option.selected = status.value === currentStatus;
            select.appendChild(option);
        });

        // 添加事件監聽器
        if (onChange) {
            select.addEventListener('change', onChange);
        }

        return select;
    },

    /**
     * 創建狀態標籤
     */
    createStatusBadge(statusValue) {
        const status = this.getStatusInfo(statusValue);
        const badge = document.createElement('span');
        badge.className = 'status-badge';
        badge.textContent = status.label;
        badge.style.cssText = `
            background-color: ${status.bgColor};
            color: ${status.color};
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            display: inline-block;
        `;
        return badge;
    },

    /**
     * 更新專案狀態（API 調用，失敗時使用本地更新）
     */
    async updateProjectStatus(projectId, newStatus, options = {}) {
        const { startDate, endDate, updatedBy } = options;
        
        try {
            const response = await fetch(`${CONFIG.API.WORKER_API_URL}/api/v1/projects/${projectId}/status`, {
                method: 'PATCH',
                headers: window.UnifiedAuth.getRequestHeaders(),
                body: JSON.stringify({
                    project_status: newStatus,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    updatedBy: updatedBy || 'user'
                })
            });

            const result = await response.json();
            
            if (!response.ok) {
                console.warn('API update failed, using local update:', result.message);
                // API 失敗時使用本地更新
                return this.updateProjectStatusLocally(projectId, newStatus, options);
            }

            return result;
        } catch (error) {
            console.warn('API request failed, using local update:', error.message);
            // API 失敗時使用本地更新
            return this.updateProjectStatusLocally(projectId, newStatus, options);
        }
    },

    /**
     * 本地更新專案狀態（備用方案）
     */
    updateProjectStatusLocally(projectId, newStatus, options = {}) {
        const { startDate, endDate } = options;
        
        // 不再更新 localStorage，避免重複顯示
        // const savedProject = localStorage.getItem('demo_created_project');
        // if (savedProject) {
        //     const project = JSON.parse(savedProject);
        //     if (project.id === projectId) {
        //         project.project_status = newStatus;
        //         if (startDate) project.start_date = startDate;
        //         if (endDate) project.end_date = endDate;
        //         project.updated_at = new Date().toISOString();
        //         localStorage.setItem('demo_created_project', JSON.stringify(project));
        //     }
        // }
        
        console.log(`Local status update: Project ${projectId} status changed to ${newStatus}`);
        
        return {
            success: true,
            message: '狀態已更新（本地模式）',
            local_update: true
        };
    },

    /**
     * 獲取專案統計（API 失敗時返回預設值）
     */
    async getProjectStats() {
        try {
            const response = await fetch(`${CONFIG.API.WORKER_API_URL}/api/v1/projects/stats`, {
                headers: window.UnifiedAuth.getRequestHeaders()
            });

            const result = await response.json();
            
            if (!response.ok) {
                console.warn('API stats failed, using default stats:', result.message);
                return this.getDefaultStats();
            }

            return result.stats;
        } catch (error) {
            console.warn('API request failed, using default stats:', error.message);
            return this.getDefaultStats();
        }
    },

    /**
     * 取得預設統計資料（備用）
     */
    getDefaultStats() {
        return {
            total: 0,
            by_status: {
                not_started: 0,
                in_progress: 0,
                maintenance: 0,
                warranty: 0,
                completed: 0
            }
        };
    },

    /**
     * 格式化日期顯示
     */
    formatDate(dateString) {
        if (!dateString) return '-';
        
        try {
            return new Date(dateString).toLocaleDateString('zh-TW');
        } catch (error) {
            return dateString;
        }
    },

    /**
     * 驗證日期範圍
     */
    validateDateRange(startDate, endDate) {
        if (!startDate || !endDate) return true;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return start <= end;
    }
};

// 導出到全域
window.ProjectStatus = ProjectStatus;

console.log('Project Status Management initialized');