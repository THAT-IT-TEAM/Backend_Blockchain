const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

// Configuration
const CONFIG = {
    ganache: {
        port: 8545,
        command: 'ganache-cli',
        args: ['-p', '8545', '-l', '10000000', '--networkId', '1337', '-h', '0.0.0.0'],
    },
    nodeHandler: {
        dir: path.join(__dirname, 'node-handler'),
        command: 'npm',
        args: ['start'],
        port: 3000,
    },
    blockchainNode: {
        dir: path.join(__dirname, 'api-nodes', 'node-1'),
        command: 'node',
        args: ['start-node.js'],
        port: 3002,
    },
    dashboard: {
        dir: path.join(__dirname, 'node-dashboard'),
        command: 'npm',
        args: ['run', 'dev'],
        port: 3001,
    },
};

const processes = [];

// --- Logging ---
const log = (service, message, color) => {
    const colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        gray: '\x1b[90m',
        reset: '\x1b[0m',
    };
    const colorCode = colors[color] || colors.reset;
    console.log(`[${new Date().toISOString()}] [${service}] ${colorCode}${message}${colors.reset}`);
};

// --- Web3 Installation and Ganache Readiness ---
async function isGanacheReady(url, timeout = 45000, retryInterval = 1500) {
    let Web3;
    try {
        Web3 = require('web3');
    } catch (e) {
        log('System', 'Web3 not found. Installing dependencies...', 'yellow');
        try {
            execSync('npm install web3@1.10.0 --no-save', { stdio: 'inherit', cwd: __dirname });
            Web3 = require('web3');
            log('System', 'Web3 installed successfully.', 'green');
        } catch (installError) {
            log('System', `Failed to install Web3: ${installError.message}`, 'red');
            return false;
        }
    }

    const start = Date.now();
    log('Ganache', `Waiting for Ganache at ${url}...`, 'yellow');
    let attempt = 0;
    while (Date.now() - start < timeout) {
        attempt++;
        try {
            log('Ganache', `Connection attempt #${attempt}...`, 'gray');
            const web3 = new Web3(new Web3.providers.HttpProvider(url));
            await web3.eth.getNodeInfo();
            log('Ganache', 'Ganache is ready.', 'green');
            return true;
        } catch (error) {
            log('Ganache', `Attempt #${attempt} failed. Retrying...`, 'gray');
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
    log('Ganache', 'Timeout waiting for Ganache to become ready.', 'red');
    return false;
}

// --- Process Management ---
function spawnProcess(name, command, args, cwd) {
    const options = { cwd, shell: true };
    const proc = spawn(command, args, options);
    processes.push({ process: proc, name });

    proc.stdout.on('data', (data) => log(name, data.toString().trim(), 'cyan'));
    proc.stderr.on('data', (data) => log(name, data.toString().trim(), 'red'));
    proc.on('close', (code) => log(name, `Service exited with code ${code}`, 'yellow'));

    return proc;
}

async function startService(name, config) {
    if (!fs.existsSync(config.dir)) {
        log('System', `Directory not found for ${name}: ${config.dir}`, 'yellow');
        return null;
    }
    log(name, `Installing dependencies in ${config.dir}...`, 'yellow');
    try {
        execSync('npm install', { cwd: config.dir, stdio: 'inherit' });
    } catch (error) {
        log(name, `Failed to install dependencies: ${error.message}`, 'red');
        return null;
    }
    log(name, 'Starting service...', 'yellow');
    return spawnProcess(name, config.command, config.args, config.dir);
}

// --- Contract Deployment ---
async function deployContracts() {
    const scriptPath = path.join(__dirname, 'scripts', 'deploy-contracts.sh');
    log('Contracts', 'Deploying contracts using deploy-contracts.sh...', 'yellow');
    try {
        // Execute the shell script for deployment
        execSync(`bash "${scriptPath}"`, { cwd: __dirname, stdio: 'inherit', shell: 'bash' });
        log('Contracts', 'Contracts deployed successfully', 'green');
        return true;
    } catch (error) {
        log('Contracts', `Failed to deploy contracts: ${error.message}`, 'red');
        return false;
    }
}

// --- Cleanup ---
function cleanup() {
    log('System', 'Shutting down all services...', 'yellow');
    processes.forEach(({ process, name }) => {
        log(name, 'Stopping service...', 'yellow');
        try {
            process.kill('SIGTERM');
        } catch (e) {
            log(name, `Failed to kill process: ${e.message}`, 'red');
        }
    });
    setTimeout(() => {
        log('System', 'Cleanup complete.', 'green');
        process.exit(0);
    }, 2000);
}

// --- Main Function ---
async function main() {
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    try {
        log('System', 'Step 1: Starting Ganache process...', 'magenta');
        spawnProcess('Ganache', CONFIG.ganache.command, CONFIG.ganache.args, __dirname);
        log('System', 'Step 2: Ganache process spawned. Awaiting readiness...', 'magenta');
        
        const ganacheReady = await isGanacheReady(`http://localhost:${CONFIG.ganache.port}`);
        log('System', `Step 3: Ganache readiness check complete. Result: ${ganacheReady}`, 'magenta');
        if (!ganacheReady) {
            throw new Error('Ganache blockchain failed to start.');
        }

        log('System', 'Step 4: Awaiting contract deployment...', 'magenta');
        const contractsDeployed = await deployContracts();
        log('System', `Step 5: Contract deployment complete. Result: ${contractsDeployed}`, 'magenta');
        if (!contractsDeployed) {
            throw new Error('Failed to deploy contracts');
        }

        log('System', 'Step 6: Awaiting Node Handler start...', 'magenta');
        await startService('Node Handler', CONFIG.nodeHandler);
        log('System', 'Step 7: Awaiting Blockchain Node start...', 'magenta');
        await startService('Blockchain Node', CONFIG.blockchainNode);
        log('System', 'Step 8: Awaiting Dashboard start...', 'magenta');
        await startService('Dashboard', CONFIG.dashboard);

        log('System', 'Step 9: All services running. Activating keep-alive.', 'green');

        // Active keep-alive to prevent the process from exiting
        setInterval(() => {
            log('System', 'Heartbeat: Ecosystem is running...', 'gray');
        }, 60000);

    } catch (error) {
        log('System', `FATAL: ${error.message}`, 'red');
        cleanup();
    }
}

main();