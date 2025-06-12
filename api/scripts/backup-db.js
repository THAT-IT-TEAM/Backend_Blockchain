const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const Config = require('../lib/config');
const { format } = require('date-fns');

class DatabaseBackup {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.dbPath = path.join(process.cwd(), Config.get('services.database.sqlite.connection.filename'));
    this.ensureBackupDirectory();
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`Created backup directory: ${this.backupDir}`);
    }
  }

  async backup() {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    const backupFile = path.join(this.backupDir, `backup_${timestamp}.db`);
    
    console.log(`Starting database backup to ${backupFile}...`);

    return new Promise((resolve, reject) => {
      // For SQLite, we can simply copy the file
      const readStream = fs.createReadStream(this.dbPath);
      const writeStream = fs.createWriteStream(backupFile);

      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => {
        console.log(`Backup completed successfully: ${backupFile}`);
        this.cleanupOldBackups();
        resolve(backupFile);
      });

      readStream.pipe(writeStream);
    });
  }

  cleanupOldBackups() {
    const maxBackups = Config.get('services.database.backup.maxBackups', 30);
    
    fs.readdir(this.backupDir, (err, files) => {
      if (err) {
        console.error('Error reading backup directory:', err);
        return;
      }

      // Filter and sort backup files
      const backupFiles = files
        .filter(file => file.startsWith('backup_') && file.endsWith('.db'))
        .map(file => ({
          name: file,
          time: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      // Remove old backups
      backupFiles.slice(maxBackups).forEach(file => {
        const filePath = path.join(this.backupDir, file.name);
        fs.unlink(filePath, err => {
          if (err) {
            console.error(`Error deleting old backup ${filePath}:`, err);
          } else {
            console.log(`Deleted old backup: ${filePath}`);
          }
        });
      });
    });
  }
}

// Run the backup if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      const backup = new DatabaseBackup();
      const result = await backup.createBackup();
      
      if (result.success) {
        logger.info(`Backup completed in ${result.duration}ms`);
        process.exit(0);
      } else {
        logger.error('Backup failed:', result.error);
        process.exit(1);
      }
    } catch (error) {
      logger.error('Unhandled error during backup:', error);
      process.exit(1);
    }
  })();
}

module.exports = DatabaseBackup;
