import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { sanitizeId } from '../util'

export type ConnectionState = 'disconnected' | 'reconnecting' | 'connected'

// Single-player mode flag - must match Network.ts
const SINGLE_PLAYER_MODE = true

export const userSlice = createSlice({
  name: 'user',
  initialState: {
    sessionId: SINGLE_PLAYER_MODE ? 'local-player' : '',
    loggedIn: SINGLE_PLAYER_MODE ? true : false,
    connectionState: (SINGLE_PLAYER_MODE ? 'connected' : 'disconnected') as ConnectionState,
    playerNameMap: new Map<string, string>(),
    showJoystick: window.innerWidth < 650,
  },
  reducers: {
    setSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload
    },
    setLoggedIn: (state, action: PayloadAction<boolean>) => {
      state.loggedIn = action.payload
    },
    setConnectionState: (state, action: PayloadAction<ConnectionState>) => {
      state.connectionState = action.payload
    },
    setPlayerNameMap: (state, action: PayloadAction<{ id: string; name: string }>) => {
      state.playerNameMap.set(sanitizeId(action.payload.id), action.payload.name)
    },
    removePlayerNameMap: (state, action: PayloadAction<string>) => {
      state.playerNameMap.delete(sanitizeId(action.payload))
    },
    setShowJoystick: (state, action: PayloadAction<boolean>) => {
      state.showJoystick = action.payload
    },
  },
})

export const {
  setSessionId,
  setLoggedIn,
  setConnectionState,
  setPlayerNameMap,
  removePlayerNameMap,
  setShowJoystick,
} = userSlice.actions

export default userSlice.reducer
