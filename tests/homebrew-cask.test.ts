import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Homebrew Cask Formula', () => {
  const formulaPath = join(__dirname, '../homebrew/my-memory.rb');

  it('formula file exists', () => {
    expect(existsSync(formulaPath)).toBe(true);
  });

  it('has correct cask structure', () => {
    const content = readFileSync(formulaPath, 'utf-8');
    
    expect(content).toMatch(/cask\s+["']my-memory["']/);
    expect(content).toMatch(/version\s+["']\d+\.\d+\.\d+["']/);
    expect(content).toMatch(/url\s+["']https:\/\//);
    expect(content).toMatch(/sha256\s+["']/); // Template or real SHA
    expect(content).toMatch(/app\s+["']My Memory\.app["']/);
    expect(content).toMatch(/name\s+["']My Memory["']/);
    expect(content).toMatch(/desc\s+["']/);
    expect(content).toMatch(/homepage\s+["']/);
  });
});
