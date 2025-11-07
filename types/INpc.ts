import { Schema } from '@colyseus/schema'

export interface INPC extends Schema {
  id: string
  name: string
  x: number
  y: number
  anim: string
  texture: string
}
