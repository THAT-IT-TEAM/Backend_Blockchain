// Load environment variables first
const path = require('path');
const dotenv = require('dotenv');
const { execSync } = require('child_process');
const fs = require('fs');
const { spawn } = require('child_process');
const axios = require('axios');

// Debug: Log current directory and .env path
console.log('Current directory:', __dirname);
const envPath = path.resolve(__dirname, '.env');
console.log('Loading .env from:', envPath);

// Load environment variables
try {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.error('Error loading .env file:', result.error);
    } else {
        console.log('Environment variables loaded successfully');
        // Log all environment variables (be careful with sensitive data in production)
        console.log('Available environment variables:', Object.keys(process.env));
    }
} catch (error) {
    console.error('Failed to load .env file:', error);
}

// Make sure we have the required environment variables
if (!process.env.HANDLER_URL) {
    console.error('WARNING: HANDLER_URL is not set in environment variables');
}

class APINode {
    constructor() {
        // Configuration
        this.port = process.env.PORT || 3002;
        this.env = process.env.NODE_ENV || 'development';
        this.handlerUrl = process.env.HANDLER_URL?.trim();
        this.nodeId = process.env.NODE_NAME || `node-${Math.floor(Math.random() * 10) + 1}`;
        
        // Debug log
        console.log('Environment Variables in Constructor:');
        console.log('- HANDLER_URL:', this.handlerUrl || 'Not set!');
        
        console.log('Environment Variables Loaded:');
        console.log(`- PORT: ${this.port}`);
        console.log(`- NODE_ENV: ${this.env}`);
        console.log(`- HANDLER_URL: ${this.handlerUrl || 'Not set!'}`);
        console.log(`- NODE_NAME: ${this.nodeId}`);
        this.configPath = path.join(__dirname, 'config', 'node.json');
        this.publicUrl = null;
        this.tunnel = null;
        this.server = null;
        this.app = null;

        // Create config directory if it doesn't exist
        const configDir = path.join(__dirname, 'config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Initialize
        this.loadConfig();
        this.setupProcessHandlers();
    }

    loadConfig() {
        const defaultConfig = {
            nodeId: this.nodeId,
            port: this.port,
            env: this.env,
            isActive: true,
            lastSeen: new Date().toISOString(),
            publicUrl: null,
            handlerUrl: this.handlerUrl
        };

        try {
            if (fs.existsSync(this.configPath)) {
                this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                console.log(`Loaded existing config for node ${this.config.nodeId}`);
            } else {
                this.config = defaultConfig;
                this.saveConfig();
                console.log(`Created new node config: ${this.config.nodeId}`);
            }
            
            // Update instance properties
            this.port = this.config.port;
            this.env = this.config.env;
            this.nodeId = this.config.nodeId;
            this.handlerUrl = this.config.handlerUrl;
            
        } catch (error) {
            console.error('Error loading/saving node config:', error);
            this.config = defaultConfig;
        }

        // Update environment
        process.env.PORT = this.port;
        process.env.NODE_ENV = this.env;
    }

    saveConfig() {
        this.config = {
            ...this.config,
            nodeId: this.nodeId,
            port: this.port,
            env: this.env,
            handlerUrl: this.handlerUrl,
            publicUrl: this.publicUrl,
            lastSeen: new Date().toISOString()
        };
        
        fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    }

    async start() {
        console.log(`Starting API Node ${this.nodeId} on port ${this.port}...`);
        try {
            this.app = require('./blockchain-api');
            this.server = this.app.listen(this.port, '0.0.0.0', async () => {
                console.log(`API Node ${this.nodeId} is running at http://localhost:${this.port}`);
                console.log(`Environment: ${this.env}`);
                await this.setupServeoTunnel();
                await this.registerWithHandler();
                this.startPingHandler(); // Start periodic ping
            });
            return this.app;
        } catch (error) {
            console.error('Failed to start API Node:', error);
            await this.cleanup();
            process.exit(1);
        }
    }

    async setupServeoTunnel() {
        if (process.env.DISABLE_TUNNEL === 'true') {
            console.log('Serveo tunnel is disabled by configuration');
            return;
        }
        return new Promise((resolve, reject) => {
            console.log('Setting up Serveo tunnel...');
            // Use -o StrictHostKeyChecking=no to avoid prompts
            // Use HTTP forwarding: -R 80:localhost:PORT
            const ssh = spawn('ssh', [
                '-o', 'StrictHostKeyChecking=no',
                '-R', `80:localhost:${this.port}`,
                'serveo.net'
            ]);
            let urlFound = false;
            ssh.stdout.on('data', (data) => {
                const output = data.toString();
                console.log('[Serveo]', output.trim());
                // Look for the public URL in the output
                const match = output.match(/Forwarding HTTP traffic from (https?:\/\/[^\s]+)/);
                if (match && match[1]) {
                    this.publicUrl = match[1];
                    // Fix: Use http:// for handler registration to avoid SSL errors
                    if (this.publicUrl.startsWith('https://')) {
                        this.publicUrl = this.publicUrl.replace('https://', 'http://');
                    }
                    this.saveConfig();
                    urlFound = true;
                    console.log(`Serveo tunnel created: ${this.publicUrl}`);
                    resolve();
                }
            });
            ssh.stderr.on('data', (data) => {
                console.error('[Serveo][stderr]', data.toString().trim());
            });
            ssh.on('close', (code) => {
                console.warn(`Serveo tunnel process exited with code ${code}. Attempting to re-establish in 5s...`);
                setTimeout(() => this.setupServeoTunnel(), 5000);
            });
            ssh.on('error', (err) => {
                console.error('Serveo tunnel error:', err);
                setTimeout(() => this.setupServeoTunnel(), 10000);
            });
            // Timeout if no URL after 15s
            setTimeout(() => {
                if (!urlFound) {
                    console.error('Failed to get Serveo public URL in time. Retrying...');
                    ssh.kill();
                    setTimeout(() => this.setupServeoTunnel(), 5000);
                    reject(new Error('Serveo tunnel timeout'));
                }
            }, 15000);
        });
    }

    async registerWithHandler() {
        if (!this.publicUrl) {
            console.warn('No public URL available. Cannot register with handler.');
            return;
        }
        if (!this.handlerUrl) {
            this.handlerUrl = process.env.HANDLER_URL?.trim();
        }
        if (!this.handlerUrl) {
            console.error('Handler URL is not defined. Please set HANDLER_URL in .env');
            return;
        }
        try {
            const registerUrl = `${this.handlerUrl.replace(/\/+$/, '')}/register-service`;
            const response = await require('axios').post(registerUrl, {
                serviceName: this.nodeId,
                serviceUrl: this.publicUrl
            });
            console.log('Registered with handler:', response.data);
            this.lastRegisteredUrl = this.publicUrl;
        } catch (error) {
            console.error('Failed to register with handler:', error.message);
        }
    }

    startPingHandler() {
        setInterval(async () => {
            try {
                // Only re-register if the tunnel URL has changed
                if (this.publicUrl !== this.lastRegisteredUrl) {
                    await this.registerWithHandler();
                } else {
                    // Send a heartbeat to the handler
                    const heartbeatUrl = `${this.handlerUrl.replace(/\/+$/, '')}/heartbeat`;
                    await require('axios').post(heartbeatUrl, {
                        serviceName: this.nodeId,
                        serviceUrl: this.publicUrl
                    }, { timeout: 2000 });
                    // Optionally log successful heartbeat
                    // console.log('Heartbeat sent to handler');
                }
            } catch (err) {
                console.warn('Heartbeat to handler failed:', err.message);
            }
        }, 30000); // Heartbeat every 30 seconds
    }

    async cleanup() {
        console.log('Cleaning up resources...');
        try {
            // No tunnel close for Serveo, just kill the process if needed
            if (this.server && typeof this.server.close === 'function') {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                }).catch(console.error);
                this.server = null;
            }
            this.saveConfig();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    setupProcessHandlers() {
        // Handle process termination
        const shutdown = async (signal) => {
            console.log(`Received ${signal}. Shutting down node...`);
            await this.cleanup();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.cleanup().finally(() => process.exit(1));
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
    }
}

// Start the node
const node = new APINode();
node.start().catch(console.error);

// Export for testing
module.exports = node;
