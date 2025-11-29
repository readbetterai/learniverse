export enum PointType {
  NPC_CONVERSATION_START = 'NPC_CONVERSATION_START', // Deprecated - kept for DB compatibility
  NPC_MEANINGFUL_QUESTION = 'NPC_MEANINGFUL_QUESTION', // Points for asking meaningful questions
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
    description: 'Started conversation with NPC (deprecated)',
    cooldownMs: 60000, // 1 minute per NPC
  },
  [PointType.NPC_MEANINGFUL_QUESTION]: {
    type: PointType.NPC_MEANINGFUL_QUESTION,
    points: 10,
    description: 'Asked a meaningful question',
    cooldownMs: 0, // No cooldown - every meaningful question earns points
  },
}

export interface PointsUpdatePayload {
  pointsEarned: number
  newTotal: number
  reason: string
  awardedBy: string // 'SYSTEM' or NPC name (e.g., 'Prof. Laura')
}

// Configurable award messages per NPC for meaningful questions
export const NPC_AWARD_MESSAGES: Record<string, string> = {
  guide: "Great question! I'm awarding you {points} points for your curiosity.",
  // Add more NPCs as needed, fallback for unknown NPCs
  default: "I'm awarding you {points} points for that thoughtful question!",
}

// Helper to get message with points interpolated
export function getNpcAwardMessage(npcId: string, points: number): string {
  const template = NPC_AWARD_MESSAGES[npcId] || NPC_AWARD_MESSAGES.default
  return template.replace('{points}', points.toString())
}
