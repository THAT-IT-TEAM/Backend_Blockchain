# Blockchain Node Manager Dashboard

A modern, responsive dashboard for monitoring and managing blockchain nodes and services using Ganache CLI for local development.

## Features

- Local blockchain development with Ganache CLI
- Automatic blockchain network initialization
- Real-time node status monitoring
- Service health checks
- Resource usage metrics (CPU, Memory, Disk)
- Responsive design for all devices
- Dark/light mode support
- Modern UI with Tailwind CSS

## Prerequisites

- Node.js 16.8 or later
- npm or yarn

## Getting Started

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd node-dashboard
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn
   ```

3. Create a `.env.local` file in the root directory and add your environment variables:

   ```env
   # API Configuration
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3050

   # Optional: Set to 'production' in production
   NODE_ENV=development
   ```

4. Run the development server with blockchain initialization:

   ```bash
   # Start just the dashboard (no blockchain)
   npm run dev

   # Start everything (dashboard + blockchain + node handler + default node)
   npm run dev:all
   # or
   yarn dev:all
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to access the dashboard.

   The following services will be started automatically (when using `npm run dev:all` or `yarn dev:all` from the root `Backend_Blockchain` directory via `start-api.js`):

   - Dashboard: http://localhost:3000
   - Blockchain RPC: http://localhost:8545
   - API Server: http://localhost:3050 (this is the `blockchain-api.js`)
   - Node Handler API: http://localhost:3001 (if configured)
   - Default Node: http://localhost:3002 (if configured)

   The blockchain initialization will:

   - Start a local Hyperledger Besu network using Docker (or Ganache CLI)
   - Deploy all smart contracts
   - Start the blockchain API server (which can now expose itself via ngrok)
   - Initialize the node handler and default node

## Key Features & Recent Updates

- **Comprehensive Database Inspector**: View, add, edit, and delete records across all database tables directly from the dashboard.
- **User & Wallet Integration**: Every new user registered (including admin) automatically gets a wallet created and a corresponding profile entry, simplifying user management and blockchain interactions.
- **File Management**: Enhanced file storage management with bucket-centric views, direct file download/view links, and improved upload/delete functionality.
- **Ngrok Integration (API)**: The backend API can now expose itself to the internet using Ngrok with custom domains, configurable via environment variables (`NGROK_AUTHTOKEN`, `NGROK_DOMAIN`) in `Backend_Blockchain/api/.env`.

## Building for Production

To create an optimized production build:

```bash
npm run build
# or
yarn build
```

Then start the production server:

```bash
npm start
# or
yarn start
```

## Tech Stack

- [Next.js](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type checking
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Lucide Icons](https://lucide.dev/) - Icons
- [Framer Motion](https://www.framer.com/motion/) - Animations
- [React Hook Form](https://react-hook-form.com/) - Form handling
- [Zod](https://zod.dev/) - Schema validation
- [Axios](https://axios-http.com/) - HTTP client

## Project Structure

```
src/
  components/     # Reusable UI components
  lib/           # Utility functions and hooks
  pages/         # Next.js pages
  styles/        # Global styles
  types/         # TypeScript type definitions
  utils/         # Helper functions
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
