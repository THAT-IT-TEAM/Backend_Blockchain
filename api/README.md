# Blockchain API with Database and Monitoring

A robust blockchain API with integrated database management, file storage, and monitoring capabilities.

## Features

- **Database Management**: SQLite database with migrations and backups
- **File Storage**: Local file storage with metadata and access control
- **Monitoring**: System and database health monitoring
- **Scheduled Tasks**: Automated backups and maintenance
- **Configuration**: Environment-based configuration system
- **Security**: JWT authentication and CORS protection

## Prerequisites

- Node.js 16.x or later
- npm 8.x or later
- SQLite3

# Blockchain API

A robust backend API for the Multi-Vendor Expense Tracker, built with Node.js, Express, and connected to a blockchain network.

## Features

- JWT-based authentication
- User and vendor management
- Expense tracking
- Integration with Ganache blockchain
- SQLite database for local storage
- Ngrok tunneling for public access
- Automatic contract deployment

## Prerequisites

- Node.js 14+ and npm
- Ganache CLI (for local blockchain)
- Ngrok account (for public access)

## Installation

1. Clone the repository
2. Navigate to the API directory:
   ```bash
   cd Backend_Blockchain/api
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy `.env.example` to `.env` and configure your environment variables
5. Initialize the database:
   ```bash
   npm run db:setup
   ```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# App Configuration
NODE_ENV=development
PORT=3001

# Database
DB_PATH=./data/app.db

# JWT Authentication
JWT_SECRET=your_jwt_secret_key

# Blockchain
BLOCKCHAIN_RPC_URL=http://localhost:8545
PRIVATE_KEY=your_private_key_here

# Ngrok Configuration (optional)
NGROK_ENABLED=true
NGROK_AUTHTOKEN=your_ngrok_authtoken
NGROK_DOMAIN=your-custom-domain.ngrok-free.app

# IPFS (optional)
IPFS_API_URL=/ip4/127.0.0.1/tcp/5001
IPFS_GATEWAY_URL=http://localhost:8080/ipfs/

# CORS (comma-separated list of allowed origins)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Setting Up Ganache

1. Install Ganache CLI globally:
   ```bash
   npm install -g ganache-cli
   ```

2. Start Ganache in a separate terminal:
   ```bash
   ganache-cli --port 8545 --accounts 10 --deterministic --gasLimit 10000000
   ```

## Deploying Smart Contracts

1. Navigate to the root directory:
   ```bash
   cd Backend_Blockchain
   ```

2. Run the deployment script:
   ```bash
   ./scripts/deploy-contracts.sh
   ```

   This will:
   - Compile the smart contracts
   - Deploy them to your local Ganache network
   - Update the contract addresses in the configuration

## Running the API

### Development Mode

```bash
# Start the API server
npm run dev
```

### Production Mode

```bash
# Build and start the application
npm start
```

The API will be available at `http://localhost:3001` (or your configured PORT).

### With Ngrok (for public access)

1. Set `NGROK_ENABLED=true` in your `.env` file
2. Provide your `NGROK_AUTHTOKEN` and optionally `NGROK_DOMAIN`
3. Start the server:
   ```bash
   npm start
   ```

The public URL will be displayed in the console when the tunnel is established.

## API Endpoints

### Authentication

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user profile (requires auth)

### Users

- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

### Vendors

- `GET /api/vendors` - Get all vendors
- `POST /api/vendors` - Register a new vendor (requires auth)
- `GET /api/vendors/:address` - Get vendor by wallet address
- `PUT /api/vendors/:address` - Update vendor
- `DELETE /api/vendors/:address` - Deactivate vendor

### Expenses

- `GET /api/expenses` - Get all expenses (filterable)
- `POST /api/expenses` - Create new expense (requires auth)
- `GET /api/expenses/:id` - Get expense by ID
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

## Testing

Run the test suite:

```bash
npm test
```

## Deployment

### Prerequisites

- Node.js 14+
- PM2 (for process management)
- Nginx (recommended for production)

### Steps

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the application with PM2:
   ```bash
   pm2 start ecosystem.config.js --env production
   ```

3. Set up Nginx as a reverse proxy (recommended)

## Troubleshooting

- **Blockchain connection issues**: Ensure Ganache is running and `BLOCKCHAIN_RPC_URL` is correct
- **Database errors**: Check if the SQLite database file exists and is writable
- **Authentication issues**: Verify JWT_SECRET is set and consistent
- **Ngrok not starting**: Check your auth token and internet connection

## License

MIT

## Usage

### Starting the Server

```bash
# Development
npm run dev

# Production
npm start
```

### Database Management

```bash
# Initialize database
npm run db:init

# Create backup
npm run db:backup

# Run database monitoring
npm run db:monitor

# Setup database (init + backup)
npm run db:setup
```

### Monitoring

To start the monitoring service:

```bash
npm run monitor:start
```

This will start monitoring the system and database, with logs saved to the `logs/` directory.

## API Endpoints

### Health Check

```
GET /api/health
```

### File Management

```
POST   /api/files           - Upload a file
GET    /api/files           - List files
GET    /api/files/:cid      - Get a file
DELETE /api/files/:cid      - Delete a file
```

## Scheduled Tasks

- **Database Backup**: Daily at 2 AM
- **System Monitoring**: Every 5 minutes

## Deployment

### Docker

A `Dockerfile` is included for containerized deployment:

```bash
docker build -t blockchain-api .
docker run -p 3000:3000 --env-file .env blockchain-api
```

### PM2 (Production)

For production deployment with PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start ecosystem.config.js

# Save the process list
pm2 save

# Set up startup script
pm2 startup
```

## Monitoring and Logs

- Application logs: `logs/app.log`
- Access logs: `logs/access.log`
- Error logs: `logs/error.log`
- Scheduler logs: `logs/scheduler.log`

## License

MIT License - see the [LICENSE](LICENSE) file for details.
