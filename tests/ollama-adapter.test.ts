import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaAdapter } from '../src/adapters/llm/ollama';

function jsonResponse(data: any, init?: { ok?: boolean; status?: number; statusText?: string; body?: any }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 500);
  const statusText = init?.statusText ?? (ok ? 'OK' : 'ERR');
  return {
    ok,
    status,
    statusText,
    json: async () => data,
    body: init?.body
  } as any;
}

describe('OllamaAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('blocks non-localhost baseUrl (SSRF protection)', async () => {
    const adapter = new OllamaAdapter();
    await adapter.initialize({ baseUrl: 'https://example.com' });

    expect(adapter.isAvailable()).toBe(false);
    expect(adapter.getError()).toBe('Ollama must run on localhost');
  });

  it('marks unavailable when server is not responding', async () => {
    (globalThis.fetch as any).mockResolvedValue(jsonResponse({}, { ok: false, status: 500, statusText: 'ERR' }));

    const adapter = new OllamaAdapter();
    await adapter.initialize({ baseUrl: 'http://localhost:11434' });

    expect(adapter.isAvailable()).toBe(false);
    expect(adapter.getError()).toBe('Server not responding');
  });

  it('falls back to an installed model when configured model is missing', async () => {
    (globalThis.fetch as any).mockResolvedValue(
      jsonResponse({ models: [{ name: 'mistral' }, { name: 'llama3.2' }] })
    );

    const adapter = new OllamaAdapter();
    await adapter.initialize({ baseUrl: 'http://localhost:11434', model: 'nonexistent' });

    expect(adapter.isAvailable()).toBe(true);
    expect(adapter.getModels()).toEqual(['mistral', 'llama3.2']);
    expect(adapter.getCurrentModel()).toBe('llama3.2');
    expect(adapter.setModel('mistral')).toBe(true);
    expect(adapter.getCurrentModel()).toBe('mistral');
  });

  it('generate throws when not available', async () => {
    const adapter = new OllamaAdapter();
    await adapter.initialize({ baseUrl: 'https://example.com' });

    await expect(adapter.generate({ prompt: 'hi' })).rejects.toThrow('Ollama not available');
  });

  it('generate returns response text', async () => {
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/tags')) return jsonResponse({ models: [{ name: 'llama3.1' }] });
      if (url.endsWith('/api/generate')) return jsonResponse({ response: 'Hello' });
      return jsonResponse({}, { ok: false, status: 404, statusText: 'Not Found' });
    });

    const adapter = new OllamaAdapter();
    await adapter.initialize({ baseUrl: 'http://localhost:11434' });

    const res = await adapter.generate({ prompt: 'hi' });
    expect(res.text).toBe('Hello');
    expect(res.model).toBe(adapter.getCurrentModel());
  });

  it('generateStream streams chunks and returns full text', async () => {
    const fetchMock = globalThis.fetch as any;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/tags')) return jsonResponse({ models: [{ name: 'llama3.1' }] });
      if (url.endsWith('/api/generate')) {
        const enc = new TextEncoder();
        const chunks = [
          enc.encode('{"response":"Hel"}\n'),
          enc.encode('{"response":"lo"}\n')
        ];
        let idx = 0;
        const reader = {
          read: async () => {
            if (idx >= chunks.length) return { done: true, value: undefined };
            return { done: false, value: chunks[idx++] };
          }
        };
        return jsonResponse({}, { body: { getReader: () => reader } });
      }
      return jsonResponse({}, { ok: false, status: 404, statusText: 'Not Found' });
    });

    const adapter = new OllamaAdapter();
    await adapter.initialize({ baseUrl: 'http://localhost:11434' });

    const got: string[] = [];
    const res = await adapter.generateStream({ prompt: 'hi' }, (c) => got.push(c));
    expect(got.join('')).toBe('Hello');
    expect(res.text).toBe('Hello');
  });
});

