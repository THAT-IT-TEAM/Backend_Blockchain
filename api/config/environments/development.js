module.exports = {
  env: 'development',
  app: {
    port: 3000,
    host: 'localhost',
    cors: {
      allowedOrigins: ['http://localhost:3000', 'http://localhost:3001']
    }
  },
  db: {
    sqlite: {
      filename: 'dev.sqlite',
      debug: true
    }
  },
  logging: {
    level: 'debug'
  }
};
