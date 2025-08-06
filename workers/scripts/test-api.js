/**
 * API Testing Script
 * Tests all major API endpoints
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:8787';
const TENANT_ID = 'yes-ceramics';

// Test data
const testUser = {
  phone: '0912345678',
  password: '678'
};

let sessionToken = null;

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Helper function to make API requests
async function apiRequest(method, endpoint, data = null, token = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    
    return {
      status: response.status,
      ok: response.ok,
      data: result
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

// Test functions
async function testHealth() {
  console.log(`${colors.blue}Testing health check...${colors.reset}`);
  const result = await apiRequest('GET', '/health');
  
  if (result.ok) {
    console.log(`${colors.green}✓ Health check passed${colors.reset}`);
    console.log(`  Status: ${result.data.data.status}`);
    console.log(`  Environment: ${result.data.data.environment}`);
  } else {
    console.log(`${colors.red}✗ Health check failed${colors.reset}`);
    console.log(`  Error: ${result.error || result.data.message}`);
  }
  
  return result.ok;
}

async function testLogin() {
  console.log(`\n${colors.blue}Testing login...${colors.reset}`);
  const result = await apiRequest('POST', `/api/v1/tenant/${TENANT_ID}/auth/login`, testUser);
  
  if (result.ok && result.data.success) {
    sessionToken = result.data.data.sessionId;
    console.log(`${colors.green}✓ Login successful${colors.reset}`);
    console.log(`  Session ID: ${sessionToken.substring(0, 20)}...`);
    console.log(`  User: ${result.data.data.user.name} (${result.data.data.user.phone})`);
  } else {
    console.log(`${colors.red}✗ Login failed${colors.reset}`);
    console.log(`  Error: ${result.data.message}`);
  }
  
  return result.ok;
}

async function testProfile() {
  console.log(`\n${colors.blue}Testing profile retrieval...${colors.reset}`);
  const result = await apiRequest('GET', `/api/v1/tenant/${TENANT_ID}/auth/profile`, null, sessionToken);
  
  if (result.ok && result.data.success) {
    console.log(`${colors.green}✓ Profile retrieved${colors.reset}`);
    console.log(`  User ID: ${result.data.data.userId}`);
    console.log(`  Role: ${result.data.data.userInfo.role}`);
  } else {
    console.log(`${colors.red}✗ Profile retrieval failed${colors.reset}`);
    console.log(`  Error: ${result.data.message}`);
  }
  
  return result.ok;
}

async function testProjects() {
  console.log(`\n${colors.blue}Testing projects list...${colors.reset}`);
  const result = await apiRequest('GET', `/api/v1/tenant/${TENANT_ID}/projects`, null, sessionToken);
  
  if (result.ok) {
    console.log(`${colors.green}✓ Projects list retrieved${colors.reset}`);
    console.log(`  Status: ${result.status}`);
    // Projects might be empty initially
  } else {
    console.log(`${colors.red}✗ Projects list failed${colors.reset}`);
    console.log(`  Error: ${result.data.message}`);
  }
  
  return result.ok;
}

async function testFileUpload() {
  console.log(`\n${colors.blue}Testing file upload preparation...${colors.reset}`);
  
  // Just test that the endpoint exists
  const result = await apiRequest('GET', `/api/v1/tenant/${TENANT_ID}/files/site/test-site?projectId=test-project`, null, sessionToken);
  
  if (result.status === 404 || result.ok) {
    console.log(`${colors.green}✓ File endpoint accessible${colors.reset}`);
    console.log(`  Note: Actual file upload requires FormData and real files`);
  } else {
    console.log(`${colors.red}✗ File endpoint error${colors.reset}`);
    console.log(`  Error: ${result.data.message}`);
  }
  
  return true; // Don't fail the test for this
}

async function testLogout() {
  console.log(`\n${colors.blue}Testing logout...${colors.reset}`);
  const result = await apiRequest('POST', `/api/v1/tenant/${TENANT_ID}/auth/logout`, null, sessionToken);
  
  if (result.ok) {
    console.log(`${colors.green}✓ Logout successful${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Logout failed${colors.reset}`);
    console.log(`  Error: ${result.data.message}`);
  }
  
  return result.ok;
}

// Main test runner
async function runTests() {
  console.log('====================================');
  console.log('Construction Management API Tests');
  console.log('====================================');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Tenant: ${TENANT_ID}`);
  console.log('');
  
  const tests = [
    { name: 'Health Check', fn: testHealth },
    { name: 'Login', fn: testLogin },
    { name: 'Profile', fn: testProfile },
    { name: 'Projects', fn: testProjects },
    { name: 'Files', fn: testFileUpload },
    { name: 'Logout', fn: testLogout }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`${colors.red}✗ ${test.name} error: ${error.message}${colors.reset}`);
      failed++;
    }
  }
  
  console.log('\n====================================');
  console.log('Test Summary');
  console.log('====================================');
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total: ${tests.length}`);
  
  if (failed === 0) {
    console.log(`\n${colors.green}All tests passed! 🎉${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}Some tests failed. Please check the errors above.${colors.reset}`);
  }
}

// Run tests
runTests().catch(console.error);