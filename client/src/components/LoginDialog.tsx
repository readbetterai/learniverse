import React, { useState } from 'react'
import styled from 'styled-components'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'

import { useAppSelector, useAppDispatch } from '../hooks'
import { setLoggedIn } from '../stores/UserStore'
import { getAvatarString, getColorByString } from '../util'

import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

const Wrapper = styled.form`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #222639;
  border-radius: 16px;
  padding: 36px 60px;
  box-shadow: 0px 0px 5px #0000006f;
`

const Title = styled.p`
  margin: 5px;
  font-size: 20px;
  color: #c2c2c2;
  text-align: center;
`

const RoomName = styled.div`
  max-width: 500px;
  max-height: 120px;
  overflow-wrap: anywhere;
  overflow-y: auto;
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;

  h3 {
    font-size: 24px;
    color: #eee;
  }
`

const RoomDescription = styled.div`
  max-width: 500px;
  max-height: 150px;
  overflow-wrap: anywhere;
  overflow-y: auto;
  font-size: 16px;
  color: #c2c2c2;
  display: flex;
  justify-content: center;
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  margin: 36px 0;
  width: 300px;
`

const Bottom = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`

const Warning = styled.div`
  margin-top: 30px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
`

export default function LoginDialog() {
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const dispatch = useAppDispatch()
  const videoConnected = useAppSelector((state) => state.user.videoConnected)
  const roomJoined = useAppSelector((state) => state.room.roomJoined)
  const roomName = useAppSelector((state) => state.room.roomName) || 'Learniverse'
  const roomDescription = useAppSelector((state) => state.room.roomDescription) || 'Public Lobby'
  const game = phaserGame.scene.keys.game as Game

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    // Validation
    if (!username) {
      setError('Username is required')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }

    setIsLoading(true)

    try {
      console.log('Logging in with username:', username)

      // Join room with credentials
      await game.network.joinOrCreatePublic({
        username,
        password,
      })

      // If we get here, authentication succeeded
      // Avatar texture is set from the database by the server via Colyseus state sync
      game.registerKeys()
      game.myPlayer.setPlayerName(username)
      game.network.readyToConnect()
      dispatch(setLoggedIn(true))
    } catch (err: any) {
      console.error('Login error:', err)
      // Extract error message from Colyseus error
      const errorMessage = err.message || err.toString() || 'Login failed. Please check your credentials.'
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <Wrapper onSubmit={handleSubmit}>
      <Title>Joining</Title>
      <RoomName>
        <Avatar style={{ background: getColorByString(roomName) }}>
          {getAvatarString(roomName)}
        </Avatar>
        <h3>{roomName}</h3>
      </RoomName>
      <RoomDescription>
        <ArrowRightIcon /> {roomDescription}
      </RoomDescription>
      <Content>
        <TextField
          autoFocus
          fullWidth
          label="Username"
          variant="outlined"
          color="secondary"
          value={username}
          disabled={isLoading}
          onChange={(e) => setUsername(e.target.value)}
          style={{ marginBottom: '16px' }}
        />
        <TextField
          fullWidth
          type="password"
          label="Password"
          variant="outlined"
          color="secondary"
          value={password}
          disabled={isLoading}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <Warning>
            <Alert variant="outlined" severity="error">
              <AlertTitle>Error</AlertTitle>
              {error}
            </Alert>
          </Warning>
        )}
        {!error && !videoConnected && (
          <Warning>
            <Alert variant="outlined" severity="info">
              <AlertTitle>Tip</AlertTitle>
              Connect webcam for video chat!
            </Alert>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                game.network.webRTC?.getUserMedia()
              }}
            >
              Connect Webcam
            </Button>
          </Warning>
        )}
        {!error && videoConnected && (
          <Warning>
            <Alert variant="outlined" severity="success">Webcam connected!</Alert>
          </Warning>
        )}
      </Content>
      <Bottom>
        <Button
          variant="contained"
          color="secondary"
          size="large"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </Button>
      </Bottom>
    </Wrapper>
  )
}
