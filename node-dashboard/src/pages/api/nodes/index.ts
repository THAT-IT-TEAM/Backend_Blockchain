import { NextApiRequest, NextApiResponse } from 'next';
import { getWeb3, getBlockNumber, getAccounts } from '@/utils/web3';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const web3 = getWeb3();
    const [blockNumber, accounts] = await Promise.all([
      getBlockNumber(),
      getAccounts(),
    ]);

    // Get balances for all accounts
    const accountsWithBalances = await Promise.all(
      accounts.map(async (address) => ({
        address,
        balance: await web3.eth.getBalance(address),
      }))
    );

    // Get network ID and peer count
    const [networkId, peerCount] = await Promise.all([
      web3.eth.net.getId(),
      web3.eth.net.getPeerCount(),
    ]);

    res.status(200).json({
      blockNumber,
      networkId,
      peerCount,
      isMining: await web3.eth.isMining(),
      isSyncing: await web3.eth.isSyncing(),
      accounts: accountsWithBalances,
    });
  } catch (error) {
    console.error('Error fetching node info:', error);
    res.status(500).json({
      error: 'Failed to fetch node information',
      details: error.message,
    });
  }
}
