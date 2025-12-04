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

    // Start NPC chat UI with empty messages
    // Server will send conversation history via START_NPC_CONVERSATION message
    store.dispatch(startNpcChat({
      npcId: this.npcId,
      npcName: this.npcName,
      messages: [],
    }))

    // Send start conversation message to server
    network.startNpcConversation(this.npcId)
  }
}
