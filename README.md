# Multi-Vendor Expense Tracker - Blockchain Infrastructure

A decentralized expense tracking system built on Hyperledger Besu with automatic node management.

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <your-repo>
   cd expense-tracker-blockchain
   chmod +x scripts/*.sh
   ./scripts/setup.sh

2. **Start the Network**
   chage the dir to docker dir
   ```bash
   docker-compose up -d
   ```

3. **install ganache then run** 
   ```bash
      ganache-cli --port 8545 --accounts 10 --deterministic --gasLimit 10000000
   ```

5. **deploy contracts** 
```./scripts/deploy-contracts.sh```
6.  **now change the folder to api and run**
   ```bash
      node blockchain-api.js
   ```

Network Architecture

Bootnode: Main entry point (port 8545)
Validator 1: Additional validator (port 8547)
Validator 2: Additional validator (port 8548)
API Server: REST API interface (port 3000)

API Endpoints
Health & Network

GET /health - System health check
GET /network - Network information

Users

POST /api/users/register - Register new user
GET /api/users - Get all users
GET /api/users/:address - Get user details
PUT /api/users/:address/grant-admin - Grant admin privileges
PUT /api/users/:address/revoke-admin - Revoke admin privileges

Vendors

POST /api/vendors/register - Register new vendor
GET /api/vendors - Get all vendors
GET /api/vendors/:address - Get vendor details
GET /api/vendors/category/:category - Get vendors by category

Expenses

POST /api/expenses - Create new expense
GET /api/expenses - Get all expenses
GET /api/expenses/user/:address - Get user expenses
GET /api/expenses/vendor/:address - Get vendor expenses
PUT /api/expenses/:id/approve - Approve expense
PUT /api/expenses/:id/pay - Pay expense

Adding New Nodes
To add a new node to the network:
```./scripts/add-node.sh node4
docker-compose down
docker-compose up -d
```

Troubleshooting

Network not starting: Check Docker logs

```docker-compose logs```
Contracts not deploying: Ensure network is fully synced
```./scripts/test-network.sh```
API not connecting: Verify contract deployment
```curl http://localhost:3000/health```

Development
For development, you can run individual components:
```
# Start only blockchain
docker-compose up bootnode validator1 validator2

# Run API in development mode
cd api && npm run dev
```
Production Deployment

Update docker-compose.yml with production settings
Configure proper networking and security
Set up monitoring and logging
Configure backup strategies for blockchain data

Security Considerations

Private keys are auto-generated and stored securely
Network uses permissioned accounts
Admin functions require proper authorization
API includes rate limiting and validation
