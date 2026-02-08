import { describe, it, expect, vi, beforeEach } from 'vitest';

type InitConfig = {
  apiKey?: string;
  openrouterApiKey?: string;
  provider?: string;
  enableFallback?: boolean;
};

const throwOnGenerate = new Set<string>();
const clearSecretsCalls: Record<string, number> = { gemini: 0, openrouter: 0, ollama: 0 };

class FakeBaseAdapter {
  readonly capabilities: any;
  private available = false;
  private model = 'm1';
  private error?: string;

  constructor(
    public readonly name: string,
    capabilities: { supportsModelSelection: boolean; supportsStreaming: boolean; requiresApiKey: boolean }
  ) {
    this.capabilities = capabilities;
  }

  async initialize(config: InitConfig): Promise<void> {
    this.error = undefined;
    if (this.name === 'gemini') {
      this.available = Boolean(config.apiKey);
      if (!this.available) this.error = 'No API key';
      return;
    }
    if (this.name === 'openrouter') {
      this.available = Boolean(config.openrouterApiKey);
      if (!this.available) this.error = 'No API key';
      return;
    }
    // Ollama is treated as always available for unit tests.
    this.available = true;
  }

  isAvailable(): boolean {
    return this.available;
  }

  getModels(): string[] {
    return [this.model];
  }

  getCurrentModel(): string {
    return this.model;
  }

  setModel(model: string): boolean {
    if (!this.capabilities.supportsModelSelection) return false;
    this.model = model;
    return true;
  }

  getError(): string | undefined {
    return this.error;
  }

  clearSecrets(): void {
    clearSecretsCalls[this.name] = (clearSecretsCalls[this.name] || 0) + 1;
    this.available = false;
  }

  async generate(request: { prompt: string }): Promise<{ text: string; model: string }> {
    if (!this.available) throw new Error(`${this.name} not available`);
    if (throwOnGenerate.has(this.name)) throw new Error(`${this.name} boom`);
    return { text: `${this.name}:${request.prompt}`, model: this.model };
  }

  async generateStream(
    request: { prompt: string },
    onChunk: (c: string) => void
  ): Promise<{ text: string; model: string }> {
    if (!this.available) throw new Error(`${this.name} not available`);
    const text = `${this.name}:${request.prompt}`;
    onChunk(text);
    return { text, model: this.model };
  }
}

vi.mock('../src/adapters/llm', () => ({
  GeminiAdapter: class GeminiAdapter extends FakeBaseAdapter {
    constructor() {
      super('gemini', { supportsModelSelection: false, supportsStreaming: true, requiresApiKey: true });
    }
  },
  OpenRouterAdapter: class OpenRouterAdapter extends FakeBaseAdapter {
    constructor() {
      super('openrouter', { supportsModelSelection: false, supportsStreaming: true, requiresApiKey: true });
    }
  },
  OllamaAdapter: class OllamaAdapter extends FakeBaseAdapter {
    constructor() {
      super('ollama', { supportsModelSelection: true, supportsStreaming: true, requiresApiKey: false });
    }
  }
}));

const { LLMService } = await import('../src/core/llm-service');

