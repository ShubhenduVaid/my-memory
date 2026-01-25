import { describe, it, expect } from 'vitest';
import { scoreNote } from '../src/core/scoring';

describe('searchLocal performance', () => {
  it('completes in under 200ms for 1000 notes', () => {
    const mockNotes = Array.from({ length: 1000 }, (_, i) => ({
      id: `note-${i}`,
      title: `Note ${i} about ${['work', 'personal', 'ideas', 'meetings'][i % 4]}`,
      content: `This is the content of note ${i}. It contains various topics like ${['project', 'family', 'brainstorm', 'agenda'][i % 4]} and other details.`,
      source: 'test',
      sourceId: `test-${i}`,
      modifiedAt: new Date(),
      metadata: { folder: `Folder ${i % 10}` }
    }));

    const start = performance.now();
    const queryWords = ['work', 'project'];
    
    const scored = mockNotes.map(note => ({
      note,
      score: scoreNote(note, queryWords)
    }));

    const results = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const elapsed = performance.now() - start;
    
    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });
});
