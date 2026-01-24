/**
 * Preload script for secure IPC communication.
 * Exposes a safe API to the renderer process.
 */

import { contextBridge, ipcRenderer } from 'electron';

console.log('[Preload] loaded');

const api = {
  /** Search with AI-powered answers */
  search: (query: string) => ipcRenderer.invoke('search', query),

  /** Search locally without AI (for real-time feedback) */
  searchLocal: (query: string) => ipcRenderer.invoke('search-local', query),

  /** Check whether a Gemini API key is configured */
  getGeminiKeyStatus: () => ipcRenderer.invoke('get-gemini-key-status'),

  /** Set or clear the Gemini API key */
  setGeminiKey: (apiKey: string | null) => ipcRenderer.invoke('set-gemini-key', apiKey),

  /** Get LLM provider config */
  getLlmConfig: () => ipcRenderer.invoke('get-llm-config'),

  /** Set LLM provider */
  setLlmProvider: (provider: string) => ipcRenderer.invoke('set-llm-provider', provider),

  /** Set OpenRouter API key */
  setOpenrouterKey: (apiKey: string | null) => ipcRenderer.invoke('set-openrouter-key', apiKey),

  /** Get Ollama models */
  getOllamaModels: () => ipcRenderer.invoke('get-ollama-models'),

  /** Set Ollama model */
  setOllamaModel: (model: string) => ipcRenderer.invoke('set-ollama-model', model),

  /** Check whether a Notion token is configured */
  getNotionConfig: () => ipcRenderer.invoke('notion-get-config'),

  /** Set or clear the Notion token */
  setNotionToken: (token: string | null) => ipcRenderer.invoke('notion-set-token', token),

  /** Trigger Notion sync */
  syncNotionNow: () => ipcRenderer.invoke('notion-sync-now'),

  /** Get Obsidian vault config */
  getObsidianConfig: () => ipcRenderer.invoke('obsidian-get-config'),

  /** Update Obsidian vault config */
  setObsidianConfig: (config: { vaults?: string[] }) =>
    ipcRenderer.invoke('obsidian-set-config', config),

  /** Select an Obsidian vault */
  selectObsidianVault: () => ipcRenderer.invoke('obsidian-select-vault'),

  /** Trigger Obsidian sync */
  syncObsidianNow: () => ipcRenderer.invoke('obsidian-sync-now'),
  /** Get local file indexing config */
  getLocalConfig: () => ipcRenderer.invoke('local-get-config'),

  /** Update local file indexing config */
  setLocalConfig: (config: { folders?: string[]; recursive?: boolean }) =>
    ipcRenderer.invoke('local-set-config', config),

  /** Select a local folder */
  selectLocalFolder: () => ipcRenderer.invoke('local-select-folder'),

  /** Trigger local sync */
  syncLocalNow: () => ipcRenderer.invoke('local-sync-now'),

  /** Debug ping to verify IPC */
  ping: () => ipcRenderer.invoke('ping'),

  /** Open a note in Apple Notes */
  openNote: (noteId: string) => ipcRenderer.send('open-note', noteId),

  /** Listen for search stream chunks */
  onSearchStreamChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk);
    ipcRenderer.on('search-stream-chunk', handler);
    return () => ipcRenderer.removeListener('search-stream-chunk', handler);
  },

  /** Listen for search stream completion */
  onSearchStreamDone: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('search-stream-done', handler);
    return () => ipcRenderer.removeListener('search-stream-done', handler);
  }
};

contextBridge.exposeInMainWorld('api', Object.freeze(api));
