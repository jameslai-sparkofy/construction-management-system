#!/usr/bin/env node

// 使用 Cloudflare API 直接部署 Worker
const fs = require('fs');
const https = require('https');

const API_TOKEN = 'Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4';
const WORKER_NAME = 'construction-management-api-clerk';

// 讀取 worker 代碼
const workerCode = fs.readFileSync('./workers-compatible.js', 'utf8');

// 首先獲取 account ID
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
            console.log('✅ Account found:', response.result[0].name);
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

// 部署 Worker
const deployWorker = async (accountId) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${accountId}/workers/scripts/${WORKER_NAME}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/javascript',
        'Content-Length': Buffer.byteLength(workerCode)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Response:', JSON.stringify(response, null, 2));
          if (response.success) {
            console.log('✅ Worker deployed successfully!');
            resolve(response);
          } else {
            reject(response.errors || 'Deployment failed');
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(workerCode);
    req.end();
  });
};

// 主執行流程
(async () => {
  try {
    console.log('🔍 Getting account ID...');
    const accountId = await getAccountId();
    
    console.log('🚀 Deploying worker...');
    await deployWorker(accountId);
    
    console.log(`🎉 Worker should be available at: https://${WORKER_NAME}.lai-jameslai.workers.dev/`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();