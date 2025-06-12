# Unified Blockchain API Node

This is a self-contained, unified API node that can be deployed independently. Each instance is a complete copy of the main API and can handle requests on its own.

## Features

- Complete API functionality in a single node
- Independent operation (no external dependencies)
- Easy to scale horizontally
- Automatic configuration
- Health monitoring endpoints

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- SQLite (included)

### Installation

1. Copy the `unified` directory to your deployment location
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables (copy .env.example to .env and modify as needed)

### Running the Node

```bash
# Start in production mode
npm start

# Start in development mode with hot-reload
npm run dev

# Start with custom port
PORT=3002 npm start
```

### Environment Variables

- `PORT`: Port to run the API on (default: 3002)
- `NODE_ENV`: Environment (development, production, etc.)
- `JWT_SECRET`: Secret key for JWT tokens
- `DATABASE_URL`: Path to SQLite database file
- `BLOCKCHAIN_RPC_URL`: URL of the blockchain RPC endpoint

### Health Check

```
GET /health
```

### API Documentation

See the main API documentation for available endpoints and usage.

## Scaling

To scale horizontally:

1. Deploy multiple instances of this node
2. Use a load balancer (e.g., Nginx, HAProxy) in front
3. Each node maintains its own database connection and state

## License

[Your License Here]
