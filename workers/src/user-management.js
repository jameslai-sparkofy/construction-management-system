/**
 * 用戶管理模組
 * 處理專案用戶的加入、管理和權限
 */

export class UserManagement {
    constructor(env) {
        this.env = env;
        this.engineeringDB = env.DB_ENGINEERING || env.DB;
        this.crmDB = env.DB_CRM;
    }

    /**
     * 從員工表獲取可選擇的管理員
     */
    async getAvailableAdmins() {
        try {
            const result = await this.crmDB.prepare(`
                SELECT 
                    open_user_id as user_id,
                    name,
                    mobile as phone,
                    email,
                    main_department_id as department,
                    '' as position
                FROM employees_simple
                ORDER BY name
            `).all();

            return {
                success: true,
                data: result.results || []
            };
        } catch (error) {
            console.error('Error fetching admins:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 從工地師父表獲取可選擇的工人
     */
    async getAvailableWorkers(teamId = null) {
        try {
            let query = `
                SELECT 
                    _id as user_id,
                    name,
                    phone_number__c as phone,
                    owner__r,
                    owner_department as department,
                    field_D1087__c as team_id
                FROM object_50hj8__c
                WHERE is_deleted = 0
                AND life_status = 'normal'
            `;
            
            const params = [];
            if (teamId) {
                query += ` AND field_D1087__c = ?`;
                params.push(teamId);
            }
            
            query += ` ORDER BY name`;
            
            const stmt = params.length > 0 ? 
                this.crmDB.prepare(query).bind(...params) :
                this.crmDB.prepare(query);
                
            const result = await stmt.all();

            return {
                success: true,
                data: result.results || []
            };
        } catch (error) {
            console.error('Error fetching workers:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 獲取工班列表
     */
    async getAvailableTeams() {
        try {
            // 從 CRM 或工程資料庫獲取工班資訊
            // 這裡暫時使用固定資料，實際應從資料庫查詢
            const teams = [
                { id: 'team_001', name: '泥作工班A' },
                { id: 'team_002', name: '水電工班B' },
                { id: 'team_003', name: '油漆工班C' },
                { id: 'team_004', name: '木工班D' }
            ];

            return {
                success: true,
                data: teams
            };
        } catch (error) {
            console.error('Error fetching teams:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 從商機聯絡人表獲取可選擇的業主
     */
    async getAvailableOwners(opportunityId) {
        try {
            const query = opportunityId ? 
                `SELECT 
                    _id as user_id,
                    contact_id__r as name,
                    '' as phone,
                    '' as email,
                    '' as role
                FROM newopportunitycontactsobj
                WHERE new_opportunity_id__relation_ids = ?
                ORDER BY contact_id__r` :
                `SELECT 
                    _id as user_id,
                    contact_id__r as name,
                    '' as phone,
                    '' as email,
                    '' as role,
                    new_opportunity_id__relation_ids as opportunity_id
                FROM newopportunitycontactsobj
                ORDER BY contact_id__r`;

            const stmt = opportunityId ? 
                this.crmDB.prepare(query).bind(opportunityId) :
                this.crmDB.prepare(query);

            const result = await stmt.all();

            return {
                success: true,
                data: result.results || []
            };
        } catch (error) {
            console.error('Error fetching owners:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 添加用戶到專案
     */
    async addUserToProject(projectId, userInfo, addedBy) {
        try {
            const {
                user_id,
                user_type,
                user_role,
                source_table,
                phone,
                name,
                email,
                password_suffix
            } = userInfo;

            // 生成唯一ID
            const id = `pu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // 檢查用戶是否已存在
            const existing = await this.engineeringDB.prepare(`
                SELECT id FROM project_users
                WHERE project_id = ? AND user_id = ?
            `).bind(projectId, user_id).first();

            if (existing) {
                return {
                    success: false,
                    error: 'User already exists in project'
                };
            }

            // 驗證權限：只有admin或leader可以添加成員
            if (addedBy.user_type !== 'admin' && addedBy.user_role !== 'leader') {
                return {
                    success: false,
                    error: 'No permission to add users'
                };
            }

            // Leader只能添加member，不能添加其他leader（除非是admin）
            if (addedBy.user_role === 'leader' && user_role === 'leader' && addedBy.user_type !== 'admin') {
                // Leader可以添加其他leader
                // 根據需求，leader可以新增member和新增leader
            }

            // 插入用戶
            await this.engineeringDB.prepare(`
                INSERT INTO project_users (
                    id, project_id, user_id, user_type, user_role,
                    source_table, phone, name, email, password_suffix,
                    created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
                id, projectId, user_id, user_type, user_role,
                source_table, phone, name, email, 
                password_suffix || phone?.slice(-3), // 默認使用電話末3碼
                addedBy.user_id
            ).run();

            return {
                success: true,
                data: {
                    id,
                    project_id: projectId,
                    user_id,
                    name,
                    user_type,
                    user_role
                }
            };
        } catch (error) {
            console.error('Error adding user to project:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 獲取專案中的所有用戶
     */
    async getProjectUsers(projectId, filters = {}) {
        try {
            let query = `
                SELECT 
                    pu.*,
                    up.can_view_all,
                    up.can_edit_all,
                    up.can_add_members,
                    up.can_add_leaders,
                    up.is_team_member
                FROM project_users pu
                LEFT JOIN user_permissions up ON up.user_id = pu.user_id 
                    AND up.project_id = pu.project_id
                WHERE pu.project_id = ? AND pu.is_active = 1
            `;

            const params = [projectId];

            if (filters.user_type) {
                query += ` AND pu.user_type = ?`;
                params.push(filters.user_type);
            }

            if (filters.user_role) {
                query += ` AND pu.user_role = ?`;
                params.push(filters.user_role);
            }

            query += ` ORDER BY pu.user_type, pu.user_role, pu.name`;

            const result = await this.engineeringDB.prepare(query).bind(...params).all();

            // 分組返回
            const users = result.results || [];
            const grouped = {
                admins: users.filter(u => u.user_type === 'admin'),
                owners: users.filter(u => u.user_type === 'owner'),
                leaders: users.filter(u => u.user_type === 'worker' && u.user_role === 'leader'),
                members: users.filter(u => u.user_type === 'worker' && u.user_role === 'member')
            };

            return {
                success: true,
                data: {
                    all: users,
                    grouped,
                    total: users.length
                }
            };
        } catch (error) {
            console.error('Error fetching project users:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 更新用戶角色（leader提升member為leader）
     */
    async updateUserRole(projectId, userId, newRole, updatedBy) {
        try {
            // 檢查權限
            if (updatedBy.user_type !== 'admin' && updatedBy.user_role !== 'leader') {
                return {
                    success: false,
                    error: 'No permission to update user role'
                };
            }

            // 獲取目標用戶
            const targetUser = await this.engineeringDB.prepare(`
                SELECT * FROM project_users
                WHERE project_id = ? AND user_id = ?
            `).bind(projectId, userId).first();

            if (!targetUser) {
                return {
                    success: false,
                    error: 'User not found in project'
                };
            }

            // 只能更新worker的角色
            if (targetUser.user_type !== 'worker') {
                return {
                    success: false,
                    error: 'Can only update role for workers'
                };
            }

            // 更新角色
            await this.engineeringDB.prepare(`
                UPDATE project_users
                SET user_role = ?, updated_at = datetime('now')
                WHERE project_id = ? AND user_id = ?
            `).bind(newRole, projectId, userId).run();

            return {
                success: true,
                data: {
                    user_id: userId,
                    new_role: newRole
                }
            };
        } catch (error) {
            console.error('Error updating user role:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 移除用戶（軟刪除）
     */
    async removeUserFromProject(projectId, userId, removedBy) {
        try {
            // 檢查權限
            if (removedBy.user_type !== 'admin') {
                return {
                    success: false,
                    error: 'Only admin can remove users'
                };
            }

            // 軟刪除
            await this.engineeringDB.prepare(`
                UPDATE project_users
                SET is_active = 0, updated_at = datetime('now')
                WHERE project_id = ? AND user_id = ?
            `).bind(projectId, userId).run();

            return {
                success: true,
                message: 'User removed successfully'
            };
        } catch (error) {
            console.error('Error removing user:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 檢查用戶權限
     */
    async checkUserPermission(projectId, userId, permission) {
        try {
            const user = await this.engineeringDB.prepare(`
                SELECT * FROM user_permissions
                WHERE project_id = ? AND user_id = ?
            `).bind(projectId, userId).first();

            if (!user) {
                return false;
            }

            // 檢查特定權限
            switch (permission) {
                case 'view_all':
                    return user.can_view_all === 1;
                case 'edit_all':
                    return user.can_edit_all === 1;
                case 'add_members':
                    return user.can_add_members === 1;
                case 'add_leaders':
                    return user.can_add_leaders === 1;
                case 'manage_team':
                    return user.can_add_members === 1 || user.can_add_leaders === 1;
                default:
                    return false;
            }
        } catch (error) {
            console.error('Error checking permission:', error);
            return false;
        }
    }

    /**
     * 獲取用戶的工班分配
     */
    async getUserTeamAssignments(projectId, userId) {
        try {
            const result = await this.engineeringDB.prepare(`
                SELECT 
                    team_id,
                    assigned_sites_count,
                    can_view,
                    can_edit,
                    can_manage_members
                FROM user_team_assignments
                WHERE project_id = ? AND user_id = ?
            `).bind(projectId, userId).all();

            return {
                success: true,
                data: result.results || []
            };
        } catch (error) {
            console.error('Error fetching team assignments:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 創建新的工人（同步到CRM）
     */
    async createNewWorker(workerInfo) {
        try {
            const {
                name,
                phone,
                email,
                additional_info
            } = workerInfo;

            // 生成ID
            const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // 插入到 object_50hj8__c (工地師父表)
            await this.crmDB.prepare(`
                INSERT INTO object_50hj8__c (
                    _id, name, create_time, life_status, is_deleted
                ) VALUES (?, ?, ?, 'normal', 0)
            `).bind(workerId, name, Date.now()).run();

            // TODO: 同步到 CRM
            // 這裡需要調用 CRM API 來同步資料

            return {
                success: true,
                data: {
                    worker_id: workerId,
                    name,
                    phone
                }
            };
        } catch (error) {
            console.error('Error creating worker:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// API 路由處理
export async function handleUserManagementAPI(request, env, path) {
    const userMgmt = new UserManagement(env);
    const method = request.method;
    
    // 獲取當前用戶（從 session）
    const currentUser = await getCurrentUser(request, env);
    
    // 列出可選擇的用戶
    if (path.match(/^\/api\/v1\/users\/available\/(admins|workers|owners)$/)) {
        const type = path.split('/').pop();
        
        switch (type) {
            case 'admins':
                return userMgmt.getAvailableAdmins();
            case 'workers':
                const url = new URL(request.url);
                const teamId = url.searchParams.get('team_id');
                return userMgmt.getAvailableWorkers(teamId);
            case 'owners':
                const ownerUrl = new URL(request.url);
                const opportunityId = ownerUrl.searchParams.get('opportunity_id');
                return userMgmt.getAvailableOwners(opportunityId);
        }
    }
    
    // 添加用戶到專案
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users\/add$/) && method === 'POST') {
        const projectId = path.split('/')[4];
        const userInfo = await request.json();
        return userMgmt.addUserToProject(projectId, userInfo, currentUser);
    }
    
    // 獲取專案用戶
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users$/) && method === 'GET') {
        const projectId = path.split('/')[4];
        const url = new URL(request.url);
        const filters = {
            user_type: url.searchParams.get('type'),
            user_role: url.searchParams.get('role')
        };
        return userMgmt.getProjectUsers(projectId, filters);
    }
    
    // 更新用戶角色
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users\/([^\/]+)\/role$/) && method === 'PUT') {
        const projectId = path.split('/')[4];
        const userId = path.split('/')[6];
        const { role } = await request.json();
        return userMgmt.updateUserRole(projectId, userId, role, currentUser);
    }
    
    // 移除用戶
    if (path.match(/^\/api\/v1\/projects\/([^\/]+)\/users\/([^\/]+)$/) && method === 'DELETE') {
        const projectId = path.split('/')[4];
        const userId = path.split('/')[6];
        return userMgmt.removeUserFromProject(projectId, userId, currentUser);
    }
    
    // 獲取工班列表
    if (path === '/api/v1/teams' && method === 'GET') {
        return userMgmt.getAvailableTeams();
    }
    
    // 創建新工人
    if (path === '/api/v1/workers/create' && method === 'POST') {
        const workerInfo = await request.json();
        return userMgmt.createNewWorker(workerInfo);
    }
    
    return {
        success: false,
        error: 'Unknown endpoint'
    };
}

// 輔助函數：獲取當前用戶
async function getCurrentUser(request, env) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    
    // Check session in KV
    if (env.SESSIONS) {
        const session = await env.SESSIONS.get(token);
        if (session) {
            const user = JSON.parse(session);
            return {
                user_id: user.id,
                user_type: user.role || 'member',
                user_role: user.role === 'foreman' ? 'leader' : 
                          user.role === 'worker' ? 'member' : null,
                name: user.name
            };
        }
    }
    
    // Fallback for development
    if (token === 'dev-token-for-testing') {
        return {
            user_id: 'admin_001',
            user_type: 'admin',
            user_role: null,
            name: '系統管理員'
        };
    }
    
    return null;
}