import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Note } from '../src/core/types';

const cacheMock = {
  getAllNotes: vi.fn<[], Note[]>()
};

vi.mock('../src/core/cache', () => ({
  cache: cacheMock
}));

const { SearchManager } = await import('../src/core/search-manager');

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id || 'n1',
    title: overrides.title || 'Untitled',
    content: overrides.content || '',
    source: overrides.source || 'test',
    sourceId: overrides.sourceId || '1',
    modifiedAt: overrides.modifiedAt || new Date(),
    metadata: overrides.metadata
  };
}

describe('SearchManager', () => {
  beforeEach(() => {
    cacheMock.getAllNotes.mockReset();
  });

  it('returns empty results when cache is empty', () => {
    cacheMock.getAllNotes.mockReturnValue([]);
    const sm = new SearchManager();

    expect(sm.searchLocal('anything')).toEqual([]);
  });

  it('logs empty cache only once per instance', () => {
    cacheMock.getAllNotes.mockReturnValue([]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sm = new SearchManager();

    sm.searchLocal('a');
    sm.searchLocal('b');

    expect(logSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });

  it('performs smart keyword search with stop word filtering', () => {
    cacheMock.getAllNotes.mockReturnValue([
      makeNote({
        id: 'n1',
        title: 'Meeting',
        content: 'Discussed Project Alpha timeline',
        metadata: { folder: 'Work' }
      }),
      makeNote({
        id: 'n2',
        title: 'Personal',
        content: 'Grocery list',
        metadata: { folder: 'Home' }
      })
    ]);

    const sm = new SearchManager();
    const results = sm.searchLocal('what did i discuss about project alpha?');

    expect(results.map(r => r.id)).toEqual(['n1']);
    expect(results[0]?.title).toBe('Meeting');
    expect(results[0]?.folder).toContain('Work');
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it('falls back to substring search when no meaningful query tokens', () => {
    cacheMock.getAllNotes.mockReturnValue([
      makeNote({ id: 'n1', title: 'Alpha', content: 'hello world' }),
      makeNote({ id: 'n2', title: 'Beta', content: 'zzz' })
    ]);

    const sm = new SearchManager();
    // Tokenization drops 1-char tokens; this forces substring fallback.
    const results = sm.searchLocal('a');

    expect(results.map(r => r.id)).toContain('n1');
  });

  it('prepends an AI answer when LLM service is available', async () => {
    cacheMock.getAllNotes.mockReturnValue([
      makeNote({ id: 'n1', title: 'Alpha', content: 'Project Alpha was approved', metadata: { folder: 'Work' } })
    ]);

    const sm = new SearchManager();
    const fakeLlm = {
      isAvailable: () => true,
      getCurrentProvider: () => 'gemini',
      generate: vi.fn(async ({ prompt }: { prompt: string }) => {
        // Prompt should contain notes context.
        expect(prompt).toContain('Notes:');
        expect(prompt).toContain('Question:');
        return { text: 'Answer from notes', model: 'fake' };
      })
    };

    sm.setLLMService(fakeLlm as any);
    const results = await sm.search('what about alpha?');

    expect(results[0]?.id).toBe('ai-answer');
    expect(results[0]?.title).toContain('Gemini');
    expect(results[0]?.content).toBe('Answer from notes');
    expect(results[1]?.id).toBe('n1');
  });

  it('returns matches only when LLM service is missing/unavailable', async () => {
    cacheMock.getAllNotes.mockReturnValue([
      makeNote({ id: 'n1', title: 'Alpha', content: 'Project Alpha was approved', metadata: { folder: 'Work' } })
    ]);

    const sm = new SearchManager();
    const results = await sm.search('alpha');
    expect(results.map(r => r.id)).toEqual(['n1']);

    const unavailableLlm = { isAvailable: () => false };
    sm.setLLMService(unavailableLlm as any);
    const results2 = await sm.search('alpha');
    expect(results2.map(r => r.id)).toEqual(['n1']);
  });

  it('logs when no matches are found (with normalized/truncated query)', async () => {
    cacheMock.getAllNotes.mockReturnValue([
      makeNote({ id: 'n1', title: 'Alpha', content: 'Project Alpha' })
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sm = new SearchManager();

    const long = '   ' + 'x'.repeat(200) + '   ';
    const results = await sm.search(long);
    expect(results).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('no matches for'));
    expect(logSpy.mock.calls.some(c => String(c[0]).includes('...'))).toBe(true);

    logSpy.mockRestore();
  });

  it('includes format hints and extracts line excerpts in prompts', async () => {
    cacheMock.getAllNotes.mockReturnValue([
      makeNote({
        id: 'n1',
        title: 'Chat',
        content: [
          '2024-01-01 10:00 Alice: hello',
          '2024-01-01 10:01 Bob: project alpha',
          '2024-01-01 10:02 Alice: ok'
        ].join('\n'),
        metadata: { folder: 'Work' }
      }),
      makeNote({
        id: 'n2',
        title: 'Row',
        content: ['Name: Alice', 'Role: Manager', 'Team: Alpha', 'Status: Active'].join('\n'),
        metadata: { folder: 'DB' }
      })
    ]);

    const sm = new SearchManager();
    const fakeLlm = {
      isAvailable: () => true,
      getCurrentProvider: () => 'ollama',
      generate: vi.fn(async ({ prompt }: { prompt: string }) => {
        expect(prompt).toContain('Format: chat log');
        expect(prompt).toContain('Format: database row');
        expect(prompt).toContain('Alice: hello');
        // extractLineExcerpt adds separators.
        expect(prompt).toContain('...\n');
        return { text: 'ok', model: 'm' };
      })
    };

    sm.setLLMService(fakeLlm as any);
    const results = await sm.search('alpha');
    expect(results[0]?.id).toBe('ai-answer');
    expect(results[0]?.title).toContain('Ollama');
  });

  it('streams AI answer and returns final results', async () => {
    cacheMock.getAllNotes.mockReturnValue([
      makeNote({ id: 'n1', title: 'Alpha', content: 'Project Alpha was approved', metadata: { folder: 'Work' } })
    ]);

    const chunks: string[] = [];
    const sm = new SearchManager();
    const fakeLlm = {
      isAvailable: () => true,
      getCurrentProvider: () => 'openrouter',
      generateStream: vi.fn(async (_req: any, onChunk: (c: string) => void) => {
        onChunk('Hello ');
        onChunk('world');
        return { text: 'Hello world', model: 'fake' };
      })
    };

    sm.setLLMService(fakeLlm as any);

    const results = await sm.searchWithStream('alpha?', (c) => chunks.push(c));
    expect(chunks.join('')).toBe('Hello world');
    expect(results[0]?.title).toContain('OpenRouter');
    expect(results[0]?.content).toBe('Hello world');
  });

  it('searchWithStream falls back to matches when LLM is unavailable or returns empty', async () => {
    cacheMock.getAllNotes.mockReturnValue([
      makeNote({ id: 'n1', title: 'Alpha', content: 'Project Alpha', metadata: { folder: 'Work' } })
    ]);

    const sm = new SearchManager();
    const matchesOnly = await sm.searchWithStream('alpha', () => {});
    expect(matchesOnly.map(r => r.id)).toEqual(['n1']);

    const fakeLlm = {
      isAvailable: () => true,
      getCurrentProvider: () => 'gemini',
      generateStream: vi.fn(async () => null)
    };
    sm.setLLMService(fakeLlm as any);
    const matchesOnly2 = await sm.searchWithStream('alpha', () => {});
    expect(matchesOnly2.map(r => r.id)).toEqual(['n1']);
  });

  it('searchWithStream logs empty cache and returns []', async () => {
    cacheMock.getAllNotes.mockReturnValue([]);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const sm = new SearchManager();

    const res = await sm.searchWithStream('anything', () => {});
    expect(res).toEqual([]);
    expect(logSpy).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });

  it('builds truncated excerpts and omits format hints when not detected', async () => {
    const tokens = ['t1', 't2', 't3', 't4', 't5', 't6'];
    const content =
      'start ' +
      'a'.repeat(500) +
      ` ${tokens[0]} ` +
      'b'.repeat(500) +
      ` ${tokens[1]} ` +
      'c'.repeat(500) +
      ` ${tokens[2]} ` +
      'd'.repeat(500) +
      ` ${tokens[3]} ` +
      'e'.repeat(500) +
      ` ${tokens[4]} ` +
      'f'.repeat(500) +
      ` ${tokens[5]}`; // keep last token near the end

    cacheMock.getAllNotes.mockReturnValue([
      makeNote({ id: 'n1', title: 'Long', content, metadata: { folder: 'Work' } })
    ]);

    const sm = new SearchManager();
    const fakeLlm = {
      isAvailable: () => true,
      getCurrentProvider: () => null,
      generate: vi.fn(async ({ prompt }: { prompt: string }) => {
        // With a single long line, the excerpt builder should use range-based extraction
        // and truncate to maxTotal (1200).
        expect(prompt).not.toContain('Format:');

        const contentIndex = prompt.indexOf('Content: ');
        const questionIndex = prompt.indexOf('\n\nQuestion:');
        expect(contentIndex).toBeGreaterThan(0);
        expect(questionIndex).toBeGreaterThan(contentIndex);

        const contentBlock = prompt.slice(contentIndex, questionIndex);
        // The truncation branch appends an ellipsis; with the last token near the end of
        // the content, any trailing "..." should come from truncation (not suffix).
        expect(contentBlock.endsWith('...')).toBe(true);

        return { text: 'ok', model: 'm' };
      })
    };

    sm.setLLMService(fakeLlm as any);
    const results = await sm.search(tokens.join(' '));
    expect(results[0]?.title).toContain('AI Answer');
  });
});
