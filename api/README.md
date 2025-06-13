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
- User and vendor management (with automatic wallet and profile creation)
- Expense tracking
- File storage with bucket management and direct links
- Integration with Ganache blockchain
- SQLite database for local storage with generic CRUD operations
- Ngrok tunneling for public access via custom domains
- Automatic contract deployment

## Prerequisites

- Node.js 16+ and npm 8+
- Ganache CLI (for local blockchain)
- Ngrok account (for public access with custom domains)

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

Create a `.env` file in the API directory (`Backend_Blockchain/api/.env`) with the following variables:

```env
# App Configuration
NODE_ENV=development
PORT=3050 # API server now runs on port 3050

# Database
DB_PATH=./data/app.db

# JWT Authentication
JWT_SECRET=your_jwt_secret_key

# Blockchain
BLOCKCHAIN_RPC_URL=http://localhost:8545
PRIVATE_KEY=your_private_key_here

# Ngrok Configuration (optional)
NGROK_AUTHTOKEN=your_ngrok_authtoken # Required to enable ngrok
NGROK_DOMAIN=your-custom-domain.ngrok-free.app # Optional: Your custom ngrok domain

# IPFS (optional)
IPFS_API_URL=/ip4/127.0.0.1/tcp/5001
IPFS_GATEWAY_URL=http://localhost:8080/ipfs/

# CORS (comma-separated list of allowed origins)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,YOUR_NGROK_DOMAIN_HERE # Add your ngrok domain if using
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
npm run dev # Or use `node blockchain-api.js` directly from the API directory
```

### Production Mode

```bash
# Build and start the application
npm start
```

The API will be available at `http://localhost:3050` (or your configured `PORT`). If `NGROK_AUTHTOKEN` and `NGROK_DOMAIN` are set in your `.env` file, the public ngrok URL will be displayed in the console when the tunnel is established.

## API Endpoints

### Authentication

- `POST /auth/register` - Register a new user (automatically creates wallet and profile)
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user profile (requires auth)

### Generic Database Operations

These endpoints provide generic CRUD (Create, Read, Update, Delete) functionality for any table in the SQLite database, used by the dashboard's Database Inspector.

- `GET /api/db/tables` - Get a list of all tables in the database.
- `GET /api/db/:tableName` - Get all data from a specified table.
- `GET /api/db/:tableName/schema` - Get the schema for a specified table.
- `GET /api/db/relationships` - Get database table relationships.
- `GET /api/:tableName` - Get all records from a specified table.
- `GET /api/:tableName/:id` - Get a specific record from a table by its ID.
- `POST /api/:tableName` - Create a new record in a specified table.
- `PUT /api/:tableName/:id` - Update an existing record in a specified table by its ID.
- `DELETE /api/:tableName/:id` - Delete a record from a specified table by its ID.

### Users

- `GET /api/users` - Get all users (admin only)
- `POST /api/users` - Create a new user (automatically creates wallet and profile)
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
- `POST /api/expenses` - Create new expense (stores in local DB, uploads receipt to IPFS, records on blockchain). Accepts `multipart/form-data` for `receipt` file.
- `GET /api/expenses/:id` - Get expense by ID
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Files & Buckets

- `POST /api/files` - Upload a file to a specified bucket (multipart/form-data).
- `GET /api/files/buckets` - Get a list of all file buckets.
- `POST /api/files/bucket` - Create a new file bucket.
- `DELETE /api/files/bucket/:bucketName` - Delete a file bucket and its contents.
- `GET /api/files/:bucketName` - Get files within a specific bucket.
- `GET /uploads/:bucketName/:fileName` - Directly access uploaded files.
- `DELETE /api/files/:fileCid` - Delete a specific file.

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
- **Authentication issues**: Verify `JWT_SECRET` is set and consistent
- **Ngrok not starting**: Ensure `NGROK_AUTHTOKEN` is set in your `.env` and `ngrok` npm package is installed (`npm install ngrok`). Also check your internet connection and ngrok logs.

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
