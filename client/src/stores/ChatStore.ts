import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { INpcMessage } from '../../../types/INpc'
import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

export interface NpcChatMessage {
  author: string
  createdAt: number
  content: string
  isNpc: boolean
}

export const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    npcChatMessages: new Array<NpcChatMessage>(),
    currentNpcId: null as string | null,
    currentNpcName: null as string | null,
    inConversation: false,
    focused: false,
    showChat: false,
  },
  reducers: {
    startNpcChat: (state, action: PayloadAction<{ npcId: string; npcName: string; messages: NpcChatMessage[] }>) => {
      state.currentNpcId = action.payload.npcId
      state.currentNpcName = action.payload.npcName
      state.npcChatMessages = action.payload.messages
      state.inConversation = true
      state.showChat = true
    },
    endNpcChat: (state) => {
      state.currentNpcId = null
      state.currentNpcName = null
      state.inConversation = false
      state.showChat = false
      state.focused = false
    },
    pushNpcMessage: (state, action: PayloadAction<NpcChatMessage>) => {
      state.npcChatMessages.push(action.payload)
    },
    setNpcChatMessages: (state, action: PayloadAction<NpcChatMessage[]>) => {
      state.npcChatMessages = action.payload
    },
    setFocused: (state, action: PayloadAction<boolean>) => {
      const game = phaserGame.scene.keys.game as Game
      action.payload ? game.disableKeys() : game.enableKeys()
      state.focused = action.payload
    },
    setShowChat: (state, action: PayloadAction<boolean>) => {
      state.showChat = action.payload
    },
  },
})

export const {
  startNpcChat,
  endNpcChat,
  pushNpcMessage,
  setNpcChatMessages,
  setFocused,
  setShowChat,
} = chatSlice.actions

export default chatSlice.reducer
