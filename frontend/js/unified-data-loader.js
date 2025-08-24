/**
 * 統一資料載入架構
 * Unified Data Loading Architecture
 * 
 * 目標：單次API呼叫載入所有需要的資料，避免多次重複請求
 * Goals: Load all required data in a single API call to avoid multiple redundant requests
 */

class UnifiedDataLoader {
    constructor() {
        this.projectId = null;
        this.siteId = null;
        this.data = {
            // 基本專案資訊 / Basic project information
            project: null,
            
            // 案場資料 / Site data (object_8W9cb__c)
            sites: [],
            sitesMap: new Map(), // site_id -> site object
            
            // 工班資料 / Team data (object_50HJ8__c)  
            teams: [],
            teamsMap: new Map(), // team_id -> team object
            teamIdToNameMap: {}, // team_id -> {name, abbreviation}
            teamNameToIdMap: {}, // team_name -> team_id
            
            // 處理後的資料結構 / Processed data structures
            buildingGrid: {},
            statistics: {
                totalSites: 0,
                completed: 0,
                pending: 0,
                maintenance: 0
            },
            legendTeams: [],
            sitesDetailMap: new Map()
        };
        
        this.apiBaseUrl = this.getApiBaseUrl();
    }
    
    /**
     * 根據環境自動檢測API端點
     * Auto-detect API endpoint based on environment
     */
    getApiBaseUrl() {
        const hostname = window.location.hostname;
        if (hostname.includes('construction-management-frontend-dev') || hostname.includes('localhost')) {
            return 'https://construction-management-api-dev.lai-jameslai.workers.dev';
        } else {
            return 'https://construction-management-api-prod.lai-jameslai.workers.dev';
        }
    }
    
    /**
     * 主要載入函數 - 載入所有專案資料
     * Main loading function - load all project data
     */
    async loadProjectData(projectId, siteId = null) {
        this.projectId = projectId;
        this.siteId = siteId;
        
        try {
            console.log('Loading unified project data...', { projectId, siteId });
            
            // 使用批量端點載入所有資料
            // Use batch endpoint to load all data
            const response = await fetch(`${this.apiBaseUrl}/full?projectId=${projectId}`);
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Raw API response:', result);
            
            // 處理回傳的資料
            // Process returned data
            await this.processApiResponse(result);
            
            console.log('Unified data loading completed:', this.data);
            return this.data;
            
        } catch (error) {
            console.error('Failed to load unified project data:', error);
            throw error;
        }
    }
    
    /**
     * 處理API回應資料
     * Process API response data
     */
    async processApiResponse(apiResponse) {
        // 設定基本專案資訊
        // Set basic project information
        this.data.project = apiResponse.project || {};
        
        // 處理工班資料 / Process team data
        this.processTeamsData(apiResponse.teams || apiResponse.projectTeams || []);
        
        // 處理案場資料 / Process sites data  
        this.processSitesData(apiResponse.sites || apiResponse.projectSites || []);
        
        // 建立處理後的資料結構 / Build processed data structures
        this.buildProcessedStructures();
    }
    
    /**
     * 處理工班資料
     * Process team data (object_50HJ8__c)
     */
    processTeamsData(teamsData) {
        console.log('Processing teams data:', teamsData);
        
        this.data.teams = Array.isArray(teamsData) ? teamsData : [];
        this.data.teamsMap.clear();
        this.data.teamIdToNameMap = {};
        this.data.teamNameToIdMap = {};
        
        this.data.teams.forEach(team => {
            const teamId = team._id || team.id;
            const teamName = team.name || team.姓名 || '';
            const abbreviation = team.abbreviation__c || team.簡稱 || team.abbreviation || '';
            
            // 建立各種映射表 / Build various mapping tables
            this.data.teamsMap.set(teamId, team);
            this.data.teamIdToNameMap[teamId] = {
                name: teamName,
                abbreviation: abbreviation
            };
            this.data.teamNameToIdMap[teamName] = teamId;
            
            console.log(`Team mapping: ${teamId} -> ${teamName} (${abbreviation})`);
        });
        
        console.log('Teams processing completed:', {
            count: this.data.teams.length,
            teamIdToNameMap: this.data.teamIdToNameMap,
            teamNameToIdMap: this.data.teamNameToIdMap
        });
    }
    
