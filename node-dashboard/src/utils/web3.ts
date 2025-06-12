import Web3 from 'web3';
import { BLOCKCHAIN_CONFIG } from '@/config/blockchain';

// Create a singleton Web3 instance
let web3Instance: Web3 | null = null;

export const getWeb3 = (): Web3 => {
  if (!web3Instance) {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      // Use MetaMask's provider
      web3Instance = new Web3((window as any).ethereum);
      // Request account access if needed
      (window as any).ethereum.request({ method: 'eth_requestAccounts' });
    } else if (typeof window !== 'undefined' && (window as any).web3) {
      // Use legacy web3 provider
      web3Instance = new Web3((window as any).web3.currentProvider);
    } else {
      // Fallback to our local node
      const provider = new Web3.providers.HttpProvider(BLOCKCHAIN_CONFIG.PROVIDER_URL);
      web3Instance = new Web3(provider);
    }
  }
  return web3Instance;
};

export const getAccounts = async (): Promise<string[]> => {
  const web3 = getWeb3();
  return await web3.eth.getAccounts();
};

export const getBalance = async (address: string): Promise<string> => {
  const web3 = getWeb3();
  const balance = await web3.eth.getBalance(address);
  return web3.utils.fromWei(balance, 'ether');
};

export const getBlockNumber = async (): Promise<number> => {
  const web3 = getWeb3();
  return await web3.eth.getBlockNumber();
};

export const sendTransaction = async (from: string, to: string, value: string) => {
  const web3 = getWeb3();
  const valueInWei = web3.utils.toWei(value, 'ether');
  
  return await web3.eth.sendTransaction({
    from,
    to,
    value: valueInWei,
    gas: BLOCKCHAIN_CONFIG.GAS_LIMIT,
    gasPrice: BLOCKCHAIN_CONFIG.GAS_PRICE,
  });
};
