# Build stage
FROM node:18-alpine AS build

# Accept build arguments from Railway
ARG VITE_SERVER_URL
ARG VITE_OPENREPLAY_PROJECT_KEY

# Set as environment variables for the build
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_OPENREPLAY_PROJECT_KEY=$VITE_OPENREPLAY_PROJECT_KEY

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

# Build the client (environment variables will be baked into the build)
RUN cd client && npm run build

# Serve stage with Caddy (optimized for static files)
FROM caddy:2-alpine

# Copy built files
COPY --from=build /app/client/dist /usr/share/caddy

# Copy Caddyfile configuration
COPY client/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
