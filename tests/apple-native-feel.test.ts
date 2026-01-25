import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const stylesPath = join(__dirname, '../src/renderer/styles.css');
const styles = readFileSync(stylesPath, 'utf-8');

describe('Apple-native feel', () => {
  describe('dark mode', () => {
    it('uses dark background color', () => {
      expect(styles).toMatch(/body\s*\{[^}]*background:\s*rgba\(30,\s*30,\s*30/);
    });

    it('uses light text on dark background', () => {
      expect(styles).toMatch(/body\s*\{[^}]*color:\s*#fff/);
    });
  });

  describe('native fonts', () => {
    it('uses system font stack with -apple-system first', () => {
      expect(styles).toMatch(/font-family:\s*-apple-system/);
    });

    it('includes BlinkMacSystemFont for Chrome on macOS', () => {
      expect(styles).toMatch(/BlinkMacSystemFont/);
    });
  });

  describe('smooth animations', () => {
    it('has transition on interactive elements', () => {
      expect(styles).toMatch(/transition:\s*all\s+[\d.]+s\s+ease/);
    });

    it('has animation for streaming cursor', () => {
      expect(styles).toMatch(/@keyframes\s+blink/);
    });

    it('has toast entrance animation', () => {
      expect(styles).toMatch(/@keyframes\s+toast-in/);
    });

    it('has modal backdrop blur for depth', () => {
      expect(styles).toMatch(/backdrop-filter:\s*blur/);
    });

    it('has focus ring transitions for accessibility', () => {
      expect(styles).toMatch(/box-shadow:\s*0\s+0\s+0\s+2px\s+rgba\(240,\s*192,\s*64/);
    });
  });
});
