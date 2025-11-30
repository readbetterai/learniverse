import React from 'react'
import styled from 'styled-components'
import CircularProgress from '@mui/material/CircularProgress'

const Wrapper = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #222639;
  border-radius: 16px;
  padding: 48px 60px;
  box-shadow: 0px 0px 5px #0000006f;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`

const Title = styled.h1`
  margin: 0;
  font-size: 24px;
  color: #eee;
  text-align: center;
  font-weight: 500;
`

const Subtitle = styled.p`
  margin: 0;
  font-size: 14px;
  color: #aaa;
  text-align: center;
`

interface ReconnectingDialogProps {
  username?: string | null
}

export default function ReconnectingDialog({ username }: ReconnectingDialogProps) {
  return (
    <Wrapper>
      <CircularProgress color="secondary" size={48} />
      <Title>Reconnecting...</Title>
      <Subtitle>
        {username ? `Welcome back, ${username}!` : 'Please wait while we restore your session'}
      </Subtitle>
    </Wrapper>
  )
}
