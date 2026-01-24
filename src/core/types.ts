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

/** Default timeout for LLM requests (60 seconds) */
export const LLM_TIMEOUT_MS = 60000;

/** Extended timeout for local models like Ollama (120 seconds) */
export const LLM_LOCAL_TIMEOUT_MS = 120000;

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
  openrouterApiKey?: string;
  baseUrl?: string;
  model?: string;
}

/** Capabilities that an LLM adapter supports */
export interface LLMCapabilities {
  supportsModelSelection: boolean;
  requiresApiKey: boolean;
}

/**
 * Interface that all LLM adapters must implement.
 */
export interface ILLMAdapter {
  readonly name: string;
  readonly capabilities: LLMCapabilities;
  initialize(config: LLMConfig): Promise<void>;
  generate(request: LLMRequest): Promise<LLMResponse>;
  isAvailable(): boolean;
  getModels(): string[];
  getCurrentModel(): string;
  setModel(model: string): boolean;
  getError?(): string | undefined;
}

/** Supported LLM providers */
export const SUPPORTED_PROVIDERS = ['gemini', 'openrouter', 'ollama'] as const;
export type LLMProvider = (typeof SUPPORTED_PROVIDERS)[number];
