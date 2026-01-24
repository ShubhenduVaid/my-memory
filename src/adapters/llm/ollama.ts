/**
 * Ollama LLM adapter for local model inference.
 */

import { ILLMAdapter, LLMConfig, LLMRequest, LLMResponse, LLM_LOCAL_TIMEOUT_MS, LLMCapabilities } from '../../core/types';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.1';

export class OllamaAdapter implements ILLMAdapter {
  readonly name = 'ollama';
  readonly capabilities: LLMCapabilities = { supportsModelSelection: true, requiresApiKey: false };
  private baseUrl: string = DEFAULT_BASE_URL;
  private model: string = DEFAULT_MODEL;
  private available = false;
  private installedModels: string[] = [];
  private error?: string;

  async initialize(config: LLMConfig): Promise<void> {
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
    this.model = config.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL;
    this.error = undefined;

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        this.available = false;
        this.installedModels = [];
        this.error = 'Server not responding';
        console.log('[Ollama] Server not available');
        return;
      }
      const data = await response.json();
      this.installedModels = data.models?.map((m: { name: string }) => m.name) || [];
      
      // Check if configured model exists, fallback to first available
      const hasModel = this.installedModels.some(m => m === this.model || m.startsWith(this.model + ':'));
      if (!hasModel && this.installedModels.length > 0) {
        const llama = this.installedModels.find(m => m.includes('llama'));
        this.model = llama || this.installedModels[0];
        console.log('[Ollama] Model fallback to:', this.model);
      }
      
      this.available = this.installedModels.length > 0;
      if (!this.available) {
        this.error = 'No models installed. Run: ollama pull llama3.2';
      }
      console.log('[Ollama]', this.available ? `Ready with model: ${this.model}` : 'No models installed');
    } catch {
      this.available = false;
      this.installedModels = [];
      this.error = 'Not running. Start with: ollama serve';
      console.log('[Ollama] Server not reachable at', this.baseUrl);
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  getError(): string | undefined {
    return this.error;
  }

  getModels(): string[] {
    return this.installedModels;
  }

  getCurrentModel(): string {
    return this.model;
  }

  setModel(model: string): boolean {
    if (this.installedModels.includes(model)) {
      this.model = model;
      return true;
    }
    return false;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.available) throw new Error('Ollama not available');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_LOCAL_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: request.prompt,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { text: data.response || '', model: this.model };
    } finally {
      clearTimeout(timeout);
    }
  }
}
