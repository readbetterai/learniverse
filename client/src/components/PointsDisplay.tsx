import React from 'react'
import styled from 'styled-components'
import StarIcon from '@mui/icons-material/Star'
import { useAppSelector } from '../hooks'

const Container = styled.div`
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 2px solid #ffd700;
  border-radius: 20px;
  padding: 8px 16px;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
  z-index: 1000;
`

const StarIconStyled = styled(StarIcon)`
  color: #ffd700;
  font-size: 24px;
  filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.5));
`

const PointsText = styled.span`
  color: #ffffff;
  font-size: 18px;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
`

export default function PointsDisplay() {
  const totalPoints = useAppSelector((state) => state.points.totalPoints)
  const loggedIn = useAppSelector((state) => state.user.loggedIn)

  // Only show when logged in
  if (!loggedIn) return null

  return (
    <Container role="status" aria-label={`You have ${totalPoints.toLocaleString()} points`}>
      <StarIconStyled aria-hidden="true" />
      <PointsText>{(totalPoints ?? 0).toLocaleString()}</PointsText>
    </Container>
  )
}
