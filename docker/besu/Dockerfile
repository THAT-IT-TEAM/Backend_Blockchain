FROM hyperledger/besu:latest

USER root

# Install utilities
RUN apt-get update && apt-get install -y \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /opt/besu/data /opt/besu/config

# Set permissions
RUN chown -R besu:besu /opt/besu

USER besu

EXPOSE 8545 8546 30303

ENTRYPOINT ["besu"]