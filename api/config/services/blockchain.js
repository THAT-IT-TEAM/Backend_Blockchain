module.exports = {
  // Ethereum Configuration
  ethereum: {
    enabled: true,
    network: process.env.ETHEREUM_NETWORK || 'mainnet',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'http://localhost:8545',
    chainId: process.env.ETHEREUM_CHAIN_ID || 1,
    privateKey: process.env.ETHEREUM_PRIVATE_KEY,
    contracts: {
      // Add your contract addresses here
      token: process.env.TOKEN_CONTRACT_ADDRESS,
      nft: process.env.NFT_CONTRACT_ADDRESS,
      marketplace: process.env.MARKETPLACE_CONTRACT_ADDRESS
    },
    gasPrice: process.env.GAS_PRICE || '20', // in gwei
    gasLimit: process.env.GAS_LIMIT || '6000000',
    confirmations: process.env.CONFIRMATIONS || 3
  },

  // IPFS Configuration for blockchain metadata
  ipfs: {
    gateway: 'https://ipfs.io/ipfs/',
    uploadEndpoint: 'https://ipfs.infura.io:5001/api/v0/add',
    projectId: process.env.IPFS_PROJECT_ID,
    projectSecret: process.env.IPFS_PROJECT_SECRET
  },

  // Web3 Storage (alternative to IPFS)
  web3Storage: {
    enabled: false,
    token: process.env.WEB3_STORAGE_TOKEN
  },

  // Other blockchain networks
  networks: {
    polygon: {
      enabled: false,
      rpcUrl: process.env.POLYGON_RPC_URL,
      chainId: 137,
      privateKey: process.env.POLYGON_PRIVATE_KEY
    },
    bsc: {
      enabled: false,
      rpcUrl: process.env.BSC_RPC_URL,
      chainId: 56,
      privateKey: process.env.BSC_PRIVATE_KEY
    }
  }
};
