/**
 * Simple telemetry for LLM provider usage and errors.
 */

export interface ProviderStats {
  requests: number;
  errors: number;
  totalLatencyMs: number;
  lastError?: string;
  lastUsed?: number;
}

export interface TelemetrySnapshot {
  providers: Record<string, ProviderStats>;
  currentProvider: string | null;
}

class LLMTelemetry {
  private stats = new Map<string, ProviderStats>();
  private currentProvider: string | null = null;

  setCurrentProvider(name: string | null): void {
    this.currentProvider = name;
  }

  recordRequest(provider: string, latencyMs: number): void {
    const s = this.getOrCreate(provider);
    s.requests++;
    s.totalLatencyMs += latencyMs;
    s.lastUsed = Date.now();
  }

  recordError(provider: string, error: string): void {
    const s = this.getOrCreate(provider);
    s.errors++;
    s.lastError = error.slice(0, 200);
    s.lastUsed = Date.now();
  }

  getSnapshot(): TelemetrySnapshot {
    const providers: Record<string, ProviderStats> = {};
    for (const [name, stats] of this.stats) {
      providers[name] = { ...stats };
    }
    return { providers, currentProvider: this.currentProvider };
  }

  getAverageLatency(provider: string): number {
    const s = this.stats.get(provider);
    if (!s || s.requests === 0) return 0;
    return Math.round(s.totalLatencyMs / s.requests);
  }

  private getOrCreate(provider: string): ProviderStats {
    let s = this.stats.get(provider);
    if (!s) {
      s = { requests: 0, errors: 0, totalLatencyMs: 0 };
      this.stats.set(provider, s);
    }
    return s;
  }
}

export const llmTelemetry = new LLMTelemetry();
