/**
 * Test Helper - Mock Objects
 */

/**
 * Create mock environment
 */
export function createMockEnv() {
  return {
    // D1 Databases
    DB_ENGINEERING: createMockD1(),
    DB_CRM: createMockD1(),

    // KV Namespaces
    SESSION_STORE: createMockKV(),
    SYNC_STATE: createMockKV(),

    // R2 Bucket
    R2_BUCKET: createMockR2(),

    // Environment variables
    JWT_SECRET: 'test-jwt-secret',
    FX_API_TOKEN: 'test-api-token',
    FX_API_BASE_URL: 'https://test-api.example.com',
    ENVIRONMENT: 'test',
    LOG_LEVEL: 'debug'
  };
}

/**
 * Create mock D1 database
 */
export function createMockD1() {
  return {
    prepare: (sql) => ({
      bind: (...params) => ({
        first: async () => null,
        all: async () => ({ results: [], success: true }),
        run: async () => ({ success: true })
      }),
      first: async () => null,
      all: async () => ({ results: [], success: true }),
      run: async () => ({ success: true })
    }),
    batch: async (statements) => {
      return statements.map(() => ({ success: true }));
    },
    exec: async (sql) => ({ success: true })
  };
}

/**
 * Create mock KV namespace
 */
export function createMockKV() {
  const store = new Map();

  return {
    get: async (key) => store.get(key) || null,
    put: async (key, value, options = {}) => {
      store.set(key, value);
      if (options.expirationTtl) {
        setTimeout(() => store.delete(key), options.expirationTtl * 1000);
      }
    },
    delete: async (key) => store.delete(key),
    list: async (options = {}) => {
      const keys = Array.from(store.keys());
      const filtered = options.prefix 
        ? keys.filter(k => k.startsWith(options.prefix))
        : keys;
      
      return {
        keys: filtered.slice(0, options.limit || 1000).map(name => ({ name })),
        list_complete: filtered.length <= (options.limit || 1000)
      };
    }
  };
}

/**
 * Create mock R2 bucket
 */
export function createMockR2() {
  const objects = new Map();

  return {
    put: async (key, value, options = {}) => {
      objects.set(key, {
        key,
        value,
        size: value.size || value.length,
        httpMetadata: options.httpMetadata || {},
        customMetadata: options.customMetadata || {},
        uploaded: new Date().toISOString()
      });
      
      return {
        key,
        version: '1',
        size: value.size || value.length,
        etag: 'mock-etag',
        httpEtag: 'mock-http-etag',
        checksums: {},
        uploaded: new Date().toISOString()
      };
    },
    get: async (key) => {
      const obj = objects.get(key);
      if (!obj) return null;
      
      return {
        body: obj.value,
        bodyUsed: false,
        arrayBuffer: async () => obj.value,
        text: async () => obj.value.toString(),
        json: async () => JSON.parse(obj.value.toString()),
        blob: async () => new Blob([obj.value]),
        ...obj
      };
    },
    delete: async (key) => {
      objects.delete(key);
    },
    list: async (options = {}) => {
      let keys = Array.from(objects.keys());
      
      if (options.prefix) {
        keys = keys.filter(k => k.startsWith(options.prefix));
      }
      
      const limit = options.limit || 1000;
      const truncated = keys.length > limit;
      const listedKeys = keys.slice(0, limit);
      
      return {
        objects: listedKeys.map(key => ({
          key,
          size: objects.get(key).size,
          uploaded: objects.get(key).uploaded,
          etag: 'mock-etag',
          httpEtag: 'mock-http-etag',
          checksums: {}
        })),
        truncated,
        cursor: truncated ? 'mock-cursor' : undefined,
        delimitedPrefixes: []
      };
    },
    head: async (key) => {
      const obj = objects.get(key);
      if (!obj) return null;
      
      return {
        key,
        size: obj.size,
        etag: 'mock-etag',
        httpEtag: 'mock-http-etag',
        checksums: {},
        uploaded: obj.uploaded,
        httpMetadata: obj.httpMetadata,
        customMetadata: obj.customMetadata
      };
    }
  };
}

/**
 * Create mock request
 */
