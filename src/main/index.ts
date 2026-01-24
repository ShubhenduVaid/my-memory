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
  dialog,
  Menu,
  shell,
  session
} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

// Load environment variables only in development
if (!app.isPackaged) {
  config({ path: path.join(__dirname, '../../.env') });
}

import { pluginRegistry, SUPPORTED_PROVIDERS, LLMProvider } from '../core/types';
import { AppleNotesAdapter } from '../adapters/apple-notes';
import { ObsidianAdapter } from '../adapters/obsidian';
import { LocalFilesAdapter } from '../adapters/local-files';
import { NotionAdapter } from '../adapters/notion';
import { cache } from '../core/cache';
import { SearchManager } from '../core/search-manager';
import { LLMService } from '../core/llm-service';
import { readUserConfig, writeUserConfig } from './user-config';
import { updateService } from './update-service';

// Application state
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const llmService = new LLMService();
const searchManager = new SearchManager();
const obsidianAdapter = new ObsidianAdapter();
const localFilesAdapter = new LocalFilesAdapter();
const notionAdapter = new NotionAdapter();

// Rate limiting for sensitive operations
const rateLimiter = new Map<string, number>();
const RATE_LIMIT_MS = 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const last = rateLimiter.get(key) || 0;
  if (now - last < RATE_LIMIT_MS) return true;
  rateLimiter.set(key, now);
  return false;
}

// Input sanitization
function sanitizeString(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input.slice(0, maxLength).replace(/[\x00-\x1f]/g, '');
}

function isValidApiKey(key: string): boolean {
  return /^[a-zA-Z0-9_\-]{10,200}$/.test(key);
}

function isValidModelName(model: string): boolean {
  return /^[a-zA-Z0-9_\-.:]{1,100}$/.test(model);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

if (isWindows) {
  app.setAppUserModelId('com.mymemory.app');
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['https:', 'mailto:', 'notes:', 'obsidian:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeNavigationUrl(url: string): boolean {
  return url.startsWith('file://');
}

/** Create the main search window */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    backgroundColor: '#1e1e1e',
    transparent: isMac,
    vibrancy: isMac ? 'under-window' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    }
  });
  updateService.setMainWindow(mainWindow);

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
  mainWindow.on('closed', () => {
    mainWindow = null;
    updateService.setMainWindow(null);
  });
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
    { label: 'Check for Updates...', click: () => void updateService.checkForUpdates(true) },
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
  pluginRegistry.register(obsidianAdapter);
  pluginRegistry.register(localFilesAdapter);
  pluginRegistry.register(notionAdapter);
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

  // Initialize LLM service and inject into search manager
  const config = readUserConfig();
  await llmService.initialize({
    apiKey: config.geminiApiKey,
    openrouterApiKey: config.openrouterApiKey,
    provider: config.llmProvider,
  });
  searchManager.setLLMService(llmService);
}

// Application lifecycle
app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  createWindow();
  createTray();
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+Space', toggleWindow);
  if (!shortcutRegistered) {
    console.warn('[Shortcut] Failed to register CommandOrControl+Shift+Space');
  }

  await initializeApp();
  updateService.scheduleUpdateCheck();
});

app.on('second-instance', () => {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  pluginRegistry.stopAll();
  searchManager.stop();
});

app.on('window-all-closed', (event: Event) => {
  if (!isQuitting) {
    event.preventDefault();
  }
});

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (!app.isPackaged && url.startsWith('devtools://')) {
      return { action: 'allow' };
    }
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (isSafeNavigationUrl(url)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
  });
});

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

ipcMain.handle('get-gemini-key-status', () => {
  const { geminiApiKey } = readUserConfig();
  return { hasKey: Boolean(geminiApiKey) };
});

ipcMain.handle('set-gemini-key', async (_event, apiKey: string | null | undefined) => {
  if (isRateLimited('set-gemini-key')) {
    return { ok: false, error: 'Rate limited' };
  }
  const trimmed = sanitizeString(apiKey, 200).trim();
  if (trimmed && !isValidApiKey(trimmed)) {
    return { ok: false, error: 'Invalid key format' };
  }
  const geminiApiKey = trimmed.length > 0 ? trimmed : undefined;
  writeUserConfig({ geminiApiKey });
  const config = readUserConfig();
  await llmService.initialize({
    apiKey: config.geminiApiKey,
    openrouterApiKey: config.openrouterApiKey,
    provider: config.llmProvider,
  });
  return { ok: true, hasKey: Boolean(geminiApiKey) };
});

ipcMain.handle('get-llm-config', () => {
  const config = readUserConfig();
  return {
    provider: config.llmProvider || 'gemini',
    hasGeminiKey: Boolean(config.geminiApiKey),
    hasOpenrouterKey: Boolean(config.openrouterApiKey),
    providers: llmService.getProviders(),
  };
});

ipcMain.handle('set-llm-provider', async (_event, provider: string) => {
  if (isRateLimited('set-llm-provider')) {
    return { ok: false, error: 'Rate limited' };
  }
  const sanitized = sanitizeString(provider, 50);
  if (!SUPPORTED_PROVIDERS.includes(sanitized as LLMProvider)) {
    return { ok: false, error: 'Invalid provider' };
  }
  writeUserConfig({ llmProvider: sanitized as LLMProvider });
  const config = readUserConfig();
  await llmService.initialize({
    apiKey: config.geminiApiKey,
    openrouterApiKey: config.openrouterApiKey,
    provider: config.llmProvider,
  });
  return { ok: true, provider: sanitized };
});

