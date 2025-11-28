import React, { useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import StarIcon from '@mui/icons-material/Star'
import { useAppSelector, useAppDispatch } from '../hooks'
import { hideNotification } from '../stores/PointStore'

const slideIn = keyframes`
  0% {
    transform: translateX(-50%) translateY(-100px);
    opacity: 0;
  }
  100% {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
`

const slideOut = keyframes`
  0% {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateX(-50%) translateY(-100px);
    opacity: 0;
  }
`

const Backdrop = styled.div<{ $isVisible: boolean; $isAnimatingOut: boolean }>`
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  animation: ${({ $isVisible, $isAnimatingOut }) =>
    $isAnimatingOut ? slideOut : $isVisible ? slideIn : 'none'} 0.3s ease-out forwards;
  pointer-events: none;
  visibility: ${({ $isVisible, $isAnimatingOut }) =>
    $isVisible || $isAnimatingOut ? 'visible' : 'hidden'};
`

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%);
  border: 3px solid #ffd700;
  border-radius: 16px;
  padding: 20px 40px;
  box-shadow: 0 8px 32px rgba(255, 215, 0, 0.4);
`

const Title = styled.h3`
  color: #ffd700;
  font-size: 18px;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 2px;
`

const PointsEarned = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-size: 32px;
  font-weight: bold;
`

const Reason = styled.p`
  color: #aaaaaa;
  font-size: 14px;
  margin: 8px 0 0 0;
`

const NOTIFICATION_DURATION = 3000 // 3 seconds
const ANIMATION_DURATION = 300 // 0.3s in ms

export default function PointsNotification() {
  const dispatch = useAppDispatch()
  const showNotification = useAppSelector((state) => state.points.showNotification)
  const currentNotification = useAppSelector((state) => state.points.currentNotification)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)
  const [displayedNotification, setDisplayedNotification] = useState(currentNotification)

  // Update displayed notification when a new one arrives
  useEffect(() => {
    if (currentNotification && showNotification) {
      setDisplayedNotification(currentNotification)
    }
  }, [currentNotification, showNotification])

  // Handle show/hide timer - removed currentNotification from deps to prevent timer resets
  useEffect(() => {
    if (showNotification) {
      setIsAnimatingOut(false)
      const timer = setTimeout(() => {
        setIsAnimatingOut(true)
        // Wait for animation to complete before dispatching hide
        setTimeout(() => {
          dispatch(hideNotification())
          setIsAnimatingOut(false)
        }, ANIMATION_DURATION)
      }, NOTIFICATION_DURATION)
      return () => clearTimeout(timer)
    }
  }, [showNotification, dispatch])

  // Don't render if nothing to show
  if (!displayedNotification && !showNotification) return null

  return (
    <Backdrop
      $isVisible={showNotification}
      $isAnimatingOut={isAnimatingOut}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Container>
        <Title>Points Earned!</Title>
        <PointsEarned>
          <StarIcon style={{ color: '#ffd700', fontSize: 36 }} aria-hidden="true" />
          <span aria-label={`Plus ${displayedNotification?.pointsEarned ?? 0} points`}>
            +{displayedNotification?.pointsEarned ?? 0}
          </span>
        </PointsEarned>
        <Reason>{displayedNotification?.reason ?? ''}</Reason>
      </Container>
    </Backdrop>
  )
}
