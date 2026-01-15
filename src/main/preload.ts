/**
 * Preload script for secure IPC communication.
 * Exposes a safe API to the renderer process.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  /** Search with AI-powered answers */
  search: (query: string) => ipcRenderer.invoke('search', query),

  /** Search locally without AI (for real-time feedback) */
  searchLocal: (query: string) => ipcRenderer.invoke('search-local', query),

  /** Open a note in Apple Notes */
  openNote: (noteId: string) => ipcRenderer.send('open-note', noteId)
});
