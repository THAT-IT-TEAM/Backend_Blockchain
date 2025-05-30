#!/bin/bash
echo "Compiling and deploying smart contracts..."

# Wait for network to be ready
echo "Waiting for blockchain network to be ready..."
sleep 10

# Change to contracts directory
cd contracts

# Install dependencies locally (including solc)
echo "Installing dependencies..."
npm install

# Check if solc is installed locally
if [ ! -f "node_modules/.bin/solc" ]; then
    echo "Installing Solidity compiler locally..."
    npm install solc
fi

# Deploy contracts
echo "Deploying contracts..."
node deploy.js

if [ $? -eq 0 ]; then
    echo "Contracts deployed successfully!"
    echo "Check config/deployed-contracts.json for contract addresses"
else
    echo "Contract deployment failed!"
    exit 1
fi