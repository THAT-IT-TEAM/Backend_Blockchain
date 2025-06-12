const path = require('path');
const fs = require('fs').promises;
const { Database } = require('better-sqlite3');
const logger = require('./logger');
const config = require('../config');

class DatabaseUtils {
  constructor(dbPath = null) {
    this.dbPath = dbPath || config.db.connection.filename;
    this.db = null;
    this.backupDir = config.paths.backups;
  }

  /**
   * Connect to the database
   */
  async connect() {
    if (this.db) {
      return this.db;
    }

    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
      
      // Connect to the database
      this.db = new Database(this.dbPath, {
        verbose: process.env.NODE_ENV === 'development' ? logger.debug : null,
      });

      // Configure the database
      await this.configureDatabase();
      
      return this.db;
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Configure database settings
   */
  async configureDatabase() {
    try {
      // Enable WAL mode for better concurrency
      await this.db.pragma('journal_mode = WAL');
      
      // Set busy timeout to handle concurrent access
      await this.db.pragma('busy_timeout = 30000');
      
      // Enable foreign key constraints
      await this.db.pragma('foreign_keys = ON');
      
      // Set cache size (in pages)
      await this.db.pragma('cache_size = -2000'); // 2MB cache
      
      // Set temp store to memory
      await this.db.pragma('temp_store = MEMORY');
      
      // Set synchronous mode (NORMAL is a good balance between safety and speed)
      await this.db.pragma('synchronous = NORMAL');
      
      logger.debug('Database configured successfully');
    } catch (error) {
      logger.error('Failed to configure database:', error);
      throw error;
    }
  }

  /**
   * Backup the database
   */
  async backup(backupPath = null) {
    const backupFile = backupPath || path.join(
      this.backupDir,
      `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
    );

    try {
      // Ensure backup directory exists
      await fs.mkdir(path.dirname(backupFile), { recursive: true });
      
      logger.info(`Starting database backup to ${backupFile}`);
      
      // Create a backup of the database
      const backupDb = new Database(backupFile);
      await this.db.backup(backupDb, {
        progress: (remaining, pageCount) => {
          const progress = ((pageCount - remaining) / pageCount * 100).toFixed(1);
          logger.debug(`Backup progress: ${progress}%`);
        }
      });
      
      await backupDb.close();
      
      // Get backup stats
      const stats = await fs.stat(backupFile);
      
      logger.info(`Backup completed: ${backupFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      
      return {
        path: backupFile,
        size: stats.size,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to backup database:', error);
      throw error;
    }
  }

  /**
   * Run a migration
   */
  async runMigration(migrationPath) {
    try {
      const migration = require(migrationPath);
      
      // Start transaction
      await this.db.exec('BEGIN TRANSACTION');
      
      try {
        await migration.up(this.db);
        await this.db.exec('COMMIT');
        logger.info(`Migration applied: ${path.basename(migrationPath)}`);
        return true;
      } catch (error) {
        await this.db.exec('ROLLBACK');
        logger.error(`Migration failed: ${path.basename(migrationPath)}`, error);
        throw error;
      }
    } catch (error) {
      logger.error(`Failed to run migration ${migrationPath}:`, error);
      throw error;
    }
  }

  /**
   * Run a query and return all results
   */
  async query(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      logger.error('Query failed:', { sql, params, error });
      throw error;
    }
  }

  /**
   * Run a query and return the first result
   */
  async queryOne(sql, params = []) {
    const results = await this.query(sql, params);
    return results[0] || null;
  }

  /**
   * Execute a command (INSERT, UPDATE, DELETE)
   */
  async execute(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        lastID: result.lastInsertRowid,
        changes: result.changes,
      };
    } catch (error) {
      logger.error('Execute failed:', { sql, params, error });
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.debug('Database connection closed');
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const [
        { count: tableCount } = { count: 0 },
        { size: dbSize } = { size: 0 },
        { count: indexCount } = { count: 0 },
        { count: triggerCount } = { count: 0 },
        { count: viewCount } = { count: 0 },
      ] = await Promise.all([
        this.queryOne('SELECT COUNT(*) as count FROM sqlite_master WHERE type = ?', ['table']),
        this.queryOne('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()'),
        this.queryOne('SELECT COUNT(*) as count FROM sqlite_master WHERE type = ?', ['index']),
        this.queryOne('SELECT COUNT(*) as count FROM sqlite_master WHERE type = ?', ['trigger']),
        this.queryOne('SELECT COUNT(*) as count FROM sqlite_master WHERE type = ?', ['view']),
      ]);

      return {
        tableCount,
        dbSize,
        indexCount,
        triggerCount,
        viewCount,
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      throw error;
    }
  }

  /**
   * Check database integrity
   */
  async checkIntegrity() {
    try {
      const result = await this.queryOne('PRAGMA integrity_check');
      return result.integrity_check === 'ok';
    } catch (error) {
      logger.error('Database integrity check failed:', error);
      return false;
    }
  }

  /**
   * Vacuum the database to optimize storage
   */
  async vacuum() {
    try {
      logger.info('Starting database vacuum...');
      await this.db.exec('VACUUM');
      logger.info('Database vacuum completed');
      return true;
    } catch (error) {
      logger.error('Failed to vacuum database:', error);
      throw error;
    }
  }
}

module.exports = DatabaseUtils;
