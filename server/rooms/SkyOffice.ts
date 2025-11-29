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
import { DatabaseService } from '../services/DatabaseService'
import { EventLoggingService } from '../services/EventLoggingService'
import { PointService } from '../services/PointService'
import { EventType } from '../../types/EventTypes'
import { PointType, PointFlowType, getNpcAwardMessage } from '../../types/PointTypes'
// Note: PointType.NPC_MEANINGFUL_QUESTION is now used instead of NPC_CONVERSATION_START

export class SkyOffice extends Room<OfficeState> {
  private dispatcher = new Dispatcher(this)
  private _roomName: string
  private description: string
  private password: string | null = null
  private openAIService?: OpenAIService
  private dbService?: DatabaseService
  private eventLogger?: EventLoggingService
  private pointService?: PointService

  async onCreate(options: IRoomData) {
    const { name, description, password, autoDispose } = options
    this._roomName = name
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

    // Initialize Database service
    try {
      this.dbService = DatabaseService.getInstance()
      await this.dbService.connect()
      console.log('✅ Database service initialized successfully')
    } catch (error) {
      console.warn('⚠️  Database service not available:', error instanceof Error ? error.message : error)
      console.warn('   User data and conversations will not be persisted')
    }

    // Initialize Event Logging service
    try {
      this.eventLogger = EventLoggingService.getInstance()
      console.log('✅ Event logging service initialized successfully')
    } catch (error) {
      console.warn('⚠️  Event logging service not available:', error instanceof Error ? error.message : error)
      console.warn('   Events will not be tracked')
    }

    // Initialize Point service
    try {
      this.pointService = PointService.getInstance()
      await this.pointService.connect()
      console.log('✅ Point service initialized and connected')
    } catch (error) {
      console.warn('⚠️  Point service not available:', error instanceof Error ? error.message : error)
      console.warn('   Points will not be awarded')
      this.pointService = undefined
    }

    // HARD-CODED: Add 5 computers in a room
    for (let i = 0; i < 5; i++) {
      this.state.computers.set(i.toString(), new Computer())
    }

    // HARD-CODED: Add 3 whiteboards in a room
    for (let i = 0; i < 3; i++) {
      this.state.whiteboards.set(i.toString(), new Whiteboard())
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
    this.onMessage(Message.START_NPC_CONVERSATION, async (client, message: { npcId: string }) => {
      const { npcId } = message
      const npc = this.state.npcs.get(npcId)
      const player = this.state.players.get(client.sessionId)

      if (!npc || !player) return

      console.log(`Player ${player.playerName} started conversation with NPC ${npc.name}`)

      // Create or get existing conversation in memory (for real-time sync)
      if (!npc.conversations.has(client.sessionId)) {
        const conversation = new Conversation()
        npc.conversations.set(client.sessionId, conversation)
      }

      const conversation = npc.conversations.get(client.sessionId)!

      // Load conversation history from database
      if (this.dbService && player.userId) {
        try {
          const dbConversation = await this.dbService.getActiveConversation(player.userId, npcId)

          if (dbConversation) {
            // Conversation exists in DB - restore messages to in-memory state
            console.log(`📚 Loaded ${dbConversation.messages.length} messages from database`)

            // Clear and populate conversation messages from database
            conversation.messages.clear()
            dbConversation.messages.forEach((dbMsg) => {
              const msg = new NpcMessage()
              msg.author = dbMsg.author
              msg.content = dbMsg.content
              msg.isNpc = dbMsg.isNpc
              msg.createdAt = dbMsg.timestamp.getTime()
              conversation.messages.push(msg)
            })

            // Store the DB conversation ID for later use
            ;(conversation as any).dbConversationId = dbConversation.id
          } else {
            // New conversation - create in database
            const newDbConversation = await this.dbService.createConversation(player.userId, npcId)
            ;(conversation as any).dbConversationId = newDbConversation.id
            console.log(`✅ Created new conversation in database: ${newDbConversation.id}`)

            // Add static greeting for Prof. Laura when conversation is first started
            if (npcId === 'guide') {
              const greetingMessage = new NpcMessage()
              greetingMessage.author = npc.name
              greetingMessage.content = "Hello! I'm Prof. Laura. How can I help you with your studies today?"
              greetingMessage.isNpc = true
              greetingMessage.createdAt = new Date().getTime()
              conversation.messages.push(greetingMessage)

              // Save greeting to database
              await this.dbService.addConversationMessage({
                conversationId: newDbConversation.id,
                author: npc.name,
                content: greetingMessage.content,
                isNpc: true,
              })
            }
          }
        } catch (error) {
          console.error('Failed to load/create conversation from database:', error)
          // Fall back to in-memory only
          if (conversation.messages.length === 0 && npcId === 'guide') {
            const greetingMessage = new NpcMessage()
            greetingMessage.author = npc.name
            greetingMessage.content = "Hello! I'm Prof. Laura. How can I help you with your studies today?"
            greetingMessage.isNpc = true
            greetingMessage.createdAt = new Date().getTime()
            conversation.messages.push(greetingMessage)
          }
        }
      } else {
        // No database - add greeting in memory only
        if (conversation.messages.length === 0 && npcId === 'guide') {
          const greetingMessage = new NpcMessage()
          greetingMessage.author = npc.name
          greetingMessage.content = "Hello! I'm Prof. Laura. How can I help you with your studies today?"
          greetingMessage.isNpc = true
          greetingMessage.createdAt = new Date().getTime()
          conversation.messages.push(greetingMessage)
        }
      }

      // Log NPC conversation start event
      if (this.eventLogger && player.userId) {
        await this.eventLogger.startInteraction(
          player.userId,
          client.sessionId,
          'NPC',
          npcId,
          { npcName: npc.name, conversationId: (conversation as any).dbConversationId }
        )
      }

      // Note: Points are now awarded for meaningful questions in SEND_NPC_MESSAGE handler
      // instead of for starting conversations

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

      // Get DB conversation ID (stored earlier in START_NPC_CONVERSATION)
      const dbConversationId = (conversation as any).dbConversationId

      // Create player message
      const playerMessage = new NpcMessage()
      playerMessage.author = player.playerName
      playerMessage.content = content
      playerMessage.isNpc = false
      playerMessage.createdAt = new Date().getTime()

      // Add to in-memory conversation
      conversation.messages.push(playerMessage)

      console.log(`Player ${player.playerName} sent message to NPC ${npc.name}: ${content}`)

      // Log message sent event
      if (this.eventLogger && player.userId) {
        await this.eventLogger.logEvent(
          player.userId,
          EventType.NPC_MESSAGE_SENT,
          {
            npcId,
            npcName: npc.name,
            message: content,
            messageLength: content.length,
            timestamp: new Date()
          },
          client.sessionId
        )

        // Update session metrics
        await this.eventLogger.updateSessionMetrics(client.sessionId, {
          npcMessageCount: 1
        })
      }

      // Save player message to database
      if (this.dbService && dbConversationId) {
        try {
          await this.dbService.addConversationMessage({
            conversationId: dbConversationId,
            author: player.playerName,
            content: content,
            isNpc: false,
          })
        } catch (error) {
          console.error('Failed to save player message to database:', error)
        }
      }

      // Generate AI response for Prof. Laura with question evaluation
      if (npcId === 'guide' && this.openAIService) {
        try {
          // Build conversation history for OpenAI
          const conversationHistory = conversation.messages.map(msg => ({
            author: msg.author,
            content: msg.content,
            isNpc: msg.isNpc,
          }))

          // Get AI response with meaningful question evaluation
          const result = await this.openAIService.getChatResponseWithEvaluation(
            conversationHistory,
            npc.name,
            player.playerName
          )

          // Create and add NPC response message
          const npcResponseMessage = new NpcMessage()
          npcResponseMessage.author = npc.name
          npcResponseMessage.content = result.response
          npcResponseMessage.isNpc = true
          npcResponseMessage.createdAt = new Date().getTime()
          conversation.messages.push(npcResponseMessage)

          console.log(`Prof. Laura responded to ${player.playerName}: ${result.response}`)
          console.log(`Meaningful question: ${result.isMeaningfulQuestion}`)

          // Award points if the message was a meaningful question
          if (result.isMeaningfulQuestion && this.pointService && player.userId) {
            const pointResult = await this.pointService.awardPoints(
              player.userId,
              PointType.NPC_MEANINGFUL_QUESTION,
              { npcId, npcName: npc.name, question: content }
            )

            if (pointResult) {
              player.points = pointResult.newTotal
              console.log(`🌟 Awarded ${pointResult.pointsEarned} points to ${player.playerName} for meaningful question`)

              // Check if user has NPC flow type - NPC announces the point award
              if (player.pointFlowType === PointFlowType.NPC) {
                const awardMessage = new NpcMessage()
                awardMessage.author = npc.name
                awardMessage.content = getNpcAwardMessage(npcId, pointResult.pointsEarned)
                awardMessage.isNpc = true
                awardMessage.createdAt = new Date().getTime()
                conversation.messages.push(awardMessage)

                // Save NPC award message to database
                if (this.dbService && dbConversationId) {
                  try {
                    await this.dbService.addConversationMessage({
                      conversationId: dbConversationId,
                      author: npc.name,
                      content: awardMessage.content,
                      isNpc: true,
                    })
                  } catch (error) {
                    console.error('Failed to save NPC award message to database:', error)
                  }
                }
              }

              // Send notification with source info for client customization
              client.send(Message.POINTS_UPDATED, {
                pointsEarned: pointResult.pointsEarned,
                newTotal: pointResult.newTotal,
                reason: player.pointFlowType === PointFlowType.NPC
                  ? 'Points awarded'
                  : 'Asked a meaningful question',
                awardedBy: player.pointFlowType === PointFlowType.NPC ? npc.name : 'SYSTEM',
              })
            }
          }

          // Log NPC message received event
          if (this.eventLogger && player.userId) {
            await this.eventLogger.logEvent(
              player.userId,
              EventType.NPC_MESSAGE_RECEIVED,
              {
                npcId,
                npcName: npc.name,
                message: result.response,
                messageLength: result.response.length,
                wasMeaningfulQuestion: result.isMeaningfulQuestion,
                timestamp: new Date()
              },
              client.sessionId
            )
          }

          // Save NPC response to database
          if (this.dbService && dbConversationId) {
            try {
              await this.dbService.addConversationMessage({
                conversationId: dbConversationId,
                author: npc.name,
                content: result.response,
                isNpc: true,
              })
            } catch (error) {
              console.error('Failed to save NPC response to database:', error)
            }
          }

        } catch (error) {
          console.error(`Failed to get AI response for player ${player.playerName}:`, error)

          // Send friendly fallback message - NO points awarded on error (conservative approach)
          const fallbackMessage = new NpcMessage()
          fallbackMessage.author = npc.name
          fallbackMessage.content = "I apologize, I'm having a bit of trouble formulating my thoughts right now. Could you please try asking again?"
          fallbackMessage.isNpc = true
          fallbackMessage.createdAt = new Date().getTime()
          conversation.messages.push(fallbackMessage)

          console.log(`Prof. Laura sent fallback message to ${player.playerName}`)

          // Save fallback message to database
          if (this.dbService && dbConversationId) {
            try {
              await this.dbService.addConversationMessage({
                conversationId: dbConversationId,
                author: npc.name,
                content: fallbackMessage.content,
                isNpc: true,
              })
            } catch (error) {
              console.error('Failed to save fallback message to database:', error)
            }
          }
        }
      }
    })

    // when a player ends a conversation with an NPC
    this.onMessage(Message.END_NPC_CONVERSATION, async (client, message: { npcId: string }) => {
      const { npcId } = message
      const npc = this.state.npcs.get(npcId)
      const player = this.state.players.get(client.sessionId)

      if (!npc || !player) return

      console.log(`Player ${player.playerName} ended conversation with NPC ${npc.name}`)

      // Log conversation end event
      if (this.eventLogger && player.userId) {
        const result = await this.eventLogger.endInteraction(
          client.sessionId,
          'NPC',
          npcId
        )

        if (result) {
          // Update session metrics with interaction count and duration
          await this.eventLogger.updateSessionMetrics(client.sessionId, {
            npcInteractionCount: 1,
            npcTotalDuration: Math.floor(result.duration / 1000) // Convert to seconds
          })
        }
      }

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

  async onJoin(client: Client, options: any) {
    const player = new Player()

    // Require authentication with username and password
    if (!this.dbService) {
      throw new ServerError(503, 'Database service is not available')
    }

    if (!options.username || !options.password) {
      throw new ServerError(400, 'Username and password are required')
    }

    try {
      // Verify user credentials
      const user = await this.dbService.verifyUserPassword(options.username, options.password)

      if (!user) {
        throw new ServerError(401, 'Invalid username or password')
      }

      // Update user's session
      await this.dbService.updateUserSession(user.id, client.sessionId)
      console.log(`✅ User ${user.username} authenticated and joined (${user.id})`)

      // Log login event
      if (this.eventLogger) {
        await this.eventLogger.logEvent(
          user.id,
          EventType.USER_LOGIN,
          {
            avatar: options.avatarTexture || user.avatarTexture,
            timestamp: new Date(),
            username: user.username
          },
          client.sessionId
        )

        // Create session metrics
        await this.eventLogger.createSessionMetrics(user.id, client.sessionId)
      }

      // Set player properties from database
      player.userId = user.id
      player.playerName = user.username as string

      // Store join time on client for session duration calculation
      (client as any).userData = {
        ...((client as any).userData || {}),
        joinedAt: Date.now(),
        userId: user.id
      }

      // Apply avatar texture from options if provided, otherwise use saved one
      if (options.avatarTexture) {
        player.anim = options.avatarTexture + '_idle_down'
      }

      // Load last position from game progress
      const progress = await this.dbService.getGameProgress(user.id)
      if (progress && progress.lastX !== null && progress.lastY !== null) {
        player.x = progress.lastX
        player.y = progress.lastY
        player.anim = progress.lastAnim || user.avatarTexture + '_idle_down'
        console.log(`📍 Restored position for ${user.username}: (${progress.lastX}, ${progress.lastY})`)
      }

      // Load existing points
      if (this.pointService) {
        player.points = await this.pointService.getUserPoints(user.id)
      }

      // Load user's point flow type
      player.pointFlowType = user.pointFlowType || PointFlowType.SYSTEM
    } catch (error) {
      // Re-throw ServerErrors (authentication failures)
      if (error instanceof ServerError) {
        throw error
      }
      // Log and throw other errors
      console.error('Failed to authenticate user:', error)
      throw new ServerError(500, 'Authentication failed. Please try again.')
    }

    this.state.players.set(client.sessionId, player)
    client.send(Message.SEND_ROOM_DATA, {
      id: this.roomId,
      name: this._roomName,
      description: this.description,
    })
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId)
    const joinTime = (client as any).userData?.joinedAt || Date.now()

    // Note: We intentionally do NOT clear cooldowns on disconnect.
    // This prevents users from farming points by quickly reconnecting.
    // The PointService cleanup interval handles expired cooldown cleanup.

    // Save player state to database before removing
    if (player && player.userId) {
      // Log logout event and update session metrics
      if (this.eventLogger) {
        const sessionDuration = Date.now() - joinTime

        await this.eventLogger.logEvent(
          player.userId,
          EventType.USER_LOGOUT,
          {
            sessionDuration: Math.floor(sessionDuration / 1000), // Convert to seconds
            finalPosition: { x: player.x, y: player.y }
          },
          client.sessionId
        )

        // Update session metrics with final data
        await this.eventLogger.updateSessionMetrics(client.sessionId, {
          logoutTime: new Date(),
          totalDuration: Math.floor(sessionDuration / 1000)
        })

        // Save any pending movement patterns
        await this.eventLogger.saveMovementPattern(player.userId, client.sessionId)
      }

      if (this.dbService) {
        try {
          // Save current position and update last active
          await this.dbService.saveGameProgress({
            userId: player.userId,
            lastX: player.x,
            lastY: player.y,
            lastAnim: player.anim,
          })

          // Clear session ID
          await this.dbService.clearUserSession(player.userId)

          console.log(`💾 Saved progress for ${player.playerName} at (${player.x}, ${player.y})`)
        } catch (error) {
          console.error('Failed to save player progress on leave:', error)
        }
      }
    }

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
