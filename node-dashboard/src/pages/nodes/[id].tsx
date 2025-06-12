import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { fetchNodeInfo } from '@/services/nodes';
import type { NodeCardProps } from '@/types/node-card';

type NodeStatus = 'online' | 'offline' | 'degraded' | 'maintenance';
type ServiceStatus = 'online' | 'offline' | 'degraded';

// Dynamically import NodeCard to avoid SSR issues
const NodeCard = dynamic(
  () => import('@/components/cards/node-card'),
  { ssr: false }
);

export default function NodeDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [nodeData, setNodeData] = useState<{
    id: string;
    name: string;
    url: string;
    status: NodeStatus;
    lastSeen: string;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    blockNumber: number;
    networkId: number;
    peerCount: number;
    services: Array<{ name: string; status: ServiceStatus }>;
    isMining?: boolean;
    isSyncing?: boolean | object;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNodeData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const data = await fetchNodeInfo();
        setNodeData({
          id: 'local-node',
          name: 'Local Blockchain Node',
          url: 'http://localhost:7545',
          status: 'online' as const,
          lastSeen: 'Just now',
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
          blockNumber: data.blockNumber || 0,
          networkId: data.networkId || 0,
          peerCount: data.peerCount || 0,
          services: [
            { name: 'Ethereum Node', status: 'online' as const },
            { name: 'JSON-RPC', status: 'online' as const },
            { name: 'WebSocket', status: 'online' as const },
          ],
        });
        setError(null);
      } catch (err) {
        console.error('Failed to load node data:', err);
        setError('Failed to load node data. Please check if the blockchain node is running.');
      } finally {
        setLoading(false);
      }
    };

    loadNodeData();
    
    // Refresh data every 10 seconds
    const interval = setInterval(loadNodeData, 10000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !nodeData) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error || 'Node not found'}</p>
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/')}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Node Details</h1>
      </div>

      <NodeCard {...nodeData} className="max-w-3xl" />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        <h2 className="text-xl font-semibold">Node Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Connection</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">URL</span>
                <span className="text-sm font-mono">{nodeData.url}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Network ID</span>
                <span className="text-sm font-mono">#{nodeData.networkId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Peers</span>
                <span className="text-sm font-mono">{nodeData.peerCount}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Blockchain</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Current Block</span>
                <span className="text-sm font-mono">{nodeData.blockNumber.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={nodeData.status === 'online' ? 'default' : 'secondary'} className="capitalize">
                  {nodeData.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <span className="text-sm">{nodeData.lastSeen}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
