const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let backendProcess = null;
const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = process.env.PORT || 3000;
const FRONTEND_DEV_PORT = 5173;

// Window state persistence
const windowStateFile = path.join(app.getPath('userData'), 'window-state.json');

function saveWindowState() {
  if (!mainWindow) return;

  const bounds = mainWindow.getBounds();
  const state = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized: mainWindow.isMaximized()
  };

  try {
    fs.writeFileSync(windowStateFile, JSON.stringify(state));
  } catch (e) {
    console.error('[Electron] Failed to save window state:', e);
  }
}

function loadWindowState() {
  try {
    if (fs.existsSync(windowStateFile)) {
      const data = fs.readFileSync(windowStateFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[Electron] Failed to load window state:', e);
  }

  // Default state
  return {
    width: 1400,
    height: 900,
    x: undefined,
    y: undefined,
    isMaximized: false
  };
}

// Backend server management
function startBackend() {
  return new Promise((resolve, reject) => {
    console.log('[Electron] Starting backend server...');

    // In development, use tsx watch. In production, use node
    const command = isDev ? 'npx' : 'node';
    const args = isDev
      ? ['tsx', 'src/server.ts']
      : [path.join(__dirname, '..', 'dist', 'server.js')];

    backendProcess = spawn(command, args, {
      env: { ...process.env, PORT: BACKEND_PORT },
      stdio: 'inherit',
      shell: true
    });

    backendProcess.on('error', (err) => {
      console.error('[Electron] Backend process error:', err);
      reject(err);
    });

    backendProcess.on('exit', (code) => {
      console.log(`[Electron] Backend process exited with code ${code}`);
    });

    // Wait for backend to be ready
    const checkBackend = () => {
      http.get(`http://localhost:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('[Electron] Backend is ready');
          resolve();
        } else {
          setTimeout(checkBackend, 500);
        }
      }).on('error', () => {
        setTimeout(checkBackend, 500);
      });
    };

    setTimeout(checkBackend, 1000);
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('[Electron] Stopping backend server...');
    backendProcess.kill();
    backendProcess = null;
  }
}

// Application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Scan Emails',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-scan-emails');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-preferences');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (mainWindow) mainWindow.close();
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/discoverNorman/email-ollama-cleaner');
          }
        },
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/discoverNorman/email-ollama-cleaner#readme');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Email Ollama Cleaner',
              message: 'Email Ollama Cleaner',
              detail: `Version: 1.0.0\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode.js: ${process.versions.node}\n\nBuilt with Claude Code\n\n© 2026 norman`
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        {
          label: 'About ' + app.name,
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Email Ollama Cleaner',
              message: 'Email Ollama Cleaner',
              detail: `Version: 1.0.0\n\nBuilt with Claude Code\n\n© 2026 norman`
            });
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Window management
function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const windowState = loadWindowState();

  const windowOptions = {
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 1000,
    minHeight: 700,
    frame: false, // Frameless window for custom titlebar
    transparent: false, // Keep false for better performance
    backgroundColor: '#f0fdf4', // Match the app gradient
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    title: 'Email Ollama Cleaner',
    titleBarStyle: 'hidden', // macOS: hide titlebar but keep traffic lights
    trafficLightPosition: { x: 10, y: 10 }, // macOS: position traffic lights
    vibrancy: 'under-window', // macOS: beautiful blur effect
    visualEffectState: 'active', // macOS: always show vibrancy
    show: false, // Don't show until ready (prevents flash)
    roundedCorners: true
  };

  // Platform-specific settings
  if (process.platform === 'win32') {
    // Windows: Acrylic blur effect (Windows 10+)
    windowOptions.backgroundMaterial = 'acrylic';
  }

  // Add icon if it exists
  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Show window with fade-in animation once ready
  mainWindow.once('ready-to-show', () => {
    // Restore maximized state
    if (windowState.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  // Save window state on resize and move
  let saveStateTimeout;
  const debouncedSaveState = () => {
    clearTimeout(saveStateTimeout);
    saveStateTimeout = setTimeout(saveWindowState, 500);
  };

  mainWindow.on('resize', debouncedSaveState);
  mainWindow.on('move', debouncedSaveState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  // Load the frontend
  const frontendUrl = isDev
    ? `http://localhost:${FRONTEND_DEV_PORT}`
    : `http://localhost:${BACKEND_PORT}`;

  console.log(`[Electron] Loading frontend from: ${frontendUrl}`);
  mainWindow.loadURL(frontendUrl);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// System tray
function createTray() {
  // Check if tray icon exists
  const fs = require('fs');
  const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');

  if (!fs.existsSync(trayIconPath)) {
    console.log('[Electron] Tray icon not found, skipping tray creation');
    console.log('[Electron] Add icons to electron/assets/ directory for tray support');
    return;
  }

  try {
    tray = new Tray(trayIconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Open in Browser',
      click: () => {
        require('electron').shell.openExternal(`http://localhost:${BACKEND_PORT}`);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Email Ollama Cleaner');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  } catch (error) {
    console.error('[Electron] Failed to create tray:', error);
    console.log('[Electron] App will continue without system tray');
  }
}

// IPC handlers
ipcMain.handle('get-backend-url', () => {
  return `http://localhost:${BACKEND_PORT}`;
});

ipcMain.handle('is-electron', () => {
  return true;
});

// Window control handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// System theme detection
const { nativeTheme } = require('electron');

ipcMain.handle('get-system-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

// Listen for theme changes
nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  }
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Start backend first
    await startBackend();

    // Create menu, window and tray
    createMenu();
    createWindow();
    createTray();

    console.log('[Electron] App is ready');
  } catch (error) {
    console.error('[Electron] Failed to start app:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On macOS, keep app running in tray
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Electron] Uncaught exception:', error);
});
