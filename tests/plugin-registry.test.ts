import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from '../src/core/types';

describe('PluginRegistry', () => {
  it('registers and retrieves adapters by name', () => {
    const registry = new PluginRegistry();

    const adapterA = {
      name: 'a',
      initialize: vi.fn(async () => {}),
      fetchAll: vi.fn(async () => []),
      watch: vi.fn(() => {}),
      stop: vi.fn(() => {})
    };
    const adapterB = {
      name: 'b',
      initialize: vi.fn(async () => {}),
      fetchAll: vi.fn(async () => []),
      watch: vi.fn(() => {}),
      stop: vi.fn(() => {})
    };

    registry.register(adapterA);
    registry.register(adapterB);

    expect(registry.get('a')).toBe(adapterA);
    expect(registry.get('b')).toBe(adapterB);
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.getAll()).toEqual([adapterA, adapterB]);
  });

  it('initializes and stops all adapters', async () => {
    const registry = new PluginRegistry();

    const adapterA = {
      name: 'a',
      initialize: vi.fn(async () => {}),
      fetchAll: vi.fn(async () => []),
      watch: vi.fn(() => {}),
      stop: vi.fn(() => {})
    };
    const adapterB = {
      name: 'b',
      initialize: vi.fn(async () => {}),
      fetchAll: vi.fn(async () => []),
      watch: vi.fn(() => {}),
      stop: vi.fn(() => {})
    };

    registry.register(adapterA);
    registry.register(adapterB);

    await registry.initializeAll();
    expect(adapterA.initialize).toHaveBeenCalledTimes(1);
    expect(adapterB.initialize).toHaveBeenCalledTimes(1);

    registry.stopAll();
    expect(adapterA.stop).toHaveBeenCalledTimes(1);
    expect(adapterB.stop).toHaveBeenCalledTimes(1);
  });
});

