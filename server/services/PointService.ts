import { PrismaClient, Prisma } from '@prisma/client'
import { PointType, POINT_VALUES } from '../../types/PointTypes'

// Maximum cooldown duration for cleanup purposes (1 hour - enough for NPC cooldowns)
const MAX_COOLDOWN_MS = 3600000

/**
 * PointService - Singleton service for managing user points
 * Handles point awarding, cooldowns, and transaction logging
 */
export class PointService {
  private static instance: PointService
  private prisma: PrismaClient
  private isConnected = false
  // Map: `${userId}:${pointType}:${targetId?}` -> lastEarnedTimestamp
  private cooldowns: Map<string, number> = new Map()
  private cleanupInterval?: NodeJS.Timeout

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
    })
    // Start periodic cleanup of expired cooldowns
    this.cleanupInterval = setInterval(() => this.cleanupExpiredCooldowns(), 300000) // Every 5 minutes
  }

  /**
   * Connect to the database and verify connection
   */
  async connect(): Promise<void> {
    await this.prisma.$connect()
    this.isConnected = true
    console.log('✅ PointService connected to database')
  }

  public static getInstance(): PointService {
    if (!PointService.instance) {
      PointService.instance = new PointService()
    }
    return PointService.instance
  }

  /**
   * Award points to a user
   * Returns the points earned and new total, or null if cooldown active or error
   */
  async awardPoints(
    userId: string,
    pointType: PointType,
    metadata?: Record<string, unknown>
  ): Promise<{ pointsEarned: number; newTotal: number } | null> {
    const config = POINT_VALUES[pointType]
    if (!config) {
      console.warn(`⚠️ Unknown point type: ${pointType}`)
      return null
    }

    // Build cooldown key (include npcId for NPC interactions)
    const cooldownKey = this.buildCooldownKey(userId, pointType, metadata)

    // Check in-memory cooldown first
    if (!this.checkMemoryCooldown(cooldownKey, config.cooldownMs)) {
      return null
    }

    try {
      // All database operations in a single transaction for atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Verify user exists first
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, totalPoints: true },
        })

        if (!user) {
          console.error(`❌ User ${userId} not found`)
          return null
        }

        // Safely serialize metadata
        let safeMetadata: Prisma.InputJsonValue = Prisma.JsonNull
        if (metadata) {
          try {
            // Ensure metadata is JSON-serializable
            safeMetadata = JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue
          } catch {
            console.warn('⚠️ Failed to serialize metadata, using null')
          }
        }

        // Update user points
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            totalPoints: { increment: config.points },
            lifetimePoints: { increment: config.points },
          },
        })

        // Create transaction record
        await tx.pointTransaction.create({
          data: {
            userId,
            pointType,
            points: config.points,
            metadata: safeMetadata,
          },
        })

        return updatedUser
      })

      // Transaction returned null (cooldown active or user not found)
      if (!result) {
        return null
      }

      // Update in-memory cooldown after successful award
      this.setCooldown(cooldownKey)

      console.log(`⭐ Awarded ${config.points} points to user ${userId} for ${pointType}`)
      return {
        pointsEarned: config.points,
        newTotal: result.totalPoints,
      }
    } catch (error) {
      console.error('❌ Failed to award points:', error)
      return null
    }
  }

  /**
   * Get user's current points total
   */
  async getUserPoints(userId: string): Promise<number> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { totalPoints: true },
      })
      return user?.totalPoints ?? 0
    } catch (error) {
      console.error('❌ Failed to get user points:', error)
      return 0
    }
  }

  /**
   * Build cooldown key for in-memory tracking
   * For NPC interactions, include npcId to allow separate cooldowns per NPC
   */
  private buildCooldownKey(
    userId: string,
    pointType: PointType,
    metadata?: Record<string, unknown>
  ): string {
    if (pointType === PointType.NPC_CONVERSATION_START && metadata?.npcId) {
      return `${userId}:${pointType}:${metadata.npcId}`
    }
    return `${userId}:${pointType}`
  }

  /**
   * Check in-memory cooldown for frequent actions
   */
  private checkMemoryCooldown(cooldownKey: string, cooldownMs: number): boolean {
    const lastEarned = this.cooldowns.get(cooldownKey)
    if (!lastEarned) return true
    return Date.now() - lastEarned >= cooldownMs
  }

  /**
   * Set cooldown timestamp
   */
  private setCooldown(cooldownKey: string): void {
    this.cooldowns.set(cooldownKey, Date.now())
  }

  /**
   * Clear user's cooldowns when they disconnect
   */
  clearUserCooldowns(userId: string): void {
    for (const key of this.cooldowns.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.cooldowns.delete(key)
      }
    }
  }

  /**
   * Periodic cleanup of expired cooldowns to prevent memory leaks
   */
  private cleanupExpiredCooldowns(): void {
    const now = Date.now()
    let cleaned = 0
    for (const [key, timestamp] of this.cooldowns.entries()) {
      if (now - timestamp > MAX_COOLDOWN_MS) {
        this.cooldowns.delete(key)
        cleaned++
      }
    }
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cooldown entries`)
    }
  }

  /**
   * Cleanup on shutdown
   */
  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    await this.prisma.$disconnect()
    this.isConnected = false
  }
}
