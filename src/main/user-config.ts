import * as fs from 'fs';
import * as path from 'path';
import { app, safeStorage } from 'electron';
import { LLMProvider } from '../core/types';

export interface UserConfig {
  geminiApiKey?: string;
  openrouterApiKey?: string;
  llmProvider?: LLMProvider;
  obsidian?: ObsidianConfig;
  local?: LocalConfig;
  notion?: NotionConfig;
}

export interface ObsidianConfig {
  vaults?: string[];
}

export interface LocalConfig {
  folders?: string[];
  recursive?: boolean;
}

export interface NotionConfig {
  token?: string;
}

const CONFIG_FILENAME = 'config.json';
const FILE_MODE = 0o600;

interface StoredUserConfig extends UserConfig {
  secrets?: {
    geminiApiKey?: string;
    openrouterApiKey?: string;
    notionToken?: string;
  };
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function decryptSecret(secret?: string): string | undefined {
  if (!secret) return undefined;
  if (!isEncryptionAvailable()) return undefined;
  try {
    return safeStorage.decryptString(Buffer.from(secret, 'base64'));
  } catch (error) {
    console.warn('[Config] Failed to decrypt secret', error);
    return undefined;
  }
}

function encryptSecret(secret?: string): string | undefined {
  if (!secret) return undefined;
  if (!isEncryptionAvailable()) return undefined;
  try {
    return safeStorage.encryptString(secret).toString('base64');
  } catch (error) {
    console.warn('[Config] Failed to encrypt secret', error);
    return undefined;
  }
}

export function readUserConfig(): UserConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    const parsed = JSON.parse(raw) as StoredUserConfig;
    if (!parsed || typeof parsed !== 'object') return {};

    const result: UserConfig = {
      geminiApiKey: parsed.geminiApiKey,
      openrouterApiKey: parsed.openrouterApiKey,
      llmProvider: parsed.llmProvider,
      obsidian: parsed.obsidian,
      local: parsed.local,
      notion: parsed.notion ? { ...parsed.notion } : undefined
    };

    const decryptedGemini = decryptSecret(parsed.secrets?.geminiApiKey);
    if (decryptedGemini) {
      result.geminiApiKey = decryptedGemini;
    }

    const decryptedOpenrouter = decryptSecret(parsed.secrets?.openrouterApiKey);
    if (decryptedOpenrouter) {
      result.openrouterApiKey = decryptedOpenrouter;
    }

    const decryptedNotion = decryptSecret(parsed.secrets?.notionToken);
    if (decryptedNotion) {
      result.notion = { ...(result.notion || {}), token: decryptedNotion };
    }

    if (parsed.secrets && !isEncryptionAvailable()) {
      console.warn('[Config] Secrets found but encryption is unavailable');
    }

    return result;
  } catch {
    return {};
  }
}

export function writeUserConfig(update: UserConfig): void {
  const current = readUserConfig();
  const nextObsidian =
    update.obsidian === undefined
      ? current.obsidian
      : { ...(current.obsidian || {}), ...(update.obsidian || {}) };
  const nextLocal =
    update.local === undefined ? current.local : { ...(current.local || {}), ...(update.local || {}) };
  const nextNotion =
    update.notion === undefined ? current.notion : { ...(current.notion || {}), ...(update.notion || {}) };
  const next: UserConfig = {
    ...current,
    ...update,
    obsidian: nextObsidian,
    local: nextLocal,
    notion: nextNotion
  };
  if (!next.geminiApiKey) delete next.geminiApiKey;
  if (!next.openrouterApiKey) delete next.openrouterApiKey;
  if (!next.llmProvider) delete next.llmProvider;
  if (next.obsidian) {
    if (!next.obsidian.vaults || next.obsidian.vaults.length === 0) delete next.obsidian.vaults;
    if (!next.obsidian.vaults) delete next.obsidian;
  }
  if (next.local) {
    if (!next.local.folders || next.local.folders.length === 0) delete next.local.folders;
    if (next.local.recursive === undefined) delete next.local.recursive;
    if (!next.local.folders && next.local.recursive === undefined) delete next.local;
  }
  if (next.notion) {
    if (!next.notion.token) delete next.notion.token;
    if (Object.keys(next.notion).length === 0) delete next.notion;
  }

  const configPath = getConfigPath();
  const stored: StoredUserConfig = { ...next };
  const secrets: StoredUserConfig['secrets'] = {};

  const encryptedGemini = encryptSecret(next.geminiApiKey);
  if (encryptedGemini) {
    secrets.geminiApiKey = encryptedGemini;
    delete stored.geminiApiKey;
  }

  const encryptedOpenrouter = encryptSecret(next.openrouterApiKey);
  if (encryptedOpenrouter) {
    secrets.openrouterApiKey = encryptedOpenrouter;
    delete stored.openrouterApiKey;
  }

  const encryptedNotion = encryptSecret(next.notion?.token);
  if (encryptedNotion) {
    secrets.notionToken = encryptedNotion;
    if (stored.notion) {
      delete stored.notion.token;
      if (Object.keys(stored.notion).length === 0) delete stored.notion;
    }
  }

  if (Object.keys(secrets).length > 0) {
    stored.secrets = secrets;
  }

  if ((next.geminiApiKey || next.openrouterApiKey || next.notion?.token) && !isEncryptionAvailable()) {
    console.warn('[Config] Encryption unavailable, storing secrets in plaintext');
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(stored, null, 2), {
    encoding: 'utf8',
    mode: FILE_MODE
  });
}
