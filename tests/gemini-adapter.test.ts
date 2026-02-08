import { describe, it, expect, vi, beforeEach } from 'vitest';

const failingModels = new Set<string>();

vi.mock('@google/generative-ai', () => {
  class FakeModel {
    constructor(private readonly modelName: string) {}

    async generateContent(prompt: string) {
      if (failingModels.has(this.modelName)) throw new Error('fail');
      return { response: { text: () => `(${this.modelName}) ${prompt}` } };
    }

    async generateContentStream(prompt: string) {
      const parts = [`(${this.modelName}) `, prompt];
      const stream = (async function* () {
        for (const p of parts) {
          yield { text: () => p };
        }
      })();
      return { stream };
    }
  }

  return {
    GoogleGenerativeAI: class GoogleGenerativeAI {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_apiKey: string) {}
      getGenerativeModel(opts: { model: string }) {
        return new FakeModel(opts.model);
      }
    }
  };
});

const { GeminiAdapter } = await import('../src/adapters/llm/gemini');

describe('GeminiAdapter', () => {
  beforeEach(() => {
    failingModels.clear();
  });

  it('is unavailable without an API key', async () => {
    const adapter = new GeminiAdapter();
    await adapter.initialize({});
    expect(adapter.isAvailable()).toBe(false);
    await expect(adapter.generate({ prompt: 'hi' })).rejects.toThrow('Gemini not initialized');
  });

  it('initializes and generates with configured model', async () => {
    const adapter = new GeminiAdapter();
    await adapter.initialize({ apiKey: 'k', model: 'gemini-test' });

    expect(adapter.isAvailable()).toBe(true);
    expect(adapter.getModels()).toEqual(['gemini-test']);
    expect(adapter.getCurrentModel()).toBe('gemini-test');

    const res = await adapter.generate({ prompt: 'hello' });
    expect(res.text).toBe('(gemini-test) hello');
    expect(res.model).toBe('gemini-test');
  });

  it('rotates models on failure', async () => {
    const adapter = new GeminiAdapter();
    await adapter.initialize({ apiKey: 'k' });
    const models = adapter.getModels();
    expect(models.length).toBeGreaterThan(1);

    failingModels.add(models[0] as string);

    const res = await adapter.generate({ prompt: 'hi' });
    // Should fall through to a non-failing model.
    expect(res.text).toContain('hi');
    expect(res.model).not.toBe(models[0]);
  });

  it('streams chunks and returns full text', async () => {
    const adapter = new GeminiAdapter();
    await adapter.initialize({ apiKey: 'k', model: 'gemini-test' });

    const chunks: string[] = [];
    const res = await adapter.generateStream({ prompt: 'world' }, (c) => chunks.push(c));
    expect(chunks.join('')).toBe('(gemini-test) world');
    expect(res.text).toBe('(gemini-test) world');
  });
});

