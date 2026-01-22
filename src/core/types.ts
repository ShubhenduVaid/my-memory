/**
 * Core type definitions for the My Memory application.
 * Defines the plugin architecture and data models.
 */

/** Represents a note from any source adapter */
export interface Note {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceId: string;
  modifiedAt: Date;
  metadata?: Record<string, unknown>;
}

/** Callback type for note change notifications */
export type WatchCallback = (notes: Note[]) => void;

/**
 * Interface that all source adapters must implement.
 * Enables the plugin architecture for different note sources.
 */
export interface ISourceAdapter {
  /** Unique identifier for this adapter */
  readonly name: string;

  /** Initialize the adapter (called once on startup) */
  initialize(): Promise<void>;

  /** Fetch all notes from the source */
  fetchAll(): Promise<Note[]>;

  /** Start watching for changes and call the callback when notes change */
  watch(callback: WatchCallback): void;

  /** Stop watching and clean up resources */
  stop(): void;
}

/**
 * Registry for managing source adapters.
 * Provides centralized control over all registered adapters.
 */
export class PluginRegistry {
  private adapters = new Map<string, ISourceAdapter>();

  register(adapter: ISourceAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): ISourceAdapter | undefined {
    return this.adapters.get(name);
  }

  getAll(): ISourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  async initializeAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.initialize();
    }
  }

  stopAll(): void {
    for (const adapter of this.adapters.values()) {
      adapter.stop();
    }
  }
}

/** Global plugin registry instance */
export const pluginRegistry = new PluginRegistry();

// ============================================================================
// LLM Adapter Interface
// ============================================================================

/** Request for LLM text generation */
export interface LLMRequest {
  prompt: string;
  maxTokens?: number;
}

/** Response from LLM generation */
export interface LLMResponse {
  text: string;
  model: string;
}

/** Configuration for LLM adapters */
export interface LLMConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Interface that all LLM adapters must implement.
 */
export interface ILLMAdapter {
  readonly name: string;
  initialize(config: LLMConfig): Promise<void>;
  generate(request: LLMRequest): Promise<LLMResponse>;
  isAvailable(): boolean;
}

/** Registry for managing LLM adapters */
export class LLMRegistry {
  private adapters = new Map<string, ILLMAdapter>();
  private current: ILLMAdapter | null = null;

  register(adapter: ILLMAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): ILLMAdapter | undefined {
    return this.adapters.get(name);
  }

  getAll(): ILLMAdapter[] {
    return Array.from(this.adapters.values());
  }

  setCurrent(name: string): boolean {
    const adapter = this.adapters.get(name);
    if (adapter?.isAvailable()) {
      this.current = adapter;
      return true;
    }
    return false;
  }

  getCurrent(): ILLMAdapter | null {
    return this.current;
  }
}

export const llmRegistry = new LLMRegistry();
