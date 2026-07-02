const { app, BrowserWindow, shell, ipcMain, Menu, Tray, nativeImage, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ─── Constants ───────────────────────────────────────────────────────────────
const SERVER_PORT = 3000;
const USER_DATA_DIR = app.getPath('userData');
const STATE_FILE = path.join(USER_DATA_DIR, 'window-state.json');
const DB_FILE = path.join(USER_DATA_DIR, 'printex.db');

let mainWindow = null;
let tray = null;
let serverProcess = null;
let serverReady = false;

// ─── Window State ─────────────────────────────────────────────────────────────
function loadWindowState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return { width: 1400, height: 900, maximized: true };
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    const state = {
      ...bounds,
      maximized: mainWindow.isMaximized()
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

// ─── Wait for Server ──────────────────────────────────────────────────────────
function waitForServer(retries = 40, delay = 500) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(`http://localhost:${SERVER_PORT}/api/status`, (res) => {
        if (res.statusCode < 500) { serverReady = true; resolve(); }
        else { retry(n); }
      });
      req.on('error', () => retry(n));
      req.setTimeout(500, () => { req.destroy(); retry(n); });
    };
    const retry = (n) => {
      if (n <= 0) return reject(new Error('Server did not start in time'));
      setTimeout(() => attempt(n - 1), delay);
    };
    attempt(retries);
  });
}

// ─── Start Express Server ─────────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve) => {
    // Copy database to user data directory if it doesn't exist
    const bundledDb = path.join(process.resourcesPath, 'printex.db');
    if (!fs.existsSync(DB_FILE) && fs.existsSync(bundledDb)) {
      fs.copyFileSync(bundledDb, DB_FILE);
      console.log('[Electron] Copied bundled DB to user data dir.');
    }

    // Determine path to bundled server
    const serverPath = app.isPackaged
      ? path.join(process.resourcesPath, 'server.cjs')
      : path.join(__dirname, 'dist', 'server.cjs');

    if (!fs.existsSync(serverPath)) {
      console.warn('[Electron] server.cjs not found at', serverPath, '— will try tsx dev server');
      // Development fallback: run tsx server.ts
      serverProcess = spawn('npx', ['tsx', path.join(__dirname, 'server.ts')], {
        env: { ...process.env, PORT: SERVER_PORT, DB_PATH: DB_FILE, NODE_ENV: 'development' },
        cwd: __dirname,
        stdio: 'pipe',
        shell: true
      });
    } else {
      serverProcess = spawn('node', [serverPath], {
        env: { ...process.env, PORT: SERVER_PORT, DB_PATH: DB_FILE, NODE_ENV: 'production' },
        stdio: 'pipe'
      });
    }

    serverProcess.stdout.on('data', (data) => console.log('[Server]', data.toString().trim()));
    serverProcess.stderr.on('data', (data) => console.error('[Server Error]', data.toString().trim()));
    serverProcess.on('exit', (code) => console.log('[Server] Exited with code', code));

    // Resolve immediately — waitForServer will poll readiness
    resolve();
  });
}

// ─── Create Browser Window ────────────────────────────────────────────────────
async function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width || 1400,
    height: state.height || 900,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#0d0d0d',
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.cjs'),
      spellcheck: false
    }
  });

  // Restore maximized state
  if (state.maximized) mainWindow.maximize();

  // Show loading screen while server starts
  mainWindow.loadFile(path.join(__dirname, 'electron-loading.html'));
  mainWindow.show();

  // Wait for server, then load app
  try {
    await startServer();
    await waitForServer();
    await mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
    console.log('[Electron] App loaded successfully.');
  } catch (err) {
    console.error('[Electron] Server startup failed:', err);
    dialog.showErrorBox('Printex Startup Error', `The Printex server failed to start.\n\n${err.message}\n\nPlease ensure the application is not already running.`);
    app.quit();
    return;
  }

  // Save state on close/resize
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('close', (e) => {
    saveWindowState();
    // Minimize to tray on close instead of quitting
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ─── System Tray ─────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'public', 'favicon.ico');
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: '🖨️ Open Printex', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit Printex', click: () => { app.isQuiting = true; app.quit(); } }
  ]);

  tray.setToolTip('Printex Business System');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ─── App Menu ─────────────────────────────────────────────────────────────────
function buildAppMenu() {
  const template = [
    {
      label: 'Printex',
      submenu: [
        { label: 'About Printex', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { app.isQuiting = true; app.quit(); } }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow && mainWindow.reload() },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow && mainWindow.webContents.reloadIgnoringCache() },
        { label: 'Toggle Developer Tools', accelerator: 'F12', click: () => mainWindow && mainWindow.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Actual Size', role: 'resetZoom' },
        { label: 'Zoom In', role: 'zoomIn' },
        { label: 'Zoom Out', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', role: 'minimize' },
        { label: 'Zoom', role: 'zoom' },
        { type: 'separator' },
        { label: 'Bring All to Front', role: 'front' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-user-data-path', () => USER_DATA_DIR);
ipcMain.handle('get-db-path', () => DB_FILE);
ipcMain.handle('show-window', () => { mainWindow.show(); mainWindow.focus(); });
ipcMain.handle('minimize-window', () => mainWindow.minimize());
ipcMain.handle('maximize-window', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('close-window', () => mainWindow.hide());
ipcMain.handle('open-external', (event, url) => shell.openExternal(url));

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  buildAppMenu();
  await createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('window-all-closed', () => {
  // On Windows, keep running in tray
  if (process.platform !== 'darwin') {
    // do not quit — stay in tray
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  saveWindowState();
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
