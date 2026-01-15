import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  search: (query: string) => ipcRenderer.invoke('search', query),
  searchLocal: (query: string) => ipcRenderer.invoke('search-local', query),
  openNote: (noteId: string) => ipcRenderer.send('open-note', noteId)
});
