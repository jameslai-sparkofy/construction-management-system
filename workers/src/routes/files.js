/**
 * File management routes
 */

import { Router } from 'itty-router';
import { FileService } from '../services/fileService.js';
import { ResponseHelper } from '../utils/response.js';

export function createFileRoutes(env) {
  const router = Router({ base: '/files' });
  const fileService = new FileService(env);

  /**
   * Upload construction photo
   * POST /files/upload
   */
  router.post('/upload', async (request) => {
    try {
      const { projectId, siteId, type } = request.query;
      
      // Validate required parameters
      if (!projectId || !siteId || !type) {
        return ResponseHelper.error('Missing required parameters: projectId, siteId, type', 400);
      }

      if (!['before', 'after'].includes(type)) {
        return ResponseHelper.error('Type must be either "before" or "after"', 400);
      }

      const metadata = {
        projectId,
        siteId,
        type,
        userId: request.user.id,
      };

      const result = await fileService.uploadConstructionPhoto(request, metadata);
      
      // Store file metadata in KV for quick lookup
      await env.FILES_KV.put(
        `file:${result.fileId}`,
        JSON.stringify({
          path: result.path,
          metadata: result.metadata,
          uploadedAt: new Date().toISOString(),
        }),
        { expirationTtl: 365 * 24 * 60 * 60 } // 1 year
      );

      return ResponseHelper.success(result);
    } catch (err) {
      console.error('Upload error:', err);
      return ResponseHelper.error(err.message || 'File upload failed', 500);
    }
  });

  /**
   * Get file by ID
   * GET /files/:fileId
   */
  router.get('/:fileId', async (request) => {
    try {
      const { fileId } = request.params;
      
      // Get file metadata from KV
      const fileData = await env.FILES_KV.get(`file:${fileId}`, 'json');
      if (!fileData) {
        return ResponseHelper.error('File not found', 404);
      }

      // Return file from R2
      return await fileService.getFile(fileData.path);
    } catch (err) {
      console.error('File retrieval error:', err);
      return ResponseHelper.error(err.message || 'File retrieval failed', 500);
    }
  });

  /**
   * Delete file
   * DELETE /files/:fileId
   */
  router.delete('/:fileId', async (request) => {
    try {
      const { fileId } = request.params;
      
      // Check permissions
      if (!request.permissions.includes('delete')) {
        return ResponseHelper.error('Insufficient permissions', 403);
      }

      // Get file metadata from KV
      const fileData = await env.FILES_KV.get(`file:${fileId}`, 'json');
      if (!fileData) {
        return ResponseHelper.error('File not found', 404);
      }

      // Delete from R2
      await fileService.deleteFile(fileData.path);
      
      // Delete from KV
      await env.FILES_KV.delete(`file:${fileId}`);

      return ResponseHelper.success({ message: 'File deleted successfully' });
    } catch (err) {
      console.error('File deletion error:', err);
      return ResponseHelper.error(err.message || 'File deletion failed', 500);
    }
  });

  /**
   * List files for a site
   * GET /files/site/:siteId
   */
  router.get('/site/:siteId', async (request) => {
    try {
      const { siteId } = request.params;
      const { projectId } = request.query;
      
      if (!projectId) {
        return ResponseHelper.error('Missing required parameter: projectId', 400);
      }

      const files = await fileService.listSiteFiles(projectId, siteId);
      
      return ResponseHelper.success({
        files,
        count: files.length,
      });
    } catch (err) {
      console.error('File listing error:', err);
      return ResponseHelper.error(err.message || 'File listing failed', 500);
    }
  });

  /**
   * Batch upload multiple files
   * POST /files/batch-upload
   */
  router.post('/batch-upload', async (request) => {
    try {
      const { projectId, siteId, type } = request.query;
      
      if (!projectId || !siteId || !type) {
        return ResponseHelper.error('Missing required parameters', 400);
      }

      const formData = await request.formData();
      const files = formData.getAll('files');
      
      if (!files || files.length === 0) {
        return ResponseHelper.error('No files provided', 400);
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < files.length; i++) {
        try {
          // Create a new request for each file
          const fileFormData = new FormData();
          fileFormData.append('file', files[i]);
          
          const fileRequest = new Request(request.url, {
            method: 'POST',
            body: fileFormData,
          });
          
          // Copy user context
          fileRequest.user = request.user;

          const metadata = {
            projectId,
            siteId,
            type,
            userId: request.user.id,
          };

          const result = await fileService.uploadConstructionPhoto(fileRequest, metadata);
          
          // Store in KV
          await env.FILES_KV.put(
            `file:${result.fileId}`,
            JSON.stringify({
              path: result.path,
              metadata: result.metadata,
              uploadedAt: new Date().toISOString(),
            }),
            { expirationTtl: 365 * 24 * 60 * 60 }
          );

          results.push(result);
        } catch (err) {
          errors.push({
            file: files[i].name,
            error: err.message,
          });
        }
      }

      return ResponseHelper.success({
        uploaded: results,
        failed: errors,
        total: files.length,
        successful: results.length,
      });
    } catch (err) {
      console.error('Batch upload error:', err);
      return ResponseHelper.error(err.message || 'Batch upload failed', 500);
    }
  });

  return router;
}