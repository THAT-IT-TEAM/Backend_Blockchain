const { spawn, execSync } = require('child_process');
const path = require('path');
const waitPort = require('wait-port');

// Store references to child processes
const processes = [];

const NODE_HANDLER_PORT = 3001;
const NODE_HANDLER_PATH = path.join(__dirname, '../../node-handler');

async function startHandler() {
  console.log('🚀 Starting Node Handler...');
  
  // Check if the handler is already running
  try {
    const isHandlerRunning = await waitPort({
      host: 'localhost',
      port: NODE_HANDLER_PORT,
      timeout: 1000,
      output: 'dots' // Changed from 'drain' to 'dots' which is a valid output mode
    });

    if (isHandlerRunning) {
      console.log(`✅ Node Handler is already running on port ${NODE_HANDLER_PORT}`);
      return true;
    }
  } catch (error) {
    console.log('🔍 Checking Node Handler status...');
  }

  // Start the node handler
  const handler = spawn('node', ['handler.js'], {
    cwd: NODE_HANDLER_PATH,
    stdio: 'pipe',
    shell: true,
    env: {
      ...process.env,
      PORT: NODE_HANDLER_PORT,
      NODE_ENV: 'development',
    },
  });
  
  // Store the process reference
  processes.push(handler);
  
  // Handle process output
  handler.stdout.on('data', (data) => {
    console.log(`[Handler] ${data}`.trim());
  });
  
  handler.stderr.on('data', (data) => {
    console.error(`[Handler Error] ${data}`.trim());
  });
  
  handler.on('close', (code) => {
    console.log(`Handler process exited with code ${code}`);
  });

  // Wait for the handler to be ready
  try {
    await waitPort({
      host: 'localhost',
      port: NODE_HANDLER_PORT,
      timeout: 10000, // 10 seconds timeout
    });
    console.log(`✅ Node Handler started on port ${NODE_HANDLER_PORT}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to start Node Handler:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startHandler().catch(console.error);
}

module.exports = startHandler;
