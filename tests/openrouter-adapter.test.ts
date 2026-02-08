import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterAdapter } from '../src/adapters/llm/openrouter';

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

describe('OpenRouterAdapter', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('is unavailable without an API key', async () => {
    const adapter = new OpenRouterAdapter();
    await adapter.initialize({});
    expect(adapter.isAvailable()).toBe(false);
    await expect(adapter.generate({ prompt: 'hi' })).rejects.toThrow('OpenRouter not initialized');
  });

  it('generate returns model output', async () => {
    (globalThis.fetch as any).mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'Hello' } }] })
    );

    const adapter = new OpenRouterAdapter();
    await adapter.initialize({ openrouterApiKey: 'k', model: 'm' });
    expect(adapter.isAvailable()).toBe(true);

    const res = await adapter.generate({ prompt: 'hi' });
    expect(res.text).toBe('Hello');
    expect(res.model).toBe('m');
  });

  it('generate throws on HTTP error', async () => {
    (globalThis.fetch as any).mockResolvedValue(
      jsonResponse({}, { ok: false, status: 401, statusText: 'Unauthorized' })
    );

    const adapter = new OpenRouterAdapter();
    await adapter.initialize({ openrouterApiKey: 'k' });
    await expect(adapter.generate({ prompt: 'hi' })).rejects.toThrow('OpenRouter error: 401 Unauthorized');
  });

  it('generateStream parses SSE and streams deltas', async () => {
    const enc = new TextEncoder();
    const chunks = [
      enc.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n'),
      enc.encode('data: {"choices":[{"delta":{"content":"lo"}}]}\n' + 'data: [DONE]\n')
    ];
    let idx = 0;
    const reader = {
      read: async () => {
        if (idx >= chunks.length) return { done: true, value: undefined };
        return { done: false, value: chunks[idx++] };
      }
    };

    (globalThis.fetch as any).mockResolvedValue(
      jsonResponse({}, { body: { getReader: () => reader } })
    );

    const adapter = new OpenRouterAdapter();
    await adapter.initialize({ openrouterApiKey: 'k', model: 'm' });

    const got: string[] = [];
    const res = await adapter.generateStream({ prompt: 'hi' }, (c) => got.push(c));
    expect(got.join('')).toBe('Hello');
    expect(res.text).toBe('Hello');
    expect(res.model).toBe('m');
  });
});

