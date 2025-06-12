const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const Config = require('../lib/config');

class Scheduler {
  constructor() {
    this.logFile = path.join(process.cwd(), 'logs', 'scheduler.log');
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
    fs.appendFileSync(this.logFile, logMessage, 'utf8');
  }

  runCommand(command) {
    return new Promise((resolve, reject) => {
      this.log(`Executing command: ${command}`);
      
      exec(command, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
        if (error) {
          this.log(`Command failed: ${error.message}`, 'ERROR');
          return reject(error);
        }
        
        if (stderr) {
          this.log(`Command stderr: ${stderr}`, 'WARN');
        }
        
        if (stdout) {
          this.log(`Command output: ${stdout}`);
        }
        
        resolve({ stdout, stderr });
      });
    });
  }

  async scheduleBackup() {
    // Schedule daily backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        this.log('Starting scheduled database backup...');
        await this.runCommand('npm run db:backup');
        this.log('Scheduled database backup completed successfully');
      } catch (error) {
        this.log(`Scheduled backup failed: ${error.message}`, 'ERROR');
      }
    });

    this.log('Scheduled daily database backup at 2 AM');
  }

  async scheduleMonitoring() {
    // Schedule system monitoring every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        this.log('Running system monitoring check...');
        await this.runCommand('npm run db:monitor');
      } catch (error) {
        this.log(`System monitoring check failed: ${error.message}`, 'ERROR');
      }
    });

    this.log('Scheduled system monitoring every 5 minutes');
  }

  async start() {
    try {
      this.log('Starting scheduler...');
      
      // Schedule all tasks
      await this.scheduleBackup();
      await this.scheduleMonitoring();
      
      this.log('Scheduler started successfully');
      
      // Keep the process running
      setInterval(() => {
        // Keep the event loop alive
      }, 1000 * 60 * 60 * 24); // 24 hours
      
    } catch (error) {
      this.log(`Failed to start scheduler: ${error.message}`, 'ERROR');
      process.exit(1);
    }
  }

  async runTask(taskName, options = {}) {
    if (!this.tasks[taskName]) {
      throw new Error(`Task not found: ${taskName}`);
    }

    const task = this.tasks[taskName];
    const status = {
      task: taskName,
      status: TASK_STATUS.PENDING,
      startTime: new Date(),
      endTime: null,
      output: null,
      error: null,
    };

    try {
      this.log(`Running task: ${taskName}`);
      const output = await this.runCommand(task.command);
      status.status = TASK_STATUS.COMPLETED;
      status.endTime = new Date();
      status.output = output;
    } catch (error) {
      status.status = TASK_STATUS.FAILED;
      status.endTime = new Date();
      status.error = error.message;
    }

    this.taskHistory.push(status);
    return status;
  }

  getAllTasksStatus() {
    return Object.keys(this.tasks).map(taskName => ({
      task: taskName,
      status: this.tasks[taskName].status,
    }));
  }

  getTaskHistory(taskName, limit) {
    return this.taskHistory
      .filter(status => status.task === taskName)
      .slice(-limit);
  }

  registerTask(taskName, task) {
    this.tasks[taskName] = task;
  }
}

// Register tasks
const scheduler = new Scheduler();
scheduler.registerTask('backup', {
  command: 'npm run db:backup',
  priority: TASK_PRIORITY.HIGH,
  status: TASK_STATUS.PENDING,
});
scheduler.registerTask('monitor', {
  command: 'npm run db:monitor',
  priority: TASK_PRIORITY.MEDIUM,
  status: TASK_STATUS.PENDING,
});

// Start the scheduler if this file is run directly
if (require.main === module) {
  (async () => {
    try {
      const command = process.argv[2];
      
      switch (command) {
        case 'start':
          // Start the scheduler service
          await scheduler.start();
          break;
          
        case 'run':
          // Run a specific task immediately
          const taskName = process.argv[3];
          if (!taskName) {
            console.error('Task name is required');
            process.exit(1);
          }
          
          const taskRun = await scheduler.runTask(taskName, { force: true });
          console.log(JSON.stringify(taskRun, null, 2));
          process.exit(taskRun.status === TASK_STATUS.COMPLETED ? 0 : 1);
          
        case 'list':
          // List all tasks
          console.log(JSON.stringify(scheduler.getAllTasksStatus(), null, 2));
          process.exit(0);
          
        case 'history':
          // Show task history
          const historyTask = process.argv[3] || '';
          const limit = parseInt(process.argv[4] || '10', 10);
          
          if (historyTask) {
            console.log(JSON.stringify(scheduler.getTaskHistory(historyTask, limit), null, 2));
          } else {
            console.log(JSON.stringify(scheduler.taskHistory.slice(-limit), null, 2));
          }
          process.exit(0);
          
        default:
          console.log('Usage:');
          console.log('  node scheduler.js start         Start the scheduler service');
          console.log('  node scheduler.js run <task>   Run a specific task immediately');
          console.log('  node scheduler.js list         List all tasks');
          console.log('  node scheduler.js history [task] [limit]  Show task history');
          process.exit(1);
      }
    } catch (error) {
      console.error('Scheduler failed:', error);
      process.exit(1);
    }
  })();
}

// Export for testing and programmatic usage
module.exports = {
  Scheduler,
  TASK_PRIORITY,
  TASK_STATUS,
};
