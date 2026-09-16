FROM node:20-alpine

# Install docker-cli so trusted execution engine can invoke docker runtime via mounted socket
RUN apk add --no-cache docker-cli

WORKDIR /app

# Copy package manifests
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY execution-engine/package*.json ./execution-engine/

# Install dependencies
RUN npm --prefix backend ci --omit=dev

# Copy entire repository for modular monolith
COPY . .

EXPOSE 5000

WORKDIR /app/backend

CMD ["npm", "start"]