    /**
     * 處理案場資料
     * Process sites data (object_8W9cb__c)
     */
    processSitesData(sitesData) {
        console.log('Processing sites data:', sitesData);
        
        this.data.sites = Array.isArray(sitesData) ? sitesData : [];
        this.data.sitesMap.clear();
        this.data.sitesDetailMap.clear();
        
        this.data.sites.forEach(site => {
            const siteId = site._id || site.id;
            
            // 標準化案場資料欄位 / Standardize site data fields
            const standardizedSite = this.standardizeSiteData(site);
            
            this.data.sitesMap.set(siteId, standardizedSite);
            this.data.sitesDetailMap.set(siteId, standardizedSite);
            
            console.log(`Site processed: ${siteId}`, standardizedSite);
        });
        
        console.log('Sites processing completed:', {
            count: this.data.sites.length,
            sitesMap: this.data.sitesMap
        });
    }
    
    /**
     * 標準化案場資料欄位
     * Standardize site data fields based on CSV mapping
     */
    standardizeSiteData(rawSite) {
        return {
            // 基本識別資訊 / Basic identification
            _id: rawSite._id || rawSite.id,
            name: rawSite.name || rawSite.編號 || '',
            
            // 位置資訊 / Location information
            building: rawSite.field_WD7k1__c || rawSite.棟別 || '',
            floor: rawSite.field_Q6Svh__c || rawSite.樓層 || 0,
            unit: rawSite.field_XuJP2__c || rawSite.戶別 || '',
            
            // 工班資訊 / Team information
            teamId: rawSite.shift_time__c || rawSite.工班 || '',
            teamName: this.getTeamNameFromId(rawSite.shift_time__c || rawSite.工班 || ''),
            
            // 施工資訊 / Construction information
            constructionDate: rawSite.field_23pFq__c || rawSite.施工日期 || null,
            constructionCompleted: rawSite.construction_completed__c || rawSite.施工完成 || false,
            area: rawSite.field_tXAko__c || rawSite.工地坪數 || 0,
            protectionArea: rawSite.field_27g6n__c || rawSite.保護板坪數 || 0,
            
            // 狀態資訊 / Status information
            stage: rawSite.field_z9H6O__c || rawSite.階段 || '',
            tags: rawSite.field_23Z5i__c || rawSite.標籤 || [],
            siteType: rawSite.field_dxr31__c || rawSite.案場類型 || '',
            
            // 照片資訊 / Photo information
            beforePhotos: rawSite.field_V3d91__c || rawSite.施工前照片 || [],
            afterPhotos: rawSite.field_3Fqof__c || rawSite.完工照片 || [],
            acceptancePhotos: rawSite.field_v1x3S__c || rawSite.驗收照片 || [],
            
            // 備註資訊 / Notes information
            notes: rawSite.field_g18hX__c || rawSite.工地備註 || '',
            beforeNotes: rawSite.field_sF6fn__c || rawSite.施工前備註 || '',
            completionNotes: rawSite.work_shift_completion_note__c || rawSite.工班施工完備註 || '',
            acceptanceNotes: rawSite.field_n37jC__c || rawSite.驗收備註 || '',
            
            // 系統資訊 / System information
            createTime: rawSite.create_time || rawSite.创建时间 || null,
            lastModified: rawSite.last_modified_time || rawSite.最后修改时间 || null,
            lifeStatus: rawSite.life_status || rawSite.生命状态 || '',
            
            // 保留原始資料 / Preserve raw data
            raw: rawSite
        };
    }
    
