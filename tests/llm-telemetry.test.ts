import { describe, it, expect } from 'vitest';
import { llmTelemetry } from '../src/core/llm-telemetry';

describe('llmTelemetry', () => {
  it('records requests and computes average latency', () => {
    llmTelemetry.setCurrentProvider('gemini');

    llmTelemetry.recordRequest('gemini', 10);
    llmTelemetry.recordRequest('gemini', 30);

    expect(llmTelemetry.getAverageLatency('gemini')).toBe(20);

    const snapshot = llmTelemetry.getSnapshot();
    expect(snapshot.currentProvider).toBe('gemini');
    expect(snapshot.providers.gemini.requests).toBe(2);
    expect(snapshot.providers.gemini.errors).toBe(0);
    expect(snapshot.providers.gemini.totalLatencyMs).toBe(40);
    expect(typeof snapshot.providers.gemini.lastUsed).toBe('number');
  });

  it('records errors (truncated) and updates last used', () => {
    llmTelemetry.recordError('openrouter', 'x'.repeat(500));

    const snapshot = llmTelemetry.getSnapshot();
    expect(snapshot.providers.openrouter.errors).toBe(1);
    expect(snapshot.providers.openrouter.lastError?.length).toBeLessThanOrEqual(200);
    expect(typeof snapshot.providers.openrouter.lastUsed).toBe('number');
  });

  it('returns 0 average latency when provider has no requests', () => {
    expect(llmTelemetry.getAverageLatency('missing')).toBe(0);
  });
});

