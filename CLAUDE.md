# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Learniverse (fork of SkyOffice) is an immersive virtual office built with:
- **Phaser3** - Game engine for the 2D virtual world
- **Colyseus** - WebSocket-based server framework for multiplayer state synchronization
- **React/Redux** - Frontend UI framework
- **PeerJS** - WebRTC for video/screen sharing
- **TypeScript** - Both client and server
- **PostgreSQL + Prisma** - Database for user accounts and persistent data
- **OpenAI API** - Powers NPC (Prof. Laura) conversation system

## Repository Structure

The project has a **monorepo structure** with three main packages:

### `/server` - Colyseus Game Server
- Entry point: `server/index.ts`
- Main room logic: `server/rooms/SkyOffice.ts`
- Room schemas: `server/rooms/schema/` (OfficeState.ts, NpcState.ts)
- Commands: `server/rooms/commands/` (Colyseus command pattern for state mutations)
- Services:
  - `server/services/OpenAIService.ts` (handles AI chat with Prof. Laura)
  - `server/services/DatabaseService.ts` (Prisma wrapper for database operations)
- Scripts: `server/scripts/createUserBatch.ts` (admin user creation CLI)
- Prisma: `server/prisma/schema.prisma` (database schema and migrations)
- **Environment**: Requires `.env` file in `/server` with `OPENAI_API_KEY` and `DATABASE_URL`

### `/client` - Phaser3 + React Client
- Entry point: `client/src/index.tsx`
- Phaser scenes: `client/src/scenes/` (Bootstrap.ts, Game.ts, Background.ts)
- Game characters: `client/src/characters/` (MyPlayer.ts, OtherPlayer.ts)
- Interactive items: `client/src/items/` (Computer.ts, Chair.ts, Whiteboard.ts, Npc.ts)
- React components: `client/src/components/` (NpcChat.tsx, Chat.tsx, etc.)
- Redux stores: `client/src/stores/` (ChatStore.ts, UserStore.ts, RoomStore.ts, etc.)
- Network layer: `client/src/services/Network.ts` (Colyseus client connection)

### `/types` - Shared TypeScript Types
- Shared between client and server
- Key files: `IOfficeState.ts`, `INpc.ts`, `Messages.ts`, `Items.ts`
- **Important**: Types package is a dependency for both client and server

## Development Commands

### Database Setup (First-time Setup)
```bash
# 1. Install PostgreSQL (if not already installed)
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql

# 2. Create database
createdb learniverse

# 3. Copy environment file
cp server/.env.example server/.env
# Edit server/.env and set DATABASE_URL to your PostgreSQL connection string

# 4. Run Prisma migrations
npx prisma migrate dev --schema=server/prisma/schema.prisma

# 5. Generate Prisma Client
npx prisma generate --schema=server/prisma/schema.prisma

# 6. Create test users (admin only)
npx ts-node --transpile-only server/scripts/createUserBatch.ts alice password123 alice@test.com lucy
npx ts-node --transpile-only server/scripts/createUserBatch.ts bob password123 bob@test.com ash
```

### Server
```bash
# Start server (with auto-reload)
yarn start

# Production build (for Heroku)
yarn heroku-postbuild

# Database commands
npx prisma studio --schema=server/prisma/schema.prisma  # Open Prisma Studio GUI
npx prisma migrate dev --schema=server/prisma/schema.prisma  # Create new migration
```

### Client
```bash
cd client

# Start dev server with Vite
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

### Running Both
You need **two terminal windows**:
1. Terminal 1 (root): `yarn start` - starts server on `ws://localhost:2567`
2. Terminal 2 (client): `cd client && yarn dev` - starts client on `http://localhost:5173`

## Architecture Patterns

### Client-Server Communication
- Uses **Colyseus Room State Synchronization** for game state (players, NPCs, computers, whiteboards)
- Messages defined in `/types/Messages.ts` enum
- Server sends state changes → Client automatically syncs via Colyseus schemas
- Client sends messages to server via `room.send(Message.*, data)`

### Authentication System
**Login-Only Flow** (no self-registration):
- All users must be created by admin via CLI script (`server/scripts/createUserBatch.ts`)
- Client: `LoginDialog.tsx` component collects username and password
- Client sends credentials to server during `room.join()` connection
- Server: `SkyOffice.ts` `onAuth()` method verifies credentials via `DatabaseService.verifyUserPassword()`
- Passwords stored as bcrypt hashes (10 salt rounds)
- Session management: User's `sessionId` field updated on login, cleared on disconnect
- No guest access - authentication required for all connections

