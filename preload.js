'use strict';

// Preload runs in a sandboxed renderer with contextIsolation=true.
// Expose only the bare minimum to the game page via the context bridge.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Platform string so the game can show "Press F11 for fullscreen" on desktop
  platform: process.platform,

  // Let the game page request fullscreen toggle
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
});
