/**
 * 專案詳情頁面主要應用邏輯
 * Project Detail Page Main Application Logic
 */

class ProjectDetailApp {
    constructor() {
        this.currentProjectId = null;
        this.currentSiteId = null;
        this.selectedBuilding = null;
        this.selectedTeams = new Set();
        this.isInitialized = false;
        
        // DOM 元素快取 / DOM element cache
        this.elements = {};
        
        this.initializeApp();
    }
    
    /**
     * 初始化應用
     * Initialize application
     */
    async initializeApp() {
        console.log('Initializing Project Detail App...');
        
        try {
            // 從URL取得參數 / Get parameters from URL
            this.parseUrlParameters();
            
            // 快取DOM元素 / Cache DOM elements
            this.cacheElements();
            
            // 設置事件監聽器 / Set up event listeners
            this.setupEventListeners();
            
            // 載入專案資料 / Load project data
            if (this.currentProjectId) {
                await this.loadProjectData();
                this.isInitialized = true;
                console.log('Project Detail App initialized successfully');
            } else {
                throw new Error('No project ID found in URL');
            }
            
        } catch (error) {
            console.error('Failed to initialize Project Detail App:', error);
            this.showError('初始化失敗: ' + error.message);
        }
    }
    
    /**
     * 解析URL參數
     * Parse URL parameters
     */
    parseUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        this.currentProjectId = urlParams.get('id');
        this.currentSiteId = urlParams.get('site_id');
        
