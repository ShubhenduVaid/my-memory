import { describe, it, expect, vi, beforeEach } from 'vitest';

const exposeInMainWorld = vi.fn();
const ipcRenderer = {
  invoke: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
};

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer
}));

describe('preload', () => {
  beforeEach(() => {
    exposeInMainWorld.mockReset();
    ipcRenderer.invoke.mockReset();
    ipcRenderer.send.mockReset();
    ipcRenderer.on.mockReset();
    ipcRenderer.removeListener.mockReset();
    vi.resetModules();
  });

  it('exposes a frozen API surface to the renderer', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await import('../src/main/preload');
    logSpy.mockRestore();

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [key, api] = exposeInMainWorld.mock.calls[0] as any[];
    expect(key).toBe('api');
    expect(Object.isFrozen(api)).toBe(true);

    await api.search('q');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('search', 'q');

    await api.searchLocal('ql');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('search-local', 'ql');

    await api.getGeminiKeyStatus();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('get-gemini-key-status');

    await api.setGeminiKey('k');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('set-gemini-key', 'k');

    await api.setGeminiKey(null);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('set-gemini-key', null);

    await api.getLlmConfig();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('get-llm-config');

    await api.setLlmProvider('ollama');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('set-llm-provider', 'ollama');

    await api.setOpenrouterKey('ok');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('set-openrouter-key', 'ok');

    await api.getOllamaModels();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('get-ollama-models');

    await api.setOllamaModel('llama');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('set-ollama-model', 'llama');

    await api.getNotionConfig();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('notion-get-config');

    await api.setNotionToken('nt');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('notion-set-token', 'nt');

    await api.syncNotionNow();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('notion-sync-now');

    await api.getObsidianConfig();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('obsidian-get-config');

    await api.setObsidianConfig({ vaults: ['/v'] });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('obsidian-set-config', { vaults: ['/v'] });

    await api.selectObsidianVault();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('obsidian-select-vault');

    await api.syncObsidianNow();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('obsidian-sync-now');

    await api.getLocalConfig();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('local-get-config');

    await api.setLocalConfig({ folders: ['/f'], recursive: true });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('local-set-config', { folders: ['/f'], recursive: true });

    await api.selectLocalFolder();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('local-select-folder');

    await api.syncLocalNow();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('local-sync-now');

    await api.ping();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('ping');

    await api.hideWindow();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('window-hide');

    await api.getSystemTheme();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('get-system-theme');

    api.openNote('n1');
    expect(ipcRenderer.send).toHaveBeenCalledWith('open-note', 'n1');

    const cb = vi.fn();
    const unsubscribe = api.onSearchStreamChunk(cb);
    expect(ipcRenderer.on).toHaveBeenCalledTimes(1);
    const [eventName, handler] = ipcRenderer.on.mock.calls[0] as any[];
    expect(eventName).toBe('search-stream-chunk');

    handler({}, 'chunk1');
    expect(cb).toHaveBeenCalledWith('chunk1');

    unsubscribe();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('search-stream-chunk', handler);

    const doneCb = vi.fn();
    const offDone = api.onSearchStreamDone(doneCb);
    const [doneEvent, doneHandler] = ipcRenderer.on.mock.calls[1] as any[];
    expect(doneEvent).toBe('search-stream-done');
    doneHandler();
    expect(doneCb).toHaveBeenCalledTimes(1);
    offDone();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('search-stream-done', doneHandler);

    const themeCb = vi.fn();
    const offTheme = api.onThemeChange(themeCb);
    const [themeEvent, themeHandler] = ipcRenderer.on.mock.calls[2] as any[];
    expect(themeEvent).toBe('theme-changed');
    themeHandler({}, true);
    expect(themeCb).toHaveBeenCalledWith(true);
    offTheme();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('theme-changed', themeHandler);
  });
});
