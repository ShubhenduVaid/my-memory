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
  private loggedEmptyCache = false;
  private apiKey: string | null = null;

  private formatQueryForLog(query: string): string {
    const normalized = query.replace(/\s+/g, ' ').trim();
    if (!normalized) return '<empty>';
    return normalized.length > 120 ? normalized.slice(0, 120) + '...' : normalized;
  }

  private logEmptyCacheOnce(caller: 'search' | 'searchLocal'): void {
    if (this.loggedEmptyCache) return;
    console.log(`[SearchManager] ${caller}: cache is empty (no notes yet)`);
    this.loggedEmptyCache = true;
  }

  /** Initialize the search manager with Gemini models */
  async initialize(apiKey?: string | null): Promise<void> {
    const resolvedKey = (apiKey ?? this.apiKey ?? process.env.GEMINI_API_KEY)?.trim();
    this.apiKey = resolvedKey || null;
    this.models = [];
    this.modelIndex = 0;

    if (!this.apiKey) {
      console.log('[SearchManager] No GEMINI_API_KEY - AI answers disabled');
      return;
    }

    const genAI = new GoogleGenerativeAI(this.apiKey);
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
    if (notes.length === 0) {
      this.logEmptyCacheOnce('search');
      return [];
    }

    const matches = this.smartSearch(query, notes);
    if (matches.length === 0) {
      console.log(`[SearchManager] search: no matches for "${this.formatQueryForLog(query)}"`);
      return [];
    }

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
    if (notes.length === 0) {
      this.logEmptyCacheOnce('searchLocal');
      return [];
    }
    return this.smartSearch(query, notes);
  }

  /** Try to generate an AI answer, falling back across models on errors */
  private async tryGenerateAnswer(query: string, matches: SearchResult[]): Promise<string | null> {
    if (this.models.length === 0) return null;

    const attempts = this.models.length;
    for (let i = 0; i < attempts; i++) {
      const modelEntry = this.getNextModel();
      if (!modelEntry) break;
      try {
        const answer = await this.generateAnswer(query, matches, modelEntry.model);
        if (answer) return answer;
        console.warn(`[Search] Gemini returned empty response for ${modelEntry.name}`);
      } catch (error: unknown) {
        console.error(
          `[Search] Gemini error on ${modelEntry.name}: ${this.formatGeminiError(error)}`,
          error
        );
      }
    }

    console.warn('[Search] All Gemini models failed; AI answer unavailable');
    return null;
  }

  private formatGeminiError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>;
      const parts: string[] = [];
      if (typeof err.status === 'number') parts.push(`status=${err.status}`);
      if (typeof err.message === 'string') parts.push(err.message);
      if (typeof err.errorDetails === 'string') parts.push(err.errorDetails);
      if (typeof err.errorDetails === 'object' && err.errorDetails !== null) {
        try {
          parts.push(JSON.stringify(err.errorDetails));
        } catch {
          // ignore
        }
      }
      if (parts.length > 0) return parts.join(' ');
      try {
        return JSON.stringify(err);
      } catch {
        return '[object error]';
      }
    }
    return 'Unknown error';
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
      .map((note, index) => {
        const title = note.title || 'Untitled';
        const folder = note.folder || 'Unknown folder';
        const content = (note.content || note.snippet || '').replace(/\s+/g, ' ').trim();
        const excerpt = content.length > 800 ? content.slice(0, 800) + '...' : content;
        return [
          `Note ${index + 1}`,
          `Title: ${title}`,
          `Folder: ${folder}`,
          `Content: ${excerpt}`
        ].join('\n');
      })
      .join('\n\n---\n\n');

    const prompt = `You are a helpful assistant that answers using ONLY the notes provided.
Do not use outside knowledge. If the notes do not contain the answer, say so.
If the question is ambiguous, ask one short clarifying question instead of guessing.
Prefer specific details from the notes (names, dates, decisions, numbers).
If the question asks for a summary, provide a concise synthesis across relevant notes.

Output format:
1) A short direct answer (1-3 sentences).
2) A single bullet list of 2-6 key points (each bullet on its own line starting with "- ").
3) A final line: "Sources: title1; title2; title3" (include only notes you used; use "Sources: none" if no relevant info).

Notes:
${context}

Question: ${query}

Answer now.`;

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
