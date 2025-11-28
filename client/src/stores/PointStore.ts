import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface PointNotification {
  id: string
  pointsEarned: number
  reason: string
  timestamp: number
}

interface PointState {
  totalPoints: number
  notifications: PointNotification[]
  showNotification: boolean
  currentNotification: PointNotification | null
}

const initialState: PointState = {
  totalPoints: 0,
  notifications: [],
  showNotification: false,
  currentNotification: null,
}

// Counter for unique ID generation to avoid collisions when multiple notifications arrive in same ms
let notificationCounter = 0

export const pointSlice = createSlice({
  name: 'points',
  initialState,
  reducers: {
    setTotalPoints: (state, action: PayloadAction<number>) => {
      state.totalPoints = action.payload
    },
    addPointNotification: (
      state,
      action: PayloadAction<{
        pointsEarned: number
        newTotal: number
        reason: string
      }>
    ) => {
      // Use counter to ensure unique IDs even within same millisecond
      notificationCounter++
      const notification: PointNotification = {
        id: `${Date.now()}-${notificationCounter}`,
        pointsEarned: action.payload.pointsEarned,
        reason: action.payload.reason,
        timestamp: Date.now(),
      }
      state.totalPoints = action.payload.newTotal
      state.notifications.push(notification)
      state.currentNotification = notification
      state.showNotification = true

      // Keep only last 10 notifications
      if (state.notifications.length > 10) {
        state.notifications = state.notifications.slice(-10)
      }
    },
    hideNotification: (state) => {
      state.showNotification = false
      state.currentNotification = null
    },
  },
})

export const { setTotalPoints, addPointNotification, hideNotification } = pointSlice.actions

export default pointSlice.reducer
