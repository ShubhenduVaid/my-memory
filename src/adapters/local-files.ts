/**
 * Local files adapter for indexing folders on disk.
 * Supports markdown, text, and PDF files.
 */

import { promises as fsPromises, watch, FSWatcher } from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import { ISourceAdapter, Note, WatchCallback } from '../core/types';
import { readUserConfig } from '../main/user-config';

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.obsidian', '.Trash']);
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_CONTENT_CHARS = 20000;
const RESCAN_DEBOUNCE_MS = 1500;
const DEFAULT_RECURSIVE = true;

export class LocalFilesAdapter implements ISourceAdapter {
  readonly name = 'local-files';

  private callback: WatchCallback | null = null;
  private watchers: FSWatcher[] = [];
  private rescanTimer: NodeJS.Timeout | null = null;
  private rescanInFlight = false;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async fetchAll(): Promise<Note[]> {
    const config = readUserConfig().local;
    const folders = config?.folders ?? [];
    const recursive = config?.recursive ?? DEFAULT_RECURSIVE;
    if (folders.length === 0) return [];

    const notes: Note[] = [];
    for (const folder of folders) {
      try {
        const files = await this.collectFiles(folder, recursive);
        for (const filePath of files) {
          const note = await this.fileToNote(filePath, folder);
          if (note) notes.push(note);
        }
      } catch (error) {
        console.error('[LocalFiles] Scan error', folder, error);
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
    const config = readUserConfig().local;
    const folders = config?.folders ?? [];
    const recursive = config?.recursive ?? DEFAULT_RECURSIVE;
    for (const folder of folders) {
      try {
        const watcher = watch(folder, { recursive }, () => this.scheduleRescan());
        this.watchers.push(watcher);
      } catch (error) {
        console.error('[LocalFiles] Watch error', folder, error);
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
        console.error('[LocalFiles] Rescan error', error);
      } finally {
        this.rescanInFlight = false;
      }
    }, RESCAN_DEBOUNCE_MS);
  }

  private async collectFiles(root: string, recursive: boolean): Promise<string[]> {
    const files: string[] = [];
    const stack: string[] = [root];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      let entries;
      try {
        entries = await fsPromises.readdir(current, { withFileTypes: true });
      } catch (error) {
        console.error('[LocalFiles] Read dir failed', current, error);
        continue;
      }

      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (this.shouldIgnoreDir(entry.name)) continue;
          if (recursive) stack.push(fullPath);
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
    return TEXT_EXTENSIONS.has(ext) || PDF_EXTENSIONS.has(ext);
  }

  private async fileToNote(filePath: string, root: string): Promise<Note | null> {
    let stat;
    try {
      stat = await fsPromises.stat(filePath);
    } catch (error) {
      console.error('[LocalFiles] Stat failed', filePath, error);
      return null;
    }

    const ext = path.extname(filePath).toLowerCase();
    if (TEXT_EXTENSIONS.has(ext) && stat.size > MAX_TEXT_BYTES) return null;
    if (PDF_EXTENSIONS.has(ext) && stat.size > MAX_PDF_BYTES) return null;

    let content = '';
    try {
      if (PDF_EXTENSIONS.has(ext)) {
        content = await this.extractPdfText(filePath);
      } else {
        const raw = await fsPromises.readFile(filePath, 'utf8');
        content = this.normalizeText(raw);
      }
    } catch (error) {
      console.error('[LocalFiles] Read failed', filePath, error);
      return null;
    }

    if (!content) return null;
    if (content.length > MAX_CONTENT_CHARS) content = content.slice(0, MAX_CONTENT_CHARS);

    const relative = path.relative(root, filePath) || path.basename(filePath);
    const folderLabel = path.basename(root) || root;

    return {
      id: `local-file:${encodeURIComponent(filePath)}`,
      title: relative,
      content,
      source: 'local-files',
      sourceId: filePath,
      modifiedAt: stat.mtime,
      metadata: {
        folder: `Local • ${folderLabel}`,
        path: filePath
      }
    };
  }

  private async extractPdfText(filePath: string): Promise<string> {
    const buffer = await fsPromises.readFile(filePath);
    const parsed = await pdfParse(buffer);
    return this.normalizePdfText(parsed.text || '');
  }

  private normalizeText(input: string): string {
    return input.replace(/\r\n/g, '\n').trim();
  }

  private normalizePdfText(input: string): string {
    return input.replace(/\s+/g, ' ').trim();
  }
}
