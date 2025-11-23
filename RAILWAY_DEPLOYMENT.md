# Railway Deployment Guide for Learniverse

This guide walks you through deploying the Learniverse project to Railway.app.

## Why Railway?

Railway is the recommended platform for Colyseus applications because:
- ✅ **No WebSocket timeouts** (unlike Heroku's 55-second limit)
- ✅ **Native monorepo support** (automatic detection and deployment)
- ✅ **Persistent connections** (no forced 24-hour restarts)
- ✅ **Built-in PostgreSQL** (one-click database provisioning)
- ✅ **Usage-based pricing** (~$12-20/month for small production)

## Prerequisites

- GitHub repository with your code
- Railway account (sign up at https://railway.app)
- OpenAI API key (for Prof. Laura NPC)
- (Optional) Railway CLI for advanced features

## Quick Start Deployment

### Step 1: Create Railway Project

1. Log into https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway and select `learniverse` repository

### Step 2: Create PostgreSQL Database

1. In your project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway provisions the database (~30 seconds)
4. Database appears as "Postgres" service

### Step 3: Create Server Service

1. Click **"+ New"** → **"Empty Service"**
2. Name it: **"Server"**
3. Connect to your GitHub repository

#### Configure Server Service

Navigate to Server service → **Settings**:

**Source:**
- Repository: `learniverse`
- Branch: `master`

**Build:**
- Leave defaults (uses `server/railway.json`)

**Deploy:**
- Leave defaults (uses `server/railway.json`)

**Config as Code:**
- Enable "Config as Code"
- Config Path: `/server/railway.json`

#### Set Server Environment Variables

Navigate to Server service → **Variables**:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
OPENAI_API_KEY=sk-your-actual-key-here
OPENAI_MODEL=gpt-3.5-turbo
NODE_ENV=production
```

**Important:** Replace `sk-your-actual-key-here` with your actual OpenAI API key.

#### Deploy Server

1. Click **"Deploy"** or push to GitHub
2. Watch build logs
3. Wait for deployment (~2-3 minutes)
4. Verify logs show "Listening on ws://..."

#### Generate Server Domain

1. Server service → **Settings** → **Networking**
2. Click **"Generate Domain"**
3. **Copy this URL** (you'll need it for the client)
   - Example: `server-production-abc123.up.railway.app`

### Step 4: Create Client Service

1. Click **"+ New"** → **"Empty Service"**
2. Name it: **"Client"**
3. Connect to your GitHub repository

#### Configure Client Service

Navigate to Client service → **Settings**:

**Source:**
- Repository: `learniverse`
- Branch: `master`

**Build:**
- Leave defaults (uses `client/railway.json`)

**Config as Code:**
- Enable "Config as Code"
- Config Path: `/client/railway.json`

#### Set Client Environment Variables

Navigate to Client service → **Variables**:

```bash
# Replace with your actual server domain from Step 3
VITE_SERVER_URL=wss://server-production-abc123.up.railway.app

# Optional: OpenReplay project key
VITE_OPENREPLAY_PROJECT_KEY=your-project-key-here
```

**Critical:** Use `wss://` (not `ws://`) for the server URL, and replace with your actual server domain.

#### Deploy Client

1. Push changes to GitHub to trigger deployment
2. Watch build logs (Docker multi-stage build)
3. Wait for deployment (~3-5 minutes)

#### Generate Client Domain

1. Client service → **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Note the URL (e.g., `client-production-xyz789.up.railway.app`)

### Step 5: Create Test Users

#### Install Railway CLI

```bash
npm i -g @railway/cli
```

#### Link to Project

```bash
cd /Users/josephjun/LuxNova/learniverse
railway login
railway link
```

Select your project and production environment.

#### Create Users

```bash
# Create test users
railway run npx ts-node --transpile-only server/scripts/createUserBatch.ts alice password123 alice@test.com lucy
railway run npx ts-node --transpile-only server/scripts/createUserBatch.ts bob password123 bob@test.com ash
```

### Step 6: Test Your Deployment

1. Open the client URL in your browser
2. Log in with:
   - Username: `alice`
   - Password: `password123`
3. Test functionality:
   - Movement
   - NPC conversation (Prof. Laura)
   - Video chat (if multiple users)

## Architecture Overview

Your Railway project consists of three services:

```
┌─────────────────────────────────────────┐
│           Railway Project               │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────────┐   ┌─────────────┐     │
│  │ PostgreSQL │◄──│   Server    │     │
│  │  Database  │   │  (Colyseus) │     │
│  └────────────┘   └──────▲──────┘     │
│                           │            │
│                    ┌──────┴──────┐     │
│                    │   Client    │     │
│                    │ (Vite/Caddy)│     │
│                    └─────────────┘     │
└─────────────────────────────────────────┘
```

### Service Details

**PostgreSQL:**
- Managed PostgreSQL database
- Automatic backups
- Private connection string

**Server:**
- Node.js with TypeScript (ts-node)
- Colyseus WebSocket server
- Prisma ORM for database
- OpenAI integration for NPC

**Client:**
- Vite React app (built to static files)
- Served by Caddy (optimized static server)
- Connects to server via WebSocket

## Configuration Files

The following files have been created for Railway deployment:

### `/server/railway.json`

Configures the Colyseus server build and deployment:
- Runs Prisma migrations on deploy
- Watches for changes in `server/` and `types/`
- Health check on `/colyseus` endpoint
- Automatic restart on failure

### `/client/railway.json`

Configures the Vite client build:
- Uses Docker build (via Dockerfile)
- Watches for changes in `client/` and `types/`

### `/client/Dockerfile`

Multi-stage Docker build:
1. **Build stage:** Compiles TypeScript and builds Vite app
2. **Serve stage:** Uses Caddy to serve static files

### `/client/Caddyfile`

Caddy configuration for serving the SPA:
- Enables gzip compression
- SPA routing (serves index.html for all routes)
- Respects Railway's PORT environment variable

## Environment Variables Reference

### Server Service

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | PostgreSQL connection string (auto-injected) |
| `OPENAI_API_KEY` | `sk-...` | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-3.5-turbo` | OpenAI model to use |
| `NODE_ENV` | `production` | Node environment |
| `PORT` | (auto-injected) | Server port (Railway provides) |

### Client Service

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_SERVER_URL` | `wss://your-server.railway.app` | WebSocket URL to server |
| `VITE_OPENREPLAY_PROJECT_KEY` | (optional) | OpenReplay project key |

## Common Tasks

### View Logs

**Via Dashboard:**
1. Navigate to service → **Deployments**
2. Click on deployment
3. View build and runtime logs

**Via CLI:**
```bash
railway logs --service Server
railway logs --service Client
```

### Run Database Migrations

Migrations run automatically on deploy via the start command. To run manually:

```bash
railway run npx prisma migrate deploy --schema=server/prisma/schema.prisma
```

### Create New Users

```bash
railway run npx ts-node --transpile-only server/scripts/createUserBatch.ts <username> <password> [email] [avatar]
```

### Access Database with Prisma Studio

```bash
railway run npx prisma studio --schema=server/prisma/schema.prisma
```

Opens GUI at http://localhost:5555

### Check Event Logs

```bash
railway run npx ts-node --transpile-only server/scripts/checkEventLogs.ts
```

### Connect to PostgreSQL Directly

```bash
# Get connection string
railway variables --service Postgres

# Connect with psql
railway connect Postgres
```

## Monitoring & Debugging

### View Metrics

1. Navigate to project → **Observability**
2. View CPU, memory, network usage
3. Select time range (1h, 6h, 24h, 7d, 30d)

### Common Issues

**Issue: WebSocket connection fails**
- Solution: Ensure `VITE_SERVER_URL` uses `wss://` (not `ws://`)
- Verify server is running and healthy

**Issue: Prisma migration fails**
- Solution: Check `DATABASE_URL` is set correctly
- Verify database is running

**Issue: Build times out**
- Solution: Check build logs for errors
- Ensure dependencies install correctly

**Issue: Environment variables not available**
- Solution: Remember to rebuild client after changing `VITE_*` variables
- Variables are injected at build time, not runtime

## Cost Estimation

Railway uses usage-based pricing:

**Small Production (10 concurrent users):**
- PostgreSQL: ~$7/month
- Server: ~$5-10/month
- Client: ~$1-2/month
- **Total: ~$13-19/month**

**Medium Production (50 concurrent users):**
- PostgreSQL: ~$12/month
- Server: ~$15-25/month
- Client: ~$2-3/month
- **Total: ~$29-40/month**

**Free Tier:**
- Hobby plan includes $5 usage credit per month
- Good for development and testing

## Production Optimization

### Enable Custom Domain

1. Service → **Settings** → **Networking**
2. Click **"Custom Domain"**
3. Add your domain
4. Add CNAME record in DNS pointing to Railway domain

### Set Up Staging Environment

1. Project → **Settings** → **Environments**
2. Create "staging" environment
3. Deploy from different branch (e.g., `develop`)

### Configure Alerts (Pro Plan)

1. Service → **Settings** → **Alerts**
2. Set thresholds for CPU, memory, disk
3. Add email notifications

## Additional Resources

- [Railway Documentation](https://docs.railway.com/)
- [Colyseus Deployment Guide](https://docs.colyseus.io/deployment)
- [Prisma on Railway](https://www.prisma.io/docs/orm/prisma-client/deployment/traditional/deploy-to-railway)
- [Railway CLI Reference](https://docs.railway.com/guides/cli)

## Support

- Railway Community: https://station.railway.com/
- Railway Status: https://status.railway.com/
- Project Issues: https://github.com/yourusername/learniverse/issues

---

**Need help?** Check the [troubleshooting section](#common-issues) or reach out to the Railway community.
