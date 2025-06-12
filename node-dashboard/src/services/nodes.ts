import { BLOCKCHAIN_CONFIG } from '@/config/blockchain';
import Web3 from 'web3';

export interface NodeInfo {
  blockNumber: number;
  networkId: number;
  peerCount: number;
  isMining: boolean;
  isSyncing: boolean | object;
  accounts: Array<{
    address: string;
    balance: string;
  }>;
}

export const fetchNodeInfo = async (): Promise<NodeInfo> => {
  try {
    const response = await fetch('/api/nodes');
    if (!response.ok) {
      throw new Error('Failed to fetch node info');
    }
    return await response.json();
  } catch (error) {
    console.error('Error in fetchNodeInfo:', error);
    throw error;
  }
};

export const subscribeToNewBlocks = (callback: (blockNumber: number) => void) => {
  if (typeof window === 'undefined') return () => {}; // Don't run on server
  
  const web3 = new Web3(new Web3.providers.WebsocketProvider(
    BLOCKCHAIN_CONFIG.PROVIDER_URL.replace('http', 'ws')
  ));

  const subscription = web3.eth.subscribe('newBlockHeaders', (error, result) => {
    if (!error) {
      callback(Number(result.number));
    } else {
      console.error('Error in block subscription:', error);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
};
