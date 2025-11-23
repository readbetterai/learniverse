# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files and dependencies
COPY package*.json ./
COPY types/ ./types/
COPY client/ ./client/

# Install dependencies and build
RUN npm install
RUN cd client && npm run build

# Serve stage with Caddy (optimized for static files)
FROM caddy:2-alpine

# Copy built files
COPY --from=build /app/client/dist /usr/share/caddy

# Copy Caddyfile configuration
COPY client/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
