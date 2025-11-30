import { Client, Room } from 'colyseus.js'
import { IOfficeState, IPlayer, IWhiteboard } from '../../../types/IOfficeState'
import { INPC } from '../../../types/INpc'
import { Message } from '../../../types/Messages'
import { IRoomData, RoomType } from '../../../types/Rooms'
import { ItemType } from '../../../types/Items'
import { phaserEvents, Event } from '../events/EventCenter'
import store from '../stores'
import { setSessionId, setPlayerNameMap, removePlayerNameMap } from '../stores/UserStore'
import {
  setLobbyJoined,
  setJoinedRoomData,
  setAvailableRooms,
  addAvailableRooms,
  removeAvailableRooms,
} from '../stores/RoomStore'
import { pushNpcMessage } from '../stores/ChatStore'
import { setWhiteboardUrls } from '../stores/WhiteboardStore'
import { addPointNotification, setTotalPoints } from '../stores/PointStore'

// localStorage keys for session persistence
const STORAGE_KEYS = {
  TOKEN: 'learniverse_token',
  TOKEN_EXPIRES: 'learniverse_token_expires',
  USERNAME: 'learniverse_username',
}

export default class Network {
  private client: Client
  private room?: Room<IOfficeState>
  private lobby!: Room

  mySessionId!: string

  // ==================== SESSION TOKEN METHODS ====================

