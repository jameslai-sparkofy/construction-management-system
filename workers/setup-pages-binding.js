#!/usr/bin/env node

const https = require('https');

const API_TOKEN = 'Z8a74MaqCOOSQVUJHWJF7R5JXlrkWix4UxXzpkW4';
const PAGES_PROJECT_NAME = 'construction-management-frontend';
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

// 更新 Pages 專案的 Service Binding
const updatePagesBindings = async (accountId) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      compatibility_date: "2024-11-06",
      compatibility_flags: [],
      bindings: [
        {
          name: "API_SERVICE",
          type: "service", 
          service: WORKER_NAME,
          environment: "production"
        }
      ]
    });

    const options = {
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${accountId}/pages/projects/${PAGES_PROJECT_NAME}/deployment_configs/production`,
      method: 'PATCH',
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
          console.log('Binding Response:', JSON.stringify(response, null, 2));
          if (response.success) {
            resolve(response);
          } else {
            reject(response.errors || 'Failed to set binding');
          }
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
    
    console.log('🔗 Setting up Service Binding...');
    await updatePagesBindings(accountId);
    
    console.log('✅ Service Binding configured!');
    console.log('🎉 Frontend should now be able to access Worker via env.API_SERVICE');
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();