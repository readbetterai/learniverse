import { Schema, SetSchema, MapSchema, type } from '@colyseus/schema'
import {
  IPlayer,
  IOfficeState,
  IWhiteboard,
} from '../../../types/IOfficeState'
import { NPC } from './NpcState'

export class Player extends Schema implements IPlayer {
  @type('string') playerName = ''
  @type('number') x = 705
  @type('number') y = 500
  @type('string') anim = 'adam_idle_down'
  @type('string') userId = '' // Database user ID for persistence
  @type('number') points = 0 // Synced to client for real-time display
  // pointFlowType is server-side only (no @type decorator) - not synced to other clients for privacy
  pointFlowType = 'SYSTEM' // 'SYSTEM' or 'NPC' - determines point awarding flow

  // Event tracking properties (not synchronized to clients)
  lastSampleTime?: number
  currentZone?: string
  isIdle?: boolean
  idleStartTime?: number
}

export class Whiteboard extends Schema implements IWhiteboard {
  @type('string') roomId = getRoomId()
  @type({ set: 'string' }) connectedUser = new SetSchema<string>()
}

export class OfficeState extends Schema implements IOfficeState {
  @type({ map: Player })
  players = new MapSchema<Player>()

  @type({ map: Whiteboard })
  whiteboards = new MapSchema<Whiteboard>()

  @type({ map: NPC })
  npcs = new MapSchema<NPC>()
}

export const whiteboardRoomIds = new Set<string>()
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const charactersLength = characters.length

function getRoomId(): string {
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  if (!whiteboardRoomIds.has(result)) {
    whiteboardRoomIds.add(result)
    return result
  } else {
    console.log('roomId exists, remaking another one.')
    return getRoomId()
  }
}
