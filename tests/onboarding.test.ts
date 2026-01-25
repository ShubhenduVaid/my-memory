import { describe, it, expect, beforeEach } from 'vitest';

// Onboarding flow: 3 screens
// 1. Welcome screen with value prop
// 2. API key setup (Gemini)
// 3. Source selection (Apple Notes, Obsidian, Local Files)

describe('Onboarding', () => {
  describe('screen navigation', () => {
    it('starts on welcome screen', async () => {
      const { Onboarding } = await import('../src/renderer/onboarding');
      const onboarding = new Onboarding();
      expect(onboarding.currentScreen).toBe('welcome');
    });

    it('navigates welcome -> api-key -> sources', async () => {
      const { Onboarding } = await import('../src/renderer/onboarding');
      const onboarding = new Onboarding();
      onboarding.next();
      expect(onboarding.currentScreen).toBe('api-key');
      onboarding.next();
      expect(onboarding.currentScreen).toBe('sources');
    });

    it('navigates back from sources -> api-key -> welcome', async () => {
      const { Onboarding } = await import('../src/renderer/onboarding');
      const onboarding = new Onboarding();
      onboarding.goTo('sources');
      onboarding.back();
      expect(onboarding.currentScreen).toBe('api-key');
      onboarding.back();
      expect(onboarding.currentScreen).toBe('welcome');
    });
  });

  describe('state persistence', () => {
    it('persists API key across navigation', async () => {
      const { Onboarding } = await import('../src/renderer/onboarding');
      const onboarding = new Onboarding();
      onboarding.goTo('api-key');
      onboarding.setApiKey('test-key-123');
      onboarding.next();
      onboarding.back();
      expect(onboarding.getApiKey()).toBe('test-key-123');
    });

    it('persists selected sources', async () => {
      const { Onboarding } = await import('../src/renderer/onboarding');
      const onboarding = new Onboarding();
      onboarding.goTo('sources');
      onboarding.toggleSource('apple-notes');
      onboarding.toggleSource('obsidian');
      expect(onboarding.getSelectedSources()).toContain('apple-notes');
      expect(onboarding.getSelectedSources()).toContain('obsidian');
    });
  });

  describe('skip-to-main', () => {
    it('allows skipping from any screen', async () => {
      const { Onboarding } = await import('../src/renderer/onboarding');
      const onboarding = new Onboarding();
      expect(onboarding.canSkip()).toBe(true);
    });

    it('marks onboarding complete on skip', async () => {
      const { Onboarding } = await import('../src/renderer/onboarding');
      const onboarding = new Onboarding();
      onboarding.skip();
      expect(onboarding.isComplete()).toBe(true);
    });

    it('marks onboarding complete on finish', async () => {
      const { Onboarding } = await import('../src/renderer/onboarding');
      const onboarding = new Onboarding();
      onboarding.goTo('sources');
      onboarding.finish();
      expect(onboarding.isComplete()).toBe(true);
    });
  });
});
