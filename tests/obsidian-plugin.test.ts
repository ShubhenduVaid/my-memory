import { describe, it, expect } from 'vitest';

// Test the Obsidian plugin scaffold
// These tests verify: vault detection, command palette, bidirectional linking

describe('ObsidianPlugin', () => {
  describe('vault detection', () => {
    it('detects vault path from plugin context', async () => {
      const { ObsidianPlugin } = await import('../src/obsidian-plugin/main');
      const plugin = new ObsidianPlugin();
      // Plugin should expose vault path from Obsidian's app.vault.adapter.basePath
      expect(plugin.getVaultPath).toBeDefined();
    });
  });

  describe('command palette', () => {
    it('registers search command', async () => {
      const { ObsidianPlugin } = await import('../src/obsidian-plugin/main');
      const plugin = new ObsidianPlugin();
      const commands = plugin.getCommands();
      expect(commands.some((c: { id: string }) => c.id === 'my-memory-search')).toBe(true);
    });
  });

  describe('bidirectional linking', () => {
    it('generates obsidian:// URI for note', async () => {
      const { generateObsidianUri } = await import('../src/obsidian-plugin/main');
      const uri = generateObsidianUri('MyVault', 'folder/note.md');
      expect(uri).toBe('obsidian://open?vault=MyVault&file=folder%2Fnote.md');
    });
  });
});
