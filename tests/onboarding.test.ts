import { describe, it, expect } from 'vitest';
import { Onboarding } from '../src/renderer/onboarding';

describe('Onboarding', () => {
  describe('screen navigation', () => {
    it('starts on welcome screen', () => {
      const onboarding = new Onboarding();
      expect(onboarding.currentScreen).toBe('welcome');
    });

    it('navigates welcome -> api-key -> sources', () => {
      const onboarding = new Onboarding();
      onboarding.next();
      expect(onboarding.currentScreen).toBe('api-key');
      onboarding.next();
      expect(onboarding.currentScreen).toBe('sources');
    });

    it('navigates back from sources -> api-key -> welcome', () => {
      const onboarding = new Onboarding();
      onboarding.goTo('sources');
      onboarding.back();
      expect(onboarding.currentScreen).toBe('api-key');
      onboarding.back();
      expect(onboarding.currentScreen).toBe('welcome');
    });
  });

  describe('state persistence', () => {
    it('persists API key across navigation', () => {
      const onboarding = new Onboarding();
      onboarding.goTo('api-key');
      onboarding.setApiKey('test-key-123');
      onboarding.next();
      onboarding.back();
      expect(onboarding.getApiKey()).toBe('test-key-123');
    });

    it('persists selected sources', () => {
      const onboarding = new Onboarding();
      onboarding.goTo('sources');
      onboarding.toggleSource('apple-notes');
      onboarding.toggleSource('obsidian');
      expect(onboarding.getSelectedSources()).toContain('apple-notes');
      expect(onboarding.getSelectedSources()).toContain('obsidian');
    });
  });

  describe('skip-to-main', () => {
    it('allows skipping from any screen', () => {
      const onboarding = new Onboarding();
      expect(onboarding.canSkip()).toBe(true);
    });

    it('marks onboarding complete on skip', () => {
      const onboarding = new Onboarding();
      onboarding.skip();
      expect(onboarding.isComplete()).toBe(true);
    });

    it('marks onboarding complete on finish', () => {
      const onboarding = new Onboarding();
      onboarding.goTo('sources');
      onboarding.finish();
      expect(onboarding.isComplete()).toBe(true);
    });
  });

  describe('API key validation', () => {
    it('rejects empty key', () => {
      const onboarding = new Onboarding();
      expect(onboarding.validateApiKey('')).toEqual({ valid: false, error: 'API key is required' });
    });

    it('rejects short key', () => {
      const onboarding = new Onboarding();
      expect(onboarding.validateApiKey('abc')).toEqual({ valid: false, error: 'API key is too short' });
    });

    it('rejects invalid characters', () => {
      const onboarding = new Onboarding();
      expect(onboarding.validateApiKey('abcdefghijklmnopqrst!@#$')).toEqual({ valid: false, error: 'API key contains invalid characters' });
    });

    it('accepts valid key', () => {
      const onboarding = new Onboarding();
      expect(onboarding.validateApiKey('AIzaSyA1234567890abcdefg')).toEqual({ valid: true });
    });

    it('trims whitespace on setApiKey', () => {
      const onboarding = new Onboarding();
      onboarding.setApiKey('  key123456789012345  ');
      expect(onboarding.getApiKey()).toBe('key123456789012345');
    });
  });
});
