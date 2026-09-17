FROM node:20-bookworm-slim

# Install docker-cli and build tools for native dependencies (argon2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    python3 \
    make \
    g++ \
    && curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.3.1.tgz | tar -xz -C /tmp \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY execution-engine/package*.json ./execution-engine/

# Install dependencies for modular monolith backend
RUN npm --prefix backend ci --omit=dev

# Copy application code
COPY . .

EXPOSE 5000

WORKDIR /app/backend

CMD ["npm", "start"]
