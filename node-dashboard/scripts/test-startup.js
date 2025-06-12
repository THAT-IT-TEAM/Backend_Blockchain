const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Configuration
const PORTS = {
  ganache: 8545,
  api: 3001,
  dashboard: 3000
};

const TIMEOUT = 30000; // 30 seconds

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, { timeout: 1000 });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('response', (res) => {
      res.destroy();
      resolve(res.statusCode < 500);
    });
  });
}

async function waitForService(name, port) {
  console.log(`⏳ Waiting for ${name} to be ready...`);
  const startTime = Date.now();
  
  while (Date.now() - startTime < TIMEOUT) {
    if (await checkPort(port)) {
      console.log(`✅ ${name} is ready!`);
      return true;
    }
    await sleep(1000);
  }
  
  console.error(`❌ Timed out waiting for ${name} to be ready`);
  return false;
}

// Test the startup process
async function testStartup() {
  console.log('🚀 Starting Blockchain Node Dashboard test...');
  
  try {
    // Check if Ganache CLI is installed
    try {
      console.log('🔍 Checking Ganache CLI installation...');
      execSync('ganache-cli --version', { stdio: 'pipe' });
      console.log('✅ Ganache CLI is installed');
    } catch (error) {
      console.error('❌ Ganache CLI is not installed. Please install it with:');
      console.log('   npm install -g ganache-cli');
      process.exit(1);
    }
    
    // Start the blockchain initialization
    console.log('\n🔗 Initializing blockchain...');
    const blockchain = spawn('node', ['scripts/init-blockchain.js'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });
    
    // Wait for blockchain services to be ready
    const ganacheReady = await waitForService('Ganache', PORTS.ganache);
    const apiReady = await waitForService('API Server', PORTS.api);
    
    if (!ganacheReady || !apiReady) {
      console.error('❌ Failed to start required services');
      process.exit(1);
    }
    
    console.log('\n✅ All services started successfully!');
    console.log('\n🌐 Dashboard: http://localhost:3000');
    console.log('📊 API: http://localhost:3001');
    console.log('🔗 Ganache: http://localhost:8545');
    console.log('\n🛑 Press Ctrl+C to stop all services');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testStartup();
