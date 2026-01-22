/**
 * Ollama LLM adapter for local model inference.
 */

import { ILLMAdapter, LLMConfig, LLMRequest, LLMResponse } from '../../core/types';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

export class OllamaAdapter implements ILLMAdapter {
  readonly name = 'ollama';
  private baseUrl: string = DEFAULT_BASE_URL;
  private model: string = DEFAULT_MODEL;
  private available = false;

  async initialize(config: LLMConfig): Promise<void> {
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
    this.model = config.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL;

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      this.available = response.ok;
      console.log('[Ollama]', this.available ? `Ready with model: ${this.model}` : 'Not available');
    } catch {
      this.available = false;
      console.log('[Ollama] Server not reachable at', this.baseUrl);
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.available) throw new Error('Ollama not available');

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: request.prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return { text: data.response || '', model: this.model };
  }
}
