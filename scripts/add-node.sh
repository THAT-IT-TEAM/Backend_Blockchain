#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <node-name>"
    exit 1
fi

NODE_NAME=$1
NODE_DIR="docker/node-configs/$NODE_NAME"

echo "Adding new node: $NODE_NAME"

# Create node directory
mkdir -p $NODE_DIR

# Generate private key
openssl rand -hex 32 > $NODE_DIR/key
chmod 600 $NODE_DIR/key

# Get available port
LAST_PORT=$(docker ps --format "table {{.Ports}}" | grep -o '30[0-9][0-9][0-9]' | sort -n | tail -1)
NEW_PORT=$((LAST_PORT + 1))
RPC_PORT=$((8545 + $(ls docker/node-configs | wc -l)))

echo "Assigned ports: RPC=$RPC_PORT, P2P=$NEW_PORT"

# Add to docker-compose.yml
cat >> docker/docker-compose.yml << EOF

  $NODE_NAME:
    build:
      context: ./besu
      dockerfile: Dockerfile
    container_name: besu-$NODE_NAME
    ports:
      - "$RPC_PORT:8545"
      - "$NEW_PORT:30303/tcp"
      - "$NEW_PORT:30303/udp"
    volumes:
      - ./node-configs/$NODE_NAME:/opt/besu/data
      - ./config:/opt/besu/config
    depends_on:
      - bootnode
    command: |
      --genesis-file=/opt/besu/config/genesis.json
      --data-path=/opt/besu/data
      --node-private-key-file=/opt/besu/data/key
      --bootnodes=enode://\$(cat ./node-configs/bootnode/enode)@bootnode:30303
      --rpc-http-enabled=true
      --rpc-http-host=0.0.0.0
      --rpc-http-port=8545
      --rpc-http-cors-origins="*"
      --host-allowlist="*"
      --p2p-enabled=true
      --p2p-host=0.0.0.0
      --p2p-port=30303
      --network-id=1337
      --logging=INFO
      --permissions-accounts-config-enabled=true
      --permissions-accounts-config-file=/opt/besu/config/permissions.json
    networks:
      - besu-network
EOF

echo "Node $NODE_NAME added successfully!"
echo "Restart the network with: docker-compose down && docker-compose up -d"