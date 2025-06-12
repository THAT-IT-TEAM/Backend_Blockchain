export type NodeStatus = 'online' | 'offline' | 'degraded' | 'maintenance';

export interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
}

export interface NodeInfo {
  blockNumber: number;
  networkId: number;
  peerCount: number;
  // Add other node information properties as needed
}
