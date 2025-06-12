# Distributed Blockchain Application

This is a distributed blockchain application with a main handler node and multiple API nodes.

## Architecture

- **Handler Node**: Main entry point that routes requests to appropriate services
- **API Nodes**: Individual services that handle specific functionality (expenses, users, etc.)
- **Communication**:
  - Handler uses ngrok for public access
  - API nodes use localtunnel for local development

## Setup

### Prerequisites

1. Node.js (v14+)
2. npm or yarn
3. ngrok account and auth token (for the handler)

### 1. Set up the Handler Node

```bash
cd node-handler
cp .env.example .env
# Edit .env with your ngrok auth token
npm install
npm start
```

### 2. Set up API Nodes

For each service (expenses, users, etc.):

```bash
# Example for expense service
cd api-nodes/expense-service
cp ../../node-handler/.env.example .env
# Edit .env with the handler URL
npm install
npm start
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# For handler node
NGROK_AUTH_TOKEN=your_ngrok_auth_token
PORT=3000

# For API nodes
HANDLER_URL=http://your-handler-url.ngrok.io  # Get this from the handler node logs
PORT=3001  # Unique port for each service
```

## Running the System

1. Start the handler node first:
   ```bash
   cd node-handler
   npm start
   ```

2. Start each API node in a separate terminal:
   ```bash
   # Terminal 2
   cd api-nodes/expense-service
   npm start
   
   # Terminal 3
   cd api-nodes/user-service
   npm start
   ```

3. Access the API through the handler:
   ```
   # Example: Get all expenses
   GET {handler-url}/api/expenses/expenses
   
   # Example: Get a user
   GET {handler-url}/api/users/users/user1
   ```

## Adding a New Service

1. Create a new directory in `api-nodes`
2. Copy the structure from an existing service
3. Implement your routes and business logic
4. Start the service with a unique port

## Monitoring

- Handler health check: `{handler-url}/health`
- Service health check: `{service-url}/health`

## Troubleshooting

- Make sure all services are using different ports
- Check that the handler URL in API nodes is correct
- Verify ngrok is properly configured with your auth token
