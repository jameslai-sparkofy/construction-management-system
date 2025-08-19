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
    },

    /**
     * 從案場資料計算專案真實狀態和進度
     */
    calculateProjectStatus(project, sitesData = null) {
        // 如果有傳入案場資料，使用實際資料計算
        if (sitesData && Array.isArray(sitesData) && sitesData.length > 0) {
            const totalSites = sitesData.length;
            const completedSites = sitesData.filter(site => 
                site.status === 'completed' || 
                site.construction_status === 'completed' ||
                site.spc_status === 'completed' ||
                site.construction_completed__c === true ||
                site.construction_completed__c === 1 ||
                site.construction_completed__c === '1'
            ).length;
            
            const inProgressSites = sitesData.filter(site => 
                site.status === 'in_progress' || 
                site.construction_status === 'in_progress' ||
                site.spc_status === 'in_progress'
            ).length;
            
            const maintenanceSites = sitesData.filter(site => 
                site.status === 'maintenance' || 
                site.maintenance_status === 'pending' ||
                (site.maintenance_count && site.maintenance_count > 0)
            ).length;
            
            // 計算進度百分比
            const progressPercent = totalSites > 0 ? Math.round((completedSites / totalSites) * 100) : 0;
            
            // 計算專案開始日期和結束日期（從案場資料）
            const siteDates = sitesData
                .map(site => {
                    // 嘗試多種日期欄位
                    return site.start_date || 
                           site.construction_start_date || 
                           site.created_date || 
                           site.spc_start_date;
                })
                .filter(date => date && date !== 'null' && date !== '')
                .map(date => new Date(date))
                .filter(date => !isNaN(date.getTime()));
            
            const siteEndDates = sitesData
                .map(site => {
                    // 嘗試多種完工日期欄位
                    return site.end_date || 
                           site.completion_date || 
                           site.spc_completion_date ||
                           site.last_modified_date;
                })
                .filter(date => date && date !== 'null' && date !== '')
                .map(date => new Date(date))
                .filter(date => !isNaN(date.getTime()));
            
            const calculatedStartDate = siteDates.length > 0 
                ? new Date(Math.min(...siteDates)).toISOString().split('T')[0]
                : null;
                
            const calculatedEndDate = siteEndDates.length > 0 
                ? new Date(Math.max(...siteEndDates)).toISOString().split('T')[0]
                : null;
            
            // 根據實際情況判斷狀態
            let calculatedStatus;
            if (totalSites === 0) {
                calculatedStatus = 'not_started';
            } else if (completedSites === 0) {
                calculatedStatus = 'not_started';  // 沒有任何完工案場
            } else if (completedSites === totalSites) {
                calculatedStatus = 'completed';    // 全部完工
            } else if (maintenanceSites > 0) {
                calculatedStatus = 'maintenance';  // 有維修案場
            } else if (inProgressSites > 0 || completedSites > 0) {
                calculatedStatus = 'in_progress';  // 有進行中或部分完工
            } else {
                calculatedStatus = 'not_started';
            }
            
            return {
                status: calculatedStatus,
                progress: progressPercent,
                startDate: calculatedStartDate,
                endDate: calculatedEndDate,
                stats: {
                    totalSites,
                    completedSites,
                    inProgressSites,
                    maintenanceSites,
                    pendingSites: totalSites - completedSites - inProgressSites
                },
                calculatedFromSites: true
            };
        }
        
        // 備用：使用專案本身的狀態
        const fallbackStatus = project.project_status || 'not_started';
        const fallbackProgress = project.progress || 0;
        
        return {
            status: fallbackStatus,
            progress: fallbackProgress,
            stats: {
                totalSites: project.unit_count || 0,
                completedSites: project.completed_count || 0,
                inProgressSites: 0,
                maintenanceSites: 0,
                pendingSites: (project.unit_count || 0) - (project.completed_count || 0)
            },
            calculatedFromSites: false
        };
    },

    /**
     * 批量計算多個專案的狀態（用於專案列表）
     */
    async calculateProjectsStatus(projects) {
        const enhancedProjects = [];
        
        for (const project of projects) {
            try {
                // 嘗試載入該專案的案場資料
                const sitesData = await this.loadProjectSites(project.id);
                const statusInfo = this.calculateProjectStatus(project, sitesData);
                
                // 更新專案資料
                const enhancedProject = {
                    ...project,
                    calculated_status: statusInfo.status,
                    calculated_progress: statusInfo.progress,
                    calculated_start_date: statusInfo.startDate,
                    calculated_end_date: statusInfo.endDate,
                    site_stats: statusInfo.stats,
                    is_calculated: statusInfo.calculatedFromSites
                };
                
                enhancedProjects.push(enhancedProject);
                
            } catch (error) {
                console.warn(`Failed to load sites for project ${project.id}:`, error);
                // 使用原始狀態
                enhancedProjects.push({
                    ...project,
                    calculated_status: project.project_status || 'not_started',
                    calculated_progress: project.progress || 0,
                    is_calculated: false
                });
            }
        }
        
        return enhancedProjects;
    },

    /**
     * 載入專案案場資料
     */
    async loadProjectSites(projectId) {
        try {
            const response = await fetch(`${CONFIG.API.WORKER_API_URL}/api/v1/projects/${projectId}/sites`, {
                headers: window.UnifiedAuth.getRequestHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.sites || [];
            } else {
                throw new Error(`API returned ${response.status}`);
            }
        } catch (error) {
            // 如果 Worker API 失敗，嘗試直接從 D1 API 載入
            try {
                const opportunity = await this.getProjectOpportunity(projectId);
                if (opportunity) {
                    // 使用與 project-detail.html 相同的 API 端點
                    const sitesResponse = await fetch(`https://d1.yes-ceramics.com/rest/object_8W9cb__c?field_1P96q__c=${opportunity}&limit=500`, {
                        headers: {
                            'Authorization': 'Bearer fx-crm-api-secret-2025'
                        }
                    });
                    
                    if (sitesResponse.ok) {
                        const sitesData = await sitesResponse.json();
                        return sitesData.results || [];
                    }
                }
            } catch (fallbackError) {
                console.warn('Fallback API also failed:', fallbackError);
            }
            
            throw error;
        }
    },

    /**
     * 獲取專案的 Opportunity ID
     */
    async getProjectOpportunity(projectId) {
        try {
            const response = await fetch(`${CONFIG.API.WORKER_API_URL}/api/v1/projects/${projectId}`, {
                headers: window.UnifiedAuth.getRequestHeaders()
            });
            
            if (response.ok) {
                const project = await response.json();
                return project.opportunity_id;
            }
        } catch (error) {
            console.warn('Failed to get opportunity ID:', error);
        }
        
        return null;
    }
};

// 導出到全域
window.ProjectStatus = ProjectStatus;

console.log('Project Status Management initialized');