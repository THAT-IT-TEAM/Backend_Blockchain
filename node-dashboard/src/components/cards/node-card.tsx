import { cn } from '@/lib/utils';
import { Button, Badge, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui';
import { Server, Cpu, HardDrive, Clock, AlertCircle, CheckCircle2, Clock3, Hash, Network, Users } from 'lucide-react';
import type { NodeCardProps } from '@/types/node-card';

const statusIcons = {
  online: CheckCircle2,
  offline: AlertCircle,
  degraded: AlertCircle,
  maintenance: Clock,
};

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-red-500',
  degraded: 'bg-yellow-500',
  maintenance: 'bg-blue-500',
};

function NodeCard({
  id,
  name,
  url,
  status,
  lastSeen,
  cpuUsage,
  memoryUsage,
  diskUsage,
  blockNumber,
  networkId,
  peerCount,
  isMining = false,
  isSyncing = false,
  services,
  className,
}: NodeCardProps) {
  const StatusIcon = statusIcons[status] || AlertCircle;
  
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{name}</CardTitle>
          <Badge variant={status === 'online' ? 'default' : 'destructive'}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
        <CardDescription>{url}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center">
              <Cpu className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm">CPU: {cpuUsage}%</span>
            </div>
            <div className="flex items-center">
              <Server className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm">RAM: {memoryUsage}%</span>
            </div>
            <div className="flex items-center">
              <HardDrive className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm">Disk: {diskUsage}%</span>
            </div>
          </div>
          
          {blockNumber !== undefined && (
            <div className="flex items-center">
              <Hash className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm">Block: {blockNumber}</span>
            </div>
          )}
          
          {networkId !== undefined && (
            <div className="flex items-center">
              <Network className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm">Network ID: {networkId}</span>
            </div>
          )}
          
          {peerCount !== undefined && (
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm">Peers: {peerCount}</span>
            </div>
          )}
          
          <div className="flex items-center">
            <Clock3 className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm">Last seen: {lastSeen}</span>
          </div>
          
          <div className="mt-2">
            <h4 className="text-sm font-medium mb-1">Services</h4>
            <div className="flex flex-wrap gap-1">
              {services.map((service, index) => (
                <Badge
                  key={index}
                  variant={service.status === 'online' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {service.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" onClick={(e) => {
          e.stopPropagation();
          // Handle view details
        }}>
          View Details
        </Button>
        <Button size="sm" onClick={(e) => {
          e.stopPropagation();
          // Handle manage
        }}>
          Manage
        </Button>
      </CardFooter>
    </Card>
  );
}

export default NodeCard;
