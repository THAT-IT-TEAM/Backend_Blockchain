module.exports = {
  apps: [
    {
      name: 'ganache',
      script: 'npx',
      args: [
        'ganache',
        '--port', '7545',
        '--chain.chainId', '1337',
        '--wallet.accounts', '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d,1000000000000000000000',
        '--database.dbPath', './ganache_data',
        '--miner.defaultGasPrice', '0',
        '--miner.blockGasLimit', '10000000',
        '--logging.quiet'
      ],
      cwd: __dirname,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'api-server',
      script: './api/blockchain-api.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: ['api'],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        JWT_SECRET: 'your-secret-key',
        NODE_HANDLER_URL: 'http://localhost:3000'
      }
    },
    {
      name: 'dashboard',
      script: 'npm',
      args: ['run', 'dev'],
      cwd: path.join(__dirname, 'node-dashboard'),
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        NEXT_PUBLIC_API_URL: 'http://localhost:3000',
        NEXT_PUBLIC_NODE_HANDLER_URL: 'http://localhost:3000',
        NODE_OPTIONS: '--openssl-legacy-provider'
      }
    }
  ]
};

const path = require('path');
const fs = require('fs');

// PM2 Configuration for all services
module.exports = {
  apps: [
    {
      name: 'ganache',
      script: 'npx',
      args: [
        'ganache',
        '--port', '7545',
        '--chain.chainId', '1337',
        '--wallet.accounts', '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d,1000000000000000000000',
        '--database.dbPath', path.join(__dirname, 'ganache_data'),
        '--miner.defaultGasPrice', '0',
        '--miner.blockGasLimit', '10000000',
        '--logging.quiet'
      ],
      cwd: __dirname,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'api-server',
      script: './api/blockchain-api.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: ['api'],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        JWT_SECRET: 'your-secret-key',
        NODE_HANDLER_URL: 'http://localhost:3000'
      }
    },
    {
      name: 'dashboard',
      script: 'npm',
      args: ['run', 'dev'],
      cwd: path.join(__dirname, 'node-dashboard'),
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        NEXT_PUBLIC_API_URL: 'http://localhost:3000',
        NEXT_PUBLIC_NODE_HANDLER_URL: 'http://localhost:3000',
        NODE_OPTIONS: '--openssl-legacy-provider'
      }
    }
  ]
};

// Generate start and stop scripts
const startScript = `@echo off
set NODE_ENV=development
pm2 start ${__dirname}\\ecosystem.config.js
pm2 save
pm2 startup
`;

const stopScript = `@echo off
pm2 delete ecosystem.config.js
pm2 save
`;

// Write scripts to files
fs.writeFileSync(path.join(__dirname, 'start-ecosystem.bat'), startScript);
fs.writeFileSync(path.join(__dirname, 'stop-ecosystem.bat'), stopScript);

console.log('Ecosystem configuration created successfully!');
console.log('Run start-ecosystem.bat to start all services');
console.log('Run stop-ecosystem.bat to stop all services');
