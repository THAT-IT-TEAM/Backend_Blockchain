const http = require('http');
const { execSync } = require('child_process');
const Config = require('./lib/config');

const PORT = Config.get('app.port', 3000);
const HOST = Config.get('app.host', '0.0.0.0');

// Check if database is accessible
function checkDatabase() {
    try {
        // Simple query to check database connection
        const db = require('./config/database');
        return db.authenticate()
            .then(() => ({
                database: 'ok'
            }))
            .catch(error => ({
                database: 'error',
                error: error.message
            }));
    } catch (error) {
        return Promise.resolve({
            database: 'error',
            error: error.message
        });
    }
}

// Check if storage is writable
function checkStorage() {
    return new Promise((resolve) => {
        const fs = require('fs');
        const path = require('path');
        const testFile = path.join(Config.get('storage.path', './storage'), '.healthcheck');
        
        try {
            fs.writeFileSync(testFile, 'healthcheck');
            fs.unlinkSync(testFile);
            resolve({
                storage: 'ok'
            });
        } catch (error) {
            resolve({
                storage: 'error',
                error: error.message
            });
        }
    });
}

// Check system resources
function checkSystem() {
    try {
        const os = require('os');
        const freeMemory = os.freemem();
        const totalMemory = os.totalmem();
        const memoryUsage = (1 - (freeMemory / totalMemory)) * 100;
        
        const load = os.loadavg();
        const cpuUsage = (load[0] / os.cpus().length) * 100;
        
        return {
            memory: {
                total: totalMemory,
                free: freeMemory,
                used: totalMemory - freeMemory,
                usage: memoryUsage.toFixed(2) + '%'
            },
            cpu: {
                load: load.map(l => l.toFixed(2)),
                usage: cpuUsage.toFixed(2) + '%',
                cores: os.cpus().length
            },
            uptime: os.uptime()
        };
    } catch (error) {
        return {
            system: 'error',
            error: error.message
        };
    }
}

// Main health check function
async function healthCheck() {
    const results = await Promise.all([
        checkDatabase(),
        checkStorage()
    ]);
    
    const system = checkSystem();
    const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        ...results[0], // database
        ...results[1], // storage
        system,
        env: process.env.NODE_ENV || 'development',
        node: process.version,
        platform: process.platform,
        pid: process.pid,
        uptime: process.uptime()
    };
    
    // Check for any errors
    const hasError = Object.values(status).some(
        value => value === 'error' || (value && value.error)
    );
    
    if (hasError) {
        status.status = 'error';
    }
    
    return status;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    if (req.url === '/health' || req.url === '/healthz' || req.url === '/health/') {
        try {
            const health = await healthCheck();
            const statusCode = health.status === 'ok' ? 200 : 503;
            
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health, null, 2));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            }, null, 2));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'error',
            error: 'Not Found',
            timestamp: new Date().toISOString()
        }));
    }
});

// Start the health check server
server.listen(3001, '0.0.0.0', () => {
    console.log('Health check server running on http://0.0.0.0:3001/health');
});

// Handle errors
server.on('error', (error) => {
    console.error('Health check server error:', error);
    process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('Shutting down health check server...');
    server.close(() => {
        console.log('Health check server stopped');
        process.exit(0);
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

module.exports = {
    healthCheck,
    checkDatabase,
    checkStorage,
    checkSystem
};
