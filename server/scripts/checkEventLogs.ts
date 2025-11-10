import { PrismaClient } from '@prisma/client'

async function checkEventLogs() {
  const prisma = new PrismaClient()

  try {
    console.log('📊 Checking Event Logs...\n')

    // Check UserEvent table
    const eventCount = await prisma.userEvent.count()
    console.log(`Total events logged: ${eventCount}`)

    if (eventCount > 0) {
      // Get recent events
      const recentEvents = await prisma.userEvent.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: { user: true }
      })

      console.log('\n📝 Recent Events:')
      recentEvents.forEach(event => {
        console.log(`  [${event.timestamp.toISOString()}] ${event.user.username}: ${event.eventType}`)
        if (event.metadata) {
          console.log(`    Metadata: ${JSON.stringify(event.metadata)}`)
        }
      })
    }

    // Check InteractionSession table
    const interactionCount = await prisma.interactionSession.count()
    console.log(`\nTotal interaction sessions: ${interactionCount}`)

    if (interactionCount > 0) {
      const recentInteractions = await prisma.interactionSession.findMany({
        take: 5,
        orderBy: { startTime: 'desc' },
        include: { user: true }
      })

      console.log('\n💬 Recent Interactions:')
      recentInteractions.forEach(interaction => {
        const duration = interaction.duration ? `${interaction.duration / 1000}s` : 'ongoing'
        console.log(`  ${interaction.user.username} → ${interaction.targetType} (${interaction.targetId}): ${duration}`)
      })
    }

    // Check SessionMetrics table
    const sessionCount = await prisma.sessionMetrics.count()
    console.log(`\nTotal sessions tracked: ${sessionCount}`)

    if (sessionCount > 0) {
      const recentSessions = await prisma.sessionMetrics.findMany({
        take: 5,
        orderBy: { loginTime: 'desc' },
        include: { user: true }
      })

      console.log('\n📈 Recent Sessions:')
      recentSessions.forEach(session => {
        const duration = session.totalDuration ? `${session.totalDuration}s` : 'active'
        console.log(`  ${session.user.username}: ${duration} (NPC interactions: ${session.npcInteractionCount}, Messages: ${session.npcMessageCount})`)
      })
    }

    // Check MovementPattern table
    const movementCount = await prisma.movementPattern.count()
    console.log(`\nTotal movement patterns: ${movementCount}`)

    // Event type distribution
    const eventTypes = await prisma.userEvent.groupBy({
      by: ['eventType'],
      _count: true,
      orderBy: {
        _count: {
          eventType: 'desc'
        }
      }
    })

    if (eventTypes.length > 0) {
      console.log('\n📊 Event Type Distribution:')
      eventTypes.forEach(type => {
        console.log(`  ${type.eventType}: ${type._count}`)
      })
    }

  } catch (error) {
    console.error('Error checking event logs:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkEventLogs().catch(console.error)