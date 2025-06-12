const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Config = require('../lib/config');

class Setup {
  constructor() {
    this.config = Config;
    this.dataDir = path.join(process.cwd(), 'data');
    this.backupDir = path.join(process.cwd(), 'backups');
    this.logDir = path.join(process.cwd(), 'logs');
  }

  ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }

  async runCommand(command) {
    console.log(`Running: ${command}`);
    try {
      const output = execSync(command, { stdio: 'inherit' });
      return { success: true, output: output?.toString() };
    } catch (error) {
      console.error(`Command failed: ${command}`, error.message);
      return { success: false, error };
    }
  }

  async installDependencies() {
    console.log('Installing dependencies...');
    await this.runCommand('npm install');
  }

  async setupDirectories() {
    console.log('Setting up directories...');
    this.ensureDirectory(this.dataDir);
    this.ensureDirectory(this.backupDir);
    this.ensureDirectory(this.logDir);
  }

  async initializeDatabase() {
    console.log('Initializing database...');
    await this.runCommand('npm run db:init');
  }

  async createBackup() {
    console.log('Creating initial database backup...');
    await this.runCommand('npm run db:backup');
  }

  async setupCronJobs() {
    console.log('Setting up scheduled tasks...');
    
    // For Windows, we'll use node-cron instead of system cron
    console.log('\nTo run scheduled tasks, start the scheduler with:');
    console.log('npm run monitor:start');
  }

  async run() {
    try {
      console.log('Starting setup...');
      
      await this.installDependencies();
      await this.setupDirectories();
      await this.initializeDatabase();
      await this.createBackup();
      await this.setupCronJobs();
      
      console.log('\nSetup completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Start the application: npm start');
      console.log('2. For development: npm run dev');
      console.log('3. To monitor the system: npm run monitor:start');
      
    } catch (error) {
      console.error('Setup failed:', error);
      process.exit(1);
    }
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  const setup = new Setup();
  setup.run().catch(error => {
    console.error('Setup error:', error);
    process.exit(1);
  });
}

module.exports = Setup;
