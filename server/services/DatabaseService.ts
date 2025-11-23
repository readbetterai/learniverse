import { PrismaClient, User, NpcConversation, ConversationMessage, GameProgress } from '@prisma/client'
import * as bcrypt from 'bcrypt'

/**
 * DatabaseService - Singleton wrapper around Prisma Client
 * Provides high-level methods for database operations
 */
export class DatabaseService {
  private static instance: DatabaseService
  private prisma: PrismaClient

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
  }

  /**
   * Get singleton instance of DatabaseService
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    try {
      await this.prisma.$connect()
      console.log('✅ Database connected successfully')
    } catch (error) {
      console.error('❌ Failed to connect to database:', error)
      throw error
    }
  }

  /**
   * Disconnect from database (for graceful shutdown)
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
    console.log('Database disconnected')
  }

  // ==================== USER OPERATIONS ====================

  /**
   * Find user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    })
  }

  /**
   * Find user by session ID
   */
  async getUserBySessionId(sessionId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { sessionId },
    })
  }

  /**
   * Find user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    })
  }

  /**
   * Create a new user
   */
  async createUser(data: {
    username: string
    password: string
    sessionId?: string
    avatarTexture?: string
    email?: string
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        username: data.username,
        password: data.password,
        sessionId: data.sessionId,
        avatarTexture: data.avatarTexture || 'adam',
        email: data.email,
      },
    })
  }

  /**
   * Verify user password and return user if valid
   */
  async verifyUserPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username)

    if (!user) {
      return null
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return null
    }

    return user
  }

  /**
   * Update user's session ID (on join)
   */
  async updateUserSession(userId: string, sessionId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { sessionId },
    })
  }

  /**
   * Clear user's session ID (on leave)
   */
  async clearUserSession(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { sessionId: null },
    })
  }

  // ==================== GAME PROGRESS OPERATIONS ====================

  /**
   * Get user's game progress
   */
  async getGameProgress(userId: string): Promise<GameProgress | null> {
    return this.prisma.gameProgress.findUnique({
      where: { userId },
    })
  }

  /**
   * Save or update user's game progress
   */
  async saveGameProgress(data: {
    userId: string
    lastX?: number
    lastY?: number
    lastAnim?: string
    npcInteractionCount?: number
  }): Promise<GameProgress> {
    return this.prisma.gameProgress.upsert({
      where: { userId: data.userId },
      create: {
        userId: data.userId,
        lastX: data.lastX,
        lastY: data.lastY,
        lastAnim: data.lastAnim,
        npcInteractionCount: data.npcInteractionCount || 0,
        lastActiveAt: new Date(),
      },
      update: {
        lastX: data.lastX,
        lastY: data.lastY,
        lastAnim: data.lastAnim,
        npcInteractionCount: data.npcInteractionCount,
        lastActiveAt: new Date(),
      },
    })
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(userId: string): Promise<GameProgress> {
    return this.prisma.gameProgress.upsert({
      where: { userId },
      create: {
        userId,
        lastActiveAt: new Date(),
      },
      update: {
        lastActiveAt: new Date(),
      },
    })
  }

  // ==================== NPC CONVERSATION OPERATIONS ====================

  /**
   * Get active conversation between user and NPC
   * Returns the most recent conversation (with endedAt = null, or most recent one)
   */
  async getActiveConversation(userId: string, npcId: string): Promise<(NpcConversation & { messages: ConversationMessage[] }) | null> {
    // First try to get an active conversation (endedAt is null)
    const activeConversation = await this.prisma.npcConversation.findFirst({
      where: {
        userId,
        npcId,
        endedAt: null,
      },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    })

    if (activeConversation) {
      return activeConversation
    }

    // If no active conversation, get the most recent one (to resume)
    return this.prisma.npcConversation.findFirst({
      where: {
        userId,
        npcId,
      },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    })
  }

  /**
   * Create a new NPC conversation
   */
  async createConversation(userId: string, npcId: string): Promise<NpcConversation> {
    return this.prisma.npcConversation.create({
      data: {
        userId,
        npcId,
      },
    })
  }

  /**
   * Add a message to a conversation
   */
  async addConversationMessage(data: {
    conversationId: string
    author: string
    content: string
    isNpc: boolean
  }): Promise<ConversationMessage> {
    return this.prisma.conversationMessage.create({
      data: {
        conversationId: data.conversationId,
        author: data.author,
        content: data.content,
        isNpc: data.isNpc,
      },
    })
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    return this.prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
    })
  }

  /**
   * End a conversation (set endedAt timestamp)
   */
  async endConversation(conversationId: string): Promise<NpcConversation> {
    return this.prisma.npcConversation.update({
      where: { id: conversationId },
      data: { endedAt: new Date() },
    })
  }

  /**
   * Get conversation by ID with messages
   */
  async getConversationById(conversationId: string): Promise<(NpcConversation & { messages: ConversationMessage[] }) | null> {
    return this.prisma.npcConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
      },
    })
  }

  // ==================== USER SETTINGS OPERATIONS ====================

  /**
   * Get user settings
   */
  async getUserSettings(userId: string) {
    return this.prisma.userSettings.findUnique({
      where: { userId },
    })
  }

  /**
   * Create or update user settings
   */
  async saveUserSettings(data: {
    userId: string
    videoEnabled?: boolean
    audioEnabled?: boolean
    chatNotifications?: boolean
  }) {
    return this.prisma.userSettings.upsert({
      where: { userId: data.userId },
      create: {
        userId: data.userId,
        videoEnabled: data.videoEnabled ?? true,
        audioEnabled: data.audioEnabled ?? true,
        chatNotifications: data.chatNotifications ?? true,
      },
      update: {
        videoEnabled: data.videoEnabled,
        audioEnabled: data.audioEnabled,
        chatNotifications: data.chatNotifications,
      },
    })
  }
}
