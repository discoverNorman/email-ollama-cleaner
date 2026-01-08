const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let tray = null;
let backendProcess = null;
const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = process.env.PORT || 3000;
const FRONTEND_DEV_PORT = 5173;

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

// Window management
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Email Ollama Cleaner',
    autoHideMenuBar: true
  });

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
  // Create a simple colored square as tray icon (you can replace with actual icon)
  tray = new Tray(path.join(__dirname, 'tray-icon.png'));

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
}

// IPC handlers
ipcMain.handle('get-backend-url', () => {
  return `http://localhost:${BACKEND_PORT}`;
});

ipcMain.handle('is-electron', () => {
  return true;
});

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Start backend first
    await startBackend();

    // Create window and tray
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
