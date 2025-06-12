# Blockchain Node Dashboard

A full-stack blockchain node management dashboard with user authentication and API integration.

## Features

- 🚀 Next.js frontend with TypeScript
- 🔐 JWT-based authentication
- ⛓️ Ganache blockchain for development
- 📊 Dashboard for node monitoring
- 🔄 Real-time updates
- 🔒 Secure API endpoints
- 📱 Responsive design

## Prerequisites

- Node.js 16+ and npm 8+
- Git
- PM2 (for process management)

## Getting Started

### 1. Install dependencies

```bash
# Install root dependencies
npm install

# Install API dependencies
cd api
npm install

# Install dashboard dependencies
cd ../node-dashboard
npm install
cd ..
```

### 2. Set up environment variables

Create a `.env` file in the root directory:

```env
# API
PORT=3000
JWT_SECRET=your-secret-key
NODE_ENV=development
NODE_HANDLER_URL=http://localhost:3000

# Dashboard
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_NODE_HANDLER_URL=http://localhost:3000
```

### 3. Install PM2 globally

```bash
npm install -g pm2
```

## Running the Application

### Option 1: Using PM2 (Recommended)

1. Generate the PM2 ecosystem file:
   ```bash
   node ecosystem.config.js
   ```

2. Start all services:
   ```bash
   start-ecosystem.bat
   ```

3. Stop all services:
   ```bash
   stop-ecosystem.bat
   ```

### Option 2: Manual Start

1. Start Ganache:
   ```bash
   npx ganache --port 7545 --chain.chainId 1337 --wallet.accounts "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d,1000000000000000000000" --database.dbPath ./ganache_data --miner.defaultGasPrice 0 --miner.blockGasLimit 10000000
   ```

2. In a new terminal, start the API:
   ```bash
   cd api
   node blockchain-api.js
   ```

3. In another terminal, start the dashboard:
   ```bash
   cd node-dashboard
   npm run dev
   ```

## Accessing the Application

- **Dashboard**: http://localhost:3001
- **API**: http://localhost:3000
- **Ganache RPC**: http://localhost:7545

## Default Admin Account

- **Email**: admin@blockchain.com
- **Password**: Check the console output when starting the API server

## Development

### API Endpoints

- `POST /auth/register` - Register a new user
- `POST /auth/login` - User login
- `GET /api/nodes` - Get all nodes
- `POST /api/nodes` - Add a new node

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | API server port | 3000 |
| JWT_SECRET | Secret for JWT signing | your-secret-key |
| NODE_ENV | Environment (development/production) | development |
| NODE_HANDLER_URL | Base URL for node handler | http://localhost:3000 |

## License

MIT
