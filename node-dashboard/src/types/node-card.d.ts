import { ComponentType } from 'react';

type NodeStatus = 'online' | 'offline' | 'degraded' | 'maintenance';

export interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
}

export interface NodeCardProps {
  id: string;
  name: string;
  url: string;
  status: NodeStatus;
  lastSeen: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  blockNumber?: number;
  networkId?: number;
  peerCount?: number;
  isMining?: boolean;
  isSyncing?: boolean | object;
  services: ServiceStatus[];
  className?: string;
}

declare const NodeCard: ComponentType<NodeCardProps>;

export default NodeCard;
