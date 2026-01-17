/**
 * Electron main process.
 * Handles window management, tray, global shortcuts, and IPC.
 */

import {
  app,
  BrowserWindow,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  Menu,
  shell
} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: path.join(__dirname, '../../.env') });

import { pluginRegistry } from '../core/types';
import { AppleNotesAdapter } from '../adapters/apple-notes';
import { cache } from '../core/cache';
import { SearchManager } from '../core/search-manager';

// Application state
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const searchManager = new SearchManager();

/** Create the main search window */
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

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (typeof message !== 'string') return;
    const isTagged = message.startsWith('[Renderer]') || message.startsWith('[Preload]');
    const isLikelyError =
      level >= 2 ||
      message.includes('Uncaught') ||
      message.includes('ERR_') ||
      message.includes('Failed to load resource');
    if (!isTagged && !isLikelyError) return;
    const location =
      typeof sourceId === 'string' && sourceId.length > 0 ? `${path.basename(sourceId)}:${line}` : '';
    const formatted = location ? `${message} (${location})` : message;
    if (isLikelyError) console.error(formatted);
    else console.log(formatted);
  });

  (mainWindow.webContents as any).on?.('preload-error', (_event: unknown, preloadPath: string, error: unknown) => {
    console.error('[Preload] Error loading:', preloadPath, error);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Window] did-fail-load', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Window] render-process-gone', details);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow?.webContents.getURL();
    console.log('[Window] did-finish-load', url);

    const rendererJsPath = path.join(__dirname, '../renderer/renderer.js');
    console.log('[Window] renderer.js exists', fs.existsSync(rendererJsPath), rendererJsPath);

    mainWindow?.webContents
      .executeJavaScript(
        `({
          url: location.href,
          readyState: document.readyState,
          hasApi: typeof window.api !== 'undefined',
          hasApiSearch: typeof window.api?.search === 'function',
          hasHandleInput: typeof window.handleInput === 'function',
          scripts: Array.from(document.scripts).map(s => s.src || '<inline>')
        })`,
        true
      )
      .then(result => console.log('[Window] diagnostics', result))
      .catch(error => console.error('[Window] diagnostics error', error));
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('blur', () => mainWindow?.hide());
}

/** Toggle window visibility */
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

/** Create the menu bar tray icon */
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

/** Sync notes from all adapters */
async function syncNotes(): Promise<void> {
  tray?.setToolTip('My Memory - Syncing...');

  for (const adapter of pluginRegistry.getAll()) {
    try {
      const notes = await adapter.fetchAll();
      cache.clearSource(adapter.name);
      cache.upsertMany(notes);
      cache.setSyncState(adapter.name);
      console.log(`[Sync] ${notes.length} notes`);
    } catch (error) {
      console.error('[Sync] Error:', error);
    }
  }

  tray?.setToolTip('My Memory');
}

/** Initialize the application */
async function initializeApp(): Promise<void> {
  // Register source adapters
  pluginRegistry.register(new AppleNotesAdapter());
  await pluginRegistry.initializeAll();

  // Set up change watchers
  for (const adapter of pluginRegistry.getAll()) {
    adapter.watch(async notes => {
      cache.clearSource(adapter.name);
      cache.upsertMany(notes);
      cache.setSyncState(adapter.name);
    });
  }

  // Load from cache or sync
  const cachedNotes = cache.getAllNotes();
  if (cachedNotes.length > 0) {
    console.log(`[Cache] ${cachedNotes.length} notes loaded`);
    setTimeout(syncNotes, 2000); // Background sync
  } else {
    await syncNotes();
  }

  // Initialize search
  await searchManager.initialize();
}

// Application lifecycle
app.whenReady().then(async () => {
  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Shift+Space', toggleWindow);
  await initializeApp();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  pluginRegistry.stopAll();
  searchManager.stop();
});

app.on('window-all-closed', (event: Event) => event.preventDefault());

function formatQueryForLog(query: string): { preview: string; length: number } {
  const normalized = query.replace(/\s+/g, ' ').trim();
  const preview =
    normalized.length > 120 ? normalized.slice(0, 120) + '...' : normalized || '<empty>';
  return { preview, length: normalized.length };
}

// IPC handlers
ipcMain.handle('search', async (_event, query: string) => {
  const startedAt = Date.now();
  const { preview, length } = formatQueryForLog(query);
  console.log(`[IPC] search start len=${length} "${preview}"`);

  try {
    const results = await searchManager.search(query);
    console.log(
      `[IPC] search done results=${results.length} (${Date.now() - startedAt}ms) len=${length} "${preview}"`
    );
    return results;
  } catch (error) {
    console.error(`[IPC] search error len=${length} "${preview}"`, error);
    return [];
  }
});

ipcMain.handle('search-local', async (_event, query: string) => {
  const startedAt = Date.now();
  const { preview, length } = formatQueryForLog(query);

  console.log(`[IPC] search-local start len=${length} "${preview}"`);

  try {
    const results = searchManager.searchLocal(query);
    console.log(
      `[IPC] search-local done results=${results.length} (${Date.now() - startedAt}ms) len=${length} "${preview}"`
    );
    return results;
  } catch (error) {
    console.error(`[IPC] search-local error len=${length} "${preview}"`, error);
    return [];
  }
});

ipcMain.handle('ping', () => {
  console.log('[IPC] ping');
  return 'pong';
});

ipcMain.on('open-note', (_event, noteId: string) => {
  const sourceId = noteId.replace('apple-notes:', '');
  shell.openExternal(`notes://showNote?identifier=${encodeURIComponent(sourceId)}`);
});
