import 'regenerator-runtime/runtime'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { ThemeProvider } from '@mui/material/styles'

import './index.scss'
import './PhaserGame'
import muiTheme from './MuiTheme'
import App from './App'
import store from './stores'
import OpenReplayTracker from './services/OpenReplayTracker'

// Initialize OpenReplay
const projectKey = import.meta.env.VITE_OPENREPLAY_PROJECT_KEY
if (projectKey) {
  OpenReplayTracker.init(projectKey)
  OpenReplayTracker.start()
  console.log('OpenReplay session recording started')
} else {
  console.warn('OpenReplay project key not found. Session recording disabled.')
}

const container = document.getElementById('root')
const root = createRoot(container!)
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={muiTheme}>
        <App />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
)
