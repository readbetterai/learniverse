import React, { useState } from 'react'
import styled from 'styled-components'
import Fab from '@mui/material/Fab'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import CloseIcon from '@mui/icons-material/Close'
import LogoutIcon from '@mui/icons-material/Logout'
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset'
import VideogameAssetOffIcon from '@mui/icons-material/VideogameAssetOff'

import { setShowJoystick, setLoggedIn, setSessionId } from '../stores/UserStore'
import { setRoomJoined } from '../stores/RoomStore'
import { useAppSelector, useAppDispatch } from '../hooks'
import phaserGame from '../PhaserGame'
import Bootstrap from '../scenes/Bootstrap'

const Backdrop = styled.div`
  position: fixed;
  display: flex;
  gap: 10px;
  bottom: 16px;
  right: 16px;
  align-items: flex-end;

  .wrapper-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
`

const Wrapper = styled.div`
  position: relative;
  font-size: 16px;
  color: #eee;
  background: #222639;
  box-shadow: 0px 0px 5px #0000006f;
  border-radius: 16px;
  padding: 15px 35px 15px 15px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .close {
    position: absolute;
    top: 15px;
    right: 15px;
  }
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
`

const Title = styled.h3`
  font-size: 24px;
  color: #eee;
  text-align: center;
`

const ConfirmText = styled.p`
  margin: 10px 0;
  color: #c2c2c2;
`

const StyledFab = styled(Fab)<{ target?: string }>`
  &:hover {
    color: #1ea2df;
  }
`

export default function HelperButtonGroup() {
  const [showControlGuide, setShowControlGuide] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const showJoystick = useAppSelector((state) => state.user.showJoystick)
  const roomJoined = useAppSelector((state) => state.room.roomJoined)
  const dispatch = useAppDispatch()

  const handleLogout = () => {
    setShowLogoutConfirm(false)

    // Get network instance and logout
    const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap
    bootstrap.network.logout()

    // Stop the game scene (don't remove it, so it can be re-launched on next login)
    phaserGame.scene.stop('game')

    // Reset Redux state to trigger UI transition to LoginDialog
    dispatch(setRoomJoined(false))
    dispatch(setLoggedIn(false))
    dispatch(setSessionId(''))
  }

  return (
    <Backdrop>
      <div className="wrapper-group">
        {roomJoined && (
          <Tooltip title={showJoystick ? 'Disable virtual joystick' : 'Enable virtual joystick'}>
            <StyledFab size="small" onClick={() => dispatch(setShowJoystick(!showJoystick))}>
              {showJoystick ? <VideogameAssetOffIcon /> : <VideogameAssetIcon />}
            </StyledFab>
          </Tooltip>
        )}
        {showLogoutConfirm && (
          <Wrapper>
            <IconButton className="close" onClick={() => setShowLogoutConfirm(false)} size="small">
              <CloseIcon />
            </IconButton>
            <Title>Logout</Title>
            <ConfirmText>Are you sure you want to logout?</ConfirmText>
            <ButtonGroup style={{ marginTop: '10px' }}>
              <Button variant="outlined" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </Button>
              <Button variant="contained" color="error" onClick={handleLogout}>
                Logout
              </Button>
            </ButtonGroup>
          </Wrapper>
        )}
        {showControlGuide && (
          <Wrapper>
            <Title>Controls</Title>
            <IconButton className="close" onClick={() => setShowControlGuide(false)} size="small">
              <CloseIcon />
            </IconButton>
            <ul>
              <li>
                <strong>W, A, S, D or arrow keys</strong> to move
              </li>
              <li>
                <strong>E</strong> to sit down (when facing a chair)
              </li>
              <li>
                <strong>Enter</strong> to open chat
              </li>
              <li>
                <strong>ESC</strong> to close chat
              </li>
            </ul>
          </Wrapper>
        )}
      </div>
      <ButtonGroup>
        {roomJoined && (
          <>
            <Tooltip title="Control Guide">
              <StyledFab
                size="small"
                onClick={() => {
                  setShowControlGuide(!showControlGuide)
                  setShowLogoutConfirm(false)
                }}
              >
                <HelpOutlineIcon />
              </StyledFab>
            </Tooltip>
            <Tooltip title="Logout">
              <StyledFab
                size="small"
                onClick={() => {
                  setShowLogoutConfirm(!showLogoutConfirm)
                  setShowControlGuide(false)
                }}
              >
                <LogoutIcon />
              </StyledFab>
            </Tooltip>
          </>
        )}
      </ButtonGroup>
    </Backdrop>
  )
}
