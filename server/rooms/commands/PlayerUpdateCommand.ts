import { Command } from '@colyseus/command'
import { Client } from 'colyseus'
import { IOfficeState } from '../../../types/IOfficeState'
import { getZone, EventType } from '../../../types/EventTypes'

type Payload = {
  client: Client
  x: number
  y: number
  anim: string
}

export default class PlayerUpdateCommand extends Command<IOfficeState, Payload> {
  execute(data: Payload) {
    const { client, x, y, anim } = data

    const player = this.room.state.players.get(client.sessionId)

    if (!player) return

    // Get the room instance to access eventLogger
    const room = this.room as any

    // Sample movement periodically and track zone changes
    if (room.eventLogger && player.userId) {
      const now = Date.now()

      // Initialize player tracking data if needed
      if (!player.lastSampleTime) {
        player.lastSampleTime = now
        player.currentZone = getZone(x, y)
      }

      // Sample movement every 10 seconds
      if (now - player.lastSampleTime > 10000) {
        room.eventLogger.recordMovementSample(
          player.userId,
          client.sessionId,
          { x, y },
          anim
        )
        player.lastSampleTime = now
      }

      // Check for zone transitions
      const newZone = getZone(x, y)
      if (newZone !== player.currentZone) {
        // Log zone exit event
        if (player.currentZone) {
          room.eventLogger.logEvent(
            player.userId,
            EventType.ZONE_EXIT,
            { zone: player.currentZone, toZone: newZone },
            client.sessionId
          )
        }

        // Log zone enter event
        room.eventLogger.logEvent(
          player.userId,
          EventType.ZONE_ENTER,
          { zone: newZone, fromZone: player.currentZone },
          client.sessionId
        )

        player.currentZone = newZone
      }

      // Track idle state
      const isIdle = anim && anim.includes('idle')
      if (isIdle && !player.isIdle) {
        // Started idling
        player.isIdle = true
        player.idleStartTime = now
        room.eventLogger.logEvent(
          player.userId,
          EventType.IDLE_START,
          { position: { x, y }, animation: anim },
          client.sessionId
        )
      } else if (!isIdle && player.isIdle) {
        // Stopped idling
        const idleDuration = now - (player.idleStartTime || now)
        player.isIdle = false
        room.eventLogger.logEvent(
          player.userId,
          EventType.IDLE_END,
          {
            position: { x, y },
            animation: anim,
            duration: Math.floor(idleDuration / 1000)
          },
          client.sessionId
        )
      }
    }

    // Update player position and animation
    player.x = x
    player.y = y
    player.anim = anim
  }
}