  /**
   * Store session token in localStorage after successful login
   */
  storeSessionToken(token: string, expiresAt: string, username: string) {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token)
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES, expiresAt)
    localStorage.setItem(STORAGE_KEYS.USERNAME, username)
    console.log('[Network] Session token stored')
  }

  /**
   * Get stored token if valid (not expired)
   * Returns null if no token or token is expired
   */
  getStoredToken(): string | null {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    const expires = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES)

    if (!token || !expires) {
      return null
    }

    // Check if token has expired
    if (new Date() > new Date(expires)) {
      console.log('[Network] Stored token has expired')
      this.clearStoredToken()
      return null
    }

    return token
  }

  /**
   * Get stored username (for display during reconnection)
   */
  getStoredUsername(): string | null {
    return localStorage.getItem(STORAGE_KEYS.USERNAME)
  }

  /**
   * Clear stored token (on logout or token invalidation)
   */
  clearStoredToken() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES)
    localStorage.removeItem(STORAGE_KEYS.USERNAME)
    console.log('[Network] Session token cleared')
  }

  /**
   * Join room using stored session token (for reconnection)
   * Returns true if successful, false if failed
   */
  async joinWithToken(token: string): Promise<boolean> {
    try {
      console.log('[Network] Attempting to reconnect with token')
      this.room = await this.client.joinOrCreate(RoomType.PUBLIC, { sessionToken: token })
      this.initialize()
      return true
    } catch (error) {
      console.error('[Network] Token reconnection failed:', error)
      this.clearStoredToken()
      return false
    }
  }

  /**
   * Logout - clear token and leave room
   */
  logout() {
    this.clearStoredToken()
    this.room?.leave()
  }

  constructor() {
    const protocol = window.location.protocol.replace('http', 'ws')
    const endpoint =
      process.env.NODE_ENV === 'production'
        ? import.meta.env.VITE_SERVER_URL
        : `${protocol}//${window.location.hostname}:2567`

    console.log('[Network] Connecting to server:', endpoint)
    console.log('[Network] VITE_SERVER_URL:', import.meta.env.VITE_SERVER_URL)
    console.log('[Network] NODE_ENV:', process.env.NODE_ENV)

    this.client = new Client(endpoint)
    this.joinLobbyRoom().then(() => {
      store.dispatch(setLobbyJoined(true))
    })

    phaserEvents.on(Event.MY_PLAYER_NAME_CHANGE, this.updatePlayerName, this)
    phaserEvents.on(Event.MY_PLAYER_TEXTURE_CHANGE, this.updatePlayer, this)
  }

  /**
   * Get the current room instance
   */
  getRoom(): Room<IOfficeState> | undefined {
    return this.room
  }

  /**
   * method to join Colyseus' built-in LobbyRoom, which automatically notifies
   * connected clients whenever rooms with "realtime listing" have updates
   */
  async joinLobbyRoom() {
    this.lobby = await this.client.joinOrCreate(RoomType.LOBBY)

    this.lobby.onMessage('rooms', (rooms) => {
      store.dispatch(setAvailableRooms(rooms))
    })

    this.lobby.onMessage('+', ([roomId, room]) => {
      store.dispatch(addAvailableRooms({ roomId, room }))
    })

    this.lobby.onMessage('-', (roomId) => {
      store.dispatch(removeAvailableRooms(roomId))
    })
  }

  // method to join the public lobby
  async joinOrCreatePublic(credentials?: { username: string; password: string }) {
    this.room = await this.client.joinOrCreate(RoomType.PUBLIC, credentials || {})
    this.initialize()
  }

  // method to join a custom room
  async joinCustomById(roomId: string, password: string | null, credentials?: { username: string; password: string }) {
    this.room = await this.client.joinById(roomId, { password, ...credentials })
    this.initialize()
  }

  // method to create a custom room
  async createCustom(roomData: IRoomData, credentials?: { username: string; password: string }) {
    const { name, description, password, autoDispose } = roomData
    this.room = await this.client.create(RoomType.CUSTOM, {
      name,
      description,
      password,
      autoDispose,
      ...credentials,
    })
    this.initialize()
  }

  // set up all network listeners before the game starts
  initialize() {
    if (!this.room) return

    this.lobby.leave()
    this.mySessionId = this.room.sessionId
    store.dispatch(setSessionId(this.room.sessionId))

    // new instance added to the players MapSchema
    this.room.state.players.onAdd = (player: IPlayer, key: string) => {
      if (key === this.mySessionId) {
        // Set initial points for own player when they're added to state
        store.dispatch(setTotalPoints(player.points || 0))
        // Emit event with player's initial state (including avatar from database)
        phaserEvents.emit(Event.MY_PLAYER_STATE_READY, player)

        // Track changes for own player to catch anim/points updates after initial sync
        player.onChange = (changes) => {
          changes.forEach((change) => {
            const { field, value } = change
            if (field === 'anim') {
              phaserEvents.emit(Event.MY_PLAYER_STATE_READY, player)
            }
            if (field === 'points') {
              store.dispatch(setTotalPoints(value as number))
            }
          })
        }
        return
      }

      // track changes on every child object inside the players MapSchema (other players only)
      player.onChange = (changes) => {
        changes.forEach((change) => {
          const { field, value } = change
          phaserEvents.emit(Event.PLAYER_UPDATED, field, value, key)

          // when a new player finished setting up player name
          if (field === 'name' && value !== '') {
            phaserEvents.emit(Event.PLAYER_JOINED, player, key)
            store.dispatch(setPlayerNameMap({ id: key, name: value }))
          }
        })
      }
    }

    // an instance removed from the players MapSchema
    this.room.state.players.onRemove = (player: IPlayer, key: string) => {
      phaserEvents.emit(Event.PLAYER_LEFT, key)
      store.dispatch(removePlayerNameMap(key))
    }

    // new instance added to the whiteboards MapSchema
    this.room.state.whiteboards.onAdd = (whiteboard: IWhiteboard, key: string) => {
      store.dispatch(
        setWhiteboardUrls({
          whiteboardId: key,
          roomId: whiteboard.roomId,
        })
      )
      // track changes on every child object's connectedUser
      whiteboard.connectedUser.onAdd = (item, index) => {
        phaserEvents.emit(Event.ITEM_USER_ADDED, item, key, ItemType.WHITEBOARD)
      }
      whiteboard.connectedUser.onRemove = (item, index) => {
        phaserEvents.emit(Event.ITEM_USER_REMOVED, item, key, ItemType.WHITEBOARD)
      }
    }

    // new instance added to the npcs MapSchema
    this.room.state.npcs.onAdd = (npc: INPC, key: string) => {
      phaserEvents.emit(Event.NPC_JOINED, npc, key)

      // track changes on every child object inside the npcs MapSchema
      npc.onChange = (changes) => {
        changes.forEach((change) => {
          const { field, value } = change
          phaserEvents.emit(Event.NPC_UPDATED, field, value, key)
        })
      }

      // track conversation changes for this NPC
      npc.conversations.onAdd = (conversation, playerId) => {
        // Only update if it's our conversation
        if (playerId === this.room?.sessionId) {
          conversation.messages.onAdd = (message, index) => {
            const npcChatMessage = {
              author: message.author,
              createdAt: message.createdAt,
              content: message.content,
              isNpc: message.isNpc,
            }
            store.dispatch(pushNpcMessage(npcChatMessage))
          }
        }
      }
    }

    // when the server sends room data
    this.room.onMessage(Message.SEND_ROOM_DATA, (content) => {
      store.dispatch(setJoinedRoomData(content))
    })

    // when points are updated - single source of truth for point updates
    this.room.onMessage(
      Message.POINTS_UPDATED,
      (data: { pointsEarned: number; newTotal: number; reason: string; awardedBy?: string }) => {
        // Validate incoming data before dispatching
        if (
          typeof data?.pointsEarned !== 'number' ||
          typeof data?.newTotal !== 'number' ||
          typeof data?.reason !== 'string'
        ) {
          console.error('Invalid points update data:', data)
          return
        }
        store.dispatch(addPointNotification({
          ...data,
          awardedBy: data.awardedBy || 'SYSTEM',
        }))
      }
    )

    // when server sends session token (after successful password login)
    this.room.onMessage(
      Message.SESSION_TOKEN,
      (data: { token: string; expiresAt: string; username: string }) => {
        console.log('[Network] Received session token from server')
        this.storeSessionToken(data.token, data.expiresAt, data.username)
      }
    )

    // handle room disconnect for auto-reconnect detection
    this.room.onLeave((code) => {
      console.log('[Network] Room left with code:', code)
      // Code 4000 = kicked by server (don't auto-reconnect)
      // Normal close codes (1000-1999) = intentional disconnect
      if (code === 4000 || (code >= 1000 && code < 2000)) {
        return
      }
      // Abnormal disconnect (refresh, network issue) - emit event for UI
      phaserEvents.emit(Event.CONNECTION_LOST)
    })

  }

  // method to register event listener and call back function when a item user added
  onItemUserAdded(
    callback: (playerId: string, key: string, itemType: ItemType) => void,
    context?: any
  ) {
    phaserEvents.on(Event.ITEM_USER_ADDED, callback, context)
  }

  // method to register event listener and call back function when a item user removed
  onItemUserRemoved(
    callback: (playerId: string, key: string, itemType: ItemType) => void,
    context?: any
  ) {
    phaserEvents.on(Event.ITEM_USER_REMOVED, callback, context)
  }

  // method to register event listener and call back function when a player joined
  onPlayerJoined(callback: (Player: IPlayer, key: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_JOINED, callback, context)
  }

  // method to register event listener and call back function when a player left
  onPlayerLeft(callback: (key: string) => void, context?: any) {
    phaserEvents.on(Event.PLAYER_LEFT, callback, context)
  }

  // method to register event listener and call back function when a player updated
  onPlayerUpdated(
    callback: (field: string, value: number | string, key: string) => void,
    context?: any
  ) {
    phaserEvents.on(Event.PLAYER_UPDATED, callback, context)
  }

  // method to send player updates to Colyseus server
  updatePlayer(currentX: number, currentY: number, currentAnim: string) {
    this.room?.send(Message.UPDATE_PLAYER, { x: currentX, y: currentY, anim: currentAnim })
  }

  // method to send player name to Colyseus server
  updatePlayerName(currentName: string) {
    this.room?.send(Message.UPDATE_PLAYER_NAME, { name: currentName })
  }

  connectToWhiteboard(id: string) {
    this.room?.send(Message.CONNECT_TO_WHITEBOARD, { whiteboardId: id })
  }

  disconnectFromWhiteboard(id: string) {
    this.room?.send(Message.DISCONNECT_FROM_WHITEBOARD, { whiteboardId: id })
  }

  // method to interact with NPC
  interactWithNPC(npcId: string) {
    this.room?.send(Message.INTERACT_WITH_NPC, { npcId })
  }

  // method to start NPC conversation
  startNpcConversation(npcId: string) {
    this.room?.send(Message.START_NPC_CONVERSATION, { npcId })
  }

  // method to end NPC conversation
  endNpcConversation(npcId: string) {
    this.room?.send(Message.END_NPC_CONVERSATION, { npcId })
  }

  // method to send message to NPC
  sendNpcMessage(npcId: string, content: string) {
    this.room?.send(Message.SEND_NPC_MESSAGE, { npcId, content })
  }

  // method to get existing NPCs from room state
  getExistingNPCs() {
    const npcs: Array<{ npc: INPC; key: string }> = []
    this.room?.state.npcs.forEach((npc, key) => {
      npcs.push({ npc, key })
    })
    return npcs
  }

  // method to get current player's state from room
  getMyPlayer(): IPlayer | null {
    return this.room?.state.players.get(this.mySessionId) ?? null
  }
}
