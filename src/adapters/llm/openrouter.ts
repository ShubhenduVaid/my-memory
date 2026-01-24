/**
 * OpenRouter LLM adapter for accessing multiple models via OpenRouter API.
 */

import { ILLMAdapter, LLMConfig, LLMRequest, LLMResponse } from '../../core/types';

const DEFAULT_MODEL = 'deepseek/deepseek-r1-0528:free';
const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class OpenRouterAdapter implements ILLMAdapter {
  readonly name = 'openrouter';
  private apiKey: string | null = null;
  private model: string = DEFAULT_MODEL;

  async initialize(config: LLMConfig): Promise<void> {
    this.apiKey = config.openrouterApiKey || config.apiKey || process.env.OPENROUTER_API_KEY || null;
    this.model = config.model || DEFAULT_MODEL;
    if (!this.apiKey) {
      console.log('[OpenRouter] No API key - adapter disabled');
    } else {
      console.log('[OpenRouter] Initialized with model:', this.model);
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.apiKey) throw new Error('OpenRouter not initialized');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: request.prompt }],
          max_tokens: request.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenRouter error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        text: data.choices?.[0]?.message?.content || '',
        model: this.model,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
