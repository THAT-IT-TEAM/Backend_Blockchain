const os = require('os');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const Config = require('../lib/config');

class DatabaseMonitor {
  constructor() {
    this.dbPath = path.join(process.cwd(), Config.get('services.database.sqlite.connection.filename'));
    this.logFile = path.join(process.cwd(), 'logs', 'monitor.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;
    
    console.log(logMessage.trim());
    
    // Append to log file
    fs.appendFileSync(this.logFile, logMessage, 'utf8');
  }

  async checkDatabase() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          this.log(`Database connection error: ${err.message}`, 'ERROR');
          return reject(err);
        }

        // Check database integrity
        db.get('PRAGMA integrity_check', (err, row) => {
          if (err) {
            this.log(`Database integrity check failed: ${err.message}`, 'ERROR');
            db.close();
            return reject(err);
          }
          
          const isHealthy = row && row.integrity_check === 'ok';
          this.log(`Database integrity check: ${isHealthy ? 'OK' : 'FAILED'}`, isHealthy ? 'INFO' : 'ERROR');
          
          // Get database stats
          db.get('SELECT COUNT(*) as count FROM sqlite_master', (err, row) => {
            if (err) {
              this.log(`Failed to get table count: ${err.message}`, 'ERROR');
            } else {
              this.log(`Database contains ${row.count} tables/views`, 'INFO');
            }
            
            db.close(err => {
              if (err) {
                this.log(`Error closing database: ${err.message}`, 'ERROR');
                return reject(err);
              }
              resolve(isHealthy);
            });
          });
        });
      });
    });
  }

  async checkSystemResources() {
    try {
      // CPU usage
      const cpus = os.cpus().length;
      const load = os.loadavg();
      const loadPercent = (load[0] * 100 / cpus).toFixed(2);
      
      // Memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsage = (usedMem / totalMem * 100).toFixed(2);
      
      // Disk space
      const diskInfo = this.getDiskSpace();
      
      this.log(`System load: ${loadPercent}% (1 min avg)`, 'INFO');
      this.log(`Memory usage: ${memUsage}% (${this.formatBytes(usedMem)} / ${this.formatBytes(totalMem)})`, 'INFO');
      this.log(`Disk usage: ${diskInfo.usage}% (${this.formatBytes(diskInfo.used)} / ${this.formatBytes(diskInfo.total)})`, 'INFO');
      
      return {
        cpu: parseFloat(loadPercent),
        memory: parseFloat(memUsage),
        disk: diskInfo.usage,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log(`Failed to check system resources: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  getDiskSpace() {
    try {
      const stats = require('fs').statfsSync('/');
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      const usage = (used / total * 100).toFixed(2);
      
      return {
        total,
        used,
        free,
        usage: parseFloat(usage)
      };
    } catch (error) {
      // Fallback for Windows
      return {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      };
    }
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  async runChecks() {
    try {
      this.log('Starting system and database checks...', 'INFO');
      
      await this.checkDatabase();
      await this.checkSystemResources();
      
      this.log('All checks completed successfully', 'INFO');
      return true;
    } catch (error) {
      this.log(`Check failed: ${error.message}`, 'ERROR');
      return false;
    }
  }
}

// Run the monitor if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      const monitor = new SystemMonitor();
      
      // Handle command line arguments
      const command = process.argv[2];
      
      switch (command) {
        case 'check':
          // Run checks once and exit
          const success = await monitor.runChecks();
          console.log(JSON.stringify(monitor.getMetrics(), null, 2));
          process.exit(success ? 0 : 1);
          break;
          
        case 'start':
          // Start monitoring service
          monitor.start();
          break;
          
        default:
          console.log('Usage:');
          console.log('  node monitor.js check    Run checks once and exit');
          console.log('  node monitor.js start   Start monitoring service');
          process.exit(1);
      }
    } catch (error) {
      logger.error('Unhandled error in monitor:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  SystemMonitor,
  AlertManager,
};
