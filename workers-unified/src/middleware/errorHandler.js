/**
 * 統一錯誤處理中間件
 */

import { createErrorResponse } from '../utils/response.js';

export async function errorHandler(c, next) {
  try {
    await next();
  } catch (error) {
    console.error('API Error:', {
      path: c.req.path,
      method: c.req.method,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // 檢查是否為已知的錯誤類型
    if (error.name === 'ValidationError') {
      return createErrorResponse(c, error.message, 400, error.details);
    }

    if (error.name === 'AuthError') {
      return createErrorResponse(c, 'Authentication failed', 401);
    }

    if (error.name === 'PermissionError') {
      return createErrorResponse(c, 'Access denied', 403);
    }

    if (error.name === 'NotFoundError') {
      return createErrorResponse(c, 'Resource not found', 404);
    }

    // 默認內部伺服器錯誤
    const isDev = c.env.ENABLE_DEBUG === 'true';
    return createErrorResponse(c, 
      isDev ? error.message : 'Internal server error',
      500,
      isDev ? { stack: error.stack } : null
    );
  }
}