import { PrismaClient, Prisma } from '@prisma/client';
import { EventType, EventCategory, getZone } from '../../types/EventTypes';

interface EventQueueItem {
  userId: string;
  sessionId?: string | null;
  eventType: string;
  eventCategory: string;
  metadata?: any;
  timestamp: Date;
}

interface InteractionData {
  userId: string;
  sessionId: string;
  targetType: string;
  targetId: string;
  startTime: Date;
  metadata?: any;
}

interface MovementSample {
  x: number;
  y: number;
  timestamp: number;
}

export class EventLoggingService {
  private static instance: EventLoggingService;
  private prisma: PrismaClient;
  private eventQueue: EventQueueItem[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private activeInteractions: Map<string, InteractionData> = new Map();
  private movementBuffers: Map<string, MovementSample[]> = new Map();

  private constructor() {
    this.prisma = new PrismaClient();
    this.startFlushInterval();
  }

  public static getInstance(): EventLoggingService {
    if (!EventLoggingService.instance) {
      EventLoggingService.instance = new EventLoggingService();
    }
    return EventLoggingService.instance;
  }

  private startFlushInterval(): void {
    // Flush event queue every 3 seconds
    this.flushInterval = setInterval(() => {
      this.flushEventQueue();
    }, 3000);
  }

  /**
   * Log a general event
   */
  public async logEvent(
    userId: string,
    eventType: EventType | string,
    metadata?: any,
    sessionId?: string | null
  ): Promise<void> {
    // Determine category from event type
    let category = EventCategory.SYSTEM;
    if (eventType.includes('LOGIN') || eventType.includes('LOGOUT') || eventType.includes('SESSION')) {
      category = EventCategory.AUTH;
    } else if (eventType.includes('NPC')) {
      category = EventCategory.NPC;
    } else if (eventType.includes('MOVEMENT') || eventType.includes('ZONE') || eventType.includes('IDLE')) {
      category = EventCategory.MOVEMENT;
    } else if (eventType.includes('PROXIMITY')) {
      category = EventCategory.SOCIAL;
    } else if (eventType.includes('EXPLORATION')) {
      category = EventCategory.LEARNING;
    }

    this.eventQueue.push({
      userId,
      sessionId,
      eventType,
      eventCategory: category,
      metadata,
      timestamp: new Date()
    });

    // Flush immediately if queue is large
    if (this.eventQueue.length >= 100) {
      await this.flushEventQueue();
    }
  }

  /**
   * Start tracking an interaction session
   */
  public async startInteraction(
    userId: string,
    sessionId: string,
    targetType: string,
    targetId: string,
    metadata?: any
  ): Promise<void> {
    const key = `${sessionId}-${targetType}-${targetId}`;

    this.activeInteractions.set(key, {
      userId,
      sessionId,
      targetType,
      targetId,
      startTime: new Date(),
      metadata
    });

    // Also log as an event
    await this.logEvent(
      userId,
      targetType === 'NPC' ? EventType.NPC_CONVERSATION_START : EventType.PLAYER_PROXIMITY_START,
      { targetId, ...metadata },
      sessionId
    );
  }

  /**
   * End an interaction session and calculate duration
   */
  public async endInteraction(
    sessionId: string,
    targetType: string,
    targetId: string
  ): Promise<{ duration: number } | null> {
    const key = `${sessionId}-${targetType}-${targetId}`;
    const interaction = this.activeInteractions.get(key);

    if (!interaction) {
      console.warn(`No active interaction found for key: ${key}`);
      return null;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - interaction.startTime.getTime();

    // Save to database
    try {
      await this.prisma.interactionSession.create({
        data: {
          userId: interaction.userId,
          sessionId: interaction.sessionId,
          targetType: interaction.targetType,
          targetId: interaction.targetId,
          startTime: interaction.startTime,
          endTime,
          duration,
          metadata: interaction.metadata || Prisma.JsonNull
        }
      });
    } catch (error) {
      console.error('Failed to save interaction session:', error);
    }

    // Clean up
    this.activeInteractions.delete(key);

    // Log end event
    await this.logEvent(
      interaction.userId,
      targetType === 'NPC' ? EventType.NPC_CONVERSATION_END : EventType.PLAYER_PROXIMITY_END,
      { targetId, duration },
      sessionId
    );

    return { duration };
  }

  /**
   * Record a movement sample
   */
  public recordMovementSample(
    userId: string,
    sessionId: string,
    position: { x: number; y: number },
    animation?: string
  ): void {
    const key = `${userId}-${sessionId}`;

    if (!this.movementBuffers.has(key)) {
      this.movementBuffers.set(key, []);
    }

    const buffer = this.movementBuffers.get(key)!;
    buffer.push({
      x: position.x,
      y: position.y,
      timestamp: Date.now()
    });

    // Determine current zone
    const zone = getZone(position.x, position.y);

    // Log movement sample event (sampled, not every update)
    this.logEvent(
      userId,
      EventType.MOVEMENT_SAMPLE,
      { position, zone, animation },
      sessionId
    );
  }

  /**
   * Save movement pattern to database
   */
  public async saveMovementPattern(
    userId: string,
    sessionId: string
  ): Promise<void> {
    const key = `${userId}-${sessionId}`;
    const buffer = this.movementBuffers.get(key);

    if (!buffer || buffer.length === 0) {
      return;
    }

    // Calculate total distance
    let totalDistance = 0;
    const zones: any[] = [];
    let currentZone: string | null = null;
    let zoneEnterTime: number | null = null;

    for (let i = 1; i < buffer.length; i++) {
      const prev = buffer[i - 1];
      const curr = buffer[i];

      // Calculate distance
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);

      // Track zone changes
      const zone = getZone(curr.x, curr.y);
      if (zone !== currentZone) {
        if (currentZone && zoneEnterTime) {
          zones.push({
            zone: currentZone,
            enterTime: new Date(zoneEnterTime),
            exitTime: new Date(curr.timestamp),
            duration: curr.timestamp - zoneEnterTime
          });
        }
        currentZone = zone;
        zoneEnterTime = curr.timestamp;
      }
    }

    // Add final zone if still in one
    if (currentZone && zoneEnterTime && buffer.length > 0) {
      const lastTimestamp = buffer[buffer.length - 1].timestamp;
      zones.push({
        zone: currentZone,
        enterTime: new Date(zoneEnterTime),
        exitTime: new Date(lastTimestamp),
        duration: lastTimestamp - zoneEnterTime
      });
    }

    try {
      await this.prisma.movementPattern.create({
        data: {
          userId,
          sessionId,
          positions: buffer as any,
          zones: zones as any,
          totalDistance
        }
      });
    } catch (error) {
      console.error('Failed to save movement pattern:', error);
    }

    // Clear buffer
    this.movementBuffers.delete(key);
  }

  /**
   * Create or update session metrics
   */
  public async createSessionMetrics(
    userId: string,
    sessionId: string
  ): Promise<void> {
    try {
      await this.prisma.sessionMetrics.create({
        data: {
          userId,
          sessionId,
          loginTime: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to create session metrics:', error);
    }
  }

  /**
   * Update session metrics
   */
  public async updateSessionMetrics(
    sessionId: string,
    updates: Partial<{
      logoutTime: Date;
      totalDuration: number;
      npcInteractionCount: number;
      npcTotalDuration: number;
      npcMessageCount: number;
      proximityEventCount: number;
      distanceTraveled: number;
      zonesVisited: string[];
    }>
  ): Promise<void> {
    try {
      const data: any = {};

      if (updates.logoutTime) data.logoutTime = updates.logoutTime;
      if (updates.totalDuration !== undefined) data.totalDuration = updates.totalDuration;
      if (updates.npcInteractionCount !== undefined) {
        data.npcInteractionCount = { increment: updates.npcInteractionCount };
      }
      if (updates.npcTotalDuration !== undefined) {
        data.npcTotalDuration = { increment: updates.npcTotalDuration };
      }
      if (updates.npcMessageCount !== undefined) {
        data.npcMessageCount = { increment: updates.npcMessageCount };
      }
      if (updates.proximityEventCount !== undefined) {
        data.proximityEventCount = { increment: updates.proximityEventCount };
      }
      if (updates.distanceTraveled !== undefined) {
        data.distanceTraveled = { increment: updates.distanceTraveled };
      }
      if (updates.zonesVisited) data.zonesVisited = updates.zonesVisited;

      await this.prisma.sessionMetrics.update({
        where: { sessionId },
        data
      });
    } catch (error) {
      console.error('Failed to update session metrics:', error);
    }
  }

  /**
   * Flush the event queue to database
   */
  private async flushEventQueue(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.prisma.userEvent.createMany({
        data: events.map(event => ({
          userId: event.userId,
          sessionId: event.sessionId,
          eventType: event.eventType,
          eventCategory: event.eventCategory,
          metadata: event.metadata || Prisma.JsonNull,
          timestamp: event.timestamp
        }))
      });

      console.log(`Flushed ${events.length} events to database`);
    } catch (error) {
      console.error('Failed to flush event queue:', error);
      // Put events back in queue if flush failed
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Clean up resources
   */
  public async dispose(): Promise<void> {
    // Flush remaining events
    await this.flushEventQueue();

    // Save any remaining movement patterns
    for (const [key] of this.movementBuffers) {
      const [userId, sessionId] = key.split('-');
      await this.saveMovementPattern(userId, sessionId);
    }

    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Disconnect Prisma
    await this.prisma.$disconnect();
  }
}

export default EventLoggingService;