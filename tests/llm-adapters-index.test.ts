import { describe, it, expect } from 'vitest';
import * as llm from '../src/adapters/llm';

describe('adapters/llm index', () => {
  it('re-exports adapter classes', () => {
    expect(typeof llm.GeminiAdapter).toBe('function');
    expect(typeof llm.OpenRouterAdapter).toBe('function');
    expect(typeof llm.OllamaAdapter).toBe('function');
  });
});

