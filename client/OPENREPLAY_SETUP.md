# OpenReplay Setup Guide

This guide will help you set up OpenReplay session recording for Learniverse.

## What is OpenReplay?

OpenReplay is a session replay and analytics tool that helps you understand how users interact with your application by recording their sessions. It includes:
- Session replay (including canvas elements for Phaser3 game)
- Redux state tracking
- Console logs and network activity
- Performance monitoring
- Error tracking

## Prerequisites

- OpenReplay Cloud account (free tier available)
- Project key from OpenReplay dashboard

## Setup Instructions

### 1. Create OpenReplay Account

1. Go to https://openreplay.com/pricing/
2. Click "Start for Free"
3. Sign up for a free account (no credit card required)
4. Create a new project for Learniverse

### 2. Get Your Project Key

1. Log into https://app.openreplay.com/
2. Navigate to **Preferences > Projects**
3. Select your project
4. Copy the **Project Key** (looks like: `abcdef123456`)

### 3. Configure Environment Variable

1. Open `/client/.env` file
2. Add your project key:
   ```
   VITE_OPENREPLAY_PROJECT_KEY=your_project_key_here
   ```
3. Save the file

### 4. Start the Development Server

```bash
cd client
yarn dev
```

OpenReplay will automatically initialize when the application starts. You should see a console message:
```
OpenReplay session recording started
```

### 5. Verify It's Working

1. Open your browser to http://localhost:5173
2. Log in with your credentials
3. Play around in the game for a few minutes
4. Go to https://app.openreplay.com/
5. You should see your session appear in the dashboard within ~4 minutes

## Features Enabled

### ✅ Currently Enabled

- **Session Replay**: Records DOM interactions and user actions
- **Redux State Tracking**: Tracks all Redux actions and state changes
- **User Identification**: Links sessions to logged-in users
- **Custom Events**: Tracks login events
- **Console Logs**: Captures console output
- **Network Monitoring**: Records API calls and WebSocket activity
- **Performance Metrics**: Tracks page load and performance

### ⚠️ Optional Features (Currently Disabled)

**Canvas Recording** - Disabled by default due to performance impact

To enable canvas recording (for recording the Phaser3 game canvas):

1. Open `client/src/services/OpenReplayTracker.ts`
2. Uncomment these lines:
   ```typescript
   recordCanvas: true,
   canvasFPS: 4,
   canvasQuality: 'low',
   ```
3. Restart the dev server

**Note**: Canvas recording is resource-intensive and may impact game performance. It records at ~4fps, which is enough to see general player movement but not smooth gameplay.

## What Gets Recorded

### User Actions
- Login/logout events
- Mouse movements and clicks
- Keyboard inputs (passwords are masked)
- Redux actions and state changes
- NPC conversations
- Menu interactions

### Technical Data
- Console logs (info, warn, error)
- Network requests (Colyseus WebSocket, API calls)
- JavaScript errors
- Page navigation
- Performance metrics

### Privacy

The following are automatically obscured:
- Email addresses in text
- Password inputs
- Email input fields

## Viewing Session Replays

1. Log into https://app.openreplay.com/
2. Navigate to **Sessions**
3. Click on any session to watch the replay
4. Use the timeline to jump to specific events
5. View Redux actions in the DevTools panel
6. See console logs and network activity

## Pricing

- **Free Tier**: 1,000 sessions/month, 30-day retention
- **Pay-as-you-go**: $3.95/month per 1,000 sessions
- No credit card required for free tier

### Session Limits

- Maximum session length: **2 hours**
- Inactivity timeout: **2 minutes**
- Sessions automatically split if they exceed 2 hours

## Troubleshooting

### "OpenReplay project key not found" warning

**Solution**: Make sure you've set `VITE_OPENREPLAY_PROJECT_KEY` in `/client/.env`

### Sessions not appearing in dashboard

**Possible causes**:
1. Wait 4 minutes after session ends (processing time)
2. Check console for OpenReplay errors
3. Verify project key is correct
4. Ensure you're using the correct OpenReplay account

### Performance issues

**Solution**:
1. Disable canvas recording if enabled
2. Reduce console log level
3. Use conditional recording (only record errors/specific users)

### Redux state not showing

**Issue**: Redux plugin should be automatically connected via middleware

**Verify**: Check `client/src/stores/index.ts` includes:
```typescript
import OpenReplayTracker from '../services/OpenReplayTracker'

middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({
    serializableCheck: false,
  }).concat(OpenReplayTracker.getReduxPlugin()),
```

## Advanced Usage

### Track Custom Events

```typescript
import OpenReplayTracker from './services/OpenReplayTracker'

// Track custom event
OpenReplayTracker.trackEvent('npc_interaction', {
  npcId: 'guide',
  messageCount: 5
})
```

### Add Custom Metadata

```typescript
import OpenReplayTracker from './services/OpenReplayTracker'

// Add session metadata
OpenReplayTracker.setMetadata('gameLevel', 'beginner')
OpenReplayTracker.setMetadata('sessionType', 'first_time')
```

### Conditional Recording

To only record sessions with errors:

```typescript
// In client/src/index.tsx
const tracker = OpenReplayTracker.init(projectKey)

// Don't start immediately
// OpenReplayTracker.start()

// Start only when error occurs
window.addEventListener('error', () => {
  if (!OpenReplayTracker.isInitialized()) {
    OpenReplayTracker.start()
  }
})
```

## Resources

- [OpenReplay Documentation](https://docs.openreplay.com/)
- [OpenReplay Dashboard](https://app.openreplay.com/)
- [OpenReplay Pricing](https://openreplay.com/pricing/)
- [OpenReplay GitHub](https://github.com/openreplay/openreplay)

## Support

For issues with OpenReplay integration:
1. Check this guide first
2. Review [OpenReplay documentation](https://docs.openreplay.com/)
3. Check browser console for errors
4. Contact OpenReplay support via their dashboard