**User Creation** (admin only):
```bash
# Command format
npx ts-node --transpile-only server/scripts/createUserBatch.ts <username> <password> [email] [avatar]

# Example
npx ts-node --transpile-only server/scripts/createUserBatch.ts john pass123 john@test.com adam
```

### Database Architecture
**Prisma ORM** with PostgreSQL:
- **DatabaseService** (`server/services/DatabaseService.ts`) - Singleton wrapper around Prisma Client
- **Schema** (`server/prisma/schema.prisma`):
  - `User` - User accounts with credentials, avatar, session tracking
  - `NpcConversation` - Conversation sessions between users and NPCs
  - `ConversationMessage` - Individual messages in conversations (persisted to DB)
  - `GameProgress` - User progress tracking (position, play time, stats)
  - `UserSettings` - User preferences (video, audio, notifications)

**Key Operations**:
- User authentication: `verifyUserPassword()`, `updateUserSession()`
- Conversation persistence: Messages saved to DB, not just in-memory
- Session management: `sessionId` tracks active connections, allows reconnection

### NPC Conversation System
**Server side** (`server/rooms/SkyOffice.ts`):
- Each NPC has a `conversations` MapSchema keyed by player session ID
- Message handlers: `START_NPC_CONVERSATION`, `SEND_NPC_MESSAGE`, `END_NPC_CONVERSATION`
- Prof. Laura (npcId: 'guide') uses OpenAIService for AI-generated responses
- **Persistence**: Conversation messages are saved to database via `DatabaseService`
- Conversation history persists per user (stored in `NpcConversation` and `ConversationMessage` tables)

**Client side**:
- `NpcChat.tsx` component handles UI for NPC conversations
- `ChatStore.ts` manages conversation state (isNpcChatActive, activeNpcId, npcMessages)
- Network layer (`Network.ts`) handles message passing to/from server

### State Management Pattern
- **Server**: Colyseus Command pattern for mutations (see `server/rooms/commands/`)
- **Client**: Redux Toolkit for UI state (stores in `client/src/stores/`)
- **Game State**: Phaser scene state + Colyseus synchronized state

### Phaser Game Objects
- Tiled map editor exports JSON loaded in `Game.ts`
- Object layers in Tiled (Chair, Computer, Whiteboard, Npc) → converted to Phaser objects
- Custom properties from Tiled map preserved (e.g., `itemDirection` for chairs)
- Interactive items extend base `Item.ts` class with collision detection

## Key Implementation Details

### Adding a New User (Admin Operation)
1. Use `createUserBatch.ts` script with username, password, and optional email/avatar
2. Password is automatically hashed with bcrypt (10 salt rounds)
3. User record created in PostgreSQL `User` table
4. User can now log in via `LoginDialog` with their credentials
5. On login, server verifies password and updates `sessionId` field

### Adding a New NPC
1. Server: Add NPC in `SkyOffice.spawnNPCs()` method
2. Define NPC properties: id, name, x, y, texture, anim
3. Add to `this.state.npcs` MapSchema
4. Client: NPC automatically synced via Colyseus schema
5. Rendered in `Game.ts` by listening to NPC state changes

### Adding OpenAI Integration to NPC
- Check if npcId matches in `SEND_NPC_MESSAGE` handler
- Use `this.openAIService.getChatResponse()` with conversation history
- System prompt in `OpenAIService.ts` defines NPC personality
- Fallback message if OpenAI fails
- Messages are persisted to database via `DatabaseService.saveConversationMessage()`

### Adding Database Persistence for New Features
1. Update `server/prisma/schema.prisma` with new model
2. Create migration: `npx prisma migrate dev --schema=server/prisma/schema.prisma --name describe_change`
3. Regenerate Prisma Client: `npx prisma generate --schema=server/prisma/schema.prisma`
4. Add methods to `DatabaseService.ts` for CRUD operations
5. Use DatabaseService in room handlers to persist/retrieve data

### Authentication Flow Example
1. User opens client → `Bootstrap.ts` scene loads
2. `LoginDialog.tsx` displays, prompting for username and password
3. User enters credentials and submits
4. Client calls `Network.joinOrCreatePublic()` with username and password
5. Colyseus client attempts to join room with credentials in options
6. Server `onAuth()` method called with `{ username, password }` options
7. Server calls `DatabaseService.verifyUserPassword(username, password)`
8. DatabaseService queries `User` table, compares bcrypt hash
9. If valid: Server returns user object, allows connection
10. If invalid: Server throws error, connection rejected
11. On successful join: Server updates user's `sessionId` in database
12. Client transitions to `Game.ts` scene with authenticated session
13. On disconnect: Server clears user's `sessionId` (sets to null)

