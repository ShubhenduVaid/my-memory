import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface UserConfig {
  geminiApiKey?: string;
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
  const next: UserConfig = { ...current, ...update };
  if (!next.geminiApiKey) delete next.geminiApiKey;

  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), 'utf8');
}