export function createMockRequest(options = {}) {
  const url = options.url || 'https://test.example.com/api/test';
  const method = options.method || 'GET';
  const headers = new Map(Object.entries(options.headers || {}));
  const body = options.body || null;

  return {
    url,
    method,
    headers: {
      get: (key) => headers.get(key.toLowerCase()),
      has: (key) => headers.has(key.toLowerCase()),
      entries: () => headers.entries(),
      forEach: (fn) => headers.forEach(fn),
      keys: () => headers.keys(),
      values: () => headers.values()
    },
    body,
    json: async () => {
      if (typeof body === 'string') {
        return JSON.parse(body);
      }
      return body;
    },
    text: async () => {
      if (typeof body === 'string') {
        return body;
      }
      return JSON.stringify(body);
    },
    formData: async () => {
      return new FormData();
    },
    arrayBuffer: async () => {
      return new ArrayBuffer(0);
    },
    blob: async () => {
      return new Blob([body || '']);
    },
    cf: {
      colo: 'SJC',
      country: 'US',
      city: 'San Jose',
      continent: 'NA',
      latitude: '37.3382',
      longitude: '-121.8863',
      postalCode: '95113',
      region: 'California',
      regionCode: 'CA',
      timezone: 'America/Los_Angeles'
    },
    clone: () => createMockRequest(options)
  };
}

/**
 * Create mock response
 */
export function createMockResponse(body, options = {}) {
  const status = options.status || 200;
  const statusText = options.statusText || 'OK';
  const headers = new Map(Object.entries(options.headers || {}));

  return {
    status,
    statusText,
    headers: {
      get: (key) => headers.get(key.toLowerCase()),
      has: (key) => headers.has(key.toLowerCase()),
      set: (key, value) => headers.set(key.toLowerCase(), value),
      append: (key, value) => {
        const existing = headers.get(key.toLowerCase());
        if (existing) {
          headers.set(key.toLowerCase(), `${existing}, ${value}`);
        } else {
          headers.set(key.toLowerCase(), value);
        }
      },
      delete: (key) => headers.delete(key.toLowerCase()),
      entries: () => headers.entries(),
      forEach: (fn) => headers.forEach(fn),
      keys: () => headers.keys(),
      values: () => headers.values()
    },
    ok: status >= 200 && status < 300,
    redirected: false,
    type: 'basic',
    url: options.url || 'https://test.example.com/api/test',
    body,
    bodyUsed: false,
    json: async () => {
      if (typeof body === 'string') {
        return JSON.parse(body);
      }
      return body;
    },
    text: async () => {
      if (typeof body === 'string') {
        return body;
      }
      return JSON.stringify(body);
    },
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob([body || '']),
    formData: async () => new FormData(),
    clone: () => createMockResponse(body, options)
  };
}

/**
 * Create mock execution context
 */
export function createMockContext() {
  const waitUntilPromises = [];
  const passThroughOnExceptionCalled = false;

  return {
    waitUntil: (promise) => {
      waitUntilPromises.push(promise);
    },
    passThroughOnException: () => {
      passThroughOnExceptionCalled = true;
    },
    // Test helpers
    getWaitUntilPromises: () => waitUntilPromises,
    wasPassThroughOnExceptionCalled: () => passThroughOnExceptionCalled
  };
}

/**
 * Create mock fetch
 */
export function createMockFetch(responses = {}) {
  return async (url, options = {}) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    
    // Find matching response
    for (const [pattern, response] of Object.entries(responses)) {
      if (urlStr.includes(pattern)) {
        if (typeof response === 'function') {
          return response(url, options);
        }
        return createMockResponse(response.body, response);
      }
    }

    // Default response
    return createMockResponse(
      { error: 'Not found' },
      { status: 404, statusText: 'Not Found' }
    );
  };
}

/**
 * Mock timer utilities
 */
export class MockTimer {
  constructor() {
    this.currentTime = Date.now();
    this.timers = [];
  }

  now() {
    return this.currentTime;
  }

  advance(ms) {
    this.currentTime += ms;
    this.runTimers();
  }

  setTimeout(fn, delay) {
    const timer = {
      fn,
      time: this.currentTime + delay,
      type: 'timeout'
    };
    this.timers.push(timer);
    return timer;
  }

  setInterval(fn, interval) {
    const timer = {
      fn,
      time: this.currentTime + interval,
      interval,
      type: 'interval'
    };
    this.timers.push(timer);
    return timer;
  }

  clearTimeout(timer) {
    const index = this.timers.indexOf(timer);
    if (index !== -1) {
      this.timers.splice(index, 1);
    }
  }

  clearInterval(timer) {
    this.clearTimeout(timer);
  }

  runTimers() {
    const toRun = this.timers.filter(t => t.time <= this.currentTime);
    
    for (const timer of toRun) {
      timer.fn();
      
      if (timer.type === 'interval') {
        timer.time = this.currentTime + timer.interval;
      } else {
        const index = this.timers.indexOf(timer);
        this.timers.splice(index, 1);
      }
    }
  }

  reset() {
    this.currentTime = Date.now();
    this.timers = [];
  }
}