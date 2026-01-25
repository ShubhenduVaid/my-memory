import { describe, it, expect } from 'vitest';
import { AppleNotesAdapter } from '../src/adapters/apple-notes';

describe('Zero-config Apple Notes', () => {
  it('requires no configuration to instantiate', () => {
    const adapter = new AppleNotesAdapter();
    expect(adapter.name).toBe('apple-notes');
  });

  it('has initialize that requires no parameters', async () => {
    const adapter = new AppleNotesAdapter();
    await expect(adapter.initialize()).resolves.toBeUndefined();
  });

  it('fetchAll requires no setup or API keys', () => {
    const adapter = new AppleNotesAdapter();
    expect(typeof adapter.fetchAll).toBe('function');
    expect(adapter.fetchAll.length).toBe(0); // no required params
  });
});
