const { spawn, execSync } = require('child_process');
const path = require('path');
const net = require('net');

// --- Auto-installer for required packages ---
const requiredPackages = ['web3', 'uuid', 'formidable'];
for (const pkg of requiredPackages) {
  try {
    require.resolve(pkg);
  } catch (e) {
    console.log(`[Auto-Installer] Installing missing package: ${pkg} ...`);
    execSync(`npm install ${pkg}`, { stdio: 'inherit' });
  }
}

// --- Logging ---
function log(service, message, color) {
    const colors = {
        red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m', reset: '\x1b[0m',
    };
    const colorCode = colors[color] || colors.reset;
    console.log(`[${new Date().toISOString()}] [${service}] ${colorCode}${message}${colors.reset}`);
}

// --- Ganache readiness check ---
async function isGanacheReady(url, timeout = 30000, retryInterval = 1500) {
    let Web3;
    try { Web3 = require('web3'); } catch (e) { log('System', 'Web3 not found. Please install web3.', 'red'); return false; }
    const start = Date.now();
    let attempt = 0;
    while (Date.now() - start < timeout) {
        attempt++;
        try {
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

// --- Enhanced Process Management with Auto-Install on MODULE_NOT_FOUND ---
function spawnProcessWithAutoInstall(name, command, args, cwd, maxRetries = 2) {
  let retries = 0;
  function start() {
    const options = { cwd, shell: true };
    const proc = spawn(command, args, options);
    processes.push(proc);
    proc.stdout.on('data', (data) => log(name, data.toString().trim(), 'cyan'));
    proc.stderr.on('data', (data) => {
      const msg = data.toString();
      log(name, msg.trim(), 'red');
      // Check for MODULE_NOT_FOUND error
      const match = msg.match(/Cannot find module '([^']+)'/);
      if (match && retries < maxRetries) {
        const missingModule = match[1];
        log('Auto-Installer', `Detected missing module: ${missingModule}. Installing...`, 'yellow');
        try {
          execSync(`npm install ${missingModule}`, { stdio: 'inherit' });
          log('Auto-Installer', `Installed ${missingModule}. Retrying ${name}...`, 'green');
          retries++;
          setTimeout(() => start(), 1000); // Retry after short delay
        } catch (e) {
          log('Auto-Installer', `Failed to install ${missingModule}: ${e.message}`, 'red');
        }
      }
    });
    proc.on('close', (code) => log(name, `Service exited with code ${code}`, 'yellow'));
    return proc;
  }
  return start();
}

const processes = [];
function cleanup() {
    log('System', 'Shutting down all services...', 'yellow');
    processes.forEach(proc => {
        try { proc.kill('SIGTERM'); } catch (e) { }
    });
    setTimeout(() => process.exit(0), 2000);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function deployContracts() {
    log('Contracts', 'Deploying contracts using deploy-contracts.sh...', 'magenta');
    try {
        execSync('bash ./scripts/deploy-contracts.sh', { cwd: __dirname, stdio: 'inherit', shell: 'bash' });
        log('Contracts', 'Contracts deployed successfully!', 'green');
        return true;
    } catch (error) {
        log('Contracts', `Failed to deploy contracts: ${error.message}`, 'red');
        return false;
    }
}

async function main() {
    // 1. Start Ganache as a subprocess
    log('Ganache', 'Starting Ganache CLI as a subprocess...', 'magenta');
    const ganacheArgs = ['--port', '8545', '--accounts', '10', '--deterministic', '--gasLimit', '10000000'];
    spawnProcessWithAutoInstall('Ganache', 'ganache-cli', ganacheArgs, process.cwd());

    // 2. Wait for Ganache to be ready
    log('System', 'Waiting for Ganache to be ready at http://localhost:8545 ...', 'magenta');
    const ganacheReady = await isGanacheReady('http://localhost:8545');
    if (!ganacheReady) {
        log('System', 'Ganache failed to start. Exiting.', 'red');
        cleanup();
        return;
    }

    // 3. Deploy contracts
    const contractsDeployed = await deployContracts();
    if (!contractsDeployed) {
        log('System', 'Contract deployment failed. Exiting.', 'red');
        cleanup();
        return;
    }

    // 4. Start API (with auto-install retry)
    log('API', 'Starting API...', 'magenta');
    spawnProcessWithAutoInstall('API', 'node', ['blockchain-api.js'], path.join(__dirname, 'api'));

    // 6. Start Dashboard (with auto-install retry)
    log('Dashboard', 'Starting Dashboard...', 'magenta');
    spawnProcessWithAutoInstall('Dashboard', 'npm', ['run', 'dev', '--', '-p', '3001'], path.join(__dirname, 'node-dashboard'));

    // 7. Keep-alive
    setInterval(() => log('System', 'Heartbeat: Services are running...', 'gray'), 60000);
}

main();