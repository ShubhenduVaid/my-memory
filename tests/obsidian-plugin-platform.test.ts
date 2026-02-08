import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ObsidianPlugin.detectVaults (platform paths)', () => {
  const existsSync = vi.fn();
  const readFileSync = vi.fn();

  beforeEach(() => {
    existsSync.mockReset();
    readFileSync.mockReset();
    vi.resetModules();
    vi.unmock('os');
    vi.unmock('fs');
  });

  it('uses macOS config dir on darwin', async () => {
    vi.doMock('os', () => ({ homedir: () => '/h', platform: () => 'darwin' }));
    vi.doMock('fs', () => ({ existsSync, readFileSync }));

    existsSync.mockReturnValue(false);

    const { ObsidianPlugin } = await import('../src/obsidian-plugin/main');
    ObsidianPlugin.detectVaults();

    expect(existsSync).toHaveBeenCalledWith('/h/Library/Application Support/obsidian/obsidian.json');
  });

  it('uses Windows APPDATA config dir on win32', async () => {
    process.env.APPDATA = 'C:\\Users\\me\\AppData\\Roaming';
    vi.doMock('os', () => ({ homedir: () => '/h', platform: () => 'win32' }));
    vi.doMock('fs', () => ({ existsSync, readFileSync }));

    existsSync.mockReturnValue(false);

    const { ObsidianPlugin } = await import('../src/obsidian-plugin/main');
    ObsidianPlugin.detectVaults();

    const calledWith = existsSync.mock.calls[0]?.[0] as string;
    expect(calledWith).toContain('obsidian');
    expect(calledWith).toContain('obsidian.json');
    expect(calledWith).toContain('C:\\Users\\me\\AppData\\Roaming');
  });

  it('uses ~/.config on linux/other', async () => {
    vi.doMock('os', () => ({ homedir: () => '/h', platform: () => 'linux' }));
    vi.doMock('fs', () => ({ existsSync, readFileSync }));

    existsSync.mockReturnValue(false);

    const { ObsidianPlugin } = await import('../src/obsidian-plugin/main');
    ObsidianPlugin.detectVaults();

    expect(existsSync).toHaveBeenCalledWith('/h/.config/obsidian/obsidian.json');
  });

  it('parses obsidian.json and returns existing vaults', async () => {
    vi.doMock('os', () => ({ homedir: () => '/h', platform: () => 'linux' }));
    vi.doMock('fs', () => ({ existsSync, readFileSync }));

    existsSync.mockImplementation((p: string) => p.endsWith('obsidian.json') || p === '/vault1');
    readFileSync.mockReturnValue(
      JSON.stringify({
        vaults: {
          one: { path: '/vault1' },
          two: { path: '/missing' }
        }
      })
    );

    const { ObsidianPlugin } = await import('../src/obsidian-plugin/main');
    const vaults = ObsidianPlugin.detectVaults();
    expect(vaults).toEqual([{ name: 'vault1', path: '/vault1' }]);
  });

  it('returns empty when obsidian.json is unreadable', async () => {
    vi.doMock('os', () => ({ homedir: () => '/h', platform: () => 'linux' }));
    vi.doMock('fs', () => ({ existsSync, readFileSync }));

    existsSync.mockReturnValue(true);
    readFileSync.mockReturnValue('{not-json');

    const { ObsidianPlugin } = await import('../src/obsidian-plugin/main');
    expect(ObsidianPlugin.detectVaults()).toEqual([]);
  });
});

