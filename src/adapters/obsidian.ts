/**
 * Obsidian adapter for indexing vault markdown files.
 * Reads vault folders and converts notes into searchable content.
 */

import { promises as fsPromises, watch, FSWatcher } from 'fs';
import * as path from 'path';
import { ISourceAdapter, Note, WatchCallback } from '../core/types';
import { readUserConfig } from '../main/user-config';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.obsidian', '.Trash']);
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_CONTENT_CHARS = 20000;
const RESCAN_DEBOUNCE_MS = 1500;

export class ObsidianAdapter implements ISourceAdapter {
  readonly name = 'obsidian';

  private callback: WatchCallback | null = null;
  private watchers: FSWatcher[] = [];
  private rescanTimer: NodeJS.Timeout | null = null;
  private rescanInFlight = false;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async fetchAll(): Promise<Note[]> {
    const vaults = readUserConfig().obsidian?.vaults ?? [];
    if (vaults.length === 0) return [];

    const notes: Note[] = [];
    for (const vault of vaults) {
      try {
        const files = await this.collectFiles(vault);
        for (const filePath of files) {
          const note = await this.fileToNote(filePath, vault);
          if (note) notes.push(note);
        }
      } catch (error) {
        console.error('[Obsidian] Scan error', vault, error);
      }
    }

    return notes;
  }

  watch(callback: WatchCallback): void {
    this.callback = callback;
    this.resetWatchers();
  }

  stop(): void {
    this.clearWatchers();
    this.callback = null;
  }

  refreshWatchers(): void {
    this.resetWatchers();
  }

  private resetWatchers(): void {
    this.clearWatchers();
    const vaults = readUserConfig().obsidian?.vaults ?? [];
    for (const vault of vaults) {
      try {
        const watcher = watch(vault, { recursive: true }, () => this.scheduleRescan());
        this.watchers.push(watcher);
      } catch (error) {
        console.error('[Obsidian] Watch error', vault, error);
      }
    }
  }

  private clearWatchers(): void {
    this.watchers.forEach(watcher => watcher.close());
    this.watchers = [];
    if (this.rescanTimer) {
      clearTimeout(this.rescanTimer);
      this.rescanTimer = null;
    }
  }

  private scheduleRescan(): void {
    if (!this.callback) return;
    if (this.rescanTimer) clearTimeout(this.rescanTimer);
    this.rescanTimer = setTimeout(async () => {
      if (this.rescanInFlight) return;
      this.rescanInFlight = true;
      try {
        const notes = await this.fetchAll();
        this.callback?.(notes);
      } catch (error) {
        console.error('[Obsidian] Rescan error', error);
      } finally {
        this.rescanInFlight = false;
      }
    }, RESCAN_DEBOUNCE_MS);
  }

  private async collectFiles(root: string): Promise<string[]> {
    const files: string[] = [];
    const stack: string[] = [root];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      let entries;
      try {
        entries = await fsPromises.readdir(current, { withFileTypes: true });
      } catch (error) {
        console.error('[Obsidian] Read dir failed', current, error);
        continue;
      }

      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (this.shouldIgnoreDir(entry.name)) continue;
          stack.push(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;
        if (!this.isSupportedFile(fullPath)) continue;
        files.push(fullPath);
      }
    }

    return files;
  }

  private shouldIgnoreDir(name: string): boolean {
    if (name.startsWith('.')) return true;
    return IGNORE_DIRS.has(name);
  }

  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return MARKDOWN_EXTENSIONS.has(ext);
  }

  private async fileToNote(filePath: string, vaultPath: string): Promise<Note | null> {
    let stat;
    try {
      stat = await fsPromises.stat(filePath);
    } catch (error) {
      console.error('[Obsidian] Stat failed', filePath, error);
      return null;
    }

    if (stat.size > MAX_TEXT_BYTES) return null;

    let content = '';
    try {
      const raw = await fsPromises.readFile(filePath, 'utf8');
      content = this.normalizeText(raw);
    } catch (error) {
      console.error('[Obsidian] Read failed', filePath, error);
      return null;
    }

    if (!content) return null;
    if (content.length > MAX_CONTENT_CHARS) content = content.slice(0, MAX_CONTENT_CHARS);

    const relative = path.relative(vaultPath, filePath) || path.basename(filePath);
    const vaultName = path.basename(vaultPath) || vaultPath;

    return {
      id: `obsidian:${encodeURIComponent(filePath)}`,
      title: relative,
      content,
      source: 'obsidian',
      sourceId: filePath,
      modifiedAt: stat.mtime,
      metadata: {
        folder: `Obsidian • ${vaultName}`,
        vault: vaultName,
        path: filePath
      }
    };
  }

  private normalizeText(input: string): string {
    return input.replace(/\r\n/g, '\n').trim();
  }
}