describe('LLMService', () => {
  beforeEach(() => {
    throwOnGenerate.clear();
    clearSecretsCalls.gemini = 0;
    clearSecretsCalls.openrouter = 0;
    clearSecretsCalls.ollama = 0;
  });

  it('returns null when used before initialization', async () => {
    const svc = new LLMService();
    expect(await svc.generate({ prompt: 'x' })).toBeNull();
  });

  it('initializes requested provider and falls back to first available', async () => {
    const svc = new LLMService();

    await svc.initialize({ provider: 'gemini' });
    // No Gemini key, should fall back to ollama in our fake.
    expect(svc.getCurrentProvider()).toBe('ollama');

    await svc.initialize({ provider: 'gemini', apiKey: 'k' });
    expect(svc.getCurrentProvider()).toBe('gemini');
  });

  it('falls back when an unknown provider is requested', async () => {
    const svc = new LLMService();
    await svc.initialize({ provider: 'unknown', openrouterApiKey: 'ok' });

    expect(svc.getCurrentProvider()).toBe('openrouter');
  });

  it('generates with fallback when current provider fails', async () => {
    const svc = new LLMService();

    await svc.initialize({ provider: 'gemini', apiKey: 'k', openrouterApiKey: 'ok' });
    throwOnGenerate.add('gemini');

    const res = await svc.generate({ prompt: 'hi' });
    expect(res?.text).toBe('openrouter:hi');
  });

  it('does not fallback when enableFallback is false', async () => {
    const svc = new LLMService();

    await svc.initialize({ provider: 'gemini', apiKey: 'k', enableFallback: false });
    throwOnGenerate.add('gemini');

    const res = await svc.generate({ prompt: 'hi' });
    expect(res).toBeNull();
  });

  it('supports model selection when current adapter supports it', async () => {
    const svc = new LLMService();
    await svc.initialize({ provider: 'ollama' });

    expect(svc.getModels()).toEqual(['m1']);
    expect(svc.setModel('m2')).toBe(true);
    expect(svc.getCurrentModel()).toBe('m2');
  });

  it('falls back to non-streaming generation when streaming is unavailable', async () => {
    const svc = new LLMService();
    await svc.initialize({ provider: 'gemini', apiKey: 'k' });

    // Make streaming unavailable by deleting generateStream at runtime.
    // (The service should fall back to generate().)
    (svc as any).current.generateStream = undefined;
    const chunks: string[] = [];
    const res = await svc.generateStream({ prompt: 'hello' }, (c) => chunks.push(c));
    expect(chunks.length).toBe(0);
    expect(res?.text).toBe('gemini:hello');
  });

  it('returns provider info for all registered adapters', async () => {
    const svc = new LLMService();
    await svc.initialize({ provider: 'gemini', apiKey: 'k', openrouterApiKey: 'ok' });

    const providers = await svc.getProviders();
    const names = providers.map(p => p.name).sort();
    expect(names).toEqual(['gemini', 'ollama', 'openrouter']);
    expect(providers.find(p => p.name === 'gemini')?.available).toBe(true);
    expect(providers.find(p => p.name === 'openrouter')?.available).toBe(true);
  });

  it('clears secrets when re-initialized', async () => {
    const svc = new LLMService();
    await svc.initialize({ provider: 'gemini', apiKey: 'k' });
    await svc.initialize({ provider: 'gemini', apiKey: 'k2' });

    expect(clearSecretsCalls.gemini).toBeGreaterThan(0);
  });

  it('returns empty models and refuses setModel when unsupported', async () => {
    const svc = new LLMService();
    await svc.initialize({ provider: 'gemini', apiKey: 'k' });

    expect(svc.getModels()).toEqual([]);
    expect(svc.setModel('m2')).toBe(false);
  });

  it('allows switching to another provider only when available', async () => {
    const svc = new LLMService();
    await svc.initialize({ provider: 'gemini', apiKey: 'k', openrouterApiKey: 'ok' });
    await svc.getProviders(); // ensure adapters are initialized

    expect(svc.setProvider('openrouter')).toBe(true);
    expect(svc.getCurrentProvider()).toBe('openrouter');

    // Gemini without a key is unavailable in our fake.
    await svc.initialize({ provider: 'gemini' });
    expect(svc.getCurrentProvider()).toBe('ollama');
    expect(svc.setProvider('gemini')).toBe(false);
  });

  it('streams successfully when supported', async () => {
    const svc = new LLMService();
    await svc.initialize({ provider: 'gemini', apiKey: 'k' });

    const chunks: string[] = [];
    const res = await svc.generateStream({ prompt: 'hi' }, (c) => chunks.push(c));
    expect(chunks.join('')).toBe('gemini:hi');
    expect(res?.text).toBe('gemini:hi');
  });

  it('returns null when all providers fail', async () => {
    const svc = new LLMService();
    await svc.initialize({ provider: 'gemini', apiKey: 'k', openrouterApiKey: 'ok' });

    throwOnGenerate.add('gemini');
    throwOnGenerate.add('openrouter');
    throwOnGenerate.add('ollama');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await svc.generate({ prompt: 'hi' });
    errorSpy.mockRestore();

    expect(res).toBeNull();
  });

  it('returns null when streaming throws', async () => {
    const svc = new LLMService();
    await svc.initialize({ provider: 'gemini', apiKey: 'k' });

    (svc as any).current.generateStream = vi.fn(async () => {
      throw new Error('stream boom');
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await svc.generateStream({ prompt: 'hi' }, () => {});
    errorSpy.mockRestore();

    expect(res).toBeNull();
  });
});
