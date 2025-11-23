import React, { useRef, useState, useEffect } from 'react'
import styled from 'styled-components'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon'
import CloseIcon from '@mui/icons-material/Close'
import 'emoji-mart/css/emoji-mart.css'
import { Picker } from 'emoji-mart'

import phaserGame from '../PhaserGame'
import Game from '../scenes/Game'

import { getColorByString } from '../util'
import { useAppDispatch, useAppSelector } from '../hooks'
import { setFocused, endNpcChat } from '../stores/ChatStore'

const Backdrop = styled.div`
  position: fixed;
  bottom: 60px;
  left: 0;
  height: 400px;
  width: 500px;
  max-height: 50%;
  max-width: 100%;
`

const Wrapper = styled.div`
  position: relative;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
`

const ChatHeader = styled.div`
  position: relative;
  height: 35px;
  background: #000000a7;
  border-radius: 10px 10px 0px 0px;

  h3 {
    color: #ffd700;
    margin: 7px;
    font-size: 17px;
    text-align: center;
  }

  .close {
    position: absolute;
    top: 0;
    right: 0;
  }
`

const ChatBox = styled(Box)`
  height: 100%;
  width: 100%;
  overflow: auto;
  background: #2c2c2c;
  border: 1px solid #00000029;
`

const MessageWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  padding: 0px 2px;

  p {
    margin: 3px;
    text-shadow: 0.3px 0.3px black;
    font-size: 15px;
    font-weight: bold;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  span {
    color: white;
    font-weight: normal;
  }

  :hover {
    background: #3a3a3a;
  }
`

const InputWrapper = styled.form`
  box-shadow: 10px 10px 10px #00000018;
  border: 1px solid #ffd700;
  border-radius: 0px 0px 10px 10px;
  display: flex;
  flex-direction: row;
  background: linear-gradient(180deg, #000000c1, #242424c0);
`

const InputTextField = styled(InputBase)`
  border-radius: 0px 0px 10px 10px;
  input {
    padding: 5px;
  }
`

const EmojiPickerWrapper = styled.div`
  position: absolute;
  bottom: 54px;
  right: 16px;
`

const dateFormatter = new Intl.DateTimeFormat('en', {
  timeStyle: 'short',
  dateStyle: 'short',
})

const Message = ({ message }) => {
  const [tooltipOpen, setTooltipOpen] = useState(false)

  return (
    <MessageWrapper
      onMouseEnter={() => {
        setTooltipOpen(true)
      }}
      onMouseLeave={() => {
        setTooltipOpen(false)
      }}
    >
      <Tooltip
        open={tooltipOpen}
        title={dateFormatter.format(message.createdAt)}
        placement="right"
        arrow
      >
        <p
          style={{
            color: message.isNpc ? '#ffd700' : getColorByString(message.author),
          }}
        >
          {message.author}: <span>{message.content}</span>
        </p>
      </Tooltip>
    </MessageWrapper>
  )
}

export default function NpcChat() {
  const [inputValue, setInputValue] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [readyToSubmit, setReadyToSubmit] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const npcChatMessages = useAppSelector((state) => state.chat.npcChatMessages)
  const currentNpcId = useAppSelector((state) => state.chat.currentNpcId)
  const currentNpcName = useAppSelector((state) => state.chat.currentNpcName)
  const focused = useAppSelector((state) => state.chat.focused)
  const showChat = useAppSelector((state) => state.chat.showChat)
  const inConversation = useAppSelector((state) => state.chat.inConversation)
  const dispatch = useAppDispatch()
  const game = phaserGame.scene.keys.game as Game

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      // move focus back to the game and close chat
      inputRef.current?.blur()
      if (currentNpcId) {
        game.network.endNpcConversation(currentNpcId)
      }
      dispatch(endNpcChat())
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!readyToSubmit) {
      setReadyToSubmit(true)
      return
    }
    // move focus back to the game
    inputRef.current?.blur()

    const val = inputValue.trim()
    setInputValue('')
    if (val && currentNpcId) {
      game.network.sendNpcMessage(currentNpcId, val)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleClose = () => {
    if (currentNpcId) {
      game.network.endNpcConversation(currentNpcId)
    }
    dispatch(endNpcChat())
  }

  useEffect(() => {
    if (focused) {
      inputRef.current?.focus()
    }
  }, [focused])

  useEffect(() => {
    scrollToBottom()
  }, [npcChatMessages, showChat])

  if (!showChat || !inConversation) {
    return null
  }

  return (
    <Backdrop>
      <Wrapper>
        <ChatHeader>
          <h3>{currentNpcName || 'NPC Chat'}</h3>
          <IconButton
            aria-label="close dialog"
            className="close"
            onClick={handleClose}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </ChatHeader>
        <ChatBox>
          {npcChatMessages.map((message, index) => (
            <Message message={message} key={index} />
          ))}
          <div ref={messagesEndRef} />
          {showEmojiPicker && (
            <EmojiPickerWrapper>
              <Picker
                theme="dark"
                showSkinTones={false}
                showPreview={false}
                onSelect={(emoji) => {
                  setInputValue(inputValue + emoji.native)
                  setShowEmojiPicker(!showEmojiPicker)
                  dispatch(setFocused(true))
                }}
                exclude={['recent', 'flags']}
              />
            </EmojiPickerWrapper>
          )}
        </ChatBox>
        <InputWrapper onSubmit={handleSubmit}>
          <InputTextField
            inputRef={inputRef}
            autoFocus={focused}
            fullWidth
            placeholder="Press Enter to send message"
            value={inputValue}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
            onFocus={() => {
              if (!focused) {
                dispatch(setFocused(true))
                setReadyToSubmit(true)
              }
            }}
            onBlur={() => {
              dispatch(setFocused(false))
              setReadyToSubmit(false)
            }}
          />
          <IconButton aria-label="emoji" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
            <InsertEmoticonIcon />
          </IconButton>
        </InputWrapper>
      </Wrapper>
    </Backdrop>
  )
}
