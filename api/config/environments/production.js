module.exports = {
  env: 'production',
  app: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0',
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : []
    }
  },
  db: {
    sqlite: {
      filename: 'prod.sqlite',
      debug: false
    }
  },
  logging: {
    level: 'info'
  }
};
