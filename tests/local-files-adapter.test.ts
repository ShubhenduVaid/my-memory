import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const readUserConfigMock = vi.hoisted(() => vi.fn());
const pdfParseMock = vi.hoisted(() => vi.fn());
const watchMock = vi.hoisted(() => vi.fn());

vi.mock('../src/main/user-config', () => ({
  readUserConfig: readUserConfigMock
}));

vi.mock('pdf-parse', () => ({
  default: pdfParseMock
}));

vi.mock('fs', async (importActual) => {
  const actual = await importActual<typeof import('fs')>();
  return {
    ...actual,
    watch: watchMock
  };
});

const { LocalFilesAdapter } = await import('../src/adapters/local-files');

describe('LocalFilesAdapter', () => {
  beforeEach(() => {
    readUserConfigMock.mockReset();
    pdfParseMock.mockReset();
    watchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty when no folders configured', async () => {
    readUserConfigMock.mockReturnValue({ local: { folders: [] } });
    const adapter = new LocalFilesAdapter();
    const notes = await adapter.fetchAll();
    expect(notes).toEqual([]);
  });

  it('indexes supported text and PDF files (recursive)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'local-'));
    mkdirSync(join(root, 'nested'), { recursive: true });
    mkdirSync(join(root, '.git'), { recursive: true });

    writeFileSync(join(root, 'a.md'), ' Hello\r\nWorld ', 'utf8');
    writeFileSync(join(root, 'b.txt'), 'Plain text', 'utf8');
    writeFileSync(join(root, 'nested', 'c.md'), 'Nested', 'utf8');
    writeFileSync(join(root, '.git', 'ignored.md'), 'Ignore', 'utf8');

    // The PDF bytes don't matter because we mock pdf-parse.
    writeFileSync(join(root, 'd.pdf'), Buffer.from([0x25, 0x50, 0x44, 0x46]));
    pdfParseMock.mockResolvedValue({ text: 'PDF   text\nwith   spacing' });

    readUserConfigMock.mockReturnValue({ local: { folders: [root], recursive: true } });

    const adapter = new LocalFilesAdapter();
    const notes = await adapter.fetchAll();

    const byTitle = new Map(notes.map(n => [n.title, n]));
    expect(byTitle.get('a.md')?.content).toBe('Hello\nWorld');
    expect(byTitle.get('b.txt')?.content).toBe('Plain text');
    expect(byTitle.get('nested/c.md')?.content).toBe('Nested');
    expect(byTitle.get('d.pdf')?.content).toBe('PDF text with spacing');
    expect(Array.from(byTitle.keys()).sort()).toEqual(['a.md', 'b.txt', 'd.pdf', 'nested/c.md']);

    const pdfNote = byTitle.get('d.pdf');
    expect(pdfNote?.metadata?.folder).toContain('Local');
    expect(pdfNote?.metadata?.path).toContain('d.pdf');
  });

  it('respects non-recursive scans', async () => {
    const root = mkdtempSync(join(tmpdir(), 'local-'));
    mkdirSync(join(root, 'nested'), { recursive: true });
    writeFileSync(join(root, 'a.md'), 'A', 'utf8');
    writeFileSync(join(root, 'nested', 'b.md'), 'B', 'utf8');

    readUserConfigMock.mockReturnValue({ local: { folders: [root], recursive: false } });

    const adapter = new LocalFilesAdapter();
    const notes = await adapter.fetchAll();
    expect(notes.map(n => n.title).sort()).toEqual(['a.md']);
  });

  it('watch debounces rescans and emits updated notes', async () => {
    vi.useFakeTimers();

    const root = mkdtempSync(join(tmpdir(), 'local-'));
    writeFileSync(join(root, 'a.md'), 'A', 'utf8');
    readUserConfigMock.mockReturnValue({ local: { folders: [root], recursive: true } });

    const close = vi.fn();
    let fsWatchCb: (() => void) | undefined;
    watchMock.mockImplementation((_path: string, _opts: any, cb: () => void) => {
      fsWatchCb = cb;
      return { close } as any;
    });

    const adapter = new LocalFilesAdapter();
    vi.spyOn(adapter, 'fetchAll').mockResolvedValue([
      {
        id: 'local-file:1',
        title: 'a.md',
        content: 'A',
        source: 'local-files',
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
});
