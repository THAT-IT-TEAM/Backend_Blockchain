// Default configuration for connecting to the local Ganache instance
export const BLOCKCHAIN_CONFIG = {
  // Default to local Ganache
  PROVIDER_URL: process.env.NEXT_PUBLIC_BLOCKCHAIN_PROVIDER || 'http://127.0.0.1:8545',
  // Default account to use (first account from Ganache)
  DEFAULT_ACCOUNT: process.env.NEXT_PUBLIC_DEFAULT_ACCOUNT || '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
  // Network ID (default Ganache network ID)
  NETWORK_ID: process.env.NEXT_PUBLIC_NETWORK_ID || '1337',
  // Gas limit for transactions
  GAS_LIMIT: 10000000, // Increased to match Ganache default
  // Gas price in wei
  GAS_PRICE: 20000000000,
};
