export enum PointType {
  NPC_CONVERSATION_START = 'NPC_CONVERSATION_START',
}

export enum PointFlowType {
  SYSTEM = 'SYSTEM', // Points given by system (current behavior)
  NPC = 'NPC', // Points given by NPC with chat announcement
}

export interface PointConfig {
  type: PointType
  points: number
  description: string
  cooldownMs: number
}

export const POINT_VALUES: Record<PointType, PointConfig> = {
  [PointType.NPC_CONVERSATION_START]: {
    type: PointType.NPC_CONVERSATION_START,
    points: 10,
    description: 'Started conversation with NPC',
    cooldownMs: 60000, // 1 minute per NPC
  },
}

export interface PointsUpdatePayload {
  pointsEarned: number
  newTotal: number
  reason: string
  awardedBy: string // 'SYSTEM' or NPC name (e.g., 'Prof. Laura')
}

// Configurable award messages per NPC
export const NPC_AWARD_MESSAGES: Record<string, string> = {
  guide: "Great job starting our conversation! I'm awarding you {points} points.",
  // Add more NPCs as needed, fallback for unknown NPCs
  default: "I'm awarding you {points} points for engaging with me!",
}

// Helper to get message with points interpolated
export function getNpcAwardMessage(npcId: string, points: number): string {
  const template = NPC_AWARD_MESSAGES[npcId] || NPC_AWARD_MESSAGES.default
  return template.replace('{points}', points.toString())
}
