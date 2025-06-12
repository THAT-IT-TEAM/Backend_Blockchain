const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const startHandler = require('./start-handler');
const startNode = require('./start-node');
const initBlockchain = require('./init-blockchain');

// Store references to all child processes
const processes = [];
let ganacheProcess = null;

// Ensure logs directory exists
const LOGS_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Function to create a timestamp
function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// Function to create a log file stream
function createLogStream(prefix) {
  const logFile = path.join(LOGS_DIR, `${prefix}-${getTimestamp()}.log`);
  return fs.createWriteStream(logFile, { flags: 'a' });
}

async function installDependencies() {
  console.log('🔧 Installing dependencies...');
  
  const rootDir = path.join(__dirname, '../..');
  const apiDir = path.join(rootDir, 'api');
  const dashboardDir = path.join(rootDir, 'node-dashboard');
  
  try {
    // Install root dependencies
    console.log('📦 Installing root dependencies...');
    await exec('npm install', { cwd: rootDir, stdio: 'inherit' });
    
    // Install API dependencies
    console.log('📦 Installing API dependencies...');
    await exec('npm install', { cwd: apiDir, stdio: 'inherit' });
    
    // Install Dashboard dependencies
    console.log('📦 Installing Dashboard dependencies...');
    await exec('npm install', { cwd: dashboardDir, stdio: 'inherit' });
    
    console.log('✅ All dependencies installed successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error);
    return false;
  }
}

async function startAll() {
  try {
    // Install dependencies first
    const depsInstalled = await installDependencies();
    if (!depsInstalled) {
      console.log('⚠️  Some dependencies failed to install, but continuing with startup...');
    }
    // Initialize blockchain (Ganache, contracts, API server)
    console.log('🚀 Initializing Blockchain...');
    const blockchainReady = await initBlockchain();
    
    if (!blockchainReady) {
      console.log('⚠️  Some blockchain services failed to start, but continuing with available services...');
    }

    // Start the node handler
    console.log('\n🚀 Starting Node Handler...');
    await startHandler();
    
    // Start the default node
    console.log('\n🚀 Starting Default Node...');
    await startNode();
    
    // Start the Next.js development server
    console.log('\n🚀 Starting Dashboard...');
    const dashboardLog = createLogStream('dashboard');
    const dashboard = spawn('next', ['dev'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: 3000,
        NODE_ENV: 'development',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3001',
        NODE_TLS_REJECT_UNAUTHORIZED: '0' // Only for development
      },
    });
    
    // Store the process reference
    processes.push(dashboard);
    
    // Handle process output
    dashboard.stdout.on('data', (data) => {
      const log = `[Dashboard] ${data}`.trim();
      console.log(log);
      dashboardLog.write(`${new Date().toISOString()} - ${log}\n`);
    });
    
    dashboard.stderr.on('data', (data) => {
      const log = `[Dashboard Error] ${data}`.trim();
      console.error(log);
      dashboardLog.write(`${new Date().toISOString()} - ${log}\n`);
    });
    
    dashboard.on('close', (code) => {
      const log = `Dashboard process exited with code ${code}`;
      console.log(log);
      dashboardLog.write(`${new Date().toISOString()} - ${log}\n`);
      dashboardLog.end();
    });
    
    // Log the dashboard URL
    console.log('\n🌐 Dashboard will be available at: http://localhost:3000');
    console.log('📊 API server is running at: http://localhost:3001');
    console.log('🔗 Ganache RPC is running at: http://localhost:8545');
    console.log('\n🛑 Press Ctrl+C to stop all services');

    // Handle process termination
    const shutdown = async () => {
      console.log('\n🛑 Shutting down services...');
      
      // Kill all child processes
      const cleanupPromises = processes.map(proc => {
        return new Promise((resolve) => {
          if (!proc || proc.killed) {
            return resolve();
          }
          
          console.log(`🛑 Stopping process ${proc.pid}...`);
          
          // Handle process exit
          const onExit = () => {
            proc.removeListener('exit', onExit);
            resolve();
          };
          
          proc.once('exit', onExit);
          
          try {
            if (process.platform === 'win32') {
              execSync(`taskkill /F /PID ${proc.pid} /T`);
            } else {
              process.kill(-proc.pid, 'SIGTERM');
            }
            
            // Force kill if not exited after 5 seconds
            setTimeout(() => {
              if (!proc.killed) {
                try {
                  process.kill(proc.pid, 'SIGKILL');
                } catch (e) {
                  // Process already terminated
                }
              }
              resolve();
            }, 5000);
          } catch (error) {
            console.error(`❌ Error stopping process ${proc.pid}:`, error.message);
            resolve();
          }
        });
      });
      
      // Wait for all processes to be cleaned up
      await Promise.all(cleanupPromises);
      
      // Additional Ganache cleanup if needed
      console.log('🛑 Ensuring Ganache is stopped...');
      try {
        if (process.platform === 'win32') {
          execSync('taskkill /F /IM ganache-cli.exe /T', { stdio: 'ignore' });
          execSync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq ganache*" /T', { stdio: 'ignore' });
        } else {
          execSync('pkill -f ganache-cli || true', { stdio: 'ignore' });
        }
      } catch (error) {
        // Ignore errors if Ganache is already stopped
      }
      
      console.log('\n✅ All services have been stopped');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (error) {
    console.error('❌ Error starting services:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startAll().catch(console.error);
}

module.exports = startAll;
