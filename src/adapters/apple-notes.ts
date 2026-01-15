import { execFile } from 'child_process';
import { watch, FSWatcher } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { ISourceAdapter, Note, WatchCallback } from '../core/types';

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

export class AppleNotesAdapter implements ISourceAdapter {
  readonly name = 'apple-notes';
  private watcher: FSWatcher | null = null;
  private callback: WatchCallback | null = null;
  private dbPath = join(homedir(), 'Library/Group Containers/group.com.apple.notes/NoteStore.sqlite');

  async initialize(): Promise<void> {}

  async fetchAll(): Promise<Note[]> {
    return new Promise((resolve, reject) => {
      execFile('osascript', ['-l', 'JavaScript', '-e', JXA_SCRIPT], (err, stdout) => {
        if (err) return reject(err);
        try {
          const raw = JSON.parse(stdout);
          resolve(raw.map((n: any) => ({
            id: `apple-notes:${n.id}`,
            title: n.name,
            content: n.body,
            source: 'apple-notes',
            sourceId: n.id,
            modifiedAt: new Date(n.modificationDate),
            metadata: { folder: n.folder, account: n.account }
          })));
        } catch (e) { reject(e); }
      });
    });
  }

  watch(callback: WatchCallback): void {
    this.callback = callback;
    this.watcher = watch(this.dbPath, { persistent: false }, async () => {
      if (this.callback) {
        const notes = await this.fetchAll();
        this.callback(notes);
      }
    });
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
