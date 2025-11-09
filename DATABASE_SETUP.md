# Database Setup Guide

This guide will help you set up the PostgreSQL database for Learniverse.

## Overview

The application has been fully integrated with PostgreSQL + Prisma for data persistence. All code changes for Phase 1-3 have been implemented:

- ✅ User persistence (create/load users, track sessions)
- ✅ Game progress tracking (save/restore player positions)
- ✅ NPC conversation persistence (full conversation history in database)

## What's Been Implemented

### Phase 1: Foundation
- Prisma ORM installed and configured
- Database schema created with 5 models:
  - `User` - User accounts and profiles
  - `NpcConversation` - Conversation sessions with NPCs
  - `ConversationMessage` - Individual messages in conversations
  - `GameProgress` - Player progress and position data
  - `UserSettings` - User preferences

### Phase 2: User Persistence
- `SkyOffice.onJoin` - Creates or loads users from database
- `SkyOffice.onLeave` - Saves player position and clears session
- Player schema extended with `userId` field

### Phase 3: NPC Conversation Persistence
- `START_NPC_CONVERSATION` - Loads conversation history from database
- `SEND_NPC_MESSAGE` - Persists all messages to database
- Full conversation history survives server restarts

## Database Setup Options

### Option 1: Local PostgreSQL (Recommended for Development)

#### Using Docker (Easiest)

```bash
# Start PostgreSQL container
docker run --name learniverse-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=learniverse \
  -p 5432:5432 \
  -d postgres:15

# Update server/.env with:
DATABASE_URL="postgresql://postgres:password@localhost:5432/learniverse?schema=public"
```

#### Using Homebrew (macOS)

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create database
createdb learniverse

# Update server/.env with:
DATABASE_URL="postgresql://$(whoami)@localhost:5432/learniverse?schema=public"
```

### Option 2: Prisma Postgres (Cloud Development Database)

```bash
cd server

# Start Prisma Postgres development server
npx prisma dev

# This will automatically:
# - Start a local Prisma Postgres instance
# - Update your .env with the connection URL
# - Run migrations
```

### Option 3: Cloud PostgreSQL Services

#### Supabase (Free Tier)
1. Create account at https://supabase.com
2. Create new project
3. Get connection string from Settings > Database
4. Update `server/.env`:
   ```
   DATABASE_URL="postgresql://user:pass@db.project.supabase.co:5432/postgres"
   ```

#### Railway (Free Tier)
1. Create account at https://railway.app
2. Create new PostgreSQL database
3. Copy connection string
4. Update `server/.env`

#### Heroku Postgres
1. Create Heroku app
2. Add Heroku Postgres addon:
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```
3. Get connection URL:
   ```bash
   heroku config:get DATABASE_URL
   ```

## Running Migrations

Once your database is set up and `DATABASE_URL` is configured:

```bash
cd server

# Run the initial migration to create tables
npx prisma migrate dev --name init

# Verify the migration succeeded
npx prisma studio  # Opens a browser-based database viewer
```

## Verifying the Setup

After running migrations, you should see these tables in your database:
- `User`
- `NpcConversation`
- `ConversationMessage`
- `GameProgress`
- `UserSettings`
- `_prisma_migrations` (Prisma's internal table)

## Starting the Server

```bash
# Terminal 1: Start server
cd /Users/josephjun/LuxNova/learniverse
yarn start

# Terminal 2: Start client
cd /Users/josephjun/LuxNova/learniverse/client
yarn dev
```

You should see in the server logs:
```
✅ Database connected successfully
✅ OpenAI service initialized successfully
```

## Testing the Database Integration

1. **User Persistence**:
   - Join the game with a username
   - Move around the map
   - Disconnect and reconnect
   - Your position should be restored

2. **Conversation Persistence**:
   - Start a conversation with Prof. Laura
   - Send some messages
   - Close and reopen the conversation
   - Your conversation history should be preserved

3. **Cross-Session Persistence**:
   - Have a conversation with Prof. Laura
   - Restart the server
   - Reconnect with the same username
   - Your previous conversations should still be there

## Prisma Commands Reference

```bash
# Generate Prisma Client (after schema changes)
npx prisma generate

# Create a new migration
npx prisma migrate dev --name <migration_name>

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View current database schema
npx prisma db pull

# Format schema file
npx prisma format
```

## Troubleshooting

### "Can't reach database server"
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `server/.env`
- Test connection: `psql $DATABASE_URL`

### "PrismaConfigEnvError: Missing required environment variable"
- Ensure `dotenv` is installed: `yarn add dotenv`
- Check `server/prisma.config.ts` has `import "dotenv/config"`
- Verify `server/.env` file exists

### TypeScript errors after schema changes
- Run `npx prisma generate` to regenerate client
- Restart TypeScript server in your IDE

### Migration conflicts
- If you get migration conflicts, you can reset:
  ```bash
  npx prisma migrate reset
  npx prisma migrate dev
  ```

## Environment Variables

Your `server/.env` should contain:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/learniverse?schema=public

# Optional: Server Port
PORT=2567
```

## Next Steps

Now that the database is integrated, you can:

1. **Add User Authentication**: Implement proper login/registration
2. **Add More NPCs**: Create additional NPCs with persistent conversations
3. **Implement Achievements**: Use the database to track user achievements
4. **Add Leaderboards**: Track and display user statistics
5. **Room State Persistence**: Save custom room configurations
6. **Analytics**: Query conversation data for insights

## Architecture Notes

### State Management Strategy

- **In-Memory (Colyseus)**: Real-time game state for active sessions
- **Database**: Persistent storage that survives restarts
- **Sync Pattern**: Write-through (immediate persistence of critical data)

### Database Service Pattern

The `DatabaseService` is a singleton that wraps Prisma Client:
- Located at: `server/services/DatabaseService.ts`
- Methods are async and handle errors gracefully
- Fallback to in-memory state if database unavailable

### Conversation ID Tracking

NPC conversations store their database ID in memory:
```typescript
(conversation as any).dbConversationId = dbConversation.id
```
This links the Colyseus state to the database record.

## Performance Considerations

- Database writes are async and don't block game loops
- Connection pooling is handled automatically by Prisma
- Indexes are added for common queries (userId, sessionId, conversationId)
- Consider adding caching for frequently accessed data

## Deployment Notes

When deploying to production:

1. **Use connection pooling** for better performance:
   ```
   DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=20"
   ```

2. **Run migrations** before starting the app:
   ```bash
   npx prisma migrate deploy
   ```

3. **Set environment variables** in your hosting platform

4. **Monitor database usage** and upgrade plan as needed

## Support

If you encounter issues:
1. Check server console logs for error messages
2. Verify database connection with `npx prisma studio`
3. Review this documentation
4. Check Prisma docs: https://www.prisma.io/docs
