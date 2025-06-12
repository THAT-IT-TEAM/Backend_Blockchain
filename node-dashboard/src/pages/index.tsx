import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { StatusCard } from '@/components/cards/status-card';
import NodeCard from '@/components/cards/node-card';
import { Server, Cpu, Clock, AlertCircle } from 'lucide-react';
import { fetchNodeInfo } from '@/services/nodes';
import type { NodeInfo } from '@/types/node';

export default function DashboardPage() {
  const router = useRouter();
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNodeInfo = async () => {
      try {
        setLoading(true);
        const data = await fetchNodeInfo();
        setNodeInfo(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load node info:', err);
        setError('Failed to load node information. Please check if the blockchain node is running.');
      } finally {
        setLoading(false);
      }
    };

    loadNodeInfo();

    // Set up polling
    const interval = setInterval(loadNodeInfo, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Calculate stats from node info
  const stats = {
    totalNodes: 1, // We're connected to one node
    onlineNodes: nodeInfo ? 1 : 0,
    totalServices: 0, // Not implemented yet
    activeServices: 0, // Not implemented yet
    avgResponseTime: 'N/A', // Not implemented yet
    uptime: '100%', // Not implemented yet
  };

  // Create a node card for the connected node
  const nodes = nodeInfo ? [
    {
      id: 'local-node',
      name: 'Local Blockchain Node',
      url: 'http://localhost:7545',
      status: 'online' as const,
      lastSeen: 'Just now',
      cpuUsage: 0, // Not implemented
      memoryUsage: 0, // Not implemented
      diskUsage: 0, // Not implemented
      services: [
        { name: 'Ethereum Node', status: 'online' as const },
      ],
      blockNumber: nodeInfo.blockNumber,
      networkId: nodeInfo.networkId,
      peerCount: nodeInfo.peerCount,
    },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          onClick={() => {}}
        >
          Add Node
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          title="Total Nodes"
          value={stats.totalNodes.toString()}
          icon={Server}
          description={`${stats.onlineNodes} online`}
        />
        <StatusCard
          title="Active Services"
          value={`${stats.activeServices}/${stats.totalServices}`}
          icon={Cpu}
          description="across all nodes"
        />
        <StatusCard
          title="Avg. Response Time"
          value={stats.avgResponseTime}
          icon={Clock}
          description="last 24h"
        />
        <StatusCard
          title="Uptime"
          value={stats.uptime}
          description="Last 30 days"
          status="online"
          icon={Clock}
        />
      </div>

      {/* Nodes List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Nodes</h2>
          <div className="flex space-x-2">
            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Add Node
            </button>
            <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              Refresh
            </button>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
          {nodes.map((node) => (
            <div 
              key={node.id} 
              onClick={() => router.push(`/nodes/${node.id}`)}
              className="cursor-pointer hover:shadow-md transition-shadow"
            >
              <NodeCard {...node} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
