import { ItemType } from '../../../types/Items'
import Item from './Item'
import Network from '../services/Network'

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

    // Send interaction message to server
    network.interactWithNPC(this.npcId)

    // Show simple message for now
    this.clearDialogBox()
    this.setDialogBox(`${this.npcName}: Hello! Welcome to SkyOffice!`)

    // Clear message after 3 seconds
    setTimeout(() => {
      this.clearDialogBox()
      this.onOverlapDialog()
    }, 3000)
  }
}
