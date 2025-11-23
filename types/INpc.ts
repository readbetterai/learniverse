import { Schema, MapSchema, ArraySchema } from '@colyseus/schema'

export interface INpcMessage extends Schema {
  author: string
  createdAt: number
  content: string
  isNpc: boolean
}

export interface IConversation extends Schema {
  messages: ArraySchema<INpcMessage>
}

export interface INPC extends Schema {
  id: string
  name: string
  x: number
  y: number
  anim: string
  texture: string
  conversations: MapSchema<IConversation>
}
