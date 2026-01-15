export interface Note {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceId: string;
  modifiedAt: Date;
  metadata?: Record<string, any>;
}

export type WatchCallback = (notes: Note[]) => void;

export interface ISourceAdapter {
  readonly name: string;
  initialize(): Promise<void>;
  fetchAll(): Promise<Note[]>;
  watch(callback: WatchCallback): void;
  stop(): void;
}

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

export const pluginRegistry = new PluginRegistry();
