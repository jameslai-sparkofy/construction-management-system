/**
 * API Client for Construction Management System
 * Handles all API communications with the Workers backend
 */

class ApiClient {
  constructor(baseUrl = 'http://localhost:8787', tenantId = 'default') {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
    this.sessionToken = localStorage.getItem('sessionToken');
  }

  /**
   * Set authentication token
   */
  setSessionToken(token) {
    this.sessionToken = token;
    localStorage.setItem('sessionToken', token);
  }

  /**
   * Clear authentication
   */
  clearSession() {
    this.sessionToken = null;
    localStorage.removeItem('sessionToken');
  }

  /**
   * Make authenticated request
   */
  async request(method, endpoint, data = null) {
    const url = `${this.baseUrl}/api/v1/tenant/${this.tenantId}${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (this.sessionToken) {
      options.headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'API request failed');
      }

      return result;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  /**
   * Authentication APIs
   */
  async login(phone, password) {
    const result = await this.request('POST', '/auth/login', { phone, password });
    if (result.success && result.data.sessionId) {
      this.setSessionToken(result.data.sessionId);
    }
    return result;
  }

  async logout() {
    const result = await this.request('POST', '/auth/logout');
    this.clearSession();
    return result;
  }

  async getProfile() {
    return await this.request('GET', '/auth/profile');
  }

  /**
   * Project APIs
   */
  async getProjects(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return await this.request('GET', `/projects${queryParams ? '?' + queryParams : ''}`);
  }

  async getProject(projectId) {
    return await this.request('GET', `/projects/${projectId}`);
  }

  async createProject(projectData) {
    return await this.request('POST', '/projects', projectData);
  }

  async updateProject(projectId, updates) {
    return await this.request('PUT', `/projects/${projectId}`, updates);
  }

  /**
   * File APIs
   */
  async uploadFile(file, projectId, siteId, type) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseUrl}/api/v1/tenant/${this.tenantId}/files/upload?projectId=${projectId}&siteId=${siteId}&type=${type}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.sessionToken}`,
      },
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'File upload failed');
    }

    return result;
  }

  async getFile(fileId) {
    const url = `${this.baseUrl}/api/v1/tenant/${this.tenantId}/files/${fileId}`;
    return url; // Return URL for direct access
  }

  async deleteFile(fileId) {
    return await this.request('DELETE', `/files/${fileId}`);
  }

  async getSiteFiles(projectId, siteId) {
    return await this.request('GET', `/files/site/${siteId}?projectId=${projectId}`);
  }

  /**
   * CRM Integration APIs (through D1 proxy)
   */
  async getOpportunities(filters = {}) {
    // This would be proxied through your Workers API
    return await this.request('GET', '/crm/opportunities', filters);
  }

  async getOpportunity(opportunityId) {
    return await this.request('GET', `/crm/opportunities/${opportunityId}`);
  }

  async getSitesByOpportunity(opportunityId) {
    return await this.request('GET', `/crm/opportunities/${opportunityId}/sites`);
  }
}

// Export for use in other scripts
window.ApiClient = ApiClient;