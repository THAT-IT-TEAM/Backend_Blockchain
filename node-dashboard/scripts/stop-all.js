const { execSync } = require('child_process');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🛑 Stopping all services...');

// Kill Node.js processes
const killNodeProcesses = () => {
  console.log('🔴 Stopping Node.js processes...');
  try {
    if (process.platform === 'win32') {
      // Windows
      execSync('taskkill /F /IM node.exe /T', { stdio: 'ignore' });
      // Kill any remaining node processes
      execSync('wmic process where "name=\'node.exe\'" delete', { stdio: 'ignore' });
    } else {
      // Unix/Linux/Mac
      execSync('pkill -f "node|next" || true', { stdio: 'ignore' });
    }
    console.log('✅ Node.js processes stopped');
  } catch (error) {
    console.error('❌ Error stopping Node.js processes:', error.message);
  }
};

// Kill Ganache process
const killGanache = () => {
  console.log('🔴 Stopping Ganache...');
  try {
    if (process.platform === 'win32') {
      // Windows
      execSync('taskkill /F /IM ganache-cli.exe /T', { stdio: 'ignore' });
      // Kill any remaining node processes with ganache in the command line
      execSync('wmic process where "commandline like \'%ganache%\'" delete', { stdio: 'ignore' });
    } else {
      // Unix/Linux/Mac
      execSync('pkill -f ganache-cli || true', { stdio: 'ignore' });
    }
    console.log('✅ Ganache stopped');
  } catch (error) {
    console.error('❌ Error stopping Ganache:', error.message);
  }
};

// Clear log files
const clearLogs = () => {
  const logsDir = path.join(__dirname, '../../logs');
  if (fs.existsSync(logsDir)) {
    try {
      console.log('🗑️  Clearing log files...');
      const files = fs.readdirSync(logsDir);
      files.forEach(file => {
        try {
          fs.unlinkSync(path.join(logsDir, file));
        } catch (err) {
          console.error(`Error deleting log file ${file}:`, err.message);
        }
      });
      console.log('✅ Log files cleared');
    } catch (error) {
      console.error('❌ Error clearing log files:', error.message);
    }
  }
};

// Main function
const main = () => {
  try {
    // Kill processes
    killNodeProcesses();
    killGanache();
    
    // Clear logs
    clearLogs();
    
    console.log('\n✅ All services have been stopped');
  } catch (error) {
    console.error('❌ Error stopping services:', error.message);
    process.exit(1);
  }
};

// Run the main function
main();
