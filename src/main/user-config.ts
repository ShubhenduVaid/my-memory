import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface UserConfig {
  geminiApiKey?: string;
  obsidian?: ObsidianConfig;
  local?: LocalConfig;
}

export interface ObsidianConfig {
  vaults?: string[];
}

export interface LocalConfig {
  folders?: string[];
  recursive?: boolean;
}

const CONFIG_FILENAME = 'config.json';

function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

export function readUserConfig(): UserConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    const parsed = JSON.parse(raw) as UserConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
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
  const next: UserConfig = { ...current, ...update, obsidian: nextObsidian, local: nextLocal };
  if (!next.geminiApiKey) delete next.geminiApiKey;
  if (next.obsidian) {
    if (!next.obsidian.vaults || next.obsidian.vaults.length === 0) delete next.obsidian.vaults;
    if (!next.obsidian.vaults) delete next.obsidian;
  }
  if (next.local) {
    if (!next.local.folders || next.local.folders.length === 0) delete next.local.folders;
    if (next.local.recursive === undefined) delete next.local.recursive;
    if (!next.local.folders && next.local.recursive === undefined) delete next.local;
  }

  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf8');
}
