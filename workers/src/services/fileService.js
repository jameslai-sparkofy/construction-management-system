/**
 * File Service - Handles file uploads to R2 storage
 */

export class FileService {
  constructor(env) {
    this.r2 = env.CONSTRUCTION_PHOTOS;
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  }

  /**
   * Upload construction photo to R2
   * @param {Request} request - The incoming request with file data
   * @param {Object} metadata - File metadata (projectId, siteId, type, userId)
   * @returns {Promise<Object>} Upload result with file info
   */
  async uploadConstructionPhoto(request, metadata) {
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!file || typeof file === 'string') {
        throw new Error('No file provided');
      }

      // Validate file type
      if (!this.allowedTypes.includes(file.type)) {
        throw new Error(`Invalid file type. Allowed types: ${this.allowedTypes.join(', ')}`);
      }

      // Validate file size
      if (file.size > this.maxFileSize) {
        throw new Error(`File too large. Maximum size is ${this.maxFileSize / 1024 / 1024}MB`);
      }

      // Generate unique filename
      const fileId = crypto.randomUUID();
      const extension = file.name.split('.').pop();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${metadata.projectId}/${metadata.siteId}/${metadata.type}/${timestamp}_${fileId}.${extension}`;

      // Upload to R2
      const arrayBuffer = await file.arrayBuffer();
      await this.r2.put(filename, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
        customMetadata: {
          originalName: file.name,
          projectId: metadata.projectId,
          siteId: metadata.siteId,
          type: metadata.type, // 'before' or 'after'
          uploadedBy: metadata.userId,
          uploadedAt: new Date().toISOString(),
        },
      });

      return {
        success: true,
        fileId,
        filename: file.name,
        path: filename,
        size: file.size,
        type: file.type,
        url: `/api/v1/files/${fileId}`,
        metadata,
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  /**
   * Get file from R2
   * @param {string} path - The file path in R2
   * @returns {Promise<Response>} File response
   */
  async getFile(path) {
    try {
      const object = await this.r2.get(path);
      
      if (!object) {
        throw new Error('File not found');
      }

      const headers = new Headers();
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('Content-Length', object.size.toString());
      
      // Add cache headers
      headers.set('Cache-Control', 'public, max-age=3600');
      headers.set('ETag', object.httpEtag);

      return new Response(object.body, { headers });
    } catch (error) {
      console.error('File retrieval error:', error);
      throw error;
    }
  }

  /**
   * Delete file from R2
   * @param {string} path - The file path in R2
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(path) {
    try {
      await this.r2.delete(path);
      return true;
    } catch (error) {
      console.error('File deletion error:', error);
      throw error;
    }
  }

  /**
   * List files for a specific site
   * @param {string} projectId - Project ID
   * @param {string} siteId - Site ID
   * @returns {Promise<Array>} List of files
   */
  async listSiteFiles(projectId, siteId) {
    try {
      const prefix = `${projectId}/${siteId}/`;
      const listed = await this.r2.list({ prefix, limit: 1000 });
      
      return listed.objects.map(obj => {
        const pathParts = obj.key.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const type = pathParts[2]; // before/after/difficulty/floorPlan
        
        return {
          key: obj.key,
          fileName,
          type,
          size: obj.size,
          uploaded: obj.uploaded,
          url: `/api/v1/files/raw/${encodeURIComponent(obj.key)}`,
          downloadUrl: `/api/v1/files/download/${encodeURIComponent(obj.key)}`,
          metadata: obj.customMetadata || {},
        };
      });
    } catch (error) {
      console.error('File listing error:', error);
      throw error;
    }
  }

  /**
   * Generate signed URL for direct upload (future enhancement)
   * @param {Object} metadata - File metadata
   * @returns {Promise<Object>} Signed URL info
   */
  async generateUploadUrl(metadata) {
    // This would require R2 presigned URLs when available
    // For now, uploads go through the Worker
    throw new Error('Direct upload not implemented yet');
  }
}