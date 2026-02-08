import { describe, it, expect } from 'vitest';
import { scoreNote } from '../src/core/scoring';
import type { Note } from '../src/core/types';

describe('scoreNote', () => {
  it('weights title > folder > content', () => {
    const note: Note = {
      id: 'n1',
      title: 'Project Alpha',
      content: 'notes about alpha',
      source: 'test',
      sourceId: '1',
      modifiedAt: new Date(),
      metadata: { folder: 'Work' }
    };

    expect(scoreNote(note, ['alpha'])).toBe(4); // title(3) + content(1)
    expect(scoreNote(note, ['work'])).toBe(2); // folder(2)
    expect(scoreNote(note, ['alpha', 'work'])).toBe(6);
  });

  it('handles missing metadata folder', () => {
    const note: Note = {
      id: 'n1',
      title: 'Hello',
      content: 'world',
      source: 'test',
      sourceId: '1',
      modifiedAt: new Date()
    };

    expect(scoreNote(note, ['missing'])).toBe(0);
  });
});

