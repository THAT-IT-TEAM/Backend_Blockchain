const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const waitPort = require('wait-port');
const http = require('http');

// Store references to child processes
const processes = [];
let ganacheProcess = null;

// Configuration
const CONFIG = {
  ganache: {
    port: 8545,
    host: '127.0.0.1',
    networkId: 5777,
    gasLimit: 10000000,
    accounts: 10,
    dbPath: path.join(__dirname, '../../.ganache_db'),
    mnemonic: 'myth like bonus scare over problem client lizard pioneer submit female collect'
  },
  api: {
    port: 3001,
    host: '127.0.0.1'
  },
  dashboard: {
    port: 3000,
    host: '127.0.0.1'
  }
};

// Utility functions
async function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = http.createServer()
      .listen(port, host)
      .on('error', () => {
        resolve(true);
      })
      .on('listening', () => {
        server.close();
        resolve(false);
      });
  });
}

async function waitForPort(port, host = '127.0.0.1', timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await isPortInUse(port, host)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

function logWithTimestamp(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

const ROOT_DIR = path.join(__dirname, '../..');
const API_DIR = path.join(ROOT_DIR, 'api');

async function checkGanache() {
  try {
    logWithTimestamp('🔍 Checking if Ganache CLI is installed...');
    const version = execSync('ganache-cli --version', { stdio: 'pipe' }).toString().trim();
    logWithTimestamp(`✅ Ganache CLI is installed (${version})`);
    return true;
  } catch (error) {
    logWithTimestamp('❌ Ganache CLI is not installed. Please install it with:');
    logWithTimestamp('   npm install -g ganache-cli');
    return false;
  }
}

async function startBlockchainNetwork() {
  try {
    logWithTimestamp('🚀 Starting Ganache CLI...');
    
    // Check if port is already in use
    if (await isPortInUse(CONFIG.ganache.port, CONFIG.ganache.host)) {
      logWithTimestamp(`⚠️  Port ${CONFIG.ganache.port} is already in use. Trying to use Ganache on this port...`);
    }
    
    // Create ganache db directory if it doesn't exist
    if (!fs.existsSync(CONFIG.ganache.dbPath)) {
      fs.mkdirSync(CONFIG.ganache.dbPath, { recursive: true });
    }
    
    // Prepare Ganache CLI arguments
    const ganacheArgs = [
      '--port', CONFIG.ganache.port,
      '--host', CONFIG.ganache.host,
      '--networkId', CONFIG.ganache.networkId,
      '--gasLimit', CONFIG.ganache.gasLimit,
      '--accounts', CONFIG.ganache.accounts,
      '--db', CONFIG.ganache.dbPath,
      '--deterministic',
      '--mnemonic', `"${CONFIG.ganache.mnemonic}"`,
      '--verbose'
    ];
    
    logWithTimestamp(`Starting Ganache with: ganache-cli ${ganacheArgs.join(' ')}`);
    
    // Start Ganache CLI in the background
    ganacheProcess = spawn('ganache-cli', ganacheArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      detached: true
    });
    
    // Store the process reference
    processes.push(ganacheProcess);
    
    // Log Ganache output
    ganacheProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logWithTimestamp(`[Ganache] ${output}`);
      }
    });
    
    ganacheProcess.stderr.on('data', (data) => {
      const errorOutput = data.toString().trim();
      if (errorOutput) {
        logWithTimestamp(`[Ganache Error] ${errorOutput}`);
      }
    });
    
    ganacheProcess.on('close', (code, signal) => {
      logWithTimestamp(`Ganache process exited with code ${code} (signal: ${signal})`);
    });
    
    // Wait for Ganache to be ready
    logWithTimestamp(`⏳ Waiting for Ganache to start on port ${CONFIG.ganache.port}...`);
    const ganacheReady = await waitForPort(CONFIG.ganache.port, CONFIG.ganache.host, 15000);
    
    if (!ganacheReady) {
      throw new Error(`Timed out waiting for Ganache to start on port ${CONFIG.ganache.port}`);
    }
    
    logWithTimestamp(`✅ Ganache is running at http://${CONFIG.ganache.host}:${CONFIG.ganache.port}`);
    return true;
    
  } catch (error) {
    logWithTimestamp(`❌ Failed to start Ganache: ${error.message}`);
    return false;
  }
}

