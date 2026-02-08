import { describe, it, expect, vi, beforeEach } from 'vitest';

const execFileMock = vi.fn();
const watchMock = vi.fn();

vi.mock('child_process', () => ({
  execFile: execFileMock
}));

vi.mock('fs', async (importActual) => {
  const actual = await importActual<typeof import('fs')>();
  return {
    ...actual,
    watch: watchMock
  };
});

const { AppleNotesAdapter } = await import('../src/adapters/apple-notes');

describe('AppleNotesAdapter', () => {
  beforeEach(() => {
    execFileMock.mockReset();
    watchMock.mockReset();
  });

  it('fetchAll transforms JXA notes into Note objects', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (e: any, stdout: string) => void) => {
      cb(null, JSON.stringify([
        {
          id: '123',
          name: 'Hello',
          body: 'World',
          folder: 'Inbox',
          account: 'iCloud',
          creationDate: '2024-01-01T00:00:00.000Z',
          modificationDate: '2024-01-02T00:00:00.000Z'
        }
      ]));
    });

    const adapter = new AppleNotesAdapter();
    const notes = await adapter.fetchAll();

    expect(notes).toHaveLength(1);
    expect(notes[0]?.id).toBe('apple-notes:123');
    expect(notes[0]?.title).toBe('Hello');
    expect(notes[0]?.content).toBe('World');
    expect(notes[0]?.source).toBe('apple-notes');
    expect(notes[0]?.sourceId).toBe('123');
    expect(notes[0]?.metadata?.folder).toBe('Inbox');
    expect(notes[0]?.metadata?.account).toBe('iCloud');
    expect(notes[0]?.modifiedAt instanceof Date).toBe(true);
  });

  it('fetchAll rejects on execFile error', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (e: any) => void) => {
      cb(new Error('boom'));
    });

    const adapter = new AppleNotesAdapter();
    await expect(adapter.fetchAll()).rejects.toThrow('boom');
  });

  it('fetchAll rejects on invalid JSON', async () => {
    execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (e: any, stdout: string) => void) => {
      cb(null, '{not-json');
    });

    const adapter = new AppleNotesAdapter();
    await expect(adapter.fetchAll()).rejects.toBeTruthy();
  });

  it('watch schedules refresh and emits callback on change', async () => {
    const close = vi.fn();
    const onHandlers = new Map<string, (err: any) => void>();
    const watcher = {
      on: (event: string, handler: (err: any) => void) => {
        onHandlers.set(event, handler);
        return watcher;
      },
      close
    };

    let changeCb: (() => void) | undefined;
    watchMock.mockImplementation((_path: string, _opts: any, cb: () => void) => {
      changeCb = cb;
      return watcher as any;
    });

    execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (e: any, stdout: string) => void) => {
      cb(null, JSON.stringify([
        {
          id: '1',
          name: 'A',
          body: 'B',
          folder: 'F',
          account: 'Acc',
          creationDate: '2024-01-01T00:00:00.000Z',
          modificationDate: '2024-01-02T00:00:00.000Z'
        }
      ]));
    });

    const adapter = new AppleNotesAdapter();
    const updates: any[] = [];
    adapter.watch((notes) => updates.push(notes));

    // Simulate fs.watch change event
    changeCb?.();
    // onChange is async; ensure the Promise chain is flushed.
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(updates).toHaveLength(1);
    expect(updates[0][0].id).toBe('apple-notes:1');

    // Simulate watcher error -> should close and disable watcher
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onHandlers.get('error')?.({ code: 'EPERM' });
    expect(close).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();

    adapter.stop();
  });

  it('watch logs unknown watcher errors and closes watcher', () => {
    const close = vi.fn();
    const onHandlers = new Map<string, (err: any) => void>();
    const watcher = {
      on: (event: string, handler: (err: any) => void) => {
        onHandlers.set(event, handler);
        return watcher;
      },
      close
    };

    watchMock.mockReturnValue(watcher as any);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new AppleNotesAdapter();
    adapter.watch(() => {});

    const err: any = new Error('boom');
    err.code = 'EINVAL';
    onHandlers.get('error')?.(err);

    expect(warnSpy).toHaveBeenCalledWith(
      '[AppleNotes] Watcher error; live updates disabled:',
      err
    );
    expect(close).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('watch logs callback errors when refresh fails', async () => {
    const close = vi.fn();
    const onHandlers = new Map<string, (err: any) => void>();
    const watcher = {
      on: (event: string, handler: (err: any) => void) => {
        onHandlers.set(event, handler);
        return watcher;
      },
      close
    };

    let changeCb: (() => void) | undefined;
    watchMock.mockImplementation((_path: string, _opts: any, cb: () => void) => {
      changeCb = cb;
      return watcher as any;
    });

    execFileMock.mockImplementation((_cmd: string, _args: string[], cb: (e: any) => void) => {
      cb(new Error('osascript failed'));
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapter = new AppleNotesAdapter();
    adapter.watch(() => {});

    changeCb?.();
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalledWith(
      '[AppleNotes] Watch callback error:',
      expect.any(Error)
    );

    // Should still tolerate watcher errors.
    onHandlers.get('error')?.({ code: 'EPERM' });
    expect(close).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it('watch treats synchronous fs.watch failures as non-fatal', () => {
    watchMock.mockImplementation(() => {
      const err: any = new Error('nope');
      err.code = 'EPERM';
      throw err;
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new AppleNotesAdapter();

    expect(() => adapter.watch(() => {})).not.toThrow();

    warnSpy.mockRestore();
  });

  it('watch logs unknown synchronous fs.watch failures with error object', () => {
    watchMock.mockImplementation(() => {
      const err: any = new Error('nope');
      err.code = 'EINVAL';
      throw err;
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new AppleNotesAdapter();

    expect(() => adapter.watch(() => {})).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[AppleNotes] Failed to watch Apple Notes DB'), expect.any(Error));

    warnSpy.mockRestore();
  });
});
