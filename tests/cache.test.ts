import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Note } from '../src/core/types';

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/my-memory-test'
  }
}));

vi.mock('better-sqlite3', () => {
  type Row = {
    id: string;
    title: string;
    content: string;
    source: string;
    sourceId: string;
    modifiedAt: number;
    metadata: string;
  };

  let lastDb: FakeDb | null = null;

  class FakeDb {
    private notes = new Map<string, Row>();
    private syncState = new Map<string, number>();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_path: string) {
      lastDb = this;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    exec(_sql: string) {}

    prepare(sql: string) {
      const self = this;
      if (sql.startsWith('INSERT OR REPLACE INTO notes')) {
        return {
          run: (id: string, title: string, content: string, source: string, sourceId: string, modifiedAt: number, metadata: string) => {
            self.notes.set(id, { id, title, content, source, sourceId, modifiedAt, metadata });
          }
        };
      }
      if (sql.startsWith('SELECT * FROM notes WHERE source')) {
        return {
          all: (source: string) => Array.from(self.notes.values()).filter(r => r.source === source)
        };
      }
      if (sql.startsWith('SELECT * FROM notes')) {
        return {
          all: () => Array.from(self.notes.values())
        };
      }
      if (sql.startsWith('DELETE FROM notes WHERE id')) {
        return {
          run: (id: string) => {
            self.notes.delete(id);
          }
        };
      }
      if (sql.startsWith('DELETE FROM notes WHERE source')) {
        return {
          run: (source: string) => {
            for (const [id, row] of self.notes.entries()) {
              if (row.source === source) self.notes.delete(id);
            }
          }
        };
      }
      if (sql.startsWith('INSERT OR REPLACE INTO sync_state')) {
        return {
          run: (source: string, lastSync: number) => {
            self.syncState.set(source, lastSync);
          }
        };
      }
      if (sql.startsWith('SELECT lastSync FROM sync_state')) {
        return {
          get: (source: string) => {
            const v = self.syncState.get(source);
            return v === undefined ? undefined : { lastSync: v };
          }
        };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    }

    transaction<TArgs extends any[], TResult>(fn: (...args: TArgs) => TResult) {
      return (...args: TArgs) => fn(...args);
    }
  }

  return { default: FakeDb, __getLastDb: () => lastDb };
});

describe('cache', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('upserts and retrieves notes', async () => {
    const { cache } = await import('../src/core/cache');

    const noteWithMeta: Note = {
      id: 'n1',
      title: 'Title',
      content: 'Body',
      source: 'src1',
      sourceId: 'sid1',
      modifiedAt: new Date('2024-01-01T00:00:00.000Z'),
      metadata: { folder: 'F' }
    };

    const noteWithoutMeta: Note = {
      id: 'n2',
      title: 'Title 2',
      content: 'Body 2',
      source: 'src1',
      sourceId: 'sid2',
      modifiedAt: new Date('2024-01-01T00:00:00.000Z')
    };

    cache.upsertNote(noteWithMeta);
    cache.upsertNote(noteWithoutMeta);

    const all = cache.getAllNotes();
    expect(all).toHaveLength(2);
    const byId = new Map(all.map(n => [n.id, n]));
    expect(byId.get('n1')?.modifiedAt instanceof Date).toBe(true);
    expect(byId.get('n1')?.metadata?.folder).toBe('F');
    expect(byId.get('n2')?.metadata).toEqual({});

    const bySource = cache.getNotesBySource('src1');
    expect(bySource).toHaveLength(2);
    expect(cache.getNotesBySource('other')).toEqual([]);
  });

  it('supports bulk upserts and deletes', async () => {
    const { cache } = await import('../src/core/cache');

    cache.upsertMany([
      {
        id: 'a',
        title: 'A',
        content: 'a',
        source: 's1',
        sourceId: '1',
        modifiedAt: new Date(),
        metadata: {}
      },
      {
        id: 'b',
        title: 'B',
        content: 'b',
        source: 's2',
        sourceId: '2',
        modifiedAt: new Date(),
        metadata: {}
      }
    ]);

    expect(cache.getAllNotes().map(n => n.id).sort()).toEqual(['a', 'b']);

    cache.deleteNote('a');
    expect(cache.getAllNotes().map(n => n.id)).toEqual(['b']);

    cache.clearSource('s2');
    expect(cache.getAllNotes()).toEqual([]);
  });

  it('defaults missing row metadata to {}', async () => {
    const { cache } = await import('../src/core/cache');

    cache.upsertNote({
      id: 'm1',
      title: 'Meta',
      content: 'Body',
      source: 's',
      sourceId: 'sid',
      modifiedAt: new Date(),
      metadata: { folder: 'F' }
    });

    // Simulate a corrupted row where metadata is missing/empty.
    const sqlite = await import('better-sqlite3');
    const db = (sqlite as any).__getLastDb?.();
    (db as any).notes.get('m1').metadata = '';

    const note = cache.getAllNotes().find(n => n.id === 'm1');
    expect(note?.metadata).toEqual({});
  });

  it('tracks sync state per source', async () => {
    const { cache } = await import('../src/core/cache');

    expect(cache.getSyncState('s1')).toBeNull();

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123456);
    cache.setSyncState('s1');
    expect(cache.getSyncState('s1')).toBe(123456);
    nowSpy.mockRestore();
  });
});
