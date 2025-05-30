#!/bin/bash

echo "Testing blockchain network connectivity..."

# Test RPC endpoints
NODES=("8545" "8547" "8548")

for port in "${NODES[@]}"; do
    echo "Testing node on port $port..."
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        http://localhost:$port)
    
    if [[ $response == *"result"* ]]; then
        echo "✓ Node on port $port is responding"
        block_number=$(echo $response | jq -r '.result')
        echo "  Current block: $((16#${block_number:2}))"
    else
        echo "✗ Node on port $port is not responding"
    fi
done

echo "Network test completed!"