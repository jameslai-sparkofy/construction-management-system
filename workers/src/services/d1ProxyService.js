import { ResponseHelper } from '../utils/response.js';

/**
 * D1 Proxy Service to connect to existing REST API
 * This service acts as a proxy between the Workers and the existing REST API
 */
export class D1ProxyService {
  constructor(env) {
    this.apiBaseUrl = env.API_BASE_URL;
    this.crudApiUrl = env.CRUD_API_URL;
    this.apiToken = env.REST_API_TOKEN;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Construction-Management-Workers/1.0',
      'Authorization': `Bearer ${this.apiToken}`
    };
  }

  /**
   * Make a request to the external API
   * @param {string} endpoint - API endpoint
   * @param {object} options - Request options
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context for authorization
   * @returns {Promise<Response>} API response
   */
  async makeRequest(endpoint, options = {}, tenantId = null, userContext = null) {
    try {
      const url = new URL(endpoint, this.apiBaseUrl);
      
      const headers = {
        ...this.defaultHeaders,
        ...options.headers
      };

      // Add tenant context
      if (tenantId) {
        headers['X-Tenant-ID'] = tenantId;
      }

      // Add user context for API authorization
      if (userContext && userContext.userInfo) {
        headers['X-User-ID'] = userContext.userId;
        headers['X-User-Role'] = userContext.userInfo.role;
        // You might want to add other user context headers as needed
      }

      const requestOptions = {
        method: options.method || 'GET',
        headers,
        ...(options.body && { body: options.body })
      };

      const response = await fetch(url.toString(), requestOptions);
      
      // Check if the response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API request failed: ${response.status} ${response.statusText}`, errorText);
        
        return ResponseHelper.error(
          `External API error: ${response.statusText}`,
          response.status,
          'EXTERNAL_API_ERROR',
          { endpoint, status: response.status }
        );
      }

      // Try to parse JSON response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        return ResponseHelper.success(data);
      } else {
        const text = await response.text();
        return ResponseHelper.success({ content: text });
      }

    } catch (error) {
      console.error('D1 Proxy Service error:', error);
      return ResponseHelper.error(
        'Failed to connect to external API',
        500,
        'CONNECTION_ERROR',
        { endpoint, error: error.message }
      );
    }
  }

  /**
   * Get data from external API
   * @param {string} endpoint - API endpoint
   * @param {object} queryParams - Query parameters
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @returns {Promise<Response>} API response
   */
  async get(endpoint, queryParams = {}, tenantId = null, userContext = null) {
    const url = new URL(endpoint, this.apiBaseUrl);
    
    // Add query parameters
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] !== undefined && queryParams[key] !== null) {
        url.searchParams.append(key, queryParams[key]);
      }
    });

    return await this.makeRequest(url.pathname + url.search, {
      method: 'GET'
    }, tenantId, userContext);
  }

  /**
   * Post data to external API
   * @param {string} endpoint - API endpoint
   * @param {object} data - Data to post
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @returns {Promise<Response>} API response
   */
  async post(endpoint, data = {}, tenantId = null, userContext = null) {
    return await this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    }, tenantId, userContext);
  }

  /**
   * Put data to external API
   * @param {string} endpoint - API endpoint
   * @param {object} data - Data to put
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @returns {Promise<Response>} API response
   */
  async put(endpoint, data = {}, tenantId = null, userContext = null) {
    return await this.makeRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, tenantId, userContext);
  }

  /**
   * Patch data to external API
   * @param {string} endpoint - API endpoint
   * @param {object} data - Data to patch
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @returns {Promise<Response>} API response
   */
  async patch(endpoint, data = {}, tenantId = null, userContext = null) {
    return await this.makeRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }, tenantId, userContext);
  }

  /**
   * Delete data from external API
   * @param {string} endpoint - API endpoint
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @returns {Promise<Response>} API response
   */
  async delete(endpoint, tenantId = null, userContext = null) {
    return await this.makeRequest(endpoint, {
      method: 'DELETE'
    }, tenantId, userContext);
  }

  /**
   * Get projects for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @param {object} filters - Filter parameters
   * @returns {Promise<Response>} Projects response
   */
  async getProjects(tenantId, userContext, filters = {}) {
    return await this.get('/projects', filters, tenantId, userContext);
  }

  /**
   * Get project by ID
   * @param {string} projectId - Project ID
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @returns {Promise<Response>} Project response
   */
  async getProject(projectId, tenantId, userContext) {
    return await this.get(`/projects/${projectId}`, {}, tenantId, userContext);
  }

  /**
   * Create a new project
   * @param {object} projectData - Project data
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @returns {Promise<Response>} Create response
   */
  async createProject(projectData, tenantId, userContext) {
    return await this.post('/projects', projectData, tenantId, userContext);
  }

  /**
   * Update a project
   * @param {string} projectId - Project ID
   * @param {object} projectData - Project data
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @returns {Promise<Response>} Update response
   */
  async updateProject(projectId, projectData, tenantId, userContext) {
    return await this.put(`/projects/${projectId}`, projectData, tenantId, userContext);
  }

  /**
   * Delete a project
   * @param {string} projectId - Project ID
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @returns {Promise<Response>} Delete response
   */
  async deleteProject(projectId, tenantId, userContext) {
    return await this.delete(`/projects/${projectId}`, tenantId, userContext);
  }

  /**
   * Get tasks for a project
   * @param {string} projectId - Project ID
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @param {object} filters - Filter parameters
   * @returns {Promise<Response>} Tasks response
   */
  async getProjectTasks(projectId, tenantId, userContext, filters = {}) {
    return await this.get(`/projects/${projectId}/tasks`, filters, tenantId, userContext);
  }

  /**
   * Create a task for a project
   * @param {string} projectId - Project ID
   * @param {object} taskData - Task data
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @returns {Promise<Response>} Create response
   */
  async createProjectTask(projectId, taskData, tenantId, userContext) {
    return await this.post(`/projects/${projectId}/tasks`, taskData, tenantId, userContext);
  }

  /**
   * Get users for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @param {object} filters - Filter parameters
   * @returns {Promise<Response>} Users response
   */
  async getUsers(tenantId, userContext, filters = {}) {
    return await this.get('/users', filters, tenantId, userContext);
  }

  /**
   * Get reports for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {object} userContext - User context
   * @param {object} filters - Filter parameters
   * @returns {Promise<Response>} Reports response
   */
  async getReports(tenantId, userContext, filters = {}) {
    return await this.get('/reports', filters, tenantId, userContext);
  }

  /**
   * Get opportunities from CRM
   * @param {object} filters - Filter parameters
   * @returns {Promise<Response>} Opportunities response
   */
  async getOpportunities(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    const url = `${this.apiBaseUrl}/rest/newopportunityobj${queryParams ? '?' + queryParams : ''}`;
    
    const response = await fetch(url, {
      headers: this.defaultHeaders
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch opportunities: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get single opportunity by ID
   * @param {string} opportunityId - Opportunity ID
   * @returns {Promise<Response>} Opportunity response
   */
  async getOpportunity(opportunityId) {
    const url = `${this.apiBaseUrl}/rest/newopportunityobj/${opportunityId}`;
    
    const response = await fetch(url, {
      headers: this.defaultHeaders
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch opportunity: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get sites (案場) for an opportunity
   * @param {string} opportunityId - Opportunity ID
   * @returns {Promise<Response>} Sites response
   */
  async getSitesByOpportunity(opportunityId) {
    const url = `${this.apiBaseUrl}/rest/object_8w9cb__c?field_8eM2Z__c=${opportunityId}`;
    
    const response = await fetch(url, {
      headers: this.defaultHeaders
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sites: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Execute custom SQL query
   * @param {string} query - SQL query
   * @param {array} params - Query parameters
   * @returns {Promise<Response>} Query response
   */
  async executeQuery(query, params = []) {
    const url = `${this.apiBaseUrl}/query`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify({ query, params })
    });

    if (!response.ok) {
      throw new Error(`Failed to execute query: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create a new project from opportunity
   * @param {object} projectData - Project data
   * @returns {Promise<Response>} Create response
   */
  async createProjectFromOpportunity(projectData) {
    // This would use the CRUD API to create project-specific data
    const url = `${this.crudApiUrl}/crud/projects`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: JSON.stringify(projectData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create project: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Update site construction status
   * @param {string} siteId - Site ID
   * @param {object} updateData - Update data
   * @returns {Promise<Response>} Update response
   */
  async updateSiteStatus(siteId, updateData) {
    const url = `${this.crudApiUrl}/crud/object_8w9cb__c/${siteId}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.defaultHeaders,
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`Failed to update site: ${response.statusText}`);
    }

    return await response.json();
  }
}