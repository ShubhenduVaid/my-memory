import { Note } from './types';

/** Score a note based on query word matches in title (3x), folder (2x), content (1x) */
export function scoreNote(note: Note, queryWords: string[]): number {
  const titleLower = note.title.toLowerCase();
  const contentLower = note.content.toLowerCase();
  const folderLower = (note.metadata?.folder as string || '').toLowerCase();

  let score = 0;
  for (const word of queryWords) {
    if (titleLower.includes(word)) score += 3;
    if (folderLower.includes(word)) score += 2;
    if (contentLower.includes(word)) score += 1;
  }
  return score;
}
