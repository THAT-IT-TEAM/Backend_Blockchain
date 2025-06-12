const { spawn, execSync } = require('child_process');
const path = require('path');
const waitPort = require('wait-port');

// Store references to child processes
const processes = [];

const NODE_PORT = 3002;
const NODE_HANDLER_URL = 'http://localhost:3001';
const NODE_PATH = path.join(__dirname, '../../api-nodes/expense-service');

async function startNode() {
  console.log('🚀 Starting Default Node...');
  
  // Check if the node is already running
  try {
    const isNodeRunning = await waitPort({
      host: 'localhost',
      port: NODE_PORT,
      timeout: 1000,
      output: 'dots' // Changed from 'drain' to 'dots' which is a valid output mode
    });

    if (isNodeRunning) {
      console.log(`✅ Default Node is already running on port ${NODE_PORT}`);
      return true;
    }
  } catch (error) {
    console.log('🔍 Checking Default Node status...');
  }

  // Start the node
  const node = spawn('node', ['index.js'], {
    cwd: NODE_PATH,
    stdio: 'pipe',
    shell: true,
    env: {
      ...process.env,
      PORT: NODE_PORT,
      NODE_ENV: 'development',
      HANDLER_URL: NODE_HANDLER_URL,
      NODE_ID: 'default-node-1',
      NODE_NAME: 'Default Expense Node',
    },
  });
  
  // Store the process reference
  processes.push(node);
  
  // Handle process output
  node.stdout.on('data', (data) => {
    console.log(`[Node] ${data}`.trim());
  });
  
  node.stderr.on('data', (data) => {
    console.error(`[Node Error] ${data}`.trim());
  });
  
  node.on('close', (code) => {
    console.log(`Node process exited with code ${code}`);
  });

  // Wait for the node to be ready
  try {
    await waitPort({
      host: 'localhost',
      port: NODE_PORT,
      timeout: 10000, // 10 seconds timeout
    });
    console.log(`✅ Default Node started on port ${NODE_PORT}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to start Default Node:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startNode().catch(console.error);
}

module.exports = startNode;
