/**
 * API wrapper for Electron IPC bridge
 * Provides typed access to main process functionality
 */

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  content?: string;
  folder?: string;
  score: number;
}

export interface ProviderInfo {
  name: string;
  available: boolean;
  capabilities: { supportsModelSelection: boolean; requiresApiKey: boolean };
  error?: string;
}

export interface ObsidianConfig {
  vaults?: string[];
}

export interface LocalConfig {
  folders?: string[];
  recursive?: boolean;
}

interface ElectronApi {
  search: (query: string) => Promise<SearchResult[]>;
  searchLocal: (query: string) => Promise<SearchResult[]>;
  getGeminiKeyStatus: () => Promise<{ hasKey: boolean }>;
  setGeminiKey: (apiKey: string | null) => Promise<{ ok: boolean; hasKey: boolean }>;
  getLlmConfig: () => Promise<{ provider: string; hasGeminiKey: boolean; hasOpenrouterKey: boolean; providers?: ProviderInfo[] }>;
  setLlmProvider: (provider: string) => Promise<{ ok: boolean; provider: string }>;
  setOpenrouterKey: (apiKey: string | null) => Promise<{ ok: boolean; hasKey: boolean }>;
  getOllamaModels: () => Promise<{ models: string[]; current: string }>;
  setOllamaModel: (model: string) => Promise<{ ok: boolean; model: string }>;
  getNotionConfig: () => Promise<{ hasToken: boolean }>;
  setNotionToken: (token: string | null) => Promise<{ ok: boolean; hasToken: boolean }>;
  syncNotionNow: () => Promise<{ ok: boolean }>;
  getObsidianConfig: () => Promise<ObsidianConfig>;
  setObsidianConfig: (config: ObsidianConfig) => Promise<{ ok: boolean; vaults: string[] }>;
  selectObsidianVault: () => Promise<{ canceled: boolean; path?: string }>;
  syncObsidianNow: () => Promise<{ ok: boolean }>;
  getLocalConfig: () => Promise<LocalConfig>;
  setLocalConfig: (config: LocalConfig) => Promise<{ ok: boolean; folders: string[]; recursive: boolean }>;
  selectLocalFolder: () => Promise<{ canceled: boolean; path?: string }>;
  syncLocalNow: () => Promise<{ ok: boolean }>;
  openNote: (noteId: string) => void;
  onSearchStreamChunk?: (callback: (chunk: string) => void) => () => void;
  onSearchStreamDone?: (callback: () => void) => () => void;
  onThemeChange?: (callback: (isDark: boolean) => void) => () => void;
  getSystemTheme?: () => Promise<boolean>;
}

export const api: ElectronApi = (window as any).api;
