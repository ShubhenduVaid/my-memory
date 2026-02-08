import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let isPackaged = false;

const showMessageBox = vi.fn(async () => ({ response: 0 }));

const updaterHandlers = new Map<string, ((arg?: any) => void)[]>();
const autoUpdater = {
  logger: null as any,
  autoDownload: true,
  autoInstallOnAppQuit: false,
  channel: undefined as any,
  allowPrerelease: false,
  checkForUpdates: vi.fn(async () => {}),
  downloadUpdate: vi.fn(() => {}),
  quitAndInstall: vi.fn(() => {}),
  on: (event: string, handler: (arg?: any) => void) => {
    const list = updaterHandlers.get(event) || [];
    list.push(handler);
    updaterHandlers.set(event, list);
  }
};

const log = {
  transports: { file: { level: 'info' } },
  info: vi.fn(() => {}),
  error: vi.fn(() => {})
};

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return isPackaged;
    }
  },
  BrowserWindow: class BrowserWindow {},
  dialog: {
    showMessageBox
  }
}));

vi.mock('electron-updater', () => ({
  autoUpdater
}));

vi.mock('electron-log', () => ({
  default: log
}));

describe('updateService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    isPackaged = false;
    updaterHandlers.clear();
    showMessageBox.mockClear();
    autoUpdater.checkForUpdates.mockClear();
    autoUpdater.downloadUpdate.mockClear();
    autoUpdater.quitAndInstall.mockClear();
    log.info.mockClear();
    log.error.mockClear();
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('shows info when user initiates update check in dev (not packaged)', async () => {
    const { updateService } = await import('../src/main/update-service');
    await updateService.checkForUpdates(true);

    expect(showMessageBox).toHaveBeenCalledTimes(1);
    const args = showMessageBox.mock.calls[0] as any[];
    expect(args[0]?.title).toBe('Updates unavailable');
  });

  it('calls autoUpdater.checkForUpdates when packaged and enabled', async () => {
    isPackaged = true;
    process.env.AUTO_UPDATES = 'true';

    const { updateService } = await import('../src/main/update-service');
    await updateService.checkForUpdates(false);

    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('shows an error dialog when manual check fails', async () => {
    isPackaged = true;
    process.env.AUTO_UPDATES = 'true';
    autoUpdater.checkForUpdates.mockRejectedValueOnce(new Error('network'));

    const { updateService } = await import('../src/main/update-service');
    await updateService.checkForUpdates(true);

    expect(showMessageBox).toHaveBeenCalledTimes(1);
    expect(showMessageBox.mock.calls[0]?.[0]?.title).toBe('Update check failed');
  });

  it('prompts to download when update is available', async () => {
    isPackaged = true;
    process.env.AUTO_UPDATES = 'true';

    // Response 1 selects "Download"
    showMessageBox.mockResolvedValueOnce({ response: 1 });

    const { updateService } = await import('../src/main/update-service');
    // Simulate autoUpdater emitting update-available
    const handlers = updaterHandlers.get('update-available') || [];
    expect(handlers.length).toBeGreaterThan(0);
    handlers[0]?.({ version: '2.0.0' });

    // Allow the promise chain to flush (showQuestionDialog is async).
    await new Promise<void>(resolve => setImmediate(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not download when user selects Later on update prompt', async () => {
    isPackaged = true;
    process.env.AUTO_UPDATES = 'true';

    showMessageBox.mockResolvedValueOnce({ response: 0 });

    await import('../src/main/update-service');
    const handlers = updaterHandlers.get('update-available') || [];
    expect(handlers.length).toBeGreaterThan(0);
    handlers[0]?.({ version: '2.0.0' });

    await new Promise<void>(resolve => setImmediate(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });

  it('prompts "Up to date" when a manual check finds no updates', async () => {
    isPackaged = true;
    process.env.AUTO_UPDATES = 'true';

    const { updateService } = await import('../src/main/update-service');
    await updateService.checkForUpdates(true);

    const handlers = updaterHandlers.get('update-not-available') || [];
    expect(handlers.length).toBeGreaterThan(0);
    handlers[0]?.();

    await new Promise<void>(resolve => setImmediate(resolve));
    expect(showMessageBox).toHaveBeenCalled();
    const call = showMessageBox.mock.calls.at(-1) as any[];
    const options = call.length === 1 ? call[0] : call[1];
    expect(options?.title).toBe('Up to date');
  });

  it('prompts to restart when update is downloaded', async () => {
    isPackaged = true;
    process.env.AUTO_UPDATES = 'true';

    // Response 1 selects "Restart"
    showMessageBox.mockResolvedValueOnce({ response: 1 });

    await import('../src/main/update-service');
    const handlers = updaterHandlers.get('update-downloaded') || [];
    expect(handlers.length).toBeGreaterThan(0);
    handlers[0]?.({ version: '2.0.0' });

    await new Promise<void>(resolve => setImmediate(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('shows an error dialog when an update error occurs during manual check', async () => {
    isPackaged = true;
    process.env.AUTO_UPDATES = 'true';

    const { updateService } = await import('../src/main/update-service');
    await updateService.checkForUpdates(true);

    const handlers = updaterHandlers.get('error') || [];
    expect(handlers.length).toBeGreaterThan(0);
    handlers[0]?.(new Error('boom'));

    await new Promise<void>(resolve => setImmediate(resolve));
    expect(showMessageBox).toHaveBeenCalled();
    const call = showMessageBox.mock.calls.at(-1) as any[];
    const options = call.length === 1 ? call[0] : call[1];
    expect(options?.title).toBe('Update error');
  });

  it('scheduleUpdateCheck triggers a delayed check only when enabled', async () => {
    vi.useFakeTimers();

    isPackaged = true;
    process.env.AUTO_UPDATES = 'true';

    const { updateService } = await import('../src/main/update-service');
    const spy = vi.spyOn(updateService as any, 'checkForUpdates');

    updateService.scheduleUpdateCheck(10);
    await vi.advanceTimersByTimeAsync(11);

    expect(spy).toHaveBeenCalledWith(false);

    spy.mockRestore();
    vi.useRealTimers();
  });

  it('avoids concurrent update checks', async () => {
    isPackaged = true;
    process.env.AUTO_UPDATES = 'true';

    let resolveCheck: (() => void) | undefined;
    autoUpdater.checkForUpdates.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCheck = resolve;
        })
    );

    const { updateService } = await import('../src/main/update-service');
    const p1 = updateService.checkForUpdates(false);
    const p2 = updateService.checkForUpdates(false);

    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    await p2;
    resolveCheck?.();
    await p1;
  });

  it('uses dialog parent when a main window is set and not destroyed', async () => {
    const { updateService } = await import('../src/main/update-service');
    const fakeWin = { isDestroyed: () => false };
    updateService.setMainWindow(fakeWin as any);

    await updateService.checkForUpdates(true);

    expect(showMessageBox).toHaveBeenCalledTimes(1);
    const call = showMessageBox.mock.calls[0] as any[];
    expect(call[0]).toBe(fakeWin);
    expect(call[1]?.title).toBe('Updates unavailable');
  });

  it('does not use dialog parent when the window is destroyed', async () => {
    const { updateService } = await import('../src/main/update-service');
    const fakeWin = { isDestroyed: () => true };
    updateService.setMainWindow(fakeWin as any);

    await updateService.checkForUpdates(true);

    expect(showMessageBox).toHaveBeenCalledTimes(1);
    const call = showMessageBox.mock.calls[0] as any[];
    expect(call.length).toBe(1);
    expect(call[0]?.title).toBe('Updates unavailable');
  });

  it('respects UPDATE_CHANNEL for prerelease channels', async () => {
    process.env.UPDATE_CHANNEL = 'beta';
    await import('../src/main/update-service');

    expect(autoUpdater.channel).toBe('beta');
    expect(autoUpdater.allowPrerelease).toBe(true);
  });

  it('treats stable channel as non-prerelease', async () => {
    process.env.UPDATE_CHANNEL = 'stable';
    await import('../src/main/update-service');

    expect(autoUpdater.channel).toBe('stable');
    expect(autoUpdater.allowPrerelease).toBe(false);
  });
});
