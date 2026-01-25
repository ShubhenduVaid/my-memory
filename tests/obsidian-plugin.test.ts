import { describe, it, expect } from 'vitest';
import { ObsidianPlugin, generateObsidianUri } from '../src/obsidian-plugin/main';

describe('ObsidianPlugin', () => {
  describe('vault detection', () => {
    it('detects vault path from plugin context', () => {
      const plugin = new ObsidianPlugin('/path/to/vault');
      expect(plugin.getVaultPath()).toBe('/path/to/vault');
    });

    it('returns undefined when no vault path provided', () => {
      const plugin = new ObsidianPlugin();
      expect(plugin.getVaultPath()).toBeUndefined();
    });

    it('has static detectVaults method', () => {
      expect(typeof ObsidianPlugin.detectVaults).toBe('function');
      const vaults = ObsidianPlugin.detectVaults();
      expect(Array.isArray(vaults)).toBe(true);
    });
  });

  describe('command palette', () => {
    it('registers search command', () => {
      const plugin = new ObsidianPlugin();
      const commands = plugin.getCommands();
      expect(commands.some((c: { id: string }) => c.id === 'my-memory-search')).toBe(true);
    });
  });

  describe('bidirectional linking', () => {
    it('generates obsidian:// URI for note', () => {
      const uri = generateObsidianUri('MyVault', 'folder/note.md');
      expect(uri).toBe('obsidian://open?vault=MyVault&file=folder%2Fnote.md');
    });

    it('encodes vault name with spaces', () => {
      const uri = generateObsidianUri('My Vault', 'note.md');
      expect(uri).toBe('obsidian://open?vault=My%20Vault&file=note.md');
    });
  });
});
