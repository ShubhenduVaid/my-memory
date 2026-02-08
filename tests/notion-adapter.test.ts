import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const readUserConfigMock = vi.fn();

vi.mock('../src/main/user-config', () => ({
  readUserConfig: readUserConfigMock
}));

const { NotionAdapter } = await import('../src/adapters/notion');

function jsonResponse(data: any, init?: { ok?: boolean; status?: number; statusText?: string }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 500);
  const statusText = init?.statusText ?? (ok ? 'OK' : 'ERR');
  return {
    ok,
    status,
    statusText,
    json: async () => data,
    text: async () => (typeof data === 'string' ? data : JSON.stringify(data))
  } as any;
}

describe('NotionAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    readUserConfigMock.mockReset();
    // Avoid NotionClient throttling delays.
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('returns empty when token is missing', async () => {
    readUserConfigMock.mockReturnValue({ notion: { token: '   ' } });
    const adapter = new NotionAdapter();
    const notes = await adapter.fetchAll();
    expect(notes).toEqual([]);
  });

  it('fetchAll builds notes from pages + databases and normalizes content', async () => {
    readUserConfigMock.mockReturnValue({ notion: { token: 'token' } });

    const p1 = {
      object: 'page',
      id: 'p1',
      url: 'https://notion.so/p1',
      last_edited_time: '2024-01-03T00:00:00.000Z',
      parent: { type: 'database_id', database_id: 'db1' },
      properties: {
        Name: { type: 'title', title: [{ plain_text: 'Page One' }] },
        Status: { type: 'status', status: { name: 'In Progress' } },
        Tags: { type: 'multi_select', multi_select: [{ name: 'Tag1' }, { name: 'Tag2' }] },
        Count: { type: 'number', number: 42 },
        Done: { type: 'checkbox', checkbox: false },
        Website: { type: 'url', url: 'https://example.com' },
        Email: { type: 'email', email: 'a@b.com' },
        Phone: { type: 'phone_number', phone_number: '+1' },
        When: { type: 'date', date: { start: '2024-01-01', end: '2024-01-02' } },
        People: {
          type: 'people',
          people: [{ name: 'Alice' }, { person: { email: 'bob@example.com' } }]
        },
        Files: {
          type: 'files',
          files: [{ name: 'f1' }, { file: { url: 'https://x' } }, { external: { url: 'https://y' } }]
        },
        Formula: { type: 'formula', formula: { type: 'string', string: 'computed' } },
        Rollup: {
          type: 'rollup',
          rollup: {
            type: 'array',
            array: [{ type: 'number', number: 1 }, { type: 'checkbox', checkbox: true }]
          }
        },
        Unknown: { type: 'unknown', unknown: {} }
      }
    };

    const p2 = {
      object: 'page',
      id: 'p2',
      url: 'https://notion.so/p2',
      last_edited_time: '2024-01-04T00:00:00.000Z',
      parent: { type: 'workspace' },
      properties: {
        Title: { type: 'title', title: [{ plain_text: 'Workspace Page' }] },
        Notes: { type: 'rich_text', rich_text: [{ plain_text: 'hello' }, { plain_text: ' world' }] }
      }
    };

    const p3Archived = { object: 'page', id: 'p3', archived: true, parent: { type: 'workspace' }, properties: {} };

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      const u = new URL(url);
      const path = u.pathname;

      if (path.endsWith('/search') && method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const value = body?.filter?.value;
        if (value === 'page') {
          return jsonResponse({ results: [p2, p3Archived], has_more: false, next_cursor: null });
        }
        if (value === 'database') {
          return jsonResponse({ results: [{ object: 'database', id: 'db1' }, { object: 'database', id: 'db2' }], has_more: false, next_cursor: null });
        }
        return jsonResponse({ results: [], has_more: false, next_cursor: null });
      }

      if (path.endsWith('/databases/db1/query') && method === 'POST') {
        return jsonResponse({ results: [p1], has_more: false, next_cursor: null });
      }

      if (path.endsWith('/databases/db2/query') && method === 'POST') {
        return jsonResponse('nope', { ok: false, status: 401, statusText: 'Unauthorized' });
      }

      if (path.endsWith('/databases/db1') && method === 'GET') {
        return jsonResponse({ title: [{ plain_text: 'My DB' }] });
      }

      if (path.endsWith('/blocks/p1/children') && method === 'GET') {
        return jsonResponse({
          results: [
            { id: 't1', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Hello' }] } },
            { id: 'e1', type: 'equation', equation: { expression: 'E=mc2' } },
            { id: 'bmk', type: 'bookmark', bookmark: { url: 'https://example.com' } },
            { id: 'tr1', type: 'table_row', table_row: { cells: [[{ plain_text: 'Cell1' }]] } },
            { id: 'cp1', type: 'child_page', child_page: { title: 'Child' } },
            { id: 'cd1', type: 'child_database', child_database: { title: 'ChildDB' } },
            { id: 'b1', type: 'paragraph', paragraph: { rich_text: [] }, has_children: true },
            { id: 'long', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'x'.repeat(21000) }] } }
          ],
          has_more: false,
          next_cursor: null
        });
      }

      if (path.endsWith('/blocks/b1/children') && method === 'GET') {
        return jsonResponse({
          results: [{ id: 't2', type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Nested child' }] } }],
          has_more: false,
          next_cursor: null
        });
      }

      if (path.endsWith('/blocks/p2/children') && method === 'GET') {
        return jsonResponse({ results: [], has_more: false, next_cursor: null });
      }

      return jsonResponse('not found', { ok: false, status: 404, statusText: 'Not Found' });
    });

    globalThis.fetch = fetchMock as any;

    const adapter = new NotionAdapter();
    const notes = await adapter.fetchAll();

    const byId = new Map(notes.map(n => [n.sourceId, n]));
    expect(notes).toHaveLength(2);

    const note1 = byId.get('p1');
    expect(note1?.title).toBe('Page One');
    expect(note1?.metadata?.folder).toBe('Notion • My DB');
    expect(note1?.content).toContain('Status: In Progress');
    expect(note1?.content).toContain('Tags: Tag1, Tag2');
    expect(note1?.content).toContain('Done: false');
    expect(note1?.content).toContain('Rollup: 1, true');
    expect(note1?.content).toContain('Hello');
    expect(note1?.content).toContain('E=mc2');
    expect(note1?.content).toContain('Cell1');
    expect(note1?.content).toContain('ChildDB');
    expect((note1?.content || '').length).toBeLessThanOrEqual(20000);

    const note2 = byId.get('p2');
    expect(note2?.title).toBe('Workspace Page');
    expect(note2?.metadata?.folder).toBe('Notion • Workspace');
    expect(note2?.content).toContain('Notes: hello world');
  });

  it('surfaces Notion API failures with useful errors', async () => {
    readUserConfigMock.mockReturnValue({ notion: { token: 'token' } });
    globalThis.fetch = vi.fn(async () => jsonResponse('nope', { ok: false, status: 400, statusText: 'Bad Request' })) as any;

    const adapter = new NotionAdapter();
    await expect(adapter.fetchAll()).rejects.toThrow('[Notion] 400 Bad Request');
  });

  it('warns when no pages are found', async () => {
    readUserConfigMock.mockReturnValue({ notion: { token: 'token' } });
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      const u = new URL(url);
      if (u.pathname.endsWith('/search') && method === 'POST') {
        return jsonResponse({ results: [], has_more: false, next_cursor: null });
      }
      return jsonResponse('not found', { ok: false, status: 404, statusText: 'Not Found' });
    }) as any;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new NotionAdapter();
    const notes = await adapter.fetchAll();

    expect(notes).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      '[Notion] No pages found. Ensure pages are shared with the integration.'
    );
    warnSpy.mockRestore();
  });

  it('labels folders for page parents and unknown parents', async () => {
    readUserConfigMock.mockReturnValue({ notion: { token: 'token' } });

    const pPage = {
      object: 'page',
      id: 'pPage',
      url: 'https://notion.so/pPage',
      last_edited_time: '2024-01-01T00:00:00.000Z',
      parent: { type: 'page_id', page_id: 'root' },
      properties: { Name: { type: 'title', title: [{ plain_text: 'Page Parent' }] } }
    };

    const pUnknown = {
      object: 'page',
      id: 'pUnknown',
      url: 'https://notion.so/pUnknown',
      last_edited_time: '2024-01-01T00:00:00.000Z',
      parent: { type: 'block_id', block_id: 'b' },
      properties: { Name: { type: 'title', title: [{ plain_text: 'Unknown Parent' }] } }
    };

    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      const u = new URL(url);
      const path = u.pathname;

      if (path.endsWith('/search') && method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const value = body?.filter?.value;
        if (value === 'page') return jsonResponse({ results: [pPage, pUnknown], has_more: false, next_cursor: null });
        if (value === 'database') return jsonResponse({ results: [], has_more: false, next_cursor: null });
      }

      if (path.endsWith('/blocks/pPage/children') && method === 'GET') {
        return jsonResponse({ results: [], has_more: false, next_cursor: null });
      }
      if (path.endsWith('/blocks/pUnknown/children') && method === 'GET') {
        return jsonResponse({ results: [], has_more: false, next_cursor: null });
      }

      return jsonResponse('not found', { ok: false, status: 404, statusText: 'Not Found' });
    }) as any;

    const adapter = new NotionAdapter();
    const notes = await adapter.fetchAll();
    const byId = new Map(notes.map(n => [n.sourceId, n]));

    expect(byId.get('pPage')?.metadata?.folder).toBe('Notion • Page');
    expect(byId.get('pUnknown')?.metadata?.folder).toBe('Notion');
  });

  it('caches database titles and falls back to "Database" when title lookup fails', async () => {
    readUserConfigMock.mockReturnValue({ notion: { token: 'token' } });

    const p1 = {
      object: 'page',
      id: 'p1',
      url: 'https://notion.so/p1',
      last_edited_time: '2024-01-01T00:00:00.000Z',
      parent: { type: 'database_id', database_id: 'db1' },
      properties: { Name: { type: 'title', title: [{ plain_text: 'One' }] } }
    };
    const p2 = {
      object: 'page',
      id: 'p2',
      url: 'https://notion.so/p2',
      last_edited_time: '2024-01-01T00:00:00.000Z',
      parent: { type: 'database_id', database_id: 'db1' },
      properties: { Name: { type: 'title', title: [{ plain_text: 'Two' }] } }
    };

    const dbTitleCalls: string[] = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method || 'GET';
      const u = new URL(url);
      const path = u.pathname;

      if (path.endsWith('/search') && method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const value = body?.filter?.value;
        if (value === 'page') return jsonResponse({ results: [], has_more: false, next_cursor: null });
        if (value === 'database') return jsonResponse({ results: [{ object: 'database', id: 'db1' }], has_more: false, next_cursor: null });
      }

      if (path.endsWith('/databases/db1/query') && method === 'POST') {
        return jsonResponse({ results: [p1, p2], has_more: false, next_cursor: null });
      }

      if (path.endsWith('/databases/db1') && method === 'GET') {
        dbTitleCalls.push(path);
        return jsonResponse('nope', { ok: false, status: 500, statusText: 'ERR' });
      }

      if (path.endsWith('/blocks/p1/children') && method === 'GET') {
        return jsonResponse({ results: [], has_more: false, next_cursor: null });
      }
      if (path.endsWith('/blocks/p2/children') && method === 'GET') {
        return jsonResponse({ results: [], has_more: false, next_cursor: null });
      }

      return jsonResponse('not found', { ok: false, status: 404, statusText: 'Not Found' });
    }) as any;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapter = new NotionAdapter();
    const notes = await adapter.fetchAll();
    errorSpy.mockRestore();

    // Database title lookup should be attempted once; second page should hit the in-memory cache.
    expect(dbTitleCalls).toHaveLength(1);

    const folders = notes.map(n => n.metadata?.folder);
    expect(folders).toEqual(['Notion • Database', 'Notion • Database']);
  });

  it('watch polls on an interval when token exists and avoids overlap', async () => {
    vi.useFakeTimers();
    readUserConfigMock.mockReturnValue({ notion: { token: 'token' } });

    const adapter = new NotionAdapter();
    const updates: any[] = [];

    let resolveFetch: (() => void) | undefined;
    const fetchPromise = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchAllSpy = vi
      .spyOn(adapter, 'fetchAll')
      .mockImplementationOnce(() => fetchPromise.then(() => []))
      .mockResolvedValueOnce([]);

    adapter.watch((notes) => updates.push(notes));

    // First tick starts a poll (in flight).
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1);
    expect(fetchAllSpy).toHaveBeenCalledTimes(1);

    // Second tick while in-flight should be ignored.
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1);
    expect(fetchAllSpy).toHaveBeenCalledTimes(1);

    resolveFetch?.();
    await Promise.resolve();

    // Next interval should poll again.
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1);
    await Promise.resolve();
    expect(fetchAllSpy).toHaveBeenCalledTimes(2);

    adapter.stop();
    vi.useRealTimers();
  });
});
