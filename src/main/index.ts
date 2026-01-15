import { app, BrowserWindow, Tray, globalShortcut, ipcMain, nativeImage, Menu, shell } from 'electron';
import * as path from 'path';
import { config } from 'dotenv';

// Load .env from project root
config({ path: path.join(__dirname, '../../.env') });

import { pluginRegistry } from '../core/types';
import { AppleNotesAdapter } from '../adapters/apple-notes';
import { cache } from '../core/cache';
import { SearchManager } from '../core/search-manager';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let searchManager: SearchManager | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    transparent: true,
    vibrancy: 'under-window',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('blur', () => mainWindow?.hide());
}

function toggleWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.center();
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADfSURBVDiNpZMxDoJAEEXfLhRaGBILOYEH8AZ6A2/gDbiBN/AGegNv4A08gTfQwthQkFgQCsYCFhZYwPiTSTY7O/P/zM4uOOeIoQDcgBrwBl7AE3g454ZfBRFJgQuwcs4NvwlE5AHcgJVzLv9NICIXYB2YbyMiN2AXmG8jIhdgH5hvIyJnYBuYbyMiJ+AQmG8jIkfgGJhvIyIH4BSYbyMie+AcmG8jIjvgEphvIyJb4BqYbyMiG+AWmG8jImvgHphvIyIr4BGYbyMiS+AZmG8jIgvgFZhvIyJz4B2YbyMiM+ATmP8FX8Y4Vf4AAAAASUVORK5CYII='
  );
  tray = new Tray(icon);
  tray.setToolTip('My Memory');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Search', click: toggleWindow },
    { label: 'Sync Now', click: syncNotes },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.on('click', toggleWindow);
}

async function syncNotes(): Promise<void> {
  tray?.setToolTip('My Memory - Syncing...');
  
  for (const adapter of pluginRegistry.getAll()) {
    try {
      const notes = await adapter.fetchAll();
      cache.clearSource(adapter.name);
      cache.upsertMany(notes);
      cache.setSyncState(adapter.name);
      console.log(`[Sync] ${notes.length} notes`);
    } catch (e) {
      console.error(`[Sync] Error:`, e);
    }
  }
  
  tray?.setToolTip('My Memory');
}

async function initializeApp(): Promise<void> {
  // Register adapters
  const appleNotes = new AppleNotesAdapter();
  pluginRegistry.register(appleNotes);
  
  // Initialize adapters and start watching
  await pluginRegistry.initializeAll();
  
  for (const adapter of pluginRegistry.getAll()) {
    adapter.watch(async (notes) => {
      cache.clearSource(adapter.name);
      cache.upsertMany(notes);
      cache.setSyncState(adapter.name);
    });
  }
  
  // Check if we have cached data
  const cachedNotes = cache.getAllNotes();
  if (cachedNotes.length > 0) {
    console.log(`[Cache] ${cachedNotes.length} notes loaded`);
    setTimeout(() => syncNotes(), 2000);
  } else {
    await syncNotes();
  }
  
  // Initialize search manager
  searchManager = new SearchManager();
  await searchManager.initialize();
}

app.whenReady().then(async () => {
  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Shift+Space', toggleWindow);
  await initializeApp();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  pluginRegistry.stopAll();
  searchManager?.stop();
});

app.on('window-all-closed', (e: Event) => e.preventDefault());

// IPC handlers
ipcMain.handle('search', async (_event, query: string) => {
  if (!searchManager) return [];
  return searchManager.search(query);
});

ipcMain.handle('search-local', async (_event, query: string) => {
  if (!searchManager) return [];
  return searchManager.searchLocal(query);
});

ipcMain.on('open-note', (_event, noteId: string) => {
  // Extract Apple Notes ID and open via URL scheme
  const sourceId = noteId.replace('apple-notes:', '');
  shell.openExternal(`notes://showNote?identifier=${encodeURIComponent(sourceId)}`);
});
