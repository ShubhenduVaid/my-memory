/**
 * LLM Service - manages adapter lifecycle and provides unified generation interface.
 */

import { ILLMAdapter, LLMConfig, LLMRequest, LLMResponse, LLMCapabilities } from './types';
import { GeminiAdapter, OpenRouterAdapter, OllamaAdapter } from '../adapters/llm';

export interface LLMServiceConfig extends LLMConfig {
  provider?: string;
}

export interface ProviderInfo {
  name: string;
  available: boolean;
  capabilities: LLMCapabilities;
  error?: string;
}

export class LLMService {
  private adapters = new Map<string, ILLMAdapter>();
  private current: ILLMAdapter | null = null;

  async initialize(config: LLMServiceConfig = {}): Promise<void> {
    // Clear secrets from previous adapters before re-init
    for (const adapter of this.adapters.values()) {
      adapter.clearSecrets?.();
    }
    this.adapters.clear();
    this.current = null;

    const adapters = [new GeminiAdapter(), new OpenRouterAdapter(), new OllamaAdapter()];
    
    await Promise.all(adapters.map(a => a.initialize(config)));
    adapters.forEach(a => this.adapters.set(a.name, a));

    // Set current adapter
    const provider = config.provider || 'gemini';
    if (!this.setProvider(provider)) {
      for (const adapter of this.adapters.values()) {
        if (adapter.isAvailable()) {
          this.current = adapter;
          break;
        }
      }
    }

    console.log('[LLMService] Provider:', this.current?.name || 'none');
  }

  async generate(request: LLMRequest): Promise<LLMResponse | null> {
    if (!this.current) return null;
    try {
      return await this.current.generate(request);
    } catch (error) {
      console.error('[LLMService] Generation error:', error);
      return null;
    }
  }

  getProviders(): ProviderInfo[] {
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
}
