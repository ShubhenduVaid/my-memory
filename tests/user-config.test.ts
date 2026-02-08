import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let userDataPath = '';
const safeStorageMock = {
  isEncryptionAvailable: vi.fn(),
  encryptString: vi.fn((s: string) => Buffer.from(s, 'utf8')),
  decryptString: vi.fn((b: Buffer) => b.toString('utf8'))
};

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataPath
  },
  safeStorage: safeStorageMock
}));

const { readUserConfig, writeUserConfig } = await import('../src/main/user-config');

describe('user-config', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'user-data-'));
    safeStorageMock.isEncryptionAvailable.mockReset();
    safeStorageMock.encryptString.mockClear();
    safeStorageMock.decryptString.mockClear();
  });

  it('returns empty config when config file is missing', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);
    expect(readUserConfig()).toEqual({});
  });

  it('encrypts secrets when encryption is available', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);

    writeUserConfig({
      geminiApiKey: 'gk',
      openrouterApiKey: 'ok',
      notion: { token: 'nt' },
      llmProvider: 'gemini',
      obsidian: { vaults: ['/v1'] },
      local: { folders: ['/f1'], recursive: true }
    });

    const configPath = join(userDataPath, 'config.json');
    expect(existsSync(configPath)).toBe(true);

    const raw = readFileSync(configPath, 'utf8');
    const stored = JSON.parse(raw);

    // Secrets should be stored encrypted under `secrets`, not plaintext at top-level.
    expect(stored.geminiApiKey).toBeUndefined();
    expect(stored.openrouterApiKey).toBeUndefined();
    expect(stored.notion?.token).toBeUndefined();
    expect(typeof stored.secrets?.geminiApiKey).toBe('string');
    expect(typeof stored.secrets?.openrouterApiKey).toBe('string');
    expect(typeof stored.secrets?.notionToken).toBe('string');

    const roundTrip = readUserConfig();
    expect(roundTrip.geminiApiKey).toBe('gk');
    expect(roundTrip.openrouterApiKey).toBe('ok');
    expect(roundTrip.notion?.token).toBe('nt');
    expect(roundTrip.llmProvider).toBe('gemini');
  });

  it('stores plaintext secrets when encryption is unavailable', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeUserConfig({ geminiApiKey: 'gk' });
    warnSpy.mockRestore();

    const configPath = join(userDataPath, 'config.json');
    const stored = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(stored.geminiApiKey).toBe('gk');

    const roundTrip = readUserConfig();
    expect(roundTrip.geminiApiKey).toBe('gk');
  });

  it('merges nested updates and prunes empty config', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    writeUserConfig({ obsidian: { vaults: ['/v1'] }, local: { folders: ['/f1'] } });
    writeUserConfig({ obsidian: { vaults: ['/v2'] } });

    const cfg = readUserConfig();
    expect(cfg.obsidian?.vaults).toEqual(['/v2']);
    expect(cfg.local?.folders).toEqual(['/f1']);

    writeUserConfig({ obsidian: { vaults: [] } });
    const after = readUserConfig();
    expect(after.obsidian).toBeUndefined();
  });
});

