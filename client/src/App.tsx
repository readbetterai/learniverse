import React, { useEffect, useState, useRef } from 'react'
import styled from 'styled-components'

import { useAppSelector, useAppDispatch } from './hooks'
import { setLoggedIn, setConnectionState } from './stores/UserStore'
import { setRoomJoined } from './stores/RoomStore'

import LoginDialog from './components/LoginDialog'
import WhiteboardDialog from './components/WhiteboardDialog'
import NpcChat from './components/NpcChat'
import HelperButtonGroup from './components/HelperButtonGroup'
import MobileVirtualJoystick from './components/MobileVirtualJoystick'
import PointsDisplay from './components/PointsDisplay'
import PointsNotification from './components/PointsNotification'
import ReconnectingDialog from './components/ReconnectingDialog'

import phaserGame from './PhaserGame'
import Bootstrap from './scenes/Bootstrap'
import Game from './scenes/Game'

const Backdrop = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
`

function App() {
  const dispatch = useAppDispatch()
  const loggedIn = useAppSelector((state) => state.user.loggedIn)
  const connectionState = useAppSelector((state) => state.user.connectionState)
  const whiteboardDialogOpen = useAppSelector((state) => state.whiteboard.whiteboardDialogOpen)

  const [reconnectUsername, setReconnectUsername] = useState<string | null>(null)
  // Use ref to prevent double reconnection in React StrictMode
  // Refs persist across StrictMode unmount/remount cycles
  const hasAttemptedReconnectRef = useRef(false)

  // Check for stored token on mount and attempt reconnection
  useEffect(() => {
    // Guard against double-mount in React StrictMode
    if (hasAttemptedReconnectRef.current) {
      console.log('[App] Reconnect already attempted, skipping (StrictMode double-mount)')
      return
    }

    const attemptReconnect = async () => {
      const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap

      // Wait for bootstrap scene to be ready
      if (!bootstrap?.network) {
        console.log('[App] Bootstrap not ready, retrying...')
        setTimeout(attemptReconnect, 100)
        return
      }

      // Mark that we've attempted reconnection (use ref to persist across StrictMode remounts)
      hasAttemptedReconnectRef.current = true

      const token = bootstrap.network.getStoredToken()
      const username = bootstrap.network.getStoredUsername()

      if (token) {
        console.log('[App] Found stored token, attempting reconnection')
        setReconnectUsername(username)
        dispatch(setConnectionState('reconnecting'))

        const success = await bootstrap.network.joinWithToken(token)

        if (success) {
          console.log('[App] Reconnection successful, launching game...')
          // Launch game scene
          bootstrap.launchGame()
          dispatch(setRoomJoined(true))

          // Wait for the game scene to be fully created
          const game = phaserGame.scene.keys.game as Game
          console.log('[App] Waiting for game scene create event...')

          // Add timeout to detect if game scene never creates
          const createTimeout = setTimeout(() => {
            console.error('[App] Game scene create event never fired after 5 seconds')
          }, 5000)

          game.events.once('create', () => {
            clearTimeout(createTimeout)
            console.log('[App] Game scene created, registering keys and setting player name')
            game.registerKeys()
            if (username) {
              game.myPlayer.setPlayerName(username)
            }
            dispatch(setLoggedIn(true))
            dispatch(setConnectionState('connected'))
            console.log('[App] Reconnection complete, user logged in')
          })
        } else {
          console.log('[App] Reconnection failed, showing login')
          dispatch(setConnectionState('disconnected'))
        }
      } else {
        console.log('[App] No stored token, showing login')
        dispatch(setConnectionState('disconnected'))
      }
    }

    // Only attempt reconnect if not already logged in
    if (!loggedIn) {
      attemptReconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  let ui: JSX.Element

  // Priority 1: Show ReconnectingDialog if attempting to reconnect
  if (connectionState === 'reconnecting') {
    ui = <ReconnectingDialog username={reconnectUsername} />
  }
  // Priority 2: Show game UI if logged in
  else if (loggedIn) {
    if (whiteboardDialogOpen) {
      /* Render WhiteboardDialog if user is using a whiteboard. */
      ui = <WhiteboardDialog />
    } else {
      ui = (
        /* Render NPC Chat if no dialogs are opened. */
        <>
          <NpcChat />
          <MobileVirtualJoystick />
        </>
      )
    }
  }
  // Priority 3: Show LoginDialog
  else {
    ui = <LoginDialog />
  }

  return (
    <Backdrop>
      {ui}
      {/* Points system UI - always rendered when logged in */}
      <PointsDisplay />
      <PointsNotification />
      {/* Render HelperButtonGroup if no dialogs are opened. */}
      {!whiteboardDialogOpen && <HelperButtonGroup />}
    </Backdrop>
  )
}

export default App
