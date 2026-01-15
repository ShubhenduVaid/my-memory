import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { Note } from '../core/types';

const dbPath = join(app.getPath('userData'), 'cache.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    source TEXT,
    sourceId TEXT,
    modifiedAt INTEGER,
    metadata TEXT
  );
  CREATE TABLE IF NOT EXISTS sync_state (
    source TEXT PRIMARY KEY,
    lastSync INTEGER
  );
`);

const stmts = {
  upsert: db.prepare(`INSERT OR REPLACE INTO notes (id, title, content, source, sourceId, modifiedAt, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`),
  getAll: db.prepare(`SELECT * FROM notes`),
  getBySource: db.prepare(`SELECT * FROM notes WHERE source = ?`),
  delete: db.prepare(`DELETE FROM notes WHERE id = ?`),
  deleteBySource: db.prepare(`DELETE FROM notes WHERE source = ?`),
  setSyncState: db.prepare(`INSERT OR REPLACE INTO sync_state (source, lastSync) VALUES (?, ?)`),
  getSyncState: db.prepare(`SELECT lastSync FROM sync_state WHERE source = ?`)
};

export const cache = {
  upsertNote(note: Note): void {
    stmts.upsert.run(note.id, note.title, note.content, note.source, note.sourceId, note.modifiedAt.getTime(), JSON.stringify(note.metadata || {}));
  },

  upsertMany(notes: Note[]): void {
    const tx = db.transaction((notes: Note[]) => notes.forEach(n => this.upsertNote(n)));
    tx(notes);
  },

  getAllNotes(): Note[] {
    return stmts.getAll.all().map(rowToNote);
  },

  getNotesBySource(source: string): Note[] {
    return stmts.getBySource.all(source).map(rowToNote);
  },

  deleteNote(id: string): void {
    stmts.delete.run(id);
  },

  clearSource(source: string): void {
    stmts.deleteBySource.run(source);
  },

  setSyncState(source: string): void {
    stmts.setSyncState.run(source, Date.now());
  },

  getSyncState(source: string): number | null {
    const row = stmts.getSyncState.get(source) as { lastSync: number } | undefined;
    return row?.lastSync ?? null;
  }
};

function rowToNote(row: any): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    source: row.source,
    sourceId: row.sourceId,
    modifiedAt: new Date(row.modifiedAt),
    metadata: JSON.parse(row.metadata || '{}')
  };
}
