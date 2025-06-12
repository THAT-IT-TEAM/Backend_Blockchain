module.exports = {
  // API versioning
  version: 'v1',
  
  // API documentation
  docs: {
    enabled: true,
    path: '/api-docs',
    options: {
      info: {
        title: 'Blockchain API',
        version: '1.0.0',
        description: 'API for blockchain operations'
      },
      security: [
        {
          bearerAuth: []
        }
      ],
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      apis: ['./routes/*.js']
    }
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.'
  },

  // CORS configuration
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 86400
  },

  // Body parser configuration
  bodyParser: {
    json: {
      limit: '10mb',
      extended: true
    },
    urlencoded: {
      limit: '10mb',
      extended: true
    }
  },

  // File upload configuration
  uploads: {
    directory: 'uploads',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5
  }
};
