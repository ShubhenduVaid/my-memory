/**
 * SQLite-based cache for storing notes locally.
 * Provides fast access to notes without re-fetching from sources.
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { Note } from './types';

// Initialize database
const dbPath = join(app.getPath('userData'), 'cache.db');
const db = new Database(dbPath);

// Create tables if they don't exist
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

// Prepared statements for better performance
const statements = {
  upsert: db.prepare(
    `INSERT OR REPLACE INTO notes (id, title, content, source, sourceId, modifiedAt, metadata) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ),
  getAll: db.prepare(`SELECT * FROM notes`),
  getBySource: db.prepare(`SELECT * FROM notes WHERE source = ?`),
  delete: db.prepare(`DELETE FROM notes WHERE id = ?`),
  deleteBySource: db.prepare(`DELETE FROM notes WHERE source = ?`),
  setSyncState: db.prepare(`INSERT OR REPLACE INTO sync_state (source, lastSync) VALUES (?, ?)`),
  getSyncState: db.prepare(`SELECT lastSync FROM sync_state WHERE source = ?`)
};

/** Convert a database row to a Note object */
function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    source: row.source as string,
    sourceId: row.sourceId as string,
    modifiedAt: new Date(row.modifiedAt as number),
    metadata: JSON.parse((row.metadata as string) || '{}')
  };
}

/** Cache operations for notes storage */
export const cache = {
  /** Insert or update a single note */
  upsertNote(note: Note): void {
    statements.upsert.run(
      note.id,
      note.title,
      note.content,
      note.source,
      note.sourceId,
      note.modifiedAt.getTime(),
      JSON.stringify(note.metadata || {})
    );
  },

  /** Insert or update multiple notes in a transaction */
  upsertMany(notes: Note[]): void {
    const transaction = db.transaction((notes: Note[]) => {
      notes.forEach(note => this.upsertNote(note));
    });
    transaction(notes);
  },

  /** Get all cached notes */
  getAllNotes(): Note[] {
    return (statements.getAll.all() as Record<string, unknown>[]).map(rowToNote);
  },

  /** Get notes from a specific source */
  getNotesBySource(source: string): Note[] {
    return (statements.getBySource.all(source) as Record<string, unknown>[]).map(rowToNote);
  },

  /** Delete a note by ID */
  deleteNote(id: string): void {
    statements.delete.run(id);
  },

  /** Clear all notes from a specific source */
  clearSource(source: string): void {
    statements.deleteBySource.run(source);
  },

  /** Update the last sync timestamp for a source */
  setSyncState(source: string): void {
    statements.setSyncState.run(source, Date.now());
  },

  /** Get the last sync timestamp for a source */
  getSyncState(source: string): number | null {
    const row = statements.getSyncState.get(source) as { lastSync: number } | undefined;
    return row?.lastSync ?? null;
  }
};