        console.log('URL parameters:', {
            projectId: this.currentProjectId,
            siteId: this.currentSiteId
        });
    }
    
    /**
     * 快取DOM元素
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // 統計卡片 / Statistics cards
            totalSitesCard: document.querySelector('[data-stat="total"]'),
            completedCard: document.querySelector('[data-stat="completed"]'),
            pendingCard: document.querySelector('[data-stat="pending"]'),
            maintenanceCard: document.querySelector('[data-stat="maintenance"]'),
            
            // 建築物選擇器 / Building selector
            buildingSelector: document.getElementById('buildingSelector'),
            
            // 工班圖例 / Team legend
            legendContainer: document.getElementById('legendContainer'),
            
            // 樓層網格 / Floor grid
            gridContent: document.querySelector('.grid-content'),
            gridContainer: document.querySelector('.floor-grid-container'),
            
            // 案場詳情模態框 / Site detail modal
            siteModal: document.getElementById('siteDetailModal'),
            siteModalContent: document.querySelector('#siteDetailModal .modal-content'),
            
            // 載入指示器 / Loading indicator
            loadingIndicator: document.getElementById('loadingIndicator'),
            
            // 錯誤訊息 / Error message
            errorContainer: document.getElementById('errorContainer')
        };
    }
    
    /**
     * 設置事件監聽器
     * Set up event listeners
     */
    setupEventListeners() {
        // 建築物選擇 / Building selection
        if (this.elements.buildingSelector) {
            this.elements.buildingSelector.addEventListener('change', (e) => {
                this.onBuildingChanged(e.target.value);
            });
        }
        
        // 工班圖例點擊 / Team legend click
        if (this.elements.legendContainer) {
            this.elements.legendContainer.addEventListener('click', (e) => {
                const teamItem = e.target.closest('[data-team-id]');
                if (teamItem) {
                    this.toggleTeamFilter(teamItem.dataset.teamId);
                }
            });
        }
        
        // 案場格子點擊 / Site cell click
        if (this.elements.gridContent) {
            this.elements.gridContent.addEventListener('click', (e) => {
                const siteCell = e.target.closest('[data-site-id]');
                if (siteCell) {
                    this.showSiteDetail(siteCell.dataset.siteId);
                }
            });
        }
        
        // 模態框關閉 / Modal close
        if (this.elements.siteModal) {
            this.elements.siteModal.addEventListener('click', (e) => {
                if (e.target === this.elements.siteModal || e.target.closest('.close-modal')) {
                    this.closeSiteModal();
                }
            });
        }
        
        // ESC鍵關閉模態框 / ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.siteModal.style.display === 'block') {
                this.closeSiteModal();
            }
        });
    }
    
    /**
     * 載入專案資料
     * Load project data
     */
    async loadProjectData() {
        this.showLoading(true);
        
        try {
            console.log('Loading project data via unified loader...');
            
            // 使用統一資料載入器 / Use unified data loader
            const data = await window.unifiedDataLoader.loadProjectData(
                this.currentProjectId, 
                this.currentSiteId
            );
            
            // 更新UI元件 / Update UI components
            this.updateStatistics(data.statistics);
            this.updateBuildingSelector(data);
            this.updateTeamLegend(data.legendTeams);
            this.updateFloorGrid(data);
            
            // 如果有指定site_id，開啟該案場詳情 / If site_id is specified, open site details
            if (this.currentSiteId) {
                this.showSiteDetail(this.currentSiteId);
            }
            
            console.log('Project data loaded and UI updated successfully');
            
        } catch (error) {
            console.error('Failed to load project data:', error);
            this.showError('載入專案資料失敗: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * 更新統計卡片
     * Update statistics cards
     */
    updateStatistics(stats) {
        console.log('Updating statistics:', stats);
        
        if (this.elements.totalSitesCard) {
            this.elements.totalSitesCard.textContent = stats.totalSites || 0;
        }
        if (this.elements.completedCard) {
            this.elements.completedCard.textContent = stats.completed || 0;
        }
        if (this.elements.pendingCard) {
            this.elements.pendingCard.textContent = stats.pending || 0;
        }
        if (this.elements.maintenanceCard) {
            this.elements.maintenanceCard.textContent = stats.maintenance || 0;
        }
    }
    
    /**
     * 更新建築物選擇器
     * Update building selector
     */
    updateBuildingSelector(data) {
        if (!this.elements.buildingSelector) return;
        
        const buildings = window.unifiedDataLoader.getBuildings();
        console.log('Updating building selector:', buildings);
        
        // 清空現有選項 / Clear existing options
        this.elements.buildingSelector.innerHTML = '<option value="">選擇建築物</option>';
        
        // 新增建築物選項 / Add building options
        buildings.forEach(building => {
            const option = document.createElement('option');
            option.value = building;
            option.textContent = building;
            this.elements.buildingSelector.appendChild(option);
        });
        
        // 如果只有一個建築物，自動選擇 / If only one building, auto-select
        if (buildings.length === 1) {
            this.elements.buildingSelector.value = buildings[0];
            this.selectedBuilding = buildings[0];
            this.updateFloorGrid(data);
        }
    }
    
    /**
     * 更新工班圖例
     * Update team legend
     */
    updateTeamLegend(legendTeams) {
        if (!this.elements.legendContainer) return;
        
        console.log('Updating team legend:', legendTeams);
        
        // 清空現有內容 / Clear existing content
        this.elements.legendContainer.innerHTML = '';
        
        legendTeams.forEach(team => {
            const teamElement = document.createElement('div');
            teamElement.className = 'legend-item';
            teamElement.dataset.teamId = team.id;
            
            const progressPercent = team.totalSites > 0 ? 
                Math.round((team.completedSites / team.totalSites) * 100) : 0;
            
            teamElement.innerHTML = `
                <div class="team-info">
                    <span class="team-name">${team.name}</span>
                    <span class="team-abbreviation">${team.abbreviation || ''}</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <span class="progress-text">${team.completedSites}/${team.totalSites}</span>
                </div>
            `;
            
            this.elements.legendContainer.appendChild(teamElement);
        });
    }
    
    /**
     * 更新樓層網格
     * Update floor grid
     */
    updateFloorGrid(data) {
        if (!this.elements.gridContent || !this.selectedBuilding) return;
        
        console.log('Updating floor grid for building:', this.selectedBuilding);
        
        const floors = window.unifiedDataLoader.getFloorsForBuilding(this.selectedBuilding);
        
        // 清空現有內容 / Clear existing content
        this.elements.gridContent.innerHTML = '';
        
        floors.forEach(floor => {
            const sites = window.unifiedDataLoader.getSitesForBuildingFloor(this.selectedBuilding, floor);
            const floorElement = this.createFloorElement(floor, sites);
            this.elements.gridContent.appendChild(floorElement);
        });
    }
    
    /**
     * 建立樓層元素
     * Create floor element
     */
    createFloorElement(floor, sites) {
        const floorDiv = document.createElement('div');
        floorDiv.className = 'floor-row';
        
        // 樓層標籤 / Floor label
        const floorLabel = document.createElement('div');
        floorLabel.className = 'floor-label';
        floorLabel.textContent = `${floor}F`;
        
        // 案場容器 / Sites container
        const sitesContainer = document.createElement('div');
        sitesContainer.className = 'sites-container';
        
        sites.forEach(site => {
            const siteElement = this.createSiteElement(site);
            sitesContainer.appendChild(siteElement);
        });
        
        floorDiv.appendChild(floorLabel);
        floorDiv.appendChild(sitesContainer);
        
        return floorDiv;
    }
    
    /**
     * 建立案場元素
     * Create site element
     */
    createSiteElement(site) {
        const siteDiv = document.createElement('div');
        siteDiv.className = 'site-cell';
        siteDiv.dataset.siteId = site._id;
        siteDiv.dataset.teamId = site.teamId;
        
        // 根據狀態設置樣式 / Set style based on status
        let statusClass = 'pending';
        if (site.constructionCompleted) {
            statusClass = 'completed';
        } else if (site.tags && site.tags.includes('需維修')) {
            statusClass = 'maintenance';
        }
        
        siteDiv.classList.add(statusClass);
        
        // 工班過濾 / Team filtering
        if (this.selectedTeams.size > 0 && !this.selectedTeams.has(site.teamId)) {
            siteDiv.classList.add('filtered');
        }
        
        siteDiv.innerHTML = `
            <div class="site-unit">${site.unit || ''}</div>
            <div class="site-team">${site.teamName || ''}</div>
        `;
        
        return siteDiv;
    }
    
    /**
     * 建築物改變處理
     * Handle building change
     */
    onBuildingChanged(building) {
        console.log('Building changed to:', building);
        this.selectedBuilding = building;
        
        if (building && window.unifiedDataLoader.data) {
            this.updateFloorGrid(window.unifiedDataLoader.data);
        }
    }
    
    /**
     * 切換工班過濾
     * Toggle team filter
     */
    toggleTeamFilter(teamId) {
        console.log('Toggling team filter:', teamId);
        
        if (this.selectedTeams.has(teamId)) {
            this.selectedTeams.delete(teamId);
        } else {
            this.selectedTeams.add(teamId);
        }
        
        // 更新工班圖例樣式 / Update team legend style
        const teamElement = this.elements.legendContainer.querySelector(`[data-team-id="${teamId}"]`);
        if (teamElement) {
            teamElement.classList.toggle('selected', this.selectedTeams.has(teamId));
        }
        
        // 重新渲染網格 / Re-render grid
        if (window.unifiedDataLoader.data) {
            this.updateFloorGrid(window.unifiedDataLoader.data);
        }
    }
    
    /**
     * 顯示案場詳情
     * Show site details
     */
    showSiteDetail(siteId) {
        console.log('Showing site detail for:', siteId);
        
        const site = window.unifiedDataLoader.getSiteDetail(siteId);
        if (!site) {
            console.error('Site not found:', siteId);
            return;
        }
        
        this.renderSiteModal(site);
        this.elements.siteModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * 渲染案場模態框內容
     * Render site modal content
     */
    renderSiteModal(site) {
        if (!this.elements.siteModalContent) return;
        
        this.elements.siteModalContent.innerHTML = `
            <div class="modal-header">
                <h3>案場詳情 - ${site.name}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="site-detail-grid">
                    <div class="detail-section">
                        <h4>基本資訊</h4>
                        <div class="detail-row">
                            <label>編號:</label>
                            <span>${site.name || ''}</span>
                        </div>
                        <div class="detail-row">
                            <label>棟別:</label>
                            <span>${site.building || ''}</span>
                        </div>
                        <div class="detail-row">
                            <label>樓層:</label>
                            <span>${site.floor || ''}F</span>
                        </div>
                        <div class="detail-row">
                            <label>戶別:</label>
                            <span>${site.unit || ''}</span>
                        </div>
                        <div class="detail-row">
                            <label>工班:</label>
                            <span>${site.teamName || ''}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>施工資訊</h4>
                        <div class="detail-row">
                            <label>施工日期:</label>
                            <span>${site.constructionDate || '未設定'}</span>
                        </div>
                        <div class="detail-row">
                            <label>施工完成:</label>
                            <span>${site.constructionCompleted ? '是' : '否'}</span>
                        </div>
                        <div class="detail-row">
                            <label>坪數:</label>
                            <span>${site.area || 0}</span>
                        </div>
                        <div class="detail-row">
                            <label>階段:</label>
                            <span>${site.stage || ''}</span>
                        </div>
                        <div class="detail-row">
                            <label>案場類型:</label>
                            <span>${site.siteType || ''}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section full-width">
                        <h4>備註</h4>
                        <div class="detail-row">
                            <label>工地備註:</label>
                            <p>${site.notes || '無'}</p>
                        </div>
                        <div class="detail-row">
                            <label>施工前備註:</label>
                            <p>${site.beforeNotes || '無'}</p>
                        </div>
                        <div class="detail-row">
                            <label>完工備註:</label>
                            <p>${site.completionNotes || '無'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 關閉案場模態框
     * Close site modal
     */
    closeSiteModal() {
        this.elements.siteModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    /**
     * 顯示載入狀態
     * Show loading state
     */
    showLoading(show) {
        if (this.elements.loadingIndicator) {
            this.elements.loadingIndicator.style.display = show ? 'block' : 'none';
        }
    }
    
    /**
     * 顯示錯誤訊息
     * Show error message
     */
    showError(message) {
        console.error('App Error:', message);
        
        if (this.elements.errorContainer) {
            this.elements.errorContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${message}
                </div>
            `;
            this.elements.errorContainer.style.display = 'block';
        } else {
            alert(message);
        }
    }
}

// 當DOM載入完成後初始化應用 / Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Project Detail App...');
    window.projectDetailApp = new ProjectDetailApp();
});

// 匯出供其他模組使用 / Export for other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectDetailApp;
}