import React, { useState } from 'react'
import styled from 'styled-components'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'

import { useAppDispatch } from '../hooks'
import { setLoggedIn } from '../stores/UserStore'
import { setRoomJoined } from '../stores/RoomStore'

import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'
import Bootstrap from '../scenes/Bootstrap'

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

const Title = styled.h1`
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #eee;
  text-align: center;
  font-weight: 500;
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

      // Get bootstrap scene which has the network
      const bootstrap = phaserGame.scene.keys.bootstrap as Bootstrap

      // Join room with credentials using bootstrap's network
      await bootstrap.network.joinOrCreatePublic({
        username,
        password,
      })

      // If we get here, authentication succeeded
      // Launch game scene (this passes the network to the Game scene)
      bootstrap.launchGame()
      dispatch(setRoomJoined(true))

      // Wait for the game scene to be fully created before accessing myPlayer
      // Use a small delay to ensure the scene is instantiated after launch/start
      const waitForGameScene = () => {
        const game = phaserGame.scene.keys.game as Game
        if (game && game.events) {
          game.events.once('create', () => {
            // Avatar texture is set from the database by the server via Colyseus state sync
            game.registerKeys()
            game.myPlayer.setPlayerName(username)
            dispatch(setLoggedIn(true))
          })
        } else {
          // Scene not ready yet, wait and retry
          setTimeout(waitForGameScene, 50)
        }
      }
      waitForGameScene()
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
      <Title>Welcome to Learniverse</Title>
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
