/**
 * 統一檔案管理路由
 * 整合 R2 檔案上傳與管理
 */

import { Hono } from 'hono';
import { createResponse, createErrorResponse, createSuccessResponse } from '../utils/response.js';

const files = new Hono();

// ========================================
// 檔案上傳
// ========================================

files.post('/upload', async (c) => {
  try {
    const user = c.get('user');
    const formData = await c.req.formData();
    const file = formData.get('file');
    
    if (!file) {
      return createErrorResponse(c, 'No file provided', 400);
    }

    // 檢查檔案類型和大小
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return createErrorResponse(c, 'File size exceeds limit (10MB)', 400);
    }

    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return createErrorResponse(c, 'File type not allowed', 400);
    }

    // 生成唯一檔案名
    const fileExtension = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;
    
    // 上傳到 R2
    await c.env.CONSTRUCTION_PHOTOS.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      },
      customMetadata: {
        uploadedBy: user.id,
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    });

    // 記錄檔案資訊到資料庫 (可選)
    const fileId = crypto.randomUUID();
    try {
      await c.env.DB_ENGINEERING
        .prepare(`
          INSERT INTO files (
            id, original_name, file_name, file_path, file_type, file_size,
            uploaded_by, uploaded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(fileId, file.name, fileName, fileName, file.type, file.size, user.id)
        .run();
    } catch (dbError) {
      console.warn('Failed to record file in database:', dbError);
      // 即使資料庫記錄失敗，檔案上傳成功
    }

    return createSuccessResponse(c, {
      file_id: fileId,
      file_name: fileName,
      original_name: file.name,
      file_type: file.type,
      file_size: file.size,
      upload_url: `/api/v1/files/${fileName}`,
      uploaded_at: new Date().toISOString()
    }, 'File uploaded successfully');

  } catch (error) {
    console.error('File upload error:', error);
    return createErrorResponse(c, 'Failed to upload file', 500);
  }
});

// ========================================
// 檔案下載/存取
// ========================================

files.get('/:fileName', async (c) => {
  try {
    const fileName = c.req.param('fileName');
    
    // 檢查檔案是否存在
    const fileObject = await c.env.CONSTRUCTION_PHOTOS.get(fileName);
    
    if (!fileObject) {
      return createErrorResponse(c, 'File not found', 404);
    }

    // 獲取檔案 metadata
    const metadata = fileObject.customMetadata || {};
    const httpMetadata = fileObject.httpMetadata || {};

    // 設定回應標頭
    const headers = {
      'Content-Type': httpMetadata.contentType || 'application/octet-stream',
      'Content-Length': fileObject.size.toString(),
      'Cache-Control': 'public, max-age=31536000', // 1年快取
    };

    if (httpMetadata.contentDisposition) {
      headers['Content-Disposition'] = httpMetadata.contentDisposition;
    }

    return new Response(fileObject.body, { headers });

  } catch (error) {
    console.error('File download error:', error);
    return createErrorResponse(c, 'Failed to download file', 500);
  }
});

// ========================================
// 獲取檔案列表
// ========================================

files.get('/', async (c) => {
  try {
    const user = c.get('user');
    const url = new URL(c.req.url);
    
    const filters = {
      uploaded_by: url.searchParams.get('uploaded_by'),
      file_type: url.searchParams.get('file_type'),
      limit: parseInt(url.searchParams.get('limit')) || 20,
      offset: parseInt(url.searchParams.get('offset')) || 0
    };

    let query = `
      SELECT 
        id, original_name, file_name, file_type, file_size,
        uploaded_by, uploaded_at,
        u.name as uploader_name
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
    `;
    
    const conditions = [];
    const params = [];
    
    // 權限過濾：非 Super Admin 只能看到自己上傳的檔案
    if (!user.is_super_admin) {
      conditions.push('f.uploaded_by = ?');
      params.push(user.id);
    } else if (filters.uploaded_by) {
      conditions.push('f.uploaded_by = ?');
      params.push(filters.uploaded_by);
    }
    
    if (filters.file_type) {
      conditions.push('f.file_type LIKE ?');
      params.push(`${filters.file_type}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ` ORDER BY f.uploaded_at DESC LIMIT ? OFFSET ?`;
    params.push(filters.limit, filters.offset);

    const filesResult = await c.env.DB_ENGINEERING
      .prepare(query)
      .bind(...params)
      .all();

    return createSuccessResponse(c, {
      files: (filesResult.results || []).map(file => ({
        ...file,
        download_url: `/api/v1/files/${file.file_name}`,
        file_size_mb: (file.file_size / (1024 * 1024)).toFixed(2)
      })),
      pagination: {
        limit: filters.limit,
        offset: filters.offset
      }
    });

  } catch (error) {
    console.error('Get files error:', error);
    return createErrorResponse(c, 'Failed to get files', 500);
  }
});

