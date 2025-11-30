import Phaser from 'phaser'

// import { debugDraw } from '../utils/debug'
import { createCharacterAnims } from '../anims/CharacterAnims'

import Item from '../items/Item'
import Npc from '../items/Npc'
import '../characters/MyPlayer'
import '../characters/OtherPlayer'
import MyPlayer from '../characters/MyPlayer'
import OtherPlayer from '../characters/OtherPlayer'
import PlayerSelector from '../characters/PlayerSelector'
import Network from '../services/Network'
import { IPlayer } from '../../../types/IOfficeState'
import { INPC } from '../../../types/INpc'
import { PlayerBehavior } from '../../../types/PlayerBehavior'
import { ItemType } from '../../../types/Items'
import { phaserEvents, Event } from '../events/EventCenter'

import store from '../stores'
import { setFocused, setShowChat, endNpcChat } from '../stores/ChatStore'
import { NavKeys, Keyboard } from '../../../types/KeyboardState'

export default class Game extends Phaser.Scene {
  network!: Network
  private cursors!: NavKeys
  private keyE!: Phaser.Input.Keyboard.Key
  private keyR!: Phaser.Input.Keyboard.Key
  private map!: Phaser.Tilemaps.Tilemap
  myPlayer!: MyPlayer
  private playerSelector!: Phaser.GameObjects.Zone
  private otherPlayers!: Phaser.Physics.Arcade.Group
  private otherPlayerMap = new Map<string, OtherPlayer>()
  private npcs!: Phaser.Physics.Arcade.StaticGroup
  private npcMap = new Map<string, { sprite: Npc; nameText: Phaser.GameObjects.Text }>()

  constructor() {
    super('game')
  }

  registerKeys() {
    this.cursors = {
      ...this.input.keyboard.createCursorKeys(),
      ...(this.input.keyboard.addKeys('W,S,A,D') as Keyboard),
    }

    // maybe we can have a dedicated method for adding keys if more keys are needed in the future
    this.keyE = this.input.keyboard.addKey('E')
    this.keyR = this.input.keyboard.addKey('R')
    this.input.keyboard.disableGlobalCapture()
    this.input.keyboard.on('keydown-ENTER', (event) => {
      store.dispatch(setShowChat(true))
      store.dispatch(setFocused(true))
    })
    this.input.keyboard.on('keydown-ESC', (event) => {
      store.dispatch(setShowChat(false))
    })
  }

  disableKeys() {
    this.input.keyboard.enabled = false
  }

  enableKeys() {
    this.input.keyboard.enabled = true
  }

  create(data: { network: Network }) {
    if (!data.network) {
      throw new Error('server instance missing')
    } else {
      this.network = data.network
    }

    createCharacterAnims(this.anims)

    this.map = this.make.tilemap({ key: 'tilemap' })
    const FloorAndGround = this.map.addTilesetImage('FloorAndGround', 'tiles_wall')

    const groundLayer = this.map.createLayer('Ground', FloorAndGround)
    groundLayer.setCollisionByProperty({ collides: true })

    // debugDraw(groundLayer, this)

    this.myPlayer = this.add.myPlayer(400, 400, 'adam', this.network.mySessionId)
    this.playerSelector = new PlayerSelector(this, 0, 0, 16, 16)

    // create NPC static group (NPCs will be spawned dynamically from server)
    this.npcs = this.physics.add.staticGroup({ classType: Npc })

    this.otherPlayers = this.physics.add.group({ classType: OtherPlayer })

    this.cameras.main.zoom = 1.5
    this.cameras.main.startFollow(this.myPlayer, true)

    this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], groundLayer)

    this.physics.add.overlap(
      this.playerSelector,
      this.npcs,
      this.handleItemSelectorOverlap,
      undefined,
      this
    )

    this.physics.add.overlap(
      this.myPlayer,
      this.otherPlayers,
      this.handlePlayersOverlap,
      undefined,
      this
    )

    // register network event listeners
    this.network.onPlayerJoined(this.handlePlayerJoined, this)
    this.network.onPlayerLeft(this.handlePlayerLeft, this)
    this.network.onMyPlayerReady(this.handleMyPlayerReady, this)
    this.network.onMyPlayerVideoConnected(this.handleMyVideoConnected, this)
    this.network.onPlayerUpdated(this.handlePlayerUpdated, this)
    this.network.onItemUserAdded(this.handleItemUserAdded, this)
    this.network.onItemUserRemoved(this.handleItemUserRemoved, this)

    // register own player state listener (for initial avatar from database)
    phaserEvents.on(Event.MY_PLAYER_STATE_READY, this.handleMyPlayerStateReady, this)

    // register NPC event listeners
    phaserEvents.on(Event.NPC_JOINED, this.handleNPCJoined, this)
    phaserEvents.on(Event.NPC_UPDATED, this.handleNPCUpdated, this)

    // Handle NPCs that were already spawned before this scene initialized
    const existingNPCs = this.network.getExistingNPCs()
    existingNPCs.forEach(({ npc, key }) => {
      this.handleNPCJoined(npc, key)
    })
  }

  private handleItemSelectorOverlap(playerSelector, selectionItem) {
    const currentItem = playerSelector.selectedItem as Item
    // currentItem is undefined if nothing was perviously selected
    if (currentItem) {
      // if the selection has not changed, do nothing
      if (currentItem === selectionItem || currentItem.depth >= selectionItem.depth) {
        return
      }
      // if selection changes, clear pervious dialog
      if (this.myPlayer.playerBehavior !== PlayerBehavior.SITTING) currentItem.clearDialogBox()
    }

    // set selected item and set up new dialog
    playerSelector.selectedItem = selectionItem
    selectionItem.onOverlapDialog()
  }

  private addObjectFromTiled(
    group: Phaser.Physics.Arcade.StaticGroup,
    object: Phaser.Types.Tilemaps.TiledObject,
    key: string,
    tilesetName: string
  ) {
    const actualX = object.x! + object.width! * 0.5
    const actualY = object.y! - object.height! * 0.5
    const obj = group
      .get(actualX, actualY, key, object.gid! - this.map.getTileset(tilesetName).firstgid)
      .setDepth(actualY)
    return obj
  }

  private addGroupFromTiled(
    objectLayerName: string,
    key: string,
    tilesetName: string,
    collidable: boolean
  ) {
    const group = this.physics.add.staticGroup()
    const objectLayer = this.map.getObjectLayer(objectLayerName)
    objectLayer.objects.forEach((object) => {
      const actualX = object.x! + object.width! * 0.5
      const actualY = object.y! - object.height! * 0.5
      group
        .get(actualX, actualY, key, object.gid! - this.map.getTileset(tilesetName).firstgid)
        .setDepth(actualY)
    })
    if (this.myPlayer && collidable)
      this.physics.add.collider([this.myPlayer, this.myPlayer.playerContainer], group)
  }

  // function to add new player to the otherPlayer group
  private handlePlayerJoined(newPlayer: IPlayer, id: string) {
    const otherPlayer = this.add.otherPlayer(newPlayer.x, newPlayer.y, 'adam', id, newPlayer.playerName)
    this.otherPlayers.add(otherPlayer)
    this.otherPlayerMap.set(id, otherPlayer)
  }

  // function to remove the player who left from the otherPlayer group
  private handlePlayerLeft(id: string) {
    if (this.otherPlayerMap.has(id)) {
      const otherPlayer = this.otherPlayerMap.get(id)
      if (!otherPlayer) return
      this.otherPlayers.remove(otherPlayer, true, true)
      this.otherPlayerMap.delete(id)
    }
  }

  private handleMyPlayerReady() {
    this.myPlayer.readyToConnect = true
  }

  private handleMyVideoConnected() {
    this.myPlayer.videoConnected = true
  }

  // function to handle own player's initial state from server (including avatar texture)
  private handleMyPlayerStateReady(player: IPlayer) {
    if (player.anim) {
      // Extract texture name from anim string (e.g., 'lucy_idle_down' -> 'lucy')
      const texture = player.anim.split('_')[0]
      if (texture !== this.myPlayer.playerTexture) {
        this.myPlayer.setPlayerTexture(texture)
      }
    }
    // Also update position if server has saved position
    if (player.x && player.y) {
      this.myPlayer.setPosition(player.x, player.y)
    }
  }

  // function to update target position upon receiving player updates
  private handlePlayerUpdated(field: string, value: number | string, id: string) {
    const otherPlayer = this.otherPlayerMap.get(id)
    otherPlayer?.updateOtherPlayer(field, value)
  }

  private handlePlayersOverlap(myPlayer, otherPlayer) {
    otherPlayer.makeCall(myPlayer, this.network?.webRTC)
  }

  private handleItemUserAdded(playerId: string, itemId: string, itemType: ItemType) {
    // Computers and whiteboards removed - no items to handle
  }

  private handleItemUserRemoved(playerId: string, itemId: string, itemType: ItemType) {
    // Computers and whiteboards removed - no items to handle
  }

  // function to add new NPC when spawned by server
  private handleNPCJoined(npcData: INPC, npcId: string) {
    // Create NPC sprite at the specified position
    const npc = this.npcs.get(npcData.x, npcData.y, npcData.texture) as Npc

    if (!npc) return

    npc.npcId = npcId
    npc.npcName = npcData.name

    // Set depth based on y position (for proper layering)
    npc.setDepth(npcData.y)

    // Adjust hitbox (similar to player)
    npc.body.setSize(npc.width * 0.5, npc.height * 0.5)

    // Create name label above NPC
    const nameText = this.add.text(npcData.x, npcData.y - 30, npcData.name, {
      fontSize: '14px',
      color: '#FFD700', // Gold color for NPCs
      backgroundColor: '#000000',
      padding: { x: 6, y: 3 },
    })
    nameText.setOrigin(0.5)
    nameText.setDepth(npcData.y)

    // Store references
    this.npcMap.set(npcId, { sprite: npc, nameText })

    // Play idle animation
    npc.anims.play(npcData.anim, true)
  }

  // function to update NPC when server state changes
  private handleNPCUpdated(field: string, value: any, npcId: string) {
    const npcObj = this.npcMap.get(npcId)
    if (!npcObj) return

    const { sprite, nameText } = npcObj

    switch (field) {
      case 'x':
        sprite.x = value
        nameText.x = value
        break
      case 'y':
        sprite.y = value
        nameText.y = value - 30
        sprite.setDepth(value)
        nameText.setDepth(value)
        break
      case 'anim':
        sprite.anims.play(value, true)
        break
    }
  }

  update(t: number, dt: number) {
    if (this.myPlayer && this.network) {
      this.playerSelector.update(this.myPlayer, this.cursors)
      this.myPlayer.update(this.playerSelector, this.cursors, this.keyE, this.keyR, this.network)

      // Check proximity to active NPC conversation
      const currentNpcId = store.getState().chat.currentNpcId
      const inConversation = store.getState().chat.inConversation

      if (currentNpcId && inConversation) {
        const npcObj = this.npcMap.get(currentNpcId)
        if (npcObj) {
          const distance = Phaser.Math.Distance.Between(
            this.myPlayer.x,
            this.myPlayer.y,
            npcObj.sprite.x,
            npcObj.sprite.y
          )

          const MAX_CONVERSATION_DISTANCE = 150 // pixels

          if (distance > MAX_CONVERSATION_DISTANCE) {
            // Player walked too far away, close conversation
            this.network.endNpcConversation(currentNpcId)
            store.dispatch(endNpcChat())
          }
        }
      }
    }
  }
}
