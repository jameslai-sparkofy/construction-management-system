/**
 * 統一回應工具函數
 */

export function createResponse(c, data, status = 200, headers = {}) {
  const response = {
    success: status < 400,
    timestamp: new Date().toISOString(),
    ...data
  };

  // 如果是錯誤回應且沒有 error 欄位，自動添加
  if (status >= 400 && !data.error) {
    response.error = data.message || 'Unknown error';
  }

  return c.json(response, status, {
    'Content-Type': 'application/json',
    ...headers
  });
}

export function createErrorResponse(c, message, status = 400, details = null) {
  return createResponse(c, {
    error: message,
    details
  }, status);
}

export function createSuccessResponse(c, data, message = null) {
  const response = { data };
  if (message) response.message = message;
  return createResponse(c, response);
}