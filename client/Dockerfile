# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Install types package dependencies first
COPY types/package*.json ./types/
RUN cd types && npm install --legacy-peer-deps

# Install client package dependencies
COPY client/package*.json ./client/
RUN cd client && npm install --legacy-peer-deps

# Copy source code
COPY types/ ./types/
COPY client/ ./client/

# Build the client
RUN cd client && npm run build

# Serve stage with Caddy (optimized for static files)
FROM caddy:2-alpine

# Copy built files
COPY --from=build /app/client/dist /usr/share/caddy

# Copy Caddyfile configuration
COPY client/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
