import Tracker from '@openreplay/tracker'
import trackerRedux from '@openreplay/tracker-redux'

class OpenReplayTracker {
  private tracker: Tracker | null = null
  private initialized = false

  /**
   * Initialize the OpenReplay tracker
   * @param projectKey - Your OpenReplay project key from the dashboard
   */
  init(projectKey: string) {
    if (this.initialized) {
      console.warn('OpenReplay tracker already initialized')
      return this.tracker
    }

    if (!projectKey) {
      console.error('OpenReplay project key is required')
      return null
    }

    try {
      this.tracker = new Tracker({
        projectKey,
        // Canvas recording - enables recording of Phaser3 game
        // Note: This is resource-intensive and may impact performance
        // recordCanvas: true,
        // canvasFPS: 4, // Low FPS for canvas recording (default is 4)
        // canvasQuality: 'low', // Canvas quality: 'low' | 'medium' | 'high'

        // Privacy settings
        obscureTextEmails: true,
        obscureTextNumbers: false,
        obscureInputEmails: true,

        // Performance settings
        capturePerformance: true,

        // Network settings
        network: {
          capturePayload: true, // Capture request/response payloads
          failuresOnly: false,
          sessionTokenHeader: false,
          ignoreHeaders: [],
          captureInIframes: true,
        },

        // Console logs
        consoleMethods: ['log', 'info', 'warn', 'error'],
        consoleThrottling: 30,

        // Development settings
        __DISABLE_SECURE_MODE: process.env.NODE_ENV === 'development',
      })

      this.initialized = true
      console.log('OpenReplay tracker initialized successfully')

      return this.tracker
    } catch (error) {
      console.error('Failed to initialize OpenReplay tracker:', error)
      return null
    }
  }

  /**
   * Start recording a session
   */
  start() {
    if (!this.tracker) {
      console.warn('OpenReplay tracker not initialized. Call init() first.')
      return
    }

    try {
      this.tracker.start()
      console.log('OpenReplay session started')
    } catch (error) {
      console.error('Failed to start OpenReplay session:', error)
    }
  }

  /**
   * Stop recording the current session
   */
  stop() {
    if (!this.tracker) {
      console.warn('OpenReplay tracker not initialized')
      return
    }

    try {
      this.tracker.stop()
      console.log('OpenReplay session stopped')
    } catch (error) {
      console.error('Failed to stop OpenReplay session:', error)
    }
  }

  /**
   * Set user information for the session
   */
  setUserInfo(userId: string, username?: string, email?: string) {
    if (!this.tracker) {
      console.warn('OpenReplay tracker not initialized')
      return
    }

    try {
      this.tracker.setUserID(userId)

      if (username || email) {
        this.tracker.setMetadata('username', username || '')
        if (email) {
          this.tracker.setMetadata('email', email)
        }
      }

      console.log('OpenReplay user info set:', userId)
    } catch (error) {
      console.error('Failed to set user info:', error)
    }
  }

  /**
   * Track a custom event
   */
  trackEvent(eventName: string, payload?: Record<string, any>) {
    if (!this.tracker) {
      console.warn('OpenReplay tracker not initialized')
      return
    }

    try {
      this.tracker.event(eventName, payload)
    } catch (error) {
      console.error('Failed to track event:', error)
    }
  }

  /**
   * Add custom metadata to the session
   */
  setMetadata(key: string, value: string | number | boolean) {
    if (!this.tracker) {
      console.warn('OpenReplay tracker not initialized')
      return
    }

    try {
      this.tracker.setMetadata(key, String(value))
    } catch (error) {
      console.error('Failed to set metadata:', error)
    }
  }

  /**
   * Get Redux plugin for store integration
   */
  getReduxPlugin() {
    return trackerRedux()
  }

  /**
   * Get the tracker instance
   */
  getTracker() {
    return this.tracker
  }

  /**
   * Check if tracker is initialized
   */
  isInitialized() {
    return this.initialized
  }
}

// Export singleton instance
export default new OpenReplayTracker()
