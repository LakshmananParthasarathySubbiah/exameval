/**
 * OpenAPI 3.0 specification for the ExamEval API.
 * Served as interactive docs at /api/docs and raw JSON at /api/docs.json.
 */

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: { type: 'string', example: 'Something went wrong' },
  },
};

const ok = (dataSchema) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: dataSchema,
  },
});

const paginated = (itemsKey, itemSchema) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        [itemsKey]: { type: 'array', items: itemSchema },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 42 },
          },
        },
      },
    },
  },
});

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'ExamEval API',
    version: '1.0.0',
    description:
      'AI-powered university exam evaluation system. Async LLM grading pipeline with ' +
      'human-in-the-loop review, audit trail, prompt-injection defenses, and assessment analytics.',
  },
  servers: [{ url: '/api', description: 'API root' }],
  tags: [
    { name: 'Auth' },
    { name: 'Courses' },
    { name: 'Evaluations' },
    { name: 'Analytics' },
    { name: 'System' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: errorResponse,
      Course: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Computer Networks' },
          code: { type: 'string', example: 'BCSE308L' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Evaluation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          scriptId: { type: 'string' },
          totalScore: { type: 'number', nullable: true },
          maxScore: { type: 'number', nullable: true },
          percentage: { type: 'number', nullable: true },
          status: {
            type: 'string',
            enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PENDING_REVIEW'],
          },
          staffReviewed: { type: 'boolean' },
        },
      },
      ExamAnalytics: {
        type: 'object',
        properties: {
          summary: {
            type: 'object',
            properties: {
              totalEvaluations: { type: 'integer' },
              completed: { type: 'integer' },
              pendingReview: { type: 'integer' },
              overrides: { type: 'integer' },
              averagePercentage: { type: 'number' },
              injectionFlaggedQuestions: { type: 'integer' },
              confidenceVsOverrideCorrelation: { type: 'number' },
              reliabilityCronbachAlpha: { type: 'number', nullable: true },
            },
          },
          scoreDistribution: {
            type: 'array',
            items: {
              type: 'object',
              properties: { range: { type: 'string' }, count: { type: 'integer' } },
            },
          },
          itemAnalysis: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                questionNumber: { type: 'string' },
                n: { type: 'integer' },
                meanScore: { type: 'number' },
                maxScore: { type: 'number' },
                difficulty: { type: 'number', description: 'Mean proportion correct (0..1)' },
                discrimination: {
                  type: 'number',
                  description: 'Point-biserial correlation with total score',
                },
              },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness check',
        security: [],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  role: { type: 'string', enum: ['ADMIN', 'STAFF'] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Created' },
          409: {
            description: 'Email already registered',
            content: { 'application/json': { schema: errorResponse } },
          },
          429: { description: 'Rate limited' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in, returns access + refresh tokens',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated' },
          401: {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: errorResponse } },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate tokens',
        security: [],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke refresh token',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/courses': {
      get: {
        tags: ['Courses'],
        summary: 'List courses (paginated)',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: paginated('courses', { $ref: '#/components/schemas/Course' }),
              },
            },
          },
        },
      },
      post: {
        tags: ['Courses'],
        summary: 'Create a course',
        responses: { 201: { description: 'Created' } },
      },
    },
    '/evaluations/run/{scriptId}': {
      post: {
        tags: ['Evaluations'],
        summary: 'Queue an async evaluation for a script',
        parameters: [{ name: 'scriptId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          202: {
            description: 'Accepted — job queued',
            content: {
              'application/json': { schema: ok({ $ref: '#/components/schemas/Evaluation' }) },
            },
          },
          429: { description: 'Rate limited (LLM-cost control)' },
        },
      },
    },
    '/evaluations/{id}/review': {
      patch: {
        tags: ['Evaluations'],
        summary: 'Staff review / score override (audited)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  overrideScore: { type: 'number' },
                  staffNotes: { type: 'string' },
                  staffReviewed: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated' } },
      },
    },
    '/evaluations/{id}/events': {
      get: {
        tags: ['Evaluations'],
        summary: 'Server-Sent Events stream of live evaluation progress',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'text/event-stream' } },
      },
    },
    '/analytics/exam/{examId}': {
      get: {
        tags: ['Analytics'],
        summary: 'Assessment analytics for an exam (item analysis, reliability, distribution)',
        parameters: [{ name: 'examId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: ok({ $ref: '#/components/schemas/ExamAnalytics' }),
              },
            },
          },
        },
      },
    },
  },
};

module.exports = openapi;
