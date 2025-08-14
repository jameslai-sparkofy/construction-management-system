# Construction Management Workers

Cloudflare Workers backend for the construction management system.

## Features

- **Authentication**: Phone number + last 3 digits password authentication
- **Session Management**: JWT-based sessions stored in Workers KV
- **Tenant Isolation**: Multi-tenant architecture with proper isolation
- **CORS Support**: Cross-origin resource sharing for frontend integration
- **API Proxy**: Proxy service to connect to existing REST API
- **Role-based Access Control**: Permission and role-based authorization

## Project Structure

```
workers/
├── src/
│   ├── auth/
│   │   └── authService.js          # Authentication service
│   ├── middleware/
│   │   ├── auth.js                 # Authentication middleware
│   │   ├── cors.js                 # CORS middleware
│   │   └── tenant.js               # Tenant isolation middleware
│   ├── routes/
│   │   ├── auth.js                 # Authentication routes
│   │   ├── projects.js             # Project management routes
│   │   ├── users.js                # User management routes
│   │   └── reports.js              # Reporting routes
│   ├── services/
│   │   ├── d1ProxyService.js       # D1 database proxy service
│   │   └── sessionService.js       # Session management service
│   ├── utils/
│   │   └── response.js             # Response helpers and utilities
│   └── index.js                    # Main entry point
├── package.json                    # Dependencies and scripts
├── wrangler.toml                   # Cloudflare Workers configuration
└── README.md                       # This file
```

## Setup

### Prerequisites

- Node.js 18 or later
- Cloudflare account
- Wrangler CLI

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `wrangler.toml`:
   - Update `API_BASE_URL` with your existing API endpoint
   - Update `JWT_SECRET` with a secure secret key
   - Configure KV namespace IDs

3. Create KV namespaces:
```bash
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "USERS"
```

4. Update `wrangler.toml` with the generated KV namespace IDs.

## Development

Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:8787`

## Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## API Endpoints

### Authentication

- `POST /api/v1/tenant/:tenantId/auth/login` - User login
- `POST /api/v1/tenant/:tenantId/auth/logout` - User logout
- `POST /api/v1/tenant/:tenantId/auth/refresh` - Refresh session
- `GET /api/v1/tenant/:tenantId/auth/profile` - Get user profile

### Projects

- `GET /api/v1/tenant/:tenantId/projects` - List projects
- `GET /api/v1/tenant/:tenantId/projects/:id` - Get project details
- `POST /api/v1/tenant/:tenantId/projects` - Create project
- `PUT /api/v1/tenant/:tenantId/projects/:id` - Update project
- `DELETE /api/v1/tenant/:tenantId/projects/:id` - Delete project
- `GET /api/v1/tenant/:tenantId/projects/:id/tasks` - Get project tasks
- `POST /api/v1/tenant/:tenantId/projects/:id/tasks` - Create project task

### Users

- `GET /api/v1/tenant/:tenantId/users` - List users

### Reports

- `GET /api/v1/tenant/:tenantId/reports` - Get reports

## Authentication

The API uses session-based authentication with the following flow:

1. **Login**: Send phone number and 3-digit password to `/auth/login`
2. **Session**: Receive session ID (Bearer token) for subsequent requests
3. **Authorization**: Include `Authorization: Bearer <session-id>` header in requests
4. **Tenant**: Include tenant ID in URL path or `X-Tenant-ID` header

### Example Login Request

```javascript
const response = await fetch('/api/v1/tenant/my-company/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phone: '0912345678',
    password: '123'
  })
});

const data = await response.json();
const sessionId = data.data.sessionId;
```

### Example Authenticated Request

```javascript
const response = await fetch('/api/v1/tenant/my-company/projects', {
  headers: {
    'Authorization': `Bearer ${sessionId}`,
    'Content-Type': 'application/json'
  }
});
```

## Environment Variables

Configure these in `wrangler.toml`:

- `ENVIRONMENT`: Environment name (development/staging/production)
- `API_BASE_URL`: Base URL of your existing REST API
- `JWT_SECRET`: Secret key for JWT token signing

## KV Namespaces

- `SESSIONS`: Stores user sessions
- `USERS`: Stores cached user information

## Security Features

- **Tenant Isolation**: Each tenant's data is isolated
- **Session Management**: Secure session handling with TTL
- **Permission Checks**: Role and permission-based access control
- **CORS Protection**: Configurable CORS policies
- **Input Validation**: Request validation and sanitization

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": {},
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Performance

- **Edge Computing**: Runs on Cloudflare's global edge network
- **KV Caching**: User and session data cached in KV storage
- **Connection Pooling**: Efficient API connections
- **Response Compression**: Automatic gzip compression

## Monitoring

Use Cloudflare Analytics and Wrangler tools:

```bash
# View logs
npm run tail

# Check analytics
wrangler analytics
```# Test deployment with new token
