import { ItemType } from '../../../types/Items'
import Item from './Item'
import Network from '../services/Network'
import store from '../stores'
import { startNpcChat } from '../stores/ChatStore'

export default class Npc extends Item {
  npcId!: string
  npcName!: string

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frame?: string | number) {
    super(scene, x, y, texture, frame)
    this.itemType = ItemType.NPC
  }

  onOverlapDialog() {
    this.setDialogBox(`Press R to talk to ${this.npcName}`)
  }

  openDialog(network: Network) {
    if (!this.npcId) return

    this.clearDialogBox()

    // Get existing conversation from network state
    const room = network.getRoom()
    const npcs = room?.state.npcs
    const npc = npcs?.get(this.npcId)
    const conversation = npc?.conversations.get(room?.sessionId || '')

    // Convert messages to plain objects
    const messages = conversation?.messages.map(msg => ({
      author: msg.author,
      createdAt: msg.createdAt,
      content: msg.content,
      isNpc: msg.isNpc,
    })) || []

    // Start NPC chat UI
    store.dispatch(startNpcChat({
      npcId: this.npcId,
      npcName: this.npcName,
      messages: messages,
    }))

    // Send start conversation message to server
    network.startNpcConversation(this.npcId)
  }
}