### Message Flow Example (NPC Chat with Database Persistence)
1. Player presses interaction key near NPC
2. Client sends `Message.START_NPC_CONVERSATION` with `{ npcId }`
3. Server loads/creates `NpcConversation` record from database for this user+NPC
4. Server loads existing `ConversationMessage` records and populates Colyseus state
5. Client opens NpcChat component with conversation history
6. Player types message → Client sends `Message.SEND_NPC_MESSAGE`
7. Server saves player message to database (`ConversationMessage` table)
8. Server adds player message to Colyseus state
9. Server calls OpenAI (for Prof. Laura), gets response
10. Server saves NPC response to database
11. Server adds NPC response to Colyseus state
12. Client auto-receives updated conversation via Colyseus state sync
13. NpcChat component re-renders with new messages
14. Conversation history persists across sessions and can be viewed later

## Environment Variables

### Server (`/server/.env`)
```
# Database (Required)
DATABASE_URL=postgresql://username:password@localhost:5432/learniverse?schema=public

# OpenAI (Required for Prof. Laura NPC)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo  # optional, defaults to gpt-3.5-turbo

# Server (Optional)
PORT=2567  # optional, defaults to 2567
```

See `/server/.env.example` for a complete template with documentation.

## User Management

### Creating Users (Admin Only)

Users are created via command-line script. The system supports username/password authentication with optional email and avatar selection.

**Command Format:**
```bash
npx ts-node --transpile-only server/scripts/createUserBatch.ts <username> <password> [email] [avatar]
```

**Parameters:**
- `username` (required) - Must be unique
- `password` (required) - Minimum 6 characters, automatically hashed with bcrypt
- `email` (optional) - Must be unique if provided
- `avatar` (optional) - One of: `adam`, `ash`, `lucy`, `nancy` (defaults to `adam`)

**Examples:**
```bash
# Basic user (username + password only)
npx ts-node --transpile-only server/scripts/createUserBatch.ts john password123

# User with email and custom avatar
npx ts-node --transpile-only server/scripts/createUserBatch.ts alice pass123 alice@test.com lucy

# User with avatar but no email (use empty string)
npx ts-node --transpile-only server/scripts/createUserBatch.ts bob pass123 "" ash
```

**Available Avatars:**
- `adam` - Default male character
- `ash` - Male character
- `lucy` - Female character
- `nancy` - Female character

**Database Management:**
```bash
# View all users
psql learniverse -c "SELECT username, email, \"avatarTexture\", \"createdAt\" FROM \"User\";"

# Delete a user
psql learniverse -c "DELETE FROM \"User\" WHERE username='username_to_delete';"

# Open Prisma Studio GUI for database management
npx prisma studio --schema=server/prisma/schema.prisma
```

See `/server/scripts/README.md` for detailed documentation on user creation.

## Common Gotchas

1. **Database Setup Required**: PostgreSQL must be running and migrations applied before starting the server. If you see connection errors, check `DATABASE_URL` in `/server/.env` and ensure database exists.

2. **Prisma Client Generation**: After modifying `schema.prisma`, run `npx prisma generate --schema=server/prisma/schema.prisma` to regenerate the Prisma Client. Otherwise TypeScript will show missing type errors.

3. **User Creation**: There is no self-registration UI. All users must be created via the admin CLI script (`server/scripts/createUserBatch.ts`). Users cannot sign up through the client.

4. **Authentication Required**: No guest access. Every connection attempt requires valid username/password credentials. If authentication fails, connection is rejected.

5. **Types package changes**: After modifying `/types`, must rebuild types package. Both client and server depend on it.

6. **Colyseus Schema**: State must use Colyseus schema decorators (@type, @Schema). Regular objects won't sync.

7. **NPC conversations persistence**: Unlike the original SkyOffice, conversations are now persisted to the database. Message history is preserved across sessions and can be queried from the `ConversationMessage` table.

8. **OpenAI Service**: Wrapped in try-catch. If OPENAI_API_KEY missing, service won't initialize but game still works (Prof. Laura just won't respond).

9. **Phaser + React integration**: Phaser runs in its own canvas. React components overlay via absolute positioning. Communication via Redux store and Phaser event emitter (`phaserEvents`).

10. **Player proximity**: Video chat automatically triggers when players are close (proximity detection in `MyPlayer.ts` update loop).

11. **Database Migrations**: When pulling changes that include schema updates, always run `npx prisma migrate dev --schema=server/prisma/schema.prisma` to apply new migrations. Check `server/prisma/migrations/` directory for migration history.

## WebRTC Video/Screen Sharing

- Uses PeerJS library (WebRTC wrapper)
- Video connections established when players are in proximity
- Screen sharing activated when interacting with Computer items
- Connection state managed via Redux stores (UserStore.ts tracks peer connections)
