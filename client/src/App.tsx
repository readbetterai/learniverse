import React from 'react'
import styled from 'styled-components'

import { useAppSelector } from './hooks'

import LoginDialog from './components/LoginDialog'
import WhiteboardDialog from './components/WhiteboardDialog'
import NpcChat from './components/NpcChat'
import HelperButtonGroup from './components/HelperButtonGroup'
import MobileVirtualJoystick from './components/MobileVirtualJoystick'
import PointsDisplay from './components/PointsDisplay'
import PointsNotification from './components/PointsNotification'

const Backdrop = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
`

function App() {
  const loggedIn = useAppSelector((state) => state.user.loggedIn)
  const whiteboardDialogOpen = useAppSelector((state) => state.whiteboard.whiteboardDialogOpen)

  let ui: JSX.Element
  if (loggedIn) {
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
  } else {
    /* Render LoginDialog if not logged in. */
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
