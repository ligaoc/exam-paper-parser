/**
 * Electron API wrapper for renderer process
 * Communicates with main process via IPC
 * 
 * To add new APIs:
 * 1. Add the method in preload.js
 * 2. Register the handler in ipcHandlers.js
 * 3. Export the wrapper function here
 */

// Check if running in Electron or browser
const isElectron = typeof window !== 'undefined' && window.electronAPI

/**
 * Get application info
 * Demonstrates basic IPC communication pattern
 */
export async function getAppInfo() {
  if (isElectron) {
    return await window.electronAPI.getAppInfo()
  }
  // Fallback for web mode
  return {
    name: 'Electron App (Web Mode)',
    version: '1.0.0',
    electron: 'N/A',
    node: 'N/A',
    chrome: navigator.userAgent
  }
}

/**
 * Web server control APIs
 */
export const webServer = {
  start: async (port) => {
    if (isElectron) {
      return await window.electronAPI.webServer.start(port)
    }
    throw new Error('Web 模式不支持此操作')
  },
  
  stop: async () => {
    if (isElectron) {
      return await window.electronAPI.webServer.stop()
    }
    throw new Error('Web 模式不支持此操作')
  },
  
  getStatus: async () => {
    if (isElectron) {
      return await window.electronAPI.webServer.getStatus()
    }
    return {
      running: false,
      port: 3000,
      addresses: [],
      error: 'Web 模式不支持此操作'
    }
  }
}

/**
 * Check if running in web mode (via embedded web server)
 */
export function isWebMode() {
  return !isElectron
}

// Add your custom API wrappers here:
// export async function myCustomApi(params) {
//   if (isElectron) {
//     return await window.electronAPI.myCustomApi(params)
//   }
//   // Fallback for web mode or throw error
// }
