/**
 * Notion adapter for indexing pages shared with a personal integration.
 * Fetches page content via the Notion API and normalizes to plain text.
 */

import { ISourceAdapter, Note, WatchCallback } from '../core/types';
import { readUserConfig } from '../main/user-config';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const SEARCH_PAGE_SIZE = 100;
const REQUEST_INTERVAL_MS = 350;
const MAX_CONTENT_CHARS = 20000;
const MAX_CHILD_DEPTH = 2;
const POLL_INTERVAL_MS = 15 * 60 * 1000;

type NotionRecord = Record<string, unknown>;

class NotionClient {
  private lastRequestAt = 0;

  constructor(private readonly token: string) {}

  async get(path: string, query?: Record<string, string | undefined>): Promise<NotionRecord> {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
    }
    const queryString = params.toString();
    const url = queryString ? `${path}?${queryString}` : path;
    return this.request(url, { method: 'GET' });
  }

  async post(path: string, body: Record<string, unknown>): Promise<NotionRecord> {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  private async request(path: string, init: RequestInit): Promise<NotionRecord> {
    await this.throttle();
    const response = await fetch(`${NOTION_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`[Notion] ${response.status} ${response.statusText} ${text}`);
    }

    return (await response.json()) as NotionRecord;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < REQUEST_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestAt = Date.now();
  }
}

export class NotionAdapter implements ISourceAdapter {
  readonly name = 'notion';

  private callback: WatchCallback | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private pollInFlight = false;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  async fetchAll(): Promise<Note[]> {
    const token = this.getToken();
    if (!token) return [];

    const client = new NotionClient(token);
    const pages = await this.searchPages(client);
    const databases = await this.searchDatabases(client);
    const databasePages = await this.fetchDatabasePages(client, databases);
    const mergedPages = this.mergePages(pages, databasePages);
    const databaseTitles = new Map<string, string>();
    const notes: Note[] = [];

    if (mergedPages.length === 0) {
      console.warn('[Notion] No pages found. Ensure pages are shared with the integration.');
    } else {
      console.log(
        `[Notion] Pages: search=${pages.length} databases=${databases.length} databasePages=${databasePages.length}`
      );
    }

    for (const page of mergedPages) {
      if (page.archived || page.in_trash) continue;
      const pageId = page.id as string | undefined;
      if (!pageId) continue;

      const title = this.extractPageTitle(page);
      const propertyText = this.extractPagePropertiesText(page);
      const bodyText = await this.fetchPageContent(client, pageId);
      const content = this.mergeContent(propertyText, bodyText);
      const folder = await this.getFolderLabel(page, client, databaseTitles);
      const editedAt = page.last_edited_time ? new Date(page.last_edited_time as string) : new Date();

      notes.push({
        id: `notion:${pageId}`,
        title: title || 'Untitled',
        content,
        source: 'notion',
        sourceId: pageId,
        modifiedAt: editedAt,
        metadata: {
          folder,
          url: page.url
        }
      });
    }

    return notes;
  }

  watch(callback: WatchCallback): void {
    this.callback = callback;
    this.resetPolling();
  }

  stop(): void {
    this.clearPolling();
    this.callback = null;
  }

  refreshWatchers(): void {
    this.resetPolling();
  }

  private resetPolling(): void {
    this.clearPolling();
    if (!this.getToken()) return;
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  private clearPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    if (this.pollInFlight) return;
    if (!this.callback) return;
    this.pollInFlight = true;
    try {
      const notes = await this.fetchAll();
      this.callback(notes);
    } catch (error) {
      console.error('[Notion] Poll error', error);
    } finally {
      this.pollInFlight = false;
    }
  }

  private getToken(): string | null {
    const token = readUserConfig().notion?.token?.trim();
    return token && token.length > 0 ? token : null;
  }

  private async searchPages(client: NotionClient): Promise<NotionRecord[]> {
    const results: NotionRecord[] = [];
    let cursor: string | null = null;

    do {
      const body: Record<string, unknown> = {
        page_size: SEARCH_PAGE_SIZE,
        filter: {
          property: 'object',
          value: 'page'
        }
      };
      if (cursor) body.start_cursor = cursor;

      const response = await client.post('/search', body);
      const pageResults = (response.results as NotionRecord[]) || [];
      results.push(...pageResults);
      cursor = response.has_more ? (response.next_cursor as string | null) : null;
    } while (cursor);

    return results;
  }

  private async searchDatabases(client: NotionClient): Promise<NotionRecord[]> {
    const results: NotionRecord[] = [];
    let cursor: string | null = null;

    do {
      const body: Record<string, unknown> = {
        page_size: SEARCH_PAGE_SIZE,
        filter: {
          property: 'object',
          value: 'database'
        }
      };
      if (cursor) body.start_cursor = cursor;

      const response = await client.post('/search', body);
      const dbResults = (response.results as NotionRecord[]) || [];
      results.push(...dbResults);
      cursor = response.has_more ? (response.next_cursor as string | null) : null;
    } while (cursor);

    return results;
  }

  private async fetchDatabasePages(client: NotionClient, databases: NotionRecord[]): Promise<NotionRecord[]> {
    const results: NotionRecord[] = [];
    for (const database of databases) {
      const databaseId = database.id as string | undefined;
      if (!databaseId) continue;
      try {
        const pages = await this.queryDatabase(client, databaseId);
        results.push(...pages);
      } catch (error) {
        console.error('[Notion] Database query failed', databaseId, error);
      }
    }
    return results;
  }

  private async queryDatabase(client: NotionClient, databaseId: string): Promise<NotionRecord[]> {
    const results: NotionRecord[] = [];
    let cursor: string | null = null;

    do {
      const body: Record<string, unknown> = { page_size: SEARCH_PAGE_SIZE };
      if (cursor) body.start_cursor = cursor;

      const response = await client.post(`/databases/${databaseId}/query`, body);
      const pageResults = (response.results as NotionRecord[]) || [];
      results.push(...pageResults);
      cursor = response.has_more ? (response.next_cursor as string | null) : null;
    } while (cursor);

    return results;
  }

  private mergePages(...groups: NotionRecord[][]): NotionRecord[] {
    const map = new Map<string, NotionRecord>();
    for (const group of groups) {
      for (const page of group) {
        const pageId = page.id as string | undefined;
        if (!pageId) continue;
        if (!map.has(pageId)) map.set(pageId, page);
      }
    }
    return Array.from(map.values());
  }

  private async fetchPageContent(client: NotionClient, pageId: string): Promise<string> {
    const chunks: string[] = [];
    const state = { length: 0, done: false };
    await this.collectBlockText(client, pageId, 0, chunks, state);
    return this.normalizeText(chunks.join('\n'));
  }

  private mergeContent(...parts: string[]): string {
    const merged = parts
      .map(part => part.trim())
      .filter(part => part.length > 0)
      .join('\n\n');
    if (merged.length <= MAX_CONTENT_CHARS) return this.normalizeText(merged);
    return this.normalizeText(merged.slice(0, MAX_CONTENT_CHARS));
  }

  private async collectBlockText(
    client: NotionClient,
    blockId: string,
    depth: number,
    chunks: string[],
    state: { length: number; done: boolean }
  ): Promise<void> {
    if (state.done || depth > MAX_CHILD_DEPTH) return;
    let cursor: string | null = null;

    do {
      const response = await client.get(`/blocks/${blockId}/children`, {
        page_size: String(SEARCH_PAGE_SIZE),
        start_cursor: cursor || undefined
      });
      const blocks = (response.results as NotionRecord[]) || [];
      for (const block of blocks) {
        const text = this.extractBlockText(block);
        if (text) {
          this.appendChunk(chunks, text, state);
          if (state.done) return;
        }
        if (block.has_children && depth < MAX_CHILD_DEPTH) {
          const childId = block.id as string | undefined;
          if (childId) {
            await this.collectBlockText(client, childId, depth + 1, chunks, state);
            if (state.done) return;
          }
        }
      }
      cursor = response.has_more ? (response.next_cursor as string | null) : null;
    } while (cursor);
  }

  private extractBlockText(block: NotionRecord): string {
    const type = block.type as string | undefined;
    if (!type) return '';
    const data = block[type] as NotionRecord | undefined;
    if (!data) return '';

    const parts: string[] = [];
    const pushRichText = (items: unknown): void => {
      if (!Array.isArray(items)) return;
      const text = items
        .map(item => (item as NotionRecord).plain_text)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join('');
      if (text) parts.push(text);
    };

    pushRichText(data.rich_text);
    pushRichText(data.text);
    pushRichText(data.title);
    pushRichText(data.caption);

    if (type === 'equation' && typeof data.expression === 'string') {
      parts.push(data.expression);
    }
    if (type === 'bookmark' && typeof data.url === 'string') {
      parts.push(data.url);
    }
    if (type === 'table_row' && Array.isArray(data.cells)) {
      data.cells.forEach(cell => pushRichText(cell));
    }
    if (type === 'child_page' && typeof data.title === 'string') {
      parts.push(data.title);
    }
    if (type === 'child_database' && typeof data.title === 'string') {
      parts.push(data.title);
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  private appendChunk(chunks: string[], text: string, state: { length: number; done: boolean }): void {
    if (state.done || !text) return;
    const remaining = MAX_CONTENT_CHARS - state.length;
    if (remaining <= 0) {
      state.done = true;
      return;
    }
    if (text.length > remaining) {
      chunks.push(text.slice(0, remaining));
      state.length = MAX_CONTENT_CHARS;
      state.done = true;
      return;
    }
    chunks.push(text);
    state.length += text.length;
  }

  private extractPageTitle(page: NotionRecord): string {
    const properties = page.properties as Record<string, NotionRecord> | undefined;
    if (properties) {
      for (const value of Object.values(properties)) {
        if (value.type === 'title' && Array.isArray(value.title)) {
          const title = value.title
            .map(item => (item as NotionRecord).plain_text)
            .filter((item): item is string => typeof item === 'string' && item.length > 0)
            .join('');
          if (title) return title;
        }
      }
    }
    return '';
  }

  private extractPagePropertiesText(page: NotionRecord): string {
    const properties = page.properties as Record<string, NotionRecord> | undefined;
    if (!properties) return '';

    const lines: string[] = [];
    for (const [name, property] of Object.entries(properties)) {
      const value = this.extractPropertyText(property);
      if (value) lines.push(`${name}: ${value}`);
    }

    return lines.join('\n');
  }

  private extractPropertyText(property: NotionRecord): string {
    const type = property.type as string | undefined;
    if (!type) return '';
    const value = property[type] as unknown;

    switch (type) {
      case 'title':
      case 'rich_text':
        return this.extractRichText(value);
      case 'select':
      case 'status':
        return this.extractName(value);
      case 'multi_select':
        return this.extractNameList(value);
      case 'number':
        return typeof value === 'number' ? String(value) : '';
      case 'checkbox':
        return value === true ? 'true' : value === false ? 'false' : '';
      case 'url':
      case 'email':
      case 'phone_number':
        return typeof value === 'string' ? value : '';
      case 'date':
        return this.extractDate(value);
      case 'people':
        return this.extractPeople(value);
      case 'files':
        return this.extractFiles(value);
      case 'formula':
        return this.extractFormula(value);
      case 'rollup':
        return this.extractRollup(value);
      default:
        return '';
    }
  }

  private extractRichText(value: unknown): string {
    if (!Array.isArray(value)) return '';
    return value
      .map(item => (item as NotionRecord).plain_text)
      .filter((text): text is string => typeof text === 'string' && text.length > 0)
      .join('');
  }

  private extractName(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const name = (value as NotionRecord).name;
    return typeof name === 'string' ? name : '';
  }

  private extractNameList(value: unknown): string {
    if (!Array.isArray(value)) return '';
    return value
      .map(item => this.extractName(item))
      .filter(text => text.length > 0)
      .join(', ');
  }

  private extractDate(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const start = (value as NotionRecord).start;
    const end = (value as NotionRecord).end;
    const startText = typeof start === 'string' ? start : '';
    const endText = typeof end === 'string' ? end : '';
    if (startText && endText) return `${startText} - ${endText}`;
    return startText || endText;
  }

  private extractPeople(value: unknown): string {
    if (!Array.isArray(value)) return '';
    return value
      .map(person => {
        if (!person || typeof person !== 'object') return '';
        const name = (person as NotionRecord).name;
        if (typeof name === 'string' && name.length > 0) return name;
        const personInfo = (person as NotionRecord).person as NotionRecord | undefined;
        if (personInfo && typeof personInfo.email === 'string') return personInfo.email;
        return '';
      })
      .filter(text => text.length > 0)
      .join(', ');
  }

  private extractFiles(value: unknown): string {
    if (!Array.isArray(value)) return '';
    return value
      .map(file => {
        if (!file || typeof file !== 'object') return '';
        const name = (file as NotionRecord).name;
        if (typeof name === 'string' && name.length > 0) return name;
        const fileInfo = (file as NotionRecord).file as NotionRecord | undefined;
        if (fileInfo && typeof fileInfo.url === 'string') return fileInfo.url;
        const externalInfo = (file as NotionRecord).external as NotionRecord | undefined;
        if (externalInfo && typeof externalInfo.url === 'string') return externalInfo.url;
        return '';
      })
      .filter(text => text.length > 0)
      .join(', ');
  }

  private extractFormula(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const type = (value as NotionRecord).type;
    if (typeof type !== 'string') return '';
    const formulaValue = (value as NotionRecord)[type];
    if (typeof formulaValue === 'string' || typeof formulaValue === 'number') {
      return String(formulaValue);
    }
    if (typeof formulaValue === 'boolean') return formulaValue ? 'true' : 'false';
    if (formulaValue && typeof formulaValue === 'object') {
      return this.extractDate(formulaValue);
    }
    return '';
  }

  private extractRollup(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const type = (value as NotionRecord).type;
    if (typeof type !== 'string') return '';
    const rollupValue = (value as NotionRecord)[type];
    if (Array.isArray(rollupValue)) {
      const items = rollupValue
        .map(item => {
          if (!item || typeof item !== 'object') return '';
          const itemType = (item as NotionRecord).type;
          if (typeof itemType !== 'string') return '';
          return this.extractPropertyText({ type: itemType, [itemType]: (item as NotionRecord)[itemType] });
        })
        .filter(text => text.length > 0);
      return items.join(', ');
    }
    if (typeof rollupValue === 'number') return String(rollupValue);
    if (rollupValue && typeof rollupValue === 'object') return this.extractDate(rollupValue);
    return '';
  }

  private async getFolderLabel(
    page: NotionRecord,
    client: NotionClient,
    databaseTitles: Map<string, string>
  ): Promise<string> {
    const parent = page.parent as NotionRecord | undefined;
    if (!parent || typeof parent.type !== 'string') return 'Notion';

    if (parent.type === 'database_id' && typeof parent.database_id === 'string') {
      const title = await this.getDatabaseTitle(client, parent.database_id, databaseTitles);
      return `Notion • ${title}`;
    }

    if (parent.type === 'page_id') return 'Notion • Page';
    if (parent.type === 'workspace') return 'Notion • Workspace';

    return 'Notion';
  }

  private async getDatabaseTitle(
    client: NotionClient,
    databaseId: string,
    cache: Map<string, string>
  ): Promise<string> {
    if (cache.has(databaseId)) {
      return cache.get(databaseId) as string;
    }

    try {
      const response = await client.get(`/databases/${databaseId}`);
      const title = Array.isArray(response.title)
        ? response.title
            .map(item => (item as NotionRecord).plain_text)
            .filter((item): item is string => typeof item === 'string' && item.length > 0)
            .join('')
        : '';
      const resolved = title || 'Database';
      cache.set(databaseId, resolved);
      return resolved;
    } catch (error) {
      console.error('[Notion] Failed to fetch database title', databaseId, error);
      cache.set(databaseId, 'Database');
      return 'Database';
    }
  }

  private normalizeText(input: string): string {
    return input.replace(/\r\n/g, '\n').trim();
  }
}
