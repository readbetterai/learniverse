import { Schema, type } from '@colyseus/schema'
import { INPC } from '../../../types/INpc'

export class NPC extends Schema implements INPC {
  @type('string') id = ''
  @type('string') name = ''
  @type('number') x = 0
  @type('number') y = 0
  @type('string') anim = 'nancy_idle_down'
  @type('string') texture = 'nancy'
}
