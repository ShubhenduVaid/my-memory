import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const readUserConfigMock = vi.hoisted(() => vi.fn());
const watchMock = vi.hoisted(() => vi.fn());

vi.mock('../src/main/user-config', () => ({
  readUserConfig: readUserConfigMock
}));

vi.mock('fs', async (importActual) => {
  const actual = await importActual<typeof import('fs')>();
  return {
    ...actual,
    watch: watchMock
  };
});

const { ObsidianAdapter } = await import('../src/adapters/obsidian');

describe('ObsidianAdapter', () => {
  beforeEach(() => {
    readUserConfigMock.mockReset();
    watchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetchAll indexes markdown files and ignores dot/known dirs', async () => {
    const vault = mkdtempSync(join(tmpdir(), 'vault-'));
    mkdirSync(join(vault, 'folder'), { recursive: true });
    mkdirSync(join(vault, '.obsidian'), { recursive: true });
    mkdirSync(join(vault, 'node_modules'), { recursive: true });

    writeFileSync(join(vault, 'root.md'), '# Root\nhello', 'utf8');
    writeFileSync(join(vault, 'folder', 'note.markdown'), 'content', 'utf8');
    writeFileSync(join(vault, 'folder', 'skip.txt'), 'nope', 'utf8');
    writeFileSync(join(vault, '.obsidian', 'ignored.md'), 'no', 'utf8');
    writeFileSync(join(vault, 'node_modules', 'ignored.md'), 'no', 'utf8');

    readUserConfigMock.mockReturnValue({ obsidian: { vaults: [vault] } });

    const adapter = new ObsidianAdapter();
    const notes = await adapter.fetchAll();

    const titles = notes.map(n => n.title).sort();
    expect(titles).toEqual(['folder/note.markdown', 'root.md']);
    expect(notes.every(n => n.source === 'obsidian')).toBe(true);
    expect(notes[0]?.metadata?.folder).toContain('Obsidian');
  });

  it('returns empty when no vaults are configured', async () => {
    readUserConfigMock.mockReturnValue({});

    const adapter = new ObsidianAdapter();
    const notes = await adapter.fetchAll();
    expect(notes).toEqual([]);
  });

  it('watch debounces rescans and emits updated notes', async () => {
    vi.useFakeTimers();

    const vault = mkdtempSync(join(tmpdir(), 'vault-'));
    writeFileSync(join(vault, 'a.md'), 'A', 'utf8');
    readUserConfigMock.mockReturnValue({ obsidian: { vaults: [vault] } });

    const close = vi.fn();
    let fsWatchCb: (() => void) | undefined;
    watchMock.mockImplementation((_path: string, _opts: any, cb: () => void) => {
      fsWatchCb = cb;
      return { close } as any;
    });

    const adapter = new ObsidianAdapter();
    vi.spyOn(adapter, 'fetchAll').mockResolvedValue([
      {
        id: 'obsidian:1',
        title: 'a.md',
        content: 'A',
        source: 'obsidian',
        sourceId: '1',
        modifiedAt: new Date(),
        metadata: {}
      }
    ] as any);
    const updates: any[] = [];
    adapter.watch((notes) => updates.push(notes));

    fsWatchCb?.();
    await vi.advanceTimersByTimeAsync(1600);
    await Promise.resolve();

    expect(updates.length).toBe(1);
    expect(updates[0][0].title).toBe('a.md');

    adapter.stop();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('watch is resilient to fs.watch errors', () => {
    const vault = mkdtempSync(join(tmpdir(), 'vault-'));
    readUserConfigMock.mockReturnValue({ obsidian: { vaults: [vault] } });
    watchMock.mockImplementation(() => {
      throw new Error('watch not supported');
    });

    const adapter = new ObsidianAdapter();
    expect(() => adapter.watch(() => {})).not.toThrow();
  });
});