// ========================================
// 刪除檔案
// ========================================

files.delete('/:fileName', async (c) => {
  try {
    const fileName = c.req.param('fileName');
    const user = c.get('user');
    
    // 檢查檔案是否存在於資料庫
    const fileRecord = await c.env.DB_ENGINEERING
      .prepare('SELECT * FROM files WHERE file_name = ?')
      .bind(fileName)
      .first();
    
    // 權限檢查：只有檔案上傳者或 Super Admin 可以刪除
    if (fileRecord && !user.is_super_admin && fileRecord.uploaded_by !== user.id) {
      return createErrorResponse(c, 'Access denied to delete this file', 403);
    }

    // 從 R2 刪除檔案
    await c.env.CONSTRUCTION_PHOTOS.delete(fileName);
    
    // 從資料庫刪除記錄
    if (fileRecord) {
      await c.env.DB_ENGINEERING
        .prepare('DELETE FROM files WHERE file_name = ?')
        .bind(fileName)
        .run();
    }

    return createSuccessResponse(c, null, 'File deleted successfully');

  } catch (error) {
    console.error('Delete file error:', error);
    return createErrorResponse(c, 'Failed to delete file', 500);
  }
});

// ========================================
// 檔案統計
// ========================================

files.get('/stats/summary', async (c) => {
  try {
    const user = c.get('user');
    let whereClause = '';
    let params = [];
    
    // 權限過濾
    if (!user.is_super_admin) {
      whereClause = 'WHERE uploaded_by = ?';
      params.push(user.id);
    }

    // 總檔案數和總大小
    const totalResult = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          COUNT(*) as total_files,
          COALESCE(SUM(file_size), 0) as total_size
        FROM files ${whereClause}
      `)
      .bind(...params)
      .first();

    // 按檔案類型統計
    const typeResult = await c.env.DB_ENGINEERING
      .prepare(`
        SELECT 
          CASE 
            WHEN file_type LIKE 'image/%' THEN 'Images'
            WHEN file_type = 'application/pdf' THEN 'PDFs'
            WHEN file_type LIKE 'application/vnd.openxmlformats%' THEN 'Office Documents'
            ELSE 'Others'
          END as category,
          COUNT(*) as count,
          COALESCE(SUM(file_size), 0) as total_size
        FROM files ${whereClause}
        GROUP BY category
      `)
      .bind(...params)
      .all();

    // 轉換類型統計
    const byType = {};
    (typeResult.results || []).forEach(row => {
      byType[row.category] = {
        count: row.count,
        size: row.total_size,
        size_mb: (row.total_size / (1024 * 1024)).toFixed(2)
      };
    });

    return createSuccessResponse(c, {
      total_files: totalResult.total_files || 0,
      total_size: totalResult.total_size || 0,
      total_size_mb: ((totalResult.total_size || 0) / (1024 * 1024)).toFixed(2),
      by_type: byType
    });

  } catch (error) {
    console.error('Get file stats error:', error);
    return createErrorResponse(c, 'Failed to get file statistics', 500);
  }
});

export default files;