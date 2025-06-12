const path = require('path');

module.exports = {
  // SQLite Configuration
  sqlite: {
    client: 'sqlite3',
    connection: {
      filename: path.join(process.cwd(), 'data', 'blockchain.sqlite')
    },
    useNullAsDefault: true,
    debug: process.env.NODE_ENV === 'development',
    migrations: {
      directory: path.join(process.cwd(), 'migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(process.cwd(), 'seeds')
    }
  },
  
  // MongoDB Configuration (optional)
  mongodb: {
    enabled: false,
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/blockchain',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // Redis Configuration (optional)
  redis: {
    enabled: false,
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || ''
  }
};
