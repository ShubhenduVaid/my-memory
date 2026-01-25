import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { homedir, platform } from 'os';

function getObsidianConfigDir(): string {
  switch (platform()) {
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', 'obsidian');
    case 'win32':
      return join(process.env.APPDATA || '', 'obsidian');
    default:
      return join(homedir(), '.config', 'obsidian');
  }
}

export class ObsidianPlugin {
  private vaultPath?: string;

  constructor(vaultPath?: string) {
    this.vaultPath = vaultPath;
  }

  getVaultPath(): string | undefined {
    return this.vaultPath;
  }

  getCommands(): { id: string; name: string }[] {
    return [{ id: 'my-memory-search', name: 'Search My Memory' }];
  }

  static detectVaults(): { name: string; path: string }[] {
    const vaults: { name: string; path: string }[] = [];
    const obsidianJson = join(getObsidianConfigDir(), 'obsidian.json');
    
    if (!existsSync(obsidianJson)) return vaults;

    try {
      const config = JSON.parse(readFileSync(obsidianJson, 'utf-8'));
      if (config.vaults) {
        for (const [, vault] of Object.entries(config.vaults as Record<string, { path: string }>)) {
          if (vault.path && existsSync(vault.path)) {
            vaults.push({ name: basename(vault.path), path: vault.path });
          }
        }
      }
    } catch {
      // Config unreadable, return empty
    }
    return vaults;
  }
}

export function generateObsidianUri(vault: string, file: string): string {
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file)}`;
}
