import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock cache before importing SearchManager
const mockNotes = Array.from({ length: 1000 }, (_, i) => ({
  id: `note-${i}`,
  title: `Note ${i} about ${['work', 'personal', 'ideas', 'meetings'][i % 4]}`,
  content: `This is the content of note ${i}. It contains various topics like ${['project', 'family', 'brainstorm', 'agenda'][i % 4]} and other details.`,
  source: 'test',
  metadata: { folder: `Folder ${i % 10}` }
}));

vi.mock('../src/core/cache', () => ({
  cache: {
    getAllNotes: () => mockNotes
  }
}));

import { SearchManager } from '../src/core/search-manager';

describe('searchLocal performance', () => {
  it('completes in under 200ms for 1000 notes', () => {
    const manager = new SearchManager();
    const start = performance.now();
    manager.searchLocal('work project');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});
