'use strict';

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');

// Keep a global reference so it isn't garbage-collected
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          720,
    minWidth:        800,
    minHeight:       500,
    title:           'Dodge Dash Legends',
    icon:            path.join(__dirname, 'game', 'icons', 'icon-512.png'),
    backgroundColor: '#0a0a0f',
    // Start maximised for a true fullscreen-like feel
    show: false,
    webPreferences: {
      preload:              path.join(__dirname, 'preload.js'),
      contextIsolation:     true,
      nodeIntegration:      false,
      sandbox:              true,
      webSecurity:          true,
    },
  });

  // Load the game
  mainWindow.loadFile(path.join(__dirname, 'game', 'index.html'));

  // Show once ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Application menu (minimal) ────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'Game',
      submenu: [
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          },
        },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload',         accelerator: 'CmdOrCtrl+R',       role: 'reload' },
        { label: 'Force Reload',   accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Zoom In',        accelerator: 'CmdOrCtrl+=',        role: 'zoomIn' },
        { label: 'Zoom Out',       accelerator: 'CmdOrCtrl+-',        role: 'zoomOut' },
        { label: 'Reset Zoom',     accelerator: 'CmdOrCtrl+0',        role: 'resetZoom' },
      ],
    },
  ];

  // Add DevTools only in dev mode
  if (!app.isPackaged) {
    template[1].submenu.push(
      { type: 'separator' },
      { label: 'DevTools', accelerator: 'F12', role: 'toggleDevTools' }
    );
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Electron lifecycle ────────────────────────────────────
app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
