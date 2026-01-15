/**
 * Search manager with AI-powered semantic search using Gemini.
 * Combines smart keyword search with AI-generated answers.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { cache } from './cache';
import { Note } from './types';

/** Search result returned to the UI */
export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  content?: string;
  folder?: string;
  score: number;
}

/** Model entry for rotation */
interface ModelEntry {
  name: string;
  model: GenerativeModel;
}

/** Common stop words to filter from search queries */
const STOP_WORDS = new Set([
  'what', 'did', 'i', 'is', 'the', 'a', 'an', 'with', 'was', 'were',
  'do', 'does', 'how', 'when', 'where', 'who', 'which', 'about',
  'discuss', 'discussed', 'discussing', 'talk', 'talked', 'talking',
  'my', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'have', 'has',
  'been', 'being', 'am', 'are', 'this', 'that', 'these', 'those'
]);

/** Gemini models to rotate through (latest to oldest) */
const GEMINI_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite'
];

export class SearchManager {
  private models: ModelEntry[] = [];
  private modelIndex = 0;

  /** Initialize the search manager with Gemini models */
  async initialize(): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('[SearchManager] No GEMINI_API_KEY - AI answers disabled');
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.models = GEMINI_MODELS.map(name => ({
      name,
      model: genAI.getGenerativeModel({ model: name })
    }));
    console.log('[SearchManager] Gemini ready with', this.models.length, 'models');
  }

  /** Get the next model in rotation */
  private getNextModel(): ModelEntry | null {
    if (this.models.length === 0) return null;
    const entry = this.models[this.modelIndex];
    this.modelIndex = (this.modelIndex + 1) % this.models.length;
    return entry;
  }

  /**
   * Search with AI-powered answers.
   * Returns AI answer as first result if available, followed by matching notes.
   */
  async search(query: string): Promise<SearchResult[]> {
    const notes = cache.getAllNotes();
    if (notes.length === 0) return [];

    const matches = this.smartSearch(query, notes);
    if (matches.length === 0) return [];

    // Try to generate AI answer
    const aiAnswer = await this.tryGenerateAnswer(query, matches);
    if (aiAnswer) {
      return [this.createAiResult(aiAnswer), ...matches];
    }

    return matches;
  }

  /** Search without AI (for real-time typing feedback) */
  searchLocal(query: string): SearchResult[] {
    const notes = cache.getAllNotes();
    if (notes.length === 0) return [];
    return this.smartSearch(query, notes);
  }

  /** Try to generate an AI answer, with retry on rate limit */
  private async tryGenerateAnswer(query: string, matches: SearchResult[]): Promise<string | null> {
    const modelEntry = this.getNextModel();
    if (!modelEntry) return null;

    try {
      return await this.generateAnswer(query, matches, modelEntry.model);
    } catch (error: unknown) {
      if (this.isRateLimitError(error)) {
        console.log('[Search] Rate limited, retrying...');
        const nextEntry = this.getNextModel();
        if (nextEntry) {
          try {
            return await this.generateAnswer(query, matches, nextEntry.model);
          } catch {
            console.error('[Search] Retry failed');
          }
        }
      }
      return null;
    }
  }

  /** Check if error is a rate limit error */
  private isRateLimitError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'status' in error && error.status === 429;
  }

  /** Create an AI answer search result */
  private createAiResult(content: string): SearchResult {
    return {
      id: 'ai-answer',
      title: '✨ AI Answer',
      snippet: content.slice(0, 100) + '...',
      content,
      folder: 'AI Generated',
      score: 1
    };
  }

  /** Generate an AI answer from matching notes */
  private async generateAnswer(
    query: string,
    notes: SearchResult[],
    model: GenerativeModel
  ): Promise<string | null> {
    const context = notes
      .slice(0, 5)
      .map(n => `Note: "${n.title}" (${n.folder})\n${n.content?.slice(0, 500) || n.snippet}`)
      .join('\n\n---\n\n');

    const prompt = `Based on these notes, answer the question concisely.

Notes:
${context}

Question: ${query}

Answer based only on the notes above. If the notes don't contain relevant info, say so.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Smart keyword search with stop word filtering.
   * Scores notes based on matches in title (3x), folder (2x), and content (1x).
   */
  private smartSearch(query: string, notes: Note[]): SearchResult[] {
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 1 && !STOP_WORDS.has(word));

    // Fall back to simple substring search if no meaningful words
    if (queryWords.length === 0) {
      return this.substringSearch(query.toLowerCase(), notes);
    }

    // Score and rank notes
    const scored = notes.map(note => ({
      note,
      score: this.scoreNote(note, queryWords)
    }));

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(item => this.noteToResult(item.note, item.score / (queryWords.length * 3)));
  }

  /** Score a note based on query word matches */
  private scoreNote(note: Note, queryWords: string[]): number {
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

  /** Simple substring search fallback */
  private substringSearch(query: string, notes: Note[]): SearchResult[] {
    return notes
      .filter(note =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        (note.metadata?.folder as string || '').toLowerCase().includes(query)
      )
      .slice(0, 20)
      .map(note => this.noteToResult(note, 0.5));
  }

  /** Convert a Note to a SearchResult */
  private noteToResult(note: Note, score: number): SearchResult {
    return {
      id: note.id,
      title: note.title,
      snippet: note.content.slice(0, 100),
      content: note.content,
      folder: (note.metadata?.folder as string) || '',
      score
    };
  }

  /** Cleanup resources */
  stop(): void {
    // No cleanup needed currently
  }
}
