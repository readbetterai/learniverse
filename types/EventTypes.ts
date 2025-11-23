/**
 * Event logging types and enums for tracking user behavior and system events
 */

export enum EventCategory {
  AUTH = 'AUTH',
  NPC = 'NPC',
  MOVEMENT = 'MOVEMENT',
  SOCIAL = 'SOCIAL',
  LEARNING = 'LEARNING',
  SYSTEM = 'SYSTEM'
}

export enum EventType {
  // Authentication events
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  SESSION_START = 'SESSION_START',
  SESSION_END = 'SESSION_END',

  // NPC Interaction events (Prof. Laura)
  NPC_APPROACH = 'NPC_APPROACH',              // Player enters NPC interaction range
  NPC_CONVERSATION_START = 'NPC_CONVERSATION_START',
  NPC_MESSAGE_SENT = 'NPC_MESSAGE_SENT',      // Player sends message to NPC
  NPC_MESSAGE_RECEIVED = 'NPC_MESSAGE_RECEIVED', // NPC responds to player
  NPC_CONVERSATION_END = 'NPC_CONVERSATION_END',
  NPC_ABANDON = 'NPC_ABANDON',                // Player leaves without proper end

  // Movement patterns
  ZONE_ENTER = 'ZONE_ENTER',
  ZONE_EXIT = 'ZONE_EXIT',
  MOVEMENT_SAMPLE = 'MOVEMENT_SAMPLE',        // Periodic position sampling
  IDLE_START = 'IDLE_START',
  IDLE_END = 'IDLE_END',

  // Social interactions
  PLAYER_PROXIMITY_START = 'PLAYER_PROXIMITY_START',
  PLAYER_PROXIMITY_END = 'PLAYER_PROXIMITY_END',

  // Learning behavior
  EXPLORATION_PATTERN = 'EXPLORATION_PATTERN'
}

// Zone definitions for movement tracking
export interface Zone {
  name: string;
  bounds: {
    x: [number, number];
    y: [number, number];
  };
}

export const ZONES: Record<string, Zone> = {
  SPAWN: {
    name: 'spawn',
    bounds: { x: [0, 200], y: [0, 200] }
  },
  NPC_AREA: {
    name: 'npc_area',
    bounds: { x: [400, 600], y: [300, 500] }  // Prof. Laura location
  },
  SOCIAL_AREA: {
    name: 'social_area',
    bounds: { x: [200, 400], y: [200, 400] }
  }
};

// Helper function to determine which zone a position is in
export function getZone(x: number, y: number): string {
  for (const [key, zone] of Object.entries(ZONES)) {
    const { bounds } = zone;
    if (x >= bounds.x[0] && x <= bounds.x[1] &&
        y >= bounds.y[0] && y <= bounds.y[1]) {
      return zone.name;
    }
  }
  return 'exploration'; // Default zone for areas outside defined zones
}

// Event metadata interfaces
export interface LoginEventMetadata {
  avatar?: string;
  timestamp: Date;
  clientInfo?: any;
}

export interface NpcConversationMetadata {
  npcId: string;
  conversationId?: string;
  messageCount?: number;
  duration?: number;
  message?: string;
  messageLength?: number;
}

export interface MovementEventMetadata {
  zone?: string;
  fromZone?: string;
  position?: { x: number; y: number };
  animation?: string;
  distance?: number;
}

export interface ProximityEventMetadata {
  targetPlayerId: string;
  targetPlayerName?: string;
  distance?: number;
}

export interface SessionEventMetadata {
  sessionDuration?: number;
  finalPosition?: { x: number; y: number };
  distanceTraveled?: number;
  zonesVisited?: string[];
}