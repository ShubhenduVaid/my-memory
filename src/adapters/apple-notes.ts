/**
 * Apple Notes adapter using JavaScript for Automation (JXA).
 * Fetches notes via osascript and watches for changes via SQLite file.
 */

import { execFile } from 'child_process';
import { watch, FSWatcher } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { ISourceAdapter, Note, WatchCallback } from '../core/types';

/** JXA script to fetch all notes from Apple Notes */
const JXA_SCRIPT = `
const notes = Application("Notes");
const result = [];

for (const account of notes.accounts()) {
  for (const folder of account.folders()) {
    const folderName = folder.name();
    for (const note of folder.notes()) {
      result.push({
        id: note.id(),
        name: note.name(),
        body: note.plaintext(),
        folder: folderName,
        account: account.name(),
        creationDate: note.creationDate().toISOString(),
        modificationDate: note.modificationDate().toISOString()
      });
    }
  }
}

JSON.stringify(result);
`;

/** Raw note data from JXA script */
interface RawNote {
  id: string;
  name: string;
  body: string;
  folder: string;
  account: string;
  creationDate: string;
  modificationDate: string;
}

export class AppleNotesAdapter implements ISourceAdapter {
  readonly name = 'apple-notes';

  private watcher: FSWatcher | null = null;
  private callback: WatchCallback | null = null;
  private readonly dbPath = join(
    homedir(),
    'Library/Group Containers/group.com.apple.notes/NoteStore.sqlite'
  );

  async initialize(): Promise<void> {
    // No initialization needed
  }

  /** Fetch all notes from Apple Notes using JXA */
  async fetchAll(): Promise<Note[]> {
    return new Promise((resolve, reject) => {
      execFile('osascript', ['-l', 'JavaScript', '-e', JXA_SCRIPT], (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          const rawNotes: RawNote[] = JSON.parse(stdout);
          const notes = rawNotes.map(raw => this.transformNote(raw));
          resolve(notes);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  /** Transform raw JXA note to our Note format */
  private transformNote(raw: RawNote): Note {
    return {
      id: `apple-notes:${raw.id}`,
      title: raw.name,
      content: raw.body,
      source: 'apple-notes',
      sourceId: raw.id,
      modifiedAt: new Date(raw.modificationDate),
      metadata: {
        folder: raw.folder,
        account: raw.account
      }
    };
  }

  /** Watch for changes to Apple Notes database */
  watch(callback: WatchCallback): void {
    this.callback = callback;
    this.watcher = watch(this.dbPath, { persistent: false }, async () => {
      if (this.callback) {
        try {
          const notes = await this.fetchAll();
          this.callback(notes);
        } catch (error) {
          console.error('[AppleNotes] Watch error:', error);
        }
      }
    });
  }

  /** Stop watching for changes */
  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    this.callback = null;
  }
}
