/**
 * LLM Service - manages adapter lifecycle and provides unified generation interface.
 */

import { ILLMAdapter, LLMConfig, LLMRequest, LLMResponse, LLMCapabilities, StreamCallback } from './types';
import { GeminiAdapter, OpenRouterAdapter, OllamaAdapter } from '../adapters/llm';
import { llmTelemetry } from './llm-telemetry';

export interface LLMServiceConfig extends LLMConfig {
  provider?: string;
  enableFallback?: boolean;
}

export interface ProviderInfo {
  name: string;
  available: boolean;
  capabilities: LLMCapabilities;
  error?: string;
}

type AdapterFactory = () => ILLMAdapter;

export class LLMService {
  private adapters = new Map<string, ILLMAdapter>();
  private factories = new Map<string, AdapterFactory>();
  private initialized = new Set<string>();
  private current: ILLMAdapter | null = null;
  private config: LLMServiceConfig = {};
  private enableFallback = true;

  constructor() {
    // Register adapter factories for lazy initialization
    this.factories.set('gemini', () => new GeminiAdapter());
    this.factories.set('openrouter', () => new OpenRouterAdapter());
    this.factories.set('ollama', () => new OllamaAdapter());
  }

  async initialize(config: LLMServiceConfig = {}): Promise<void> {
    // Clear secrets from previous adapters
    for (const adapter of this.adapters.values()) {
      adapter.clearSecrets?.();
    }
    this.adapters.clear();
    this.initialized.clear();
    this.current = null;
    this.config = config;
    this.enableFallback = config.enableFallback !== false;

    // Only initialize the requested provider (lazy init)
    const provider = config.provider || 'gemini';
    await this.initializeAdapter(provider);
    
    if (!this.setProvider(provider)) {
      // Fallback: try to initialize and use first available
      for (const name of this.factories.keys()) {
        if (name !== provider) {
          await this.initializeAdapter(name);
          if (this.setProvider(name)) break;
        }
      }
    }

    llmTelemetry.setCurrentProvider(this.current?.name || null);
    console.log('[LLMService] Provider:', this.current?.name || 'none');
  }

  private async initializeAdapter(name: string): Promise<ILLMAdapter | null> {
    if (this.initialized.has(name)) {
      return this.adapters.get(name) || null;
    }

    const factory = this.factories.get(name);
    if (!factory) return null;

    const adapter = factory();
    await adapter.initialize(this.config);
    this.adapters.set(name, adapter);
    this.initialized.add(name);
    return adapter;
  }

  async generate(request: LLMRequest): Promise<LLMResponse | null> {
    if (!this.current) return null;

    const providers = this.enableFallback 
      ? [this.current.name, ...Array.from(this.factories.keys()).filter(n => n !== this.current?.name)]
      : [this.current.name];

    for (const providerName of providers) {
      const adapter = await this.initializeAdapter(providerName);
      if (!adapter?.isAvailable()) continue;

      const start = Date.now();
      try {
        const result = await adapter.generate(request);
        llmTelemetry.recordRequest(providerName, Date.now() - start);
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        llmTelemetry.recordError(providerName, msg);
        console.error(`[LLMService] ${providerName} failed:`, msg);
        if (!this.enableFallback) return null;
        // Continue to next provider
      }
    }

    console.error('[LLMService] All providers failed');
    return null;
  }

  async getProviders(): Promise<ProviderInfo[]> {
    // Initialize all adapters to get accurate availability
    for (const name of this.factories.keys()) {
      await this.initializeAdapter(name);
    }
    return Array.from(this.adapters.values()).map(a => ({
      name: a.name,
      available: a.isAvailable(),
      capabilities: a.capabilities,
      error: a.getError?.(),
    }));
  }

  getCurrentProvider(): string | null {
    return this.current?.name || null;
  }

  setProvider(name: string): boolean {
    const adapter = this.adapters.get(name);
    if (adapter?.isAvailable()) {
      this.current = adapter;
      llmTelemetry.setCurrentProvider(name);
      return true;
    }
    return false;
  }

  getModels(): string[] {
    if (!this.current?.capabilities.supportsModelSelection) return [];
    return this.current.getModels();
  }

  getCurrentModel(): string {
    return this.current?.getCurrentModel() || '';
  }

  setModel(model: string): boolean {
    if (!this.current?.capabilities.supportsModelSelection) return false;
    return this.current.setModel(model);
  }

  isAvailable(): boolean {
    return this.current?.isAvailable() ?? false;
  }

  supportsStreaming(): boolean {
    return this.current?.capabilities.supportsStreaming ?? false;
  }

  async generateStream(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse | null> {
    if (!this.current?.capabilities.supportsStreaming || !this.current.generateStream) {
      // Fall back to non-streaming
      return this.generate(request);
    }

    const start = Date.now();
    try {
      const result = await this.current.generateStream(request, onChunk);
      llmTelemetry.recordRequest(this.current.name, Date.now() - start);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      llmTelemetry.recordError(this.current.name, msg);
      console.error('[LLMService] Stream error:', msg);
      return null;
    }
  }

  getTelemetry() {
    return llmTelemetry.getSnapshot();
  }
}
