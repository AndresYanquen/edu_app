const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Academy API',
    version: '1.0.0',
    description: 'Minimal documentation for the MVP endpoints.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email' },
              fullName: { type: 'string' },
              role: { type: 'string', enum: ['admin', 'instructor', 'student'] },
            },
          },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        summary: 'Login with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          400: { description: 'Invalid body' },
          401: { description: 'Invalid credentials' },
          429: { description: 'Rate limit exceeded' },
        },
      },
    },
    '/me': {
      get: {
        summary: 'Fetch profile for current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Profile information' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/me/courses': {
      get: {
        summary: 'List courses available to the current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Courses list' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/courses/{id}': {
      get: {
        summary: 'Get detailed course information',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Course detail' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Course not found' },
        },
      },
    },
    '/courses/{id}/progress': {
      get: {
        summary: 'Get course progress for a student',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'studentId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Required for admins/instructors to view other students',
          },
        ],
        responses: {
          200: { description: 'Progress data' },
          400: { description: 'Invalid studentId or missing parameter' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Course or enrollment not found' },
        },
      },
    },
    '/instructor/groups': {
      get: {
        summary: 'List groups for the instructor',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Groups list' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/groups/{id}/students': {
      get: {
        summary: 'List students inside a group',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Students list' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Group not found' },
        },
      },
    },
    '/groups/{id}/progress': {
      get: {
        summary: 'List progress per student for a group',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Progress per student' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Group not found' },
        },
      },
    },
  },
};

module.exports = swaggerDocument;