    /**
     * 建立處理後的資料結構
     * Build processed data structures for UI components
     */
    buildProcessedStructures() {
        // 建立統計資料 / Build statistics
        this.buildStatistics();
        
        // 建立建築物網格 / Build building grid
        this.buildBuildingGrid();
        
        // 建立圖例工班 / Build legend teams
        this.buildLegendTeams();
        
        console.log('Processed structures built:', {
            statistics: this.data.statistics,
            buildingGrid: Object.keys(this.data.buildingGrid),
            legendTeams: this.data.legendTeams.length
        });
    }
    
    /**
     * 建立統計資料
     * Build statistics data
     */
    buildStatistics() {
        let totalSites = 0;
        let completed = 0;
        let pending = 0;
        let maintenance = 0;
        
        this.data.sites.forEach(site => {
            totalSites++;
            
            if (site.constructionCompleted) {
                completed++;
            } else if (site.tags && site.tags.includes('需維修')) {
                maintenance++;
            } else {
                pending++;
            }
        });
        
        this.data.statistics = {
            totalSites,
            completed,
            pending,
            maintenance
        };
    }
    
    /**
     * 建立建築物網格資料
     * Build building grid data
     */
    buildBuildingGrid() {
        const grid = {};
        
        this.data.sites.forEach(site => {
            const building = site.building || 'Unknown';
            const floor = site.floor || 0;
            
            if (!grid[building]) {
                grid[building] = {};
            }
            
            if (!grid[building][floor]) {
                grid[building][floor] = [];
            }
            
            grid[building][floor].push(site);
        });
        
        this.data.buildingGrid = grid;
    }
    
    /**
     * 建立圖例工班資料
     * Build legend teams data
     */
    buildLegendTeams() {
        const teamStats = new Map();
        
        // 統計每個工班的案場數 / Count sites per team
        this.data.sites.forEach(site => {
            const teamId = site.teamId;
            if (teamId && this.data.teamIdToNameMap[teamId]) {
                if (!teamStats.has(teamId)) {
                    teamStats.set(teamId, {
                        id: teamId,
                        name: this.data.teamIdToNameMap[teamId].name,
                        abbreviation: this.data.teamIdToNameMap[teamId].abbreviation,
                        totalSites: 0,
                        completedSites: 0
                    });
                }
                
                const stats = teamStats.get(teamId);
                stats.totalSites++;
                
                if (site.constructionCompleted) {
                    stats.completedSites++;
                }
            }
        });
        
        this.data.legendTeams = Array.from(teamStats.values())
            .sort((a, b) => a.name.localeCompare(b.name));
    }
    
    /**
     * 輔助函數：根據工班ID取得工班名稱
     * Helper function: Get team name from team ID
     */
    getTeamNameFromId(teamId) {
        if (!teamId) return '';
        
        const teamInfo = this.data.teamIdToNameMap[teamId];
        if (typeof teamInfo === 'object' && teamInfo) {
            return teamInfo.name || teamId;
        }
        return teamInfo || teamId;
    }
    
    /**
     * 取得特定案場的詳細資料
     * Get detailed data for a specific site
     */
    getSiteDetail(siteId) {
        return this.data.sitesDetailMap.get(siteId) || null;
    }
    
    /**
     * 取得建築物列表
     * Get list of buildings
     */
    getBuildings() {
        return Object.keys(this.data.buildingGrid).sort();
    }
    
    /**
     * 取得特定建築物的樓層
     * Get floors for a specific building
     */
    getFloorsForBuilding(building) {
        const floors = this.data.buildingGrid[building];
        return floors ? Object.keys(floors).map(Number).sort((a, b) => b - a) : [];
    }
    
    /**
     * 取得特定建築物和樓層的案場
     * Get sites for a specific building and floor
     */
    getSitesForBuildingFloor(building, floor) {
        const floors = this.data.buildingGrid[building];
        return floors && floors[floor] ? floors[floor] : [];
    }
}

// 全域實例 / Global instance
window.unifiedDataLoader = new UnifiedDataLoader();

// 匯出供其他模組使用 / Export for other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnifiedDataLoader;
}