# Multi-Vendor Expense Tracker - Blockchain Infrastructure

A decentralized expense tracking system built on Hyperledger Besu with automatic node management.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js & npm:** [Download Node.js](https://nodejs.org/) (npm is included)
- **Docker & Docker Compose:** [Install Docker Desktop](https://www.docker.com/products/docker-desktop) (includes Docker Compose)
- **Git:** [Install Git](https://git-scm.com/downloads)
- **Ganache CLI:** For local blockchain development (optional, but recommended if not using a live Besu network).
  ```bash
  npm install -g ganache-cli
  ```

## Quick Start

Follow these steps to get the application up and running:

1.  **Clone the repository:**

    ```bash
    git clone <your-repo-url>
    cd Blockchain # Or whatever your cloned directory is named
    ```

2.  **Prepare the environment file:**
    Create a `.env` file in the `Backend_Blockchain/api` directory with the following content:

    ```env
    PORT=3000
    BLOCKCHAIN_RPC_URL=http://localhost:8545
    ADMIN_WALLET_PRIVATE_KEY= # Optional: Provide a private key for an admin wallet, otherwise one will be generated (development only!)
    NGROK_AUTHTOKEN= # Optional: Your ngrok auth token for persistent tunnels
    NGROK_DOMAIN= # Optional: Your custom ngrok domain (requires paid ngrok plan)
    JWT_SECRET=YOUR_VERY_STRONG_RANDOM_SECRET_KEY_HERE # IMPORTANT: Replace with a strong, random string
    ```

    **Note:** If `NGROK_AUTHTOKEN` and `NGROK_DOMAIN` are provided, the API will expose itself to the internet via ngrok, and the public URL will be printed in the console when the API starts.

    **Remember to replace `YOUR_VERY_STRONG_RANDOM_SECRET_KEY_HERE` with a unique, strong secret key.**

3.  **Start your blockchain network:**
    You have two options:

    - **Using Hyperledger Besu (Docker Compose):**
      Navigate to the `Blockchain` (or equivalent) directory containing your `docker-compose.yml` and `scripts` folder.
      ```bash
      cd Backend_Blockchain/docker # Assuming your docker-compose.yml is here
      docker-compose up -d
      ```
    - **Using Ganache CLI (for local development):**
      Run Ganache CLI in a separate terminal:
      ```bash
      ganache-cli --port 8545 --accounts 10 --deterministic --gasLimit 10000000
      ```
      Ensure `BLOCKCHAIN_RPC_URL` in your `.env` points to `http://localhost:8545`.

4.  **Install API dependencies:**
    Navigate to the API directory and install the Node.js dependencies:

    ```bash
    cd Backend_Blockchain/api
    npm install
    ```

5.  **Deploy Smart Contracts:**
    From the `Backend_Blockchain` directory, run the deployment script:

    ```bash
    cd .. # Go back to Backend_Blockchain directory if you were in api
    ./scripts/deploy-contracts.sh
    ```

    This will deploy the contracts to your running blockchain network and update `config/deployed-contracts.json`.

6.  **Start the API Server:**
    From the `Backend_Blockchain/api` directory:

    ```bash
    node blockchain-api.js
    # Or, if you have a start script configured in package.json:
    # npm start
    ```

    The API will start on the configured `PORT` (default 3000). If `NGROK_AUTHTOKEN` and `NGROK_DOMAIN` are set in the `Backend_Blockchain/api/.env` file, the public ngrok URL will be displayed in the terminal where the API service is running.

7.  **Access the Admin Panel and Dashboard:**
    The dashboard is now integrated into the API project. You can access it via:
    ```
    http://localhost:3001 # Assuming your dashboard runs on port 3001 as per start-api.js
    ```
    Log in with an admin user created via the `/auth/register` endpoint (you'll need to use `curl` or a tool like Postman for initial user creation, or use the registration form on the dashboard).

## API Endpoints

The API now features local database integration, JWT-based authentication, and generic CRUD operations for database tables. Remember to include the `Authorization: Bearer <YOUR_JWT_TOKEN>` header for protected routes.

### Authentication (Public)

- `POST /auth/register` - Register a new user (admin, user, or vendor role). Automatically creates a wallet and profile entry.
- `POST /auth/login` - Authenticate a user and receive a JWT

### Health & Network (Public)

- `GET /health` - System health check
- `GET /network` - Network information

### Admin & Synchronization (Protected - Admin Role Required)

- `GET /admin/tables` - Get a list of all tables in the local SQLite database.
- `GET /api/sync-check` - Compare local user/vendor profiles with blockchain registrations.
- `POST /api/run-sync` - Run a full synchronization process (generates wallets for unsynced users, registers on blockchain).

### Generic Database CRUD (Protected)

These endpoints allow for viewing, creating, updating, and deleting records in any database table exposed by the API. They are utilized by the dashboard's "Database Inspector" page.

- `GET /api/db/relationships` - Get database table relationships.

### Users (Protected)

- `GET /api/users` - Get all users from the local database.
- `POST /api/users` - Create a new user (admin, user, or vendor role). Automatically creates a wallet and profile entry.
- `GET /api/users/:address` - Get user details from the local database by blockchain wallet address
- `PUT /api/users/:address/grant-admin` - Grant admin privileges (on blockchain)
- `PUT /api/users/:address/revoke-admin` - Revoke admin privileges (on blockchain)
- `PUT /api/users/:address/deactivate` - Deactivate user (on blockchain)
- `PUT /api/users/:address/activate` - Activate user (on blockchain)

### Vendors (Protected)

- `GET /api/vendors` - Get all vendors from the local database
- `GET /api/vendors/:address` - Get vendor details from the local database by blockchain wallet address
- `GET /api/vendors/category/:category` - Get vendors by category from the local database
- `PUT /api/vendors/:address/deactivate` - Deactivate vendor (on blockchain)
- `PUT /api/vendors/:address/activate` - Activate vendor (on blockchain)

### Expenses (Protected)

- `POST /api/expenses` - Create a new expense (stores in local DB, uploads receipt to IPFS, records on blockchain). Accepts `multipart/form-data` for `receipt` file.
- `GET /api/expenses` - Get all expenses from the local database
- `GET /api/expenses/user/:address` - Get user expenses (from blockchain)
- `GET /api/expenses/vendor/:address` - Get vendor expenses (from blockchain)
- `PUT /api/expenses/:id/approve` - Approve expense (on blockchain)
- `PUT /api/expenses/:id/pay` - Pay expense (on blockchain)

## Adding New Nodes

To add a new node to the network (if using Docker Compose Besu network):

```bash
./scripts/add-node.sh node4
docker-compose down
docker-compose up -d
```

## Troubleshooting

- **Network not starting:** Check Docker logs: `docker-compose logs`
- **Contracts not deploying:** Ensure the blockchain network is fully synced and accessible.
  ```bash
  ./scripts/test-network.sh
  ```
- **API not connecting:** Verify contract deployment and blockchain RPC URL in `.env`.
  ```bash
  curl http://localhost:3000/health
  ```
- **Admin Panel Login Issues:**
  - Ensure `JWT_SECRET` is set in your `Backend_Blockchain/api/.env` file.
  - Verify you're using an email and password for a user with the `admin` role. You might need to register an admin user first via `curl` to `/auth/register`.
- **Ngrok link not showing:** Ensure `NGROK_AUTHTOKEN` and `NGROK_DOMAIN` are correctly set in `Backend_Blockchain/api/.env` and that `ngrok` npm package is installed in `Backend_Blockchain/api/`.

## Development

For development, you can run individual components:

```bash
# Start only blockchain (if using Docker Compose Besu)
cd Backend_Blockchain/docker
docker-compose up bootnode validator1 validator2

# Run API in development mode (from Backend_Blockchain/api)
cd Backend_Blockchain/api
npm run dev # If you have a dev script in package.json
# Or directly: node blockchain-api.js
```

## Production Deployment

- Update `docker-compose.yml` with production settings.
- Configure proper networking and security.
- Set up monitoring and logging.
- Configure backup strategies for blockchain data.

## Security Considerations

- **Private Keys:** Automated wallet private keys are either read from `ADMIN_WALLET_PRIVATE_KEY` in `.env` or temporarily generated. For production, **never commit private keys to version control**. Implement secure off-chain storage for generated user wallet private keys.
- **Network Access:** Network uses permissioned accounts.
- **Admin Functions:** Admin functions require proper authorization (JWT validation and role checks).
- **API Security:** API includes rate limiting and validation (not explicitly implemented in all new endpoints but good practice).
- **JWT Secret:** Keep your `JWT_SECRET` absolutely confidential.