ipcMain.handle('set-openrouter-key', async (_event, apiKey: string | null | undefined) => {
  if (isRateLimited('set-openrouter-key')) {
    return { ok: false, error: 'Rate limited' };
  }
  const trimmed = sanitizeString(apiKey, 200).trim();
  if (trimmed && !isValidApiKey(trimmed)) {
    return { ok: false, error: 'Invalid key format' };
  }
  const openrouterApiKey = trimmed.length > 0 ? trimmed : undefined;
  writeUserConfig({ openrouterApiKey });
  const config = readUserConfig();
  await llmService.initialize({
    apiKey: config.geminiApiKey,
    openrouterApiKey: config.openrouterApiKey,
    provider: config.llmProvider,
  });
  return { ok: true, hasKey: Boolean(openrouterApiKey) };
});

ipcMain.handle('get-ollama-models', () => {
  return { models: llmService.getModels(), current: llmService.getCurrentModel() };
});

ipcMain.handle('set-ollama-model', (_event, model: string) => {
  const sanitized = sanitizeString(model, 100);
  if (!isValidModelName(sanitized)) {
    return { ok: false, model: llmService.getCurrentModel() };
  }
  const success = llmService.setModel(sanitized);
  return { ok: success, model: success ? sanitized : llmService.getCurrentModel() };
});

ipcMain.handle('notion-get-config', () => {
  const notionToken = readUserConfig().notion?.token;
  return { hasToken: Boolean(notionToken) };
});

ipcMain.handle('notion-set-token', async (_event, token: string | null | undefined) => {
  const trimmed = typeof token === 'string' ? token.trim() : '';
  const notionToken = trimmed.length > 0 ? trimmed : undefined;
  writeUserConfig({ notion: { token: notionToken } });
  notionAdapter.refreshWatchers();
  await syncNotes();
  return { ok: true, hasToken: Boolean(notionToken) };
});

ipcMain.handle('notion-sync-now', async () => {
  await syncNotes();
  return { ok: true };
});

ipcMain.handle('obsidian-get-config', () => {
  const obsidian = readUserConfig().obsidian || {};
  return { vaults: obsidian.vaults || [] };
});

ipcMain.handle('obsidian-select-vault', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle('obsidian-set-config', async (_event, config: { vaults?: string[] }) => {
  const vaults = (config.vaults || [])
    .map(vault => vault.trim())
    .filter(vault => vault.length > 0 && fs.existsSync(vault) && fs.statSync(vault).isDirectory());
  const uniqueVaults = Array.from(new Set(vaults));

  writeUserConfig({ obsidian: { vaults: uniqueVaults } });
  obsidianAdapter.refreshWatchers();
  await syncNotes();

  return { ok: true, vaults: uniqueVaults };
});

ipcMain.handle('obsidian-sync-now', async () => {
  await syncNotes();
  return { ok: true };
});

ipcMain.handle('local-get-config', () => {
  const local = readUserConfig().local || {};
  return {
    folders: local.folders || [],
    recursive: local.recursive ?? true
  };
});

ipcMain.handle('local-select-folder', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  return { canceled: false, path: result.filePaths[0] };
});

ipcMain.handle(
  'local-set-config',
  async (_event, config: { folders?: string[]; recursive?: boolean }) => {
    const folders = (config.folders || [])
      .map(folder => folder.trim())
      .filter(folder => folder.length > 0 && fs.existsSync(folder) && fs.statSync(folder).isDirectory());
    const uniqueFolders = Array.from(new Set(folders));
    const recursive = config.recursive ?? true;

    writeUserConfig({
      local: {
        folders: uniqueFolders,
        recursive
      }
    });

    localFilesAdapter.refreshWatchers();
    await syncNotes();

    return { ok: true, folders: uniqueFolders, recursive };
  }
);

ipcMain.handle('local-sync-now', async () => {
  await syncNotes();
  return { ok: true };
});

ipcMain.on('open-note', (_event, noteId: string) => {
  if (noteId.startsWith('apple-notes:')) {
    const sourceId = noteId.replace('apple-notes:', '');
    const url = `notes://showNote?identifier=${encodeURIComponent(sourceId)}`;
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return;
  }
  if (noteId.startsWith('notion:')) {
    const pageId = noteId.replace('notion:', '');
    const urlId = pageId.replace(/-/g, '');
    const url = `https://www.notion.so/${encodeURIComponent(urlId)}`;
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return;
  }
  if (noteId.startsWith('obsidian:')) {
    const filePath = decodeURIComponent(noteId.replace('obsidian:', ''));
    const url = `obsidian://open?path=${encodeURIComponent(filePath)}`;
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url).catch(() => shell.openPath(filePath));
    } else {
      void shell.openPath(filePath);
    }
    return;
  }
  if (noteId.startsWith('local-file:')) {
    const filePath = decodeURIComponent(noteId.replace('local-file:', ''));
    shell.openPath(filePath);
  }
});
