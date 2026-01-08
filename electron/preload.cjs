const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if running in Electron
  isElectron: () => ipcRenderer.invoke('is-electron'),

  // Get backend URL
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),

  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized')
  },

  // System theme
  theme: {
    getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
    onThemeChanged: (callback) => {
      ipcRenderer.on('theme-changed', (event, theme) => callback(theme));
    }
  },

  // Platform info
  platform: process.platform,

  // Version info
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});
