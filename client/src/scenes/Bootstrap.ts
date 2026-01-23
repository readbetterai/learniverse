import Phaser from 'phaser'
import Network from '../services/Network'

// Single-player mode flag - must match Network.ts
const SINGLE_PLAYER_MODE = true

export default class Bootstrap extends Phaser.Scene {
  private preloadComplete = false
  network!: Network

  constructor() {
    super('bootstrap')
  }

  preload() {
    // Character spritesheets
    this.load.spritesheet('adam', 'assets/character/adam.png', {
      frameWidth: 32,
      frameHeight: 48,
    })
    this.load.spritesheet('ash', 'assets/character/ash.png', {
      frameWidth: 32,
      frameHeight: 48,
    })
    this.load.spritesheet('lucy', 'assets/character/lucy.png', {
      frameWidth: 32,
      frameHeight: 48,
    })
    this.load.spritesheet('nancy', 'assets/character/nancy.png', {
      frameWidth: 32,
      frameHeight: 48,
    })

    this.load.on('complete', () => {
      this.preloadComplete = true

      // In single-player mode, auto-launch the game after preload
      if (SINGLE_PLAYER_MODE) {
        console.log('[Bootstrap] Single-player mode: auto-launching game')
        this.launchGame()
      }
    })
  }

  init() {
    this.network = new Network()
  }

  launchGame() {
    if (!this.preloadComplete) return

    const gameScene = this.scene.get('game')
    if (gameScene) {
      // Scene exists (was previously stopped after logout), restart it
      this.scene.start('game', {
        network: this.network,
      })
    } else {
      // First launch, scene doesn't exist yet
      this.scene.launch('game', {
        network: this.network,
      })
    }

    // Note: setRoomJoined(true) is now called after successful authentication in LoginDialog
  }
}
