/**
 * Gemini LLM adapter using Google's Generative AI SDK.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ILLMAdapter, LLMConfig, LLMRequest, LLMResponse, LLM_TIMEOUT_MS, LLMCapabilities, StreamCallback } from '../../core/types';

const DEFAULT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite'
];

export class GeminiAdapter implements ILLMAdapter {
  readonly name = 'gemini';
  readonly capabilities: LLMCapabilities = { supportsModelSelection: false, supportsStreaming: true, requiresApiKey: true };
  private models: GenerativeModel[] = [];
  private modelNames: string[] = [];
  private modelIndex = 0;
  private currentModel = '';

  async initialize(config: LLMConfig): Promise<void> {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('[Gemini] No API key - adapter disabled');
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.modelNames = config.model ? [config.model] : DEFAULT_MODELS;
    this.models = this.modelNames.map(name => genAI.getGenerativeModel({ model: name }));
    this.currentModel = this.modelNames[0];
    console.log('[Gemini] Initialized with', this.models.length, 'models');
  }

  isAvailable(): boolean {
    return this.models.length > 0;
  }

  getModels(): string[] {
    return this.modelNames;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  setModel(_model: string): boolean {
    return false; // Gemini uses rotation, not manual selection
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) throw new Error('Gemini not initialized');

    for (let i = 0; i < this.models.length; i++) {
      const idx = (this.modelIndex + i) % this.models.length;
      try {
        const result = await Promise.race([
          this.models[idx].generateContent(request.prompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini timeout')), LLM_TIMEOUT_MS)
          ),
        ]);
        this.modelIndex = (idx + 1) % this.models.length;
        return { text: result.response.text(), model: this.modelNames[idx] };
      } catch (error) {
        console.warn(`[Gemini] ${this.modelNames[idx]} failed:`, error);
        this.currentModel = this.modelNames[(idx + 1) % this.models.length];
      }
    }
    throw new Error('All Gemini models failed');
  }

  clearSecrets(): void {
    this.models = [];
    this.modelNames = [];
    this.modelIndex = 0;
    this.currentModel = '';
  }

  async generateStream(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse> {
    if (!this.isAvailable()) throw new Error('Gemini not initialized');

    const idx = this.modelIndex;
    const model = this.models[idx];
    
    const result = await model.generateContentStream(request.prompt);
    let fullText = '';

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }

    this.modelIndex = (idx + 1) % this.models.length;
    return { text: fullText, model: this.modelNames[idx] };
  }
}
