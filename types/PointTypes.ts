export enum PointType {
  NPC_CONVERSATION_START = 'NPC_CONVERSATION_START',
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
}
