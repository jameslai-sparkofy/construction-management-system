import { ResponseHelper } from '../utils/response.js';

/**
 * Projects routes
 */
export class ProjectsRoutes {
  constructor(d1ProxyService, authMiddleware, tenantMiddleware) {
    this.d1ProxyService = d1ProxyService;
    this.authMiddleware = authMiddleware;
    this.tenantMiddleware = tenantMiddleware;
  }

  /**
   * Get all projects
   * @param {Request} request - Request object
   * @param {object} user - Authenticated user
   * @returns {Promise<Response>} Projects response
   */
  async getProjects(request, user) {
    try {
      // Validate tenant access
      const tenantAccess = await this.tenantMiddleware.validateTenantAccess(request, user);
      if (!tenantAccess.allowed) {
        return tenantAccess.error;
      }

      // Parse query parameters for filtering
      const url = new URL(request.url);
      const filters = {
        status: url.searchParams.get('status'),
        search: url.searchParams.get('search'),
        limit: url.searchParams.get('limit') || '20',
        offset: url.searchParams.get('offset') || '0',
        sortBy: url.searchParams.get('sortBy') || 'created_at',
        sortOrder: url.searchParams.get('sortOrder') || 'desc'
      };

      // Remove null/undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === null || filters[key] === undefined) {
          delete filters[key];
        }
      });

      return await this.d1ProxyService.getProjects(user.tenantId, user, filters);

    } catch (error) {
      console.error('Get projects error:', error);
      return ResponseHelper.error('Failed to get projects');
    }
  }

  /**
   * Get project by ID
   * @param {Request} request - Request object
   * @param {object} user - Authenticated user
   * @param {string} projectId - Project ID
   * @returns {Promise<Response>} Project response
   */
  async getProject(request, user, projectId) {
    try {
      if (!projectId) {
        return ResponseHelper.validationError('Project ID is required');
      }

      // Validate tenant access
      const tenantAccess = await this.tenantMiddleware.validateTenantAccess(request, user);
      if (!tenantAccess.allowed) {
        return tenantAccess.error;
      }

      return await this.d1ProxyService.getProject(projectId, user.tenantId, user);

    } catch (error) {
      console.error('Get project error:', error);
      return ResponseHelper.error('Failed to get project');
    }
  }

  /**
   * Create new project
   * @param {Request} request - Request object
   * @param {object} user - Authenticated user
   * @returns {Promise<Response>} Create response
   */
  async createProject(request, user) {
    try {
      // Check permissions
      const permissionCheck = await this.authMiddleware.requirePermission('projects:create')(request);
      if (permissionCheck.error) {
        return permissionCheck.error;
      }

      // Validate tenant access
      const tenantAccess = await this.tenantMiddleware.validateTenantAccess(request, user);
      if (!tenantAccess.allowed) {
        return tenantAccess.error;
      }

      // Parse request body
      const projectData = await request.json();

      // Basic validation
      if (!projectData.name || !projectData.description) {
        return ResponseHelper.validationError('Project name and description are required');
      }

      // Add metadata
      projectData.createdBy = user.userId;
      projectData.tenantId = user.tenantId;

      return await this.d1ProxyService.createProject(projectData, user.tenantId, user);

    } catch (error) {
      console.error('Create project error:', error);
      if (error instanceof SyntaxError) {
        return ResponseHelper.validationError('Invalid JSON in request body');
      }
      return ResponseHelper.error('Failed to create project');
    }
  }

  /**
   * Update project
   * @param {Request} request - Request object
   * @param {object} user - Authenticated user
   * @param {string} projectId - Project ID
   * @returns {Promise<Response>} Update response
   */
  async updateProject(request, user, projectId) {
    try {
      if (!projectId) {
        return ResponseHelper.validationError('Project ID is required');
      }

      // Check permissions
      const permissionCheck = await this.authMiddleware.requirePermission('projects:update')(request);
      if (permissionCheck.error) {
        return permissionCheck.error;
      }

      // Validate tenant access
      const tenantAccess = await this.tenantMiddleware.validateTenantAccess(request, user);
      if (!tenantAccess.allowed) {
        return tenantAccess.error;
      }

      // Parse request body
      const projectData = await request.json();

      // Add metadata
      projectData.updatedBy = user.userId;
      projectData.updatedAt = new Date().toISOString();

      return await this.d1ProxyService.updateProject(projectId, projectData, user.tenantId, user);

    } catch (error) {
      console.error('Update project error:', error);
      if (error instanceof SyntaxError) {
        return ResponseHelper.validationError('Invalid JSON in request body');
      }
      return ResponseHelper.error('Failed to update project');
    }
  }

  /**
   * Delete project
   * @param {Request} request - Request object
   * @param {object} user - Authenticated user
   * @param {string} projectId - Project ID
   * @returns {Promise<Response>} Delete response
   */
  async deleteProject(request, user, projectId) {
    try {
      if (!projectId) {
        return ResponseHelper.validationError('Project ID is required');
      }

      // Check permissions
      const permissionCheck = await this.authMiddleware.requirePermission('projects:delete')(request);
      if (permissionCheck.error) {
        return permissionCheck.error;
      }

      // Validate tenant access
      const tenantAccess = await this.tenantMiddleware.validateTenantAccess(request, user);
      if (!tenantAccess.allowed) {
        return tenantAccess.error;
      }

      return await this.d1ProxyService.deleteProject(projectId, user.tenantId, user);

    } catch (error) {
      console.error('Delete project error:', error);
      return ResponseHelper.error('Failed to delete project');
    }
  }

  /**
   * Get project tasks
   * @param {Request} request - Request object
   * @param {object} user - Authenticated user
   * @param {string} projectId - Project ID
   * @returns {Promise<Response>} Tasks response
   */
  async getProjectTasks(request, user, projectId) {
    try {
      if (!projectId) {
        return ResponseHelper.validationError('Project ID is required');
      }

      // Validate tenant access
      const tenantAccess = await this.tenantMiddleware.validateTenantAccess(request, user);
      if (!tenantAccess.allowed) {
        return tenantAccess.error;
      }

      // Parse query parameters
      const url = new URL(request.url);
      const filters = {
        status: url.searchParams.get('status'),
        assignedTo: url.searchParams.get('assignedTo'),
        priority: url.searchParams.get('priority'),
        limit: url.searchParams.get('limit') || '50',
        offset: url.searchParams.get('offset') || '0'
      };

      // Remove null/undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === null || filters[key] === undefined) {
          delete filters[key];
        }
      });

      return await this.d1ProxyService.getProjectTasks(projectId, user.tenantId, user, filters);

    } catch (error) {
      console.error('Get project tasks error:', error);
      return ResponseHelper.error('Failed to get project tasks');
    }
  }

  /**
   * Create project task
   * @param {Request} request - Request object
   * @param {object} user - Authenticated user
   * @param {string} projectId - Project ID
   * @returns {Promise<Response>} Create response
   */
  async createProjectTask(request, user, projectId) {
    try {
      if (!projectId) {
        return ResponseHelper.validationError('Project ID is required');
      }

      // Check permissions
      const permissionCheck = await this.authMiddleware.requirePermission('tasks:create')(request);
      if (permissionCheck.error) {
        return permissionCheck.error;
      }

      // Validate tenant access
      const tenantAccess = await this.tenantMiddleware.validateTenantAccess(request, user);
      if (!tenantAccess.allowed) {
        return tenantAccess.error;
      }

      // Parse request body
      const taskData = await request.json();

      // Basic validation
      if (!taskData.title || !taskData.description) {
        return ResponseHelper.validationError('Task title and description are required');
      }

      // Add metadata
      taskData.createdBy = user.userId;
      taskData.projectId = projectId;

      return await this.d1ProxyService.createProjectTask(projectId, taskData, user.tenantId, user);

    } catch (error) {
      console.error('Create project task error:', error);
      if (error instanceof SyntaxError) {
        return ResponseHelper.validationError('Invalid JSON in request body');
      }
      return ResponseHelper.error('Failed to create project task');
    }
  }
}