# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Learniverse (fork of SkyOffice) is an immersive virtual office built with:
- **Phaser3** - Game engine for the 2D virtual world
- **Colyseus** - WebSocket-based server framework for multiplayer state synchronization
- **React/Redux** - Frontend UI framework
- **PeerJS** - WebRTC for video/screen sharing
- **TypeScript** - Both client and server
- **OpenAI API** - Powers NPC (Prof. Laura) conversation system

## Repository Structure

The project has a **monorepo structure** with three main packages:

### `/server` - Colyseus Game Server
- Entry point: `server/index.ts`
- Main room logic: `server/rooms/SkyOffice.ts`
- Room schemas: `server/rooms/schema/` (OfficeState.ts, NpcState.ts)
- Commands: `server/rooms/commands/` (Colyseus command pattern for state mutations)
- Services: `server/services/OpenAIService.ts` (handles AI chat with Prof. Laura)
- **Environment**: Requires `.env` file in `/server` with `OPENAI_API_KEY`

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

### Server
```bash
# Start server (with auto-reload)
yarn start

# Production build (for Heroku)
yarn heroku-postbuild
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

### NPC Conversation System
**Server side** (`server/rooms/SkyOffice.ts`):
- Each NPC has a `conversations` MapSchema keyed by player session ID
- Message handlers: `START_NPC_CONVERSATION`, `SEND_NPC_MESSAGE`, `END_NPC_CONVERSATION`
- Prof. Laura (npcId: 'guide') uses OpenAIService for AI-generated responses
- Conversation history persists per player session (not deleted on `END_NPC_CONVERSATION`)

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

### Message Flow Example (NPC Chat)
1. Player presses interaction key near NPC
2. Client sends `Message.START_NPC_CONVERSATION` with `{ npcId }`
3. Server creates/retrieves conversation, sends back confirmation
4. Client opens NpcChat component
5. Player types message → Client sends `Message.SEND_NPC_MESSAGE`
6. Server adds player message to conversation
7. Server calls OpenAI (for Prof. Laura), gets response
8. Server adds NPC response to conversation
9. Client auto-receives updated conversation via Colyseus state sync
10. NpcChat component re-renders with new messages

## Environment Variables

### Server (`/server/.env`)
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo  # optional, defaults to gpt-3.5-turbo
PORT=2567  # optional
```

## Common Gotchas

1. **Types package changes**: After modifying `/types`, must rebuild types package. Both client and server depend on it.

2. **Colyseus Schema**: State must use Colyseus schema decorators (@type, @Schema). Regular objects won't sync.

3. **NPC conversations**: Stored per-session. If you want global NPC state visible to all players, need different architecture.

4. **OpenAI Service**: Wrapped in try-catch. If OPENAI_API_KEY missing, service won't initialize but game still works (Prof. Laura just won't respond).

5. **Phaser + React integration**: Phaser runs in its own canvas. React components overlay via absolute positioning. Communication via Redux store and Phaser event emitter (`phaserEvents`).

6. **Player proximity**: Video chat automatically triggers when players are close (proximity detection in `MyPlayer.ts` update loop).

## WebRTC Video/Screen Sharing

- Uses PeerJS library (WebRTC wrapper)
- Video connections established when players are in proximity
- Screen sharing activated when interacting with Computer items
- Connection state managed via Redux stores (UserStore.ts tracks peer connections)
