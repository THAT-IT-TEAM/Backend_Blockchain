#!/bin/bash

echo "Setting up Multi-Vendor Expense Tracker Blockchain..."

# Create directories
mkdir -p docker/node-configs/{bootnode,node1,node2,node3}
mkdir -p logs

# Generate node keys
echo "Generating node keys..."
for node in bootnode node1 node2 node3; do
    # Generate private key for each node
    openssl rand -hex 32 > docker/node-configs/$node/key
    echo "Generated key for $node"
done

# Set permissions
chmod 600 docker/node-configs/*/key

# Install dependencies
echo "Installing Node.js dependencies..."
cd api && npm install && cd ..
cd contracts && npm install && cd ..

echo "Setup completed!"
echo "Run 'docker-compose up -d' to start the blockchain network"