import { Schema, ArraySchema, MapSchema, type } from '@colyseus/schema'
import { INPC } from '../../../types/INpc'

export class NpcMessage extends Schema {
  @type('string') author = ''
  @type('number') createdAt = new Date().getTime()
  @type('string') content = ''
  @type('boolean') isNpc = false
}

export class Conversation extends Schema {
  @type([NpcMessage]) messages = new ArraySchema<NpcMessage>()
}

export class NPC extends Schema implements INPC {
  @type('string') id = ''
  @type('string') name = ''
  @type('number') x = 0
  @type('number') y = 0
  @type('string') anim = 'nancy_idle_down'
  @type('string') texture = 'nancy'
  @type({ map: Conversation }) conversations = new MapSchema<Conversation>()
}
