const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

// Configuration
const CONFIG = {
    port: process.env.PORT || 3000
};

// --- Logging ---
const log = (message, color = 'reset') => {
    const colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        reset: '\x1b[0m',
    };
    console.log(`${colors[color]}[${new Date().toISOString()}] ${message}${colors.reset}`);
};

// --- Start API Server ---
function startServer() {
    log('Starting API server...', 'green');
    
    const server = spawn('node', ['blockchain-api.js'], {
        stdio: 'inherit',
        shell: true,
        env: process.env
    });

    server.on('error', (error) => {
        log(`Error: ${error.message}`, 'red');
    });

    server.on('close', (code) => {
        const message = `Server process exited with code ${code}`;
        log(message, code === 0 ? 'green' : 'red');
        
        // Auto-restart on non-zero exit code
        if (code !== 0) {
            log('Restarting server in 2 seconds...', 'yellow');
            setTimeout(startServer, 2000);
        }
    });

    // Handle process termination
    process.on('SIGINT', () => {
        log('Shutting down server...', 'yellow');
        server.kill();
        process.exit(0);
    });
}

// --- Main Function ---
function main() {
    log('Starting API service...', 'blue');
    startServer();
}

// Start the application
main();
