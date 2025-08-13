#!/usr/bin/env node

const https = require('https');

const API_TOKEN = 'Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4';
const WORKER_NAME = 'construction-management-api-clerk';

// 獲取 account ID
const getAccountId = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: '/client/v4/accounts',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success && response.result.length > 0) {
            resolve(response.result[0].id);
          } else {
            reject('No accounts found');
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

// 設定 workers.dev 路由
const setupRoute = async (accountId) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      enabled: true
    });

    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${accountId}/workers/scripts/${WORKER_NAME}/subdomain`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Route Response:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

// 主執行
(async () => {
  try {
    console.log('🔍 Getting account ID...');
    const accountId = await getAccountId();
    
    console.log('🛣️ Setting up route...');
    await setupRoute(accountId);
    
    console.log('✅ Route should be configured');
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();