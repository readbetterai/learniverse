import bcrypt from 'bcrypt'
import { Room, Client, ServerError } from 'colyseus'
import { Dispatcher } from '@colyseus/command'
import { Player, OfficeState, Computer, Whiteboard } from './schema/OfficeState'
import { NPC, NpcMessage, Conversation } from './schema/NpcState'
import { Message } from '../../types/Messages'
import { IRoomData } from '../../types/Rooms'
import { whiteboardRoomIds } from './schema/OfficeState'
import PlayerUpdateCommand from './commands/PlayerUpdateCommand'
import PlayerUpdateNameCommand from './commands/PlayerUpdateNameCommand'
import {
  ComputerAddUserCommand,
  ComputerRemoveUserCommand,
} from './commands/ComputerUpdateArrayCommand'
import {
  WhiteboardAddUserCommand,
  WhiteboardRemoveUserCommand,
} from './commands/WhiteboardUpdateArrayCommand'
import { OpenAIService } from '../services/OpenAIService'

export class SkyOffice extends Room<OfficeState> {
  private dispatcher = new Dispatcher(this)
  private name: string
  private description: string
  private password: string | null = null
  private openAIService?: OpenAIService

  async onCreate(options: IRoomData) {
    const { name, description, password, autoDispose } = options
    this.name = name
    this.description = description
    this.autoDispose = autoDispose

    let hasPassword = false
    if (password) {
      const salt = await bcrypt.genSalt(10)
      this.password = await bcrypt.hash(password, salt)
      hasPassword = true
    }
    this.setMetadata({ name, description, hasPassword })

    this.setState(new OfficeState())

    // Initialize OpenAI service for Prof. Laura
    try {
      this.openAIService = new OpenAIService()
      console.log('✅ OpenAI service initialized successfully')
    } catch (error) {
      console.warn('⚠️  OpenAI service not available:', error instanceof Error ? error.message : error)
      console.warn('   Prof. Laura will not respond to messages automatically')
    }

    // HARD-CODED: Add 5 computers in a room
    for (let i = 0; i < 5; i++) {
      this.state.computers.set(String(i), new Computer())
    }

    // HARD-CODED: Add 3 whiteboards in a room
    for (let i = 0; i < 3; i++) {
      this.state.whiteboards.set(String(i), new Whiteboard())
    }

    // Spawn NPCs
    this.spawnNPCs()

    // when a player connect to a computer, add to the computer connectedUser array
    this.onMessage(Message.CONNECT_TO_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerAddUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player disconnect from a computer, remove from the computer connectedUser array
    this.onMessage(Message.DISCONNECT_FROM_COMPUTER, (client, message: { computerId: string }) => {
      this.dispatcher.dispatch(new ComputerRemoveUserCommand(), {
        client,
        computerId: message.computerId,
      })
    })

    // when a player stop sharing screen
    this.onMessage(Message.STOP_SCREEN_SHARE, (client, message: { computerId: string }) => {
      const computer = this.state.computers.get(message.computerId)
      computer.connectedUser.forEach((id) => {
        this.clients.forEach((cli) => {
          if (cli.sessionId === id && cli.sessionId !== client.sessionId) {
            cli.send(Message.STOP_SCREEN_SHARE, client.sessionId)
          }
        })
      })
    })

    // when a player connect to a whiteboard, add to the whiteboard connectedUser array
    this.onMessage(Message.CONNECT_TO_WHITEBOARD, (client, message: { whiteboardId: string }) => {
      this.dispatcher.dispatch(new WhiteboardAddUserCommand(), {
        client,
        whiteboardId: message.whiteboardId,
      })
    })

    // when a player disconnect from a whiteboard, remove from the whiteboard connectedUser array
    this.onMessage(
      Message.DISCONNECT_FROM_WHITEBOARD,
      (client, message: { whiteboardId: string }) => {
        this.dispatcher.dispatch(new WhiteboardRemoveUserCommand(), {
          client,
          whiteboardId: message.whiteboardId,
        })
      }
    )

    // when receiving updatePlayer message, call the PlayerUpdateCommand
    this.onMessage(
      Message.UPDATE_PLAYER,
      (client, message: { x: number; y: number; anim: string }) => {
        this.dispatcher.dispatch(new PlayerUpdateCommand(), {
          client,
          x: message.x,
          y: message.y,
          anim: message.anim,
        })
      }
    )

    // when receiving updatePlayerName message, call the PlayerUpdateNameCommand
    this.onMessage(Message.UPDATE_PLAYER_NAME, (client, message: { name: string }) => {
      this.dispatcher.dispatch(new PlayerUpdateNameCommand(), {
        client,
        name: message.name,
      })
    })

    // when a player is ready to connect, call the PlayerReadyToConnectCommand
    this.onMessage(Message.READY_TO_CONNECT, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.readyToConnect = true
    })

    // when a player is ready to connect, call the PlayerReadyToConnectCommand
    this.onMessage(Message.VIDEO_CONNECTED, (client) => {
      const player = this.state.players.get(client.sessionId)
      if (player) player.videoConnected = true
    })

    // when a player disconnect a stream, broadcast the signal to the other player connected to the stream
    this.onMessage(Message.DISCONNECT_STREAM, (client, message: { clientId: string }) => {
      this.clients.forEach((cli) => {
        if (cli.sessionId === message.clientId) {
          cli.send(Message.DISCONNECT_STREAM, client.sessionId)
        }
      })
    })

    // when a player interacts with an NPC
    this.onMessage(Message.INTERACT_WITH_NPC, (client, message: { npcId: string }) => {
      const { npcId } = message
      console.log(`Player ${client.sessionId} interacted with NPC ${npcId}`)

      // Send a simple response back to the client
      client.send(Message.INTERACT_WITH_NPC, {
        npcId,
        message: 'Hello! Welcome to SkyOffice!',
      })
    })

    // when a player starts a conversation with an NPC
    this.onMessage(Message.START_NPC_CONVERSATION, (client, message: { npcId: string }) => {
      const { npcId } = message
      const npc = this.state.npcs.get(npcId)
      const player = this.state.players.get(client.sessionId)

      if (!npc || !player) return

      console.log(`Player ${player.name} started conversation with NPC ${npc.name}`)

      // Create or get existing conversation
      if (!npc.conversations.has(client.sessionId)) {
        const conversation = new Conversation()
        npc.conversations.set(client.sessionId, conversation)

        // Add static greeting for Prof. Laura when conversation is first started
        if (npcId === 'guide') {
          const greetingMessage = new NpcMessage()
          greetingMessage.author = npc.name
          greetingMessage.content = "Hello! I'm Prof. Laura. How can I help you with your studies today?"
          greetingMessage.isNpc = true
          greetingMessage.createdAt = new Date().getTime()
          conversation.messages.push(greetingMessage)
        }
      }

      // Send conversation history to client
      client.send(Message.START_NPC_CONVERSATION, {
        npcId,
        success: true,
      })
    })

    // when a player sends a message to an NPC
    this.onMessage(Message.SEND_NPC_MESSAGE, async (client, message: { npcId: string; content: string }) => {
      const { npcId, content } = message
      const npc = this.state.npcs.get(npcId)
      const player = this.state.players.get(client.sessionId)

      if (!npc || !player) return

      // Get or create conversation
      let conversation = npc.conversations.get(client.sessionId)
      if (!conversation) {
        conversation = new Conversation()
        npc.conversations.set(client.sessionId, conversation)
      }

      // Create player message
      const playerMessage = new NpcMessage()
      playerMessage.author = player.name
      playerMessage.content = content
      playerMessage.isNpc = false
      playerMessage.createdAt = new Date().getTime()

      // Add to conversation
      conversation.messages.push(playerMessage)

      console.log(`Player ${player.name} sent message to NPC ${npc.name}: ${content}`)

      // Generate AI response for Prof. Laura
      if (npcId === 'guide' && this.openAIService) {
        try {
          // Build conversation history for OpenAI
          const conversationHistory = conversation.messages.map(msg => ({
            author: msg.author,
            content: msg.content,
            isNpc: msg.isNpc,
          }))

          // Get AI response
          const aiResponse = await this.openAIService.getChatResponse(
            conversationHistory,
            npc.name,
            player.name
          )

          // Create and add NPC response message
          const npcResponseMessage = new NpcMessage()
          npcResponseMessage.author = npc.name
          npcResponseMessage.content = aiResponse
          npcResponseMessage.isNpc = true
          npcResponseMessage.createdAt = new Date().getTime()
          conversation.messages.push(npcResponseMessage)

          console.log(`Prof. Laura responded to ${player.name}: ${aiResponse}`)

        } catch (error) {
          console.error(`Failed to get AI response for player ${player.name}:`, error)

          // Send friendly fallback message
          const fallbackMessage = new NpcMessage()
          fallbackMessage.author = npc.name
          fallbackMessage.content = "I apologize, I'm having a bit of trouble formulating my thoughts right now. Could you please try asking again?"
          fallbackMessage.isNpc = true
          fallbackMessage.createdAt = new Date().getTime()
          conversation.messages.push(fallbackMessage)

          console.log(`Prof. Laura sent fallback message to ${player.name}`)
        }
      }
    })

    // when a player ends a conversation with an NPC
    this.onMessage(Message.END_NPC_CONVERSATION, (client, message: { npcId: string }) => {
      const { npcId } = message
      const npc = this.state.npcs.get(npcId)
      const player = this.state.players.get(client.sessionId)

      if (!npc || !player) return

      console.log(`Player ${player.name} ended conversation with NPC ${npc.name}`)

      // Note: We keep the conversation in memory (as per requirements - persist history)
      // If you wanted to clear it, you would do: npc.conversations.delete(client.sessionId)
    })
  }

  private spawnNPCs() {
    // Spawn a guide NPC
    const guide = new NPC()
    guide.id = 'guide'
    guide.name = 'Prof. Laura'
    guide.x = 400
    guide.y = 300
    guide.texture = 'nancy'
    guide.anim = 'nancy_idle_down'

    this.state.npcs.set('guide', guide)
    console.log('✅ Spawned NPC: Guide at (400, 350)')
  }

  async onAuth(client: Client, options: { password: string | null }) {
    if (this.password) {
      const validPassword = await bcrypt.compare(options.password, this.password)
      if (!validPassword) {
        throw new ServerError(403, 'Password is incorrect!')
      }
    }
    return true
  }

  onJoin(client: Client, options: any) {
    this.state.players.set(client.sessionId, new Player())
    client.send(Message.SEND_ROOM_DATA, {
      id: this.roomId,
      name: this.name,
      description: this.description,
    })
  }

  onLeave(client: Client, consented: boolean) {
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId)
    }
    this.state.computers.forEach((computer) => {
      if (computer.connectedUser.has(client.sessionId)) {
        computer.connectedUser.delete(client.sessionId)
      }
    })
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboard.connectedUser.has(client.sessionId)) {
        whiteboard.connectedUser.delete(client.sessionId)
      }
    })
  }

  onDispose() {
    this.state.whiteboards.forEach((whiteboard) => {
      if (whiteboardRoomIds.has(whiteboard.roomId)) whiteboardRoomIds.delete(whiteboard.roomId)
    })

    console.log('room', this.roomId, 'disposing...')
    this.dispatcher.stop()
  }
}