async function deployContracts() {
  console.log('📝 Deploying smart contracts...');
  
  // Make sure deploy script is executable
  try {
    // Skip deployment for now as we don't have contracts yet
    console.log('ℹ️  No contracts to deploy yet. Skipping deployment.');
    return true;
  } catch (error) {
    console.error('❌ Failed to deploy smart contracts:', error.message);
    return false;
  }
}

async function startApiServer() {
  logWithTimestamp('🚀 Starting API server...');
  
  // Check if API directory exists
  if (!fs.existsSync(API_DIR)) {
    logWithTimestamp(`❌ API directory not found at ${API_DIR}`);
    return false;
  }
  
  // Check if API entry file exists
  const apiEntryFile = path.join(API_DIR, 'blockchain-api.js');
  if (!fs.existsSync(apiEntryFile)) {
    logWithTimestamp(`❌ API entry file not found at ${apiEntryFile}`);
    return false;
  }
  
  // Install API dependencies if needed
  logWithTimestamp('📦 Checking API dependencies...');
  try {
    // Check if node_modules exists
    if (!fs.existsSync(path.join(API_DIR, 'node_modules'))) {
      logWithTimestamp('📦 Installing API dependencies (this may take a while)...');
      execSync('npm install --production', { 
        cwd: API_DIR,
        stdio: 'inherit'
      });
    } else {
      logWithTimestamp('✅ API dependencies already installed');
    }
  } catch (error) {
    logWithTimestamp(`⚠️  Failed to install API dependencies: ${error.message}`);
    logWithTimestamp('⚠️  Attempting to start API server anyway...');
  }
  
  // Prepare environment variables
  const env = {
    ...process.env,
    PORT: CONFIG.api.port,
    NODE_ENV: 'development',
    BLOCKCHAIN_RPC_URL: `http://${CONFIG.ganache.host}:${CONFIG.ganache.port}`,
    JWT_SECRET: 'dev-secret-key-replace-in-production',
    NODE_TLS_REJECT_UNAUTHORIZED: '0', // Only for development
    DB_PATH: path.join(API_DIR, 'data', 'app.db')
  };
  
  logWithTimestamp(`Starting API server with NODE_ENV=${env.NODE_ENV} and PORT=${env.PORT}`);
  
  // Start the API server
  const apiProcess = spawn('node', ['blockchain-api.js'], {
    cwd: API_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env
  });
  
  // Store the process reference
  processes.push(apiProcess);
  
  // Handle process output
  apiProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      logWithTimestamp(`[API] ${output}`);
    }
  });
  
  apiProcess.stderr.on('data', (data) => {
    const errorOutput = data.toString().trim();
    if (errorOutput) {
      logWithTimestamp(`[API Error] ${errorOutput}`);
    }
  });
  
  apiProcess.on('close', (code, signal) => {
    logWithTimestamp(`API server process exited with code ${code} (signal: ${signal})`);
  });
  
  // Wait for API to be ready
  logWithTimestamp(`⏳ Waiting for API server to start on port ${CONFIG.api.port}...`);
  try {
    const apiReady = await waitForPort(CONFIG.api.port, CONFIG.api.host, 15000);
    
    if (!apiReady) {
      throw new Error(`Timed out waiting for API server to start on port ${CONFIG.api.port}`);
    }
    
    logWithTimestamp(`✅ API server is running at http://${CONFIG.api.host}:${CONFIG.api.port}`);
    return true;
    
  } catch (error) {
    logWithTimestamp(`❌ Failed to start API server: ${error.message}`);
    return false;
  }
}

async function initBlockchain() {
  console.log('🚀 Initializing Blockchain with Ganache...');
  
  // Check if Ganache CLI is installed
  if (!(await checkGanache())) {
    return false;
  }
  
  // Start Ganache
  if (!(await startBlockchainNetwork())) {
    return false;
  }
  
  // Deploy contracts
  if (!(await deployContracts())) {
    console.log('⚠️  Continuing without contract deployment...');
  }
  
  // Start API server
  if (!(await startApiServer())) {
    console.log('⚠️  Continuing without API server...');
  }
  
  return true;
}

// Run the initialization
if (require.main === module) {
  initBlockchain()
    .then(success => {
      if (success) {
        console.log('✨ Blockchain initialization completed successfully!');
      } else {
        console.error('❌ Blockchain initialization failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error during blockchain initialization:', error);
      process.exit(1);
    });
}

module.exports = initBlockchain;
