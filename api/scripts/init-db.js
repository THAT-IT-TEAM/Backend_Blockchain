const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const Config = require('../lib/config');

class DatabaseInitializer {
  constructor() {
    this.dbPath = path.join(process.cwd(), Config.get('services.database.sqlite.connection.filename'));
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`Created data directory: ${dataDir}`);
    }
  }

  async initialize() {
    console.log('Initializing database...');
    const db = new sqlite3.Database(this.dbPath);

    try {
      await this.runMigrations(db);
      console.log('Database initialization completed successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      process.exit(1);
    } finally {
      db.close();
    }
  }

  runMigrations(db) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Enable foreign key constraints
        db.run('PRAGMA foreign_keys = ON');

        // Create users table
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create sessions table
        db.run(`
          CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
          )
        `);

        // Create files table (for metadata)
        db.run(`
          CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cid TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            size INTEGER NOT NULL,
            mimetype TEXT NOT NULL,
            uploaded_by INTEGER NOT NULL,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE CASCADE
          )
        `);

        // Create indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by)');
        db.run('CREATE INDEX IF NOT EXISTS idx_files_cid ON files(cid)');
        db.run('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)');

        resolve();
      });
    });
  }
}

// Run the initializer if this file is run directly
if (require.main === module) {
  (async () => {
    try {
      const initializer = new DatabaseInitializer();
      await initializer.initialize();
      process.exit(0);
    } catch (error) {
      logger.error('Unhandled error in database initialization:', error);
      process.exit(1);
    }
  })();
}

module.exports = DatabaseInitializer;
