/**
 * Web Server Service
 * Manages embedded HTTP server for remote access using Express
 * 
 * This service provides:
 * - Static file serving for the renderer build
 * - Health check endpoint
 * - Local network access to the application
 */

const express = require('express')
const cors = require('cors')
const path = require('path')
const os = require('os')
const http = require('http')

// Default configuration
const DEFAULT_PORT = 3000
const MIN_PORT = 1024
const MAX_PORT = 65535

/**
 * Validate port number
 * @param {number} port - Port number to validate
 * @returns {boolean} True if valid
 */
function validatePort(port) {
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT
}

/**
 * Get local network addresses
 * @returns {string[]} Array of local IP addresses
 */
function getLocalAddresses() {
  const interfaces = os.networkInterfaces()
  const addresses = []

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address)
      }
    }
  }

  if (!addresses.includes('127.0.0.1')) {
    addresses.unshift('127.0.0.1')
  }

  return addresses
}

class WebServerService {
  constructor() {
    this.app = null
    this.server = null
    this.port = DEFAULT_PORT
    this.running = false
    this.error = null
  }

  /**
   * Start the HTTP server
   * @param {number} port - Port to listen on
   * @returns {Promise<{running: boolean, port: number, addresses: string[], error: string|null}>}
   */
  async start(port = DEFAULT_PORT) {
    if (!validatePort(port)) {
      this.error = `端口号必须在 ${MIN_PORT}-${MAX_PORT} 之间`
      return this.getStatus()
    }

    if (this.running) {
      await this.stop()
    }

    this.port = port
    this.error = null

    try {
      this.app = express()

      // Middleware
      this.app.use(cors())
      this.app.use(express.json())

      // Health check endpoint
      this.app.get('/api/health', (req, res) => {
        res.json({ success: true, data: { status: 'ok' } })
      })

      // Static files - serve renderer build (dist/renderer)
      const rendererPath = path.join(__dirname, '../../../dist/renderer')
      this.app.use(express.static(rendererPath))

      // SPA fallback
      this.app.use((req, res, next) => {
        if (req.path.startsWith('/api/')) {
          res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '接口不存在' } })
        } else {
          res.sendFile(path.join(rendererPath, 'index.html'))
        }
      })

      // Start server
      await new Promise((resolve, reject) => {
        this.server = http.createServer(this.app)
        this.server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            reject(new Error(`端口 ${this.port} 已被占用，请尝试端口 ${this.port + 1}`))
          } else {
            reject(err)
          }
        })
        this.server.listen(this.port, '0.0.0.0', () => {
          resolve()
        })
      })

      this.running = true
    } catch (err) {
      this.running = false
      this.error = err.message || '服务器启动失败'
      this.app = null
      this.server = null
    }

    return this.getStatus()
  }

  /**
   * Stop the HTTP server
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(() => resolve())
      })
      this.server = null
    }
    this.app = null
    this.running = false
    this.error = null
  }

  /**
   * Get current server status
   * @returns {{running: boolean, port: number, addresses: string[], error: string|null}}
   */
  getStatus() {
    const addresses = this.running
      ? getLocalAddresses().map((addr) => `http://${addr}:${this.port}`)
      : []

    return {
      running: this.running,
      port: this.port,
      addresses,
      error: this.error
    }
  }
}

// Singleton instance
let instance = null

function getWebServerService() {
  if (!instance) {
    instance = new WebServerService()
  }
  return instance
}

module.exports = {
  getWebServerService,
  validatePort,
  getLocalAddresses,
  DEFAULT_PORT,
  MIN_PORT,
  MAX_PORT
}
