import { Router } from 'itty-router';
import { ResponseHelper } from './utils/response.js';
import { CorsMiddleware } from './middleware/cors.js';
import { AuthMiddleware } from './middleware/auth.js';
import { TenantMiddleware } from './middleware/tenant.js';
import { D1ProxyService } from './services/d1ProxyService.js';
import { AuthService } from './auth/authService.js';
import { AuthRoutes } from './routes/auth.js';
import { ProjectsRoutes } from './routes/projects.js';
import { UsersRoutes } from './routes/users.js';
import { ReportsRoutes } from './routes/reports.js';
import { createFileRoutes } from './routes/files.js';

/**
 * Main entry point for Cloudflare Workers
 */
export default {
  async fetch(request, env, ctx) {
    // Initialize services and middleware
    const corsMiddleware = new CorsMiddleware({
      origin: ['http://localhost:3000', 'https://manage.yes-ceramics.com', env.FRONTEND_BASE_URL],
      credentials: true
    });

    // Handle CORS preflight requests
    if (corsMiddleware.isPreflight(request)) {
      return corsMiddleware.handlePreflight(request);
    }

    try {
      // Initialize core services
      const authService = new AuthService(env.SESSIONS, env.USERS, env.API_BASE_URL);
      const authMiddleware = new AuthMiddleware(env.SESSIONS, env.USERS, env.API_BASE_URL);
      const tenantMiddleware = new TenantMiddleware();
      const d1ProxyService = new D1ProxyService(env);

      // Initialize route handlers
      const authRoutes = new AuthRoutes(authService, tenantMiddleware);
      const projectsRoutes = new ProjectsRoutes(d1ProxyService, authMiddleware, tenantMiddleware);
      const usersRoutes = new UsersRoutes(d1ProxyService, authMiddleware, tenantMiddleware);
      const reportsRoutes = new ReportsRoutes(d1ProxyService, authMiddleware, tenantMiddleware);
      
      // Initialize file routes
      const fileRouter = createFileRoutes(env);

      // Create router
      const router = Router();

      // Health check endpoint
      router.get('/health', () => {
        return ResponseHelper.success({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT
        }, 'Service is healthy');
      });

      // API info endpoint
      router.get('/', () => {
        return ResponseHelper.success({
          name: 'Construction Management API',
          version: '1.0.0',
          description: 'Cloudflare Workers backend for construction management system',
          environment: env.ENVIRONMENT,
          endpoints: {
            auth: {
              login: 'POST /api/v1/tenant/:tenantId/auth/login',
              logout: 'POST /api/v1/tenant/:tenantId/auth/logout',
              refresh: 'POST /api/v1/tenant/:tenantId/auth/refresh',
              profile: 'GET /api/v1/tenant/:tenantId/auth/profile'
            },
            projects: {
              list: 'GET /api/v1/tenant/:tenantId/projects',
              get: 'GET /api/v1/tenant/:tenantId/projects/:id',
              create: 'POST /api/v1/tenant/:tenantId/projects',
              update: 'PUT /api/v1/tenant/:tenantId/projects/:id',
              delete: 'DELETE /api/v1/tenant/:tenantId/projects/:id',
              tasks: 'GET /api/v1/tenant/:tenantId/projects/:id/tasks',
              createTask: 'POST /api/v1/tenant/:tenantId/projects/:id/tasks'
            },
            users: {
              list: 'GET /api/v1/tenant/:tenantId/users'
            },
            reports: {
              get: 'GET /api/v1/tenant/:tenantId/reports'
            },
            files: {
              upload: 'POST /api/v1/tenant/:tenantId/files/upload',
              get: 'GET /api/v1/tenant/:tenantId/files/:fileId',
              delete: 'DELETE /api/v1/tenant/:tenantId/files/:fileId',
              list: 'GET /api/v1/tenant/:tenantId/files/site/:siteId',
              batchUpload: 'POST /api/v1/tenant/:tenantId/files/batch-upload'
            }
          }
        });
      });

      // Authentication routes
      router.post('/api/v1/tenant/:tenantId/auth/login', (request) => 
        authRoutes.login(request)
      );

      router.post('/api/v1/tenant/:tenantId/auth/logout', (request) => 
        authRoutes.logout(request)
      );

      router.post('/api/v1/tenant/:tenantId/auth/refresh', (request) => 
        authRoutes.refresh(request)
      );

      router.get('/api/v1/tenant/:tenantId/auth/profile', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        return authRoutes.profile(request, authResult.user);
      });

      // Projects routes
      router.get('/api/v1/tenant/:tenantId/projects', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        return projectsRoutes.getProjects(request, authResult.user);
      });

      router.get('/api/v1/tenant/:tenantId/projects/:projectId', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        return projectsRoutes.getProject(request, authResult.user, request.params.projectId);
      });

      router.post('/api/v1/tenant/:tenantId/projects', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        return projectsRoutes.createProject(request, authResult.user);
      });

      router.put('/api/v1/tenant/:tenantId/projects/:projectId', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        return projectsRoutes.updateProject(request, authResult.user, request.params.projectId);
      });

      router.delete('/api/v1/tenant/:tenantId/projects/:projectId', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        return projectsRoutes.deleteProject(request, authResult.user, request.params.projectId);
      });

      router.get('/api/v1/tenant/:tenantId/projects/:projectId/tasks', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        return projectsRoutes.getProjectTasks(request, authResult.user, request.params.projectId);
      });

      router.post('/api/v1/tenant/:tenantId/projects/:projectId/tasks', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        return projectsRoutes.createProjectTask(request, authResult.user, request.params.projectId);
      });

      // Users routes
      router.get('/api/v1/tenant/:tenantId/users', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        return usersRoutes.getUsers(request, authResult.user);
      });

      // Reports routes
      router.get('/api/v1/tenant/:tenantId/reports', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        return reportsRoutes.getReports(request, authResult.user);
      });

      // File routes - mount with authentication
      router.all('/api/v1/tenant/:tenantId/files/*', async (request) => {
        const authResult = await authMiddleware.requireAuth(request);
        if (authResult.error) return authResult.error;
        
        // Add user context and permissions to request
        request.user = authResult.user;
        request.permissions = authResult.permissions || ['read', 'write'];
        
        // Remove the base path and let the file router handle it
        const url = new URL(request.url);
        const path = url.pathname.replace(/^\/api\/v1\/tenant\/[^\/]+\/files/, '');
        url.pathname = path;
        
        const modifiedRequest = new Request(url.toString(), request);
        modifiedRequest.user = request.user;
        modifiedRequest.permissions = request.permissions;
        modifiedRequest.query = Object.fromEntries(url.searchParams);
        
        return fileRouter.handle(modifiedRequest);
      });

      // Catch-all route for 404s
      router.all('*', () => {
        return ResponseHelper.notFound('Endpoint not found');
      });

      // Handle the request
      let response = await router.handle(request);

      // Add CORS headers to all responses
      response = corsMiddleware.addCorsHeaders(response, request);

      return response;

    } catch (error) {
      console.error('Unhandled error:', error);
      
      // Create error response
      let errorResponse = ResponseHelper.error('Internal server error');
      
      // Add CORS headers to error response
      errorResponse = corsMiddleware.addCorsHeaders(errorResponse, request);
      
      return errorResponse;
    }
  }
};