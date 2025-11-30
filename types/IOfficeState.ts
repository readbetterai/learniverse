import { Schema, SetSchema, MapSchema } from '@colyseus/schema'
import { INPC } from './INpc'

export interface IPlayer extends Schema {
  playerName: string
  x: number
  y: number
  anim: string
  userId: string
  points: number
  // pointFlowType is server-side only, not synced to clients
  pointFlowType?: string
  // Event tracking properties (not synchronized to clients)
  lastSampleTime?: number
  currentZone?: string
  isIdle?: boolean
  idleStartTime?: number
}

export interface IWhiteboard extends Schema {
  roomId: string
  connectedUser: SetSchema<string>
}

export interface IOfficeState extends Schema {
  players: MapSchema<IPlayer>
  whiteboards: MapSchema<IWhiteboard>
  npcs: MapSchema<INPC>
}
