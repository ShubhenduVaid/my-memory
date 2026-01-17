/**
 * Preload script for secure IPC communication.
 * Exposes a safe API to the renderer process.
 */

import { contextBridge, ipcRenderer } from 'electron';

console.log('[Preload] loaded');

contextBridge.exposeInMainWorld('api', {
  /** Search with AI-powered answers */
  search: (query: string) => ipcRenderer.invoke('search', query),

  /** Search locally without AI (for real-time feedback) */
  searchLocal: (query: string) => ipcRenderer.invoke('search-local', query),

  /** Check whether a Gemini API key is configured */
  getGeminiKeyStatus: () => ipcRenderer.invoke('get-gemini-key-status'),

  /** Set or clear the Gemini API key */
  setGeminiKey: (apiKey: string | null) => ipcRenderer.invoke('set-gemini-key', apiKey),

  /** Get Obsidian vault config */
  getObsidianConfig: () => ipcRenderer.invoke('obsidian-get-config'),

  /** Update Obsidian vault config */
  setObsidianConfig: (config: { vaults?: string[] }) => ipcRenderer.invoke('obsidian-set-config', config),

  /** Select an Obsidian vault */
  selectObsidianVault: () => ipcRenderer.invoke('obsidian-select-vault'),

  /** Trigger Obsidian sync */
  syncObsidianNow: () => ipcRenderer.invoke('obsidian-sync-now'),

  /** Debug ping to verify IPC */
  ping: () => ipcRenderer.invoke('ping'),

  /** Open a note in Apple Notes */
  openNote: (noteId: string) => ipcRenderer.send('open-note', noteId)
});
