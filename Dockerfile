# Use slim base — saves ~500MB vs node:22
FROM node:22-slim

# Avoid interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Install only what's strictly needed, clean up in same layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    gnupg \
    pass \
    && rm -rf /var/lib/apt/lists/*

# Install Himalaya (email client) + clean up in one layer
RUN curl -fsSL https://github.com/pimalaya/himalaya/releases/download/v1.2.0/himalaya.x86_64-linux.tgz \
    | tar -xz -C /usr/local/bin && \
    chmod +x /usr/local/bin/himalaya

# Install OpenClaw + clean npm cache in same layer
RUN npm install -g openclaw && npm cache clean --force

# Setup OpenClaw + config in one layer
RUN openclaw setup && \
    openclaw config set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback true

# Set working directory
WORKDIR /root

# Default to bash
CMD ["bash"]