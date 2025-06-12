#!/usr/bin/env node

const path = require('path');
const { Command } = require('commander');
const { promises: fs } = require('fs');
const Config = require('../lib/config');
const { Database } = require('sqlite3').verbose();
const { open } = require('sqlite');

class MigrationRunner {
  constructor() {
    this.migrationsTable = Config.get('database.migrationsTable', 'knex_migrations');
    this.migrationsDir = path.join(__dirname, '..', 'migrations');
  }

  async getDatabaseConnection() {
    const dbPath = Config.get('database.sqlite.filename', './data/blockchain.db');
    const dbDir = path.dirname(path.resolve(dbPath));
    
    // Ensure directory exists
    try {
      await fs.mkdir(dbDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
    
    const db = await open({
      filename: dbPath,
      driver: Database
    });
    
    // Enable foreign key support
    await db.get('PRAGMA foreign_keys = ON');
    
    return db;
  }

  async ensureMigrationsTable(db) {
    const tableExists = await db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      [this.migrationsTable]
    );

    if (!tableExists) {
      await db.exec(`
        CREATE TABLE ${this.migrationsTable} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          batch INTEGER NOT NULL,
          migration_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log(`Created migrations table: ${this.migrationsTable}`);
    }
  }

  async getLatestBatch(db) {
    const result = await db.get(
      `SELECT MAX(batch) as max_batch FROM ${this.migrationsTable}`
    );
    return result ? result.max_batch || 0 : 0;
  }

  async getRunMigrations(db) {
    return db.all(
      `SELECT * FROM ${this.migrationsTable} ORDER BY batch ASC, name ASC`
    );
  }

  async runMigration(db, migrationName) {
    const migrationPath = path.join(this.migrationsDir, migrationName);
    
    try {
      // Import the migration module
      const migration = require(migrationPath);
      
      await db.run('BEGIN TRANSACTION');
      
      if (typeof migration.up === 'function') {
        console.log(`Running migration: ${migrationName}`);
        await migration.up(db);
      } else {
        console.warn(`No 'up' function found in migration: ${migrationName}`);
      }
      
      const batch = await this.getLatestBatch(db) + 1;
      
      await db.run(
        `INSERT INTO ${this.migrationsTable} (name, batch) VALUES (?, ?)`,
        [migrationName, batch]
      );
      
      await db.run('COMMIT');
      console.log(`✓ Applied migration: ${migrationName}`);
      return true;
    } catch (error) {
      await db.run('ROLLBACK');
      console.error(`✗ Error running migration ${migrationName}:`, error.message);
      throw error;
    }
  }

  async rollbackMigration(db, migration) {
    const migrationPath = path.join(this.migrationsDir, migration.name);
    
    try {
      console.log(`Rolling back: ${migration.name}`);
      const migrationModule = require(migrationPath);
      
      await db.run('BEGIN TRANSACTION');
      
      if (typeof migrationModule.down === 'function') {
        await migrationModule.down(db);
      } else {
        console.warn(`No 'down' function found in migration: ${migration.name}`);
      }
      
      await db.run(
        `DELETE FROM ${this.migrationsTable} WHERE name = ?`,
        [migration.name]
      );
      
      await db.run('COMMIT');
      console.log(`✓ Rolled back migration: ${migration.name}`);
      return true;
    } catch (error) {
      await db.run('ROLLBACK');
      console.error(`✗ Error rolling back migration ${migration.name}:`, error.message);
      throw error;
    }
  }

  async runMigrations() {
    let db;
    
    try {
      db = await this.getDatabaseConnection();
      await this.ensureMigrationsTable(db);
      
      // Get all migration files
      const migrationFiles = (await fs.readdir(this.migrationsDir))
        .filter(file => file.endsWith('.js') && file !== 'index.js')
        .sort();
      
      if (migrationFiles.length === 0) {
        console.log('No migration files found');
        return [];
      }
      
      // Get already run migrations
      const runMigrations = await this.getRunMigrations(db);
      const runMigrationNames = new Set(runMigrations.map(m => m.name));
      
      // Find migrations to run
      const migrationsToRun = migrationFiles.filter(file => !runMigrationNames.has(file));
      
      if (migrationsToRun.length === 0) {
        console.log('No new migrations to run');
        return [];
      }
      
      console.log(`Found ${migrationsToRun.length} new migration(s) to run`);
      
      // Run migrations in order
      const results = [];
      for (const file of migrationsToRun) {
        try {
          const success = await this.runMigration(db, file);
          if (success) {
            results.push({ name: file, status: 'success' });
          } else {
            results.push({ name: file, status: 'failed', error: 'Migration failed' });
          }
        } catch (error) {
          results.push({ name: file, status: 'failed', error: error.message });
          // Stop on first error
          break;
        }
      }
      
      return results;
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      if (db) {
        await db.close();
      }
    }
  }

  async rollbackMigrations(steps = 1) {
    let db;
    
    try {
      db = await this.getDatabaseConnection();
      await this.ensureMigrationsTable(db);
      
      // Get the latest batch of migrations
      const latestBatch = await this.getLatestBatch(db);
      if (latestBatch === 0) {
        console.log('No migrations to roll back');
        return [];
      }
      
      // Get the migrations to roll back
      const migrationsToRollback = await db.all(
        `SELECT * FROM ${this.migrationsTable} WHERE batch = ? ORDER BY id DESC`,
        [latestBatch]
      );
      
      if (migrationsToRollback.length === 0) {
        console.log('No migrations to roll back');
        return [];
      }
      
      console.log(`Rolling back ${migrationsToRollback.length} migration(s) from batch ${latestBatch}`);
      
      // Roll back migrations in reverse order
      const results = [];
      for (const migration of migrationsToRollback) {
        try {
          const success = await this.rollbackMigration(db, migration);
          if (success) {
            results.push({ name: migration.name, status: 'rolled back' });
          } else {
            results.push({ name: migration.name, status: 'failed', error: 'Rollback failed' });
          }
        } catch (error) {
          console.error(`Error rolling back migration ${migration.name}:`, error);
          results.push({ name: migration.name, status: 'failed', error: error.message });
          // Continue with next migration even if one fails
        }
      }
      
      return results;
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    } finally {
      if (db) {
        await db.close();
      }
    }
  }

  async listMigrations() {
    let db;
    
    try {
      db = await this.getDatabaseConnection();
      await this.ensureMigrationsTable(db);
      
      // Get all migration files
      const migrationFiles = (await fs.readdir(this.migrationsDir))
        .filter(file => file.endsWith('.js') && file !== 'index.js')
        .sort();
      
      // Get already run migrations
      const runMigrations = await this.getRunMigrations(db);
      const runMigrationMap = new Map(runMigrations.map(m => [m.name, m]));
      
      // Combine and format the results
      const allMigrations = migrationFiles.map(file => ({
        name: file,
        status: runMigrationMap.has(file) ? 'applied' : 'pending',
        batch: runMigrationMap.get(file)?.batch,
        runAt: runMigrationMap.get(file)?.migration_time
      }));
      
      return allMigrations;
    } finally {
      if (db) {
        await db.close();
      }
    }
  }
}

// Set up CLI
const program = new Command();
program
  .name('migrate')
  .description('Database migration tool')
  .version('1.0.0');

program
  .command('up')
  .description('Run pending migrations')
  .action(async () => {
    try {
      const runner = new MigrationRunner();
      const results = await runner.runMigrations();
      
      if (results.length === 0) {
        console.log('No migrations to run');
        return;
      }
      
      console.log('\nMigration results:');
      results.forEach(({ name, status, error }) => {
        const statusStr = status === 'success' ? '✓' : '✗';
        console.log(`  ${statusStr} ${name}${error ? `: ${error}` : ''}`);
      });
      
      const failed = results.filter(r => r.status === 'failed').length;
      if (failed > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  });

program
  .command('down')
  .description('Rollback the last batch of migrations')
  .option('-s, --steps <number>', 'Number of batches to rollback', '1')
  .action(async (options) => {
    try {
      const steps = parseInt(options.steps, 10) || 1;
      const runner = new MigrationRunner();
      const results = await runner.rollbackMigrations(steps);
      
      if (results.length === 0) {
        console.log('No migrations to roll back');
        return;
      }
      
      console.log('\nRollback results:');
      results.forEach(({ name, status, error }) => {
        const statusStr = status === 'rolled back' ? '✓' : '✗';
        console.log(`  ${statusStr} ${name}${error ? `: ${error}` : ''}`);
      });
      
      const failed = results.filter(r => r.status === 'failed').length;
      if (failed > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Rollback failed:', error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all migrations and their status')
  .action(async () => {
    try {
      const runner = new MigrationRunner();
      const migrations = await runner.listMigrations();
      
      if (migrations.length === 0) {
        console.log('No migrations found');
        return;
      }
      
      console.log('\nMigrations:');
      console.log('  Status   Migration');
      console.log('  -------  ---------');
      
      migrations.forEach(({ name, status, batch, runAt }) => {
        const statusStr = status === 'applied' 
          ? '✓ applied ' 
          : '  pending ';
        const batchStr = batch ? `(batch ${batch})` : '';
        const runAtStr = runAt ? `- ${new Date(runAt).toISOString()}` : '';
        console.log(`  ${statusStr} ${name} ${batchStr} ${runAtStr}`.trim());
      });
    } catch (error) {
      console.error('Failed to list migrations:', error);
      process.exit(1);
    }
  });

// Run the CLI
program.parseAsync(process.argv).catch(error => {
  console.error('Command failed:', error);
  process.exit(1);
});

// Export for programmatic usage
module.exports = MigrationRunner;
