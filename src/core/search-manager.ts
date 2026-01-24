/**
 * Search manager with AI-powered semantic search.
 * Combines smart keyword search with AI-generated answers.
 */

import { cache } from './cache';
import { Note, StreamCallback } from './types';
import { LLMService } from './llm-service';

/** Search result returned to the UI */
export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  content?: string;
  folder?: string;
  score: number;
}

/** Common stop words to filter from search queries */
const STOP_WORDS = new Set([
  'what', 'did', 'i', 'is', 'the', 'a', 'an', 'with', 'was', 'were',
  'do', 'does', 'how', 'when', 'where', 'who', 'which', 'about',
  'discuss', 'discussed', 'discussing', 'talk', 'talked', 'talking',
  'my', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'have', 'has',
  'been', 'being', 'am', 'are', 'this', 'that', 'these', 'those'
]);

export class SearchManager {
  private llmService: LLMService | null = null;
  private loggedEmptyCache = false;

  private getQueryTokens(query: string): string[] {
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
      .filter(word => word.length > 1 && !STOP_WORDS.has(word));
    return Array.from(new Set(tokens));
  }

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

  /** Set the LLM service (dependency injection) */
  setLLMService(service: LLMService): void {
    this.llmService = service;
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
      const provider = this.llmService?.getCurrentProvider() || 'AI';
      return [this.createAiResult(aiAnswer, provider), ...matches];
    }

    return matches;
  }

  /**
   * Search with streaming AI answer.
   * Calls onChunk for each piece of the AI response, returns final results.
   */
  async searchWithStream(query: string, onChunk: StreamCallback): Promise<SearchResult[]> {
    const notes = cache.getAllNotes();
    if (notes.length === 0) {
      this.logEmptyCacheOnce('search');
      return [];
    }

    const matches = this.smartSearch(query, notes);
    if (matches.length === 0) {
      return [];
    }

    if (!this.llmService?.isAvailable()) {
      return matches;
    }

    const prompt = this.buildPrompt(query, matches);
    const response = await this.llmService.generateStream({ prompt }, onChunk);
    
    if (response?.text) {
      const provider = this.llmService.getCurrentProvider() || 'AI';
      return [this.createAiResult(response.text, provider), ...matches];
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

  /** Try to generate an AI answer using the LLM service */
  private async tryGenerateAnswer(query: string, matches: SearchResult[]): Promise<string | null> {
    if (!this.llmService?.isAvailable()) return null;

    const prompt = this.buildPrompt(query, matches);
    const response = await this.llmService.generate({ prompt });
    return response?.text || null;
  }

  private buildPrompt(query: string, notes: SearchResult[]): string {
    const queryTokens = this.getQueryTokens(query);
    const context = notes
      .slice(0, 8)
      .map((note, index) => {
        const title = note.title || 'Untitled';
        const folder = note.folder || 'Unknown folder';
        const excerpt = this.buildNoteExcerpt(note, queryTokens);
        const formatHint = this.detectNoteFormat(note.content || note.snippet || '');
        return [
          `Note ${index + 1}`,
          `Title: ${title}`,
          `Folder: ${folder}`,
          formatHint ? `Format: ${formatHint}` : null,
          `Content: ${excerpt || '<empty>'}`
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n---\n\n');

    return `You are a helpful assistant that answers using ONLY the notes provided.
Do not use outside knowledge. If the notes mention the query but lack a direct answer,
say what the notes do mention and what is missing.
If the question asks about a person or relationship (e.g., "who is", "can I trust",
"what is their relationship"), summarize the evidence from the notes: roles, actions,
support/conflict, and timeframe. Do NOT make a definitive trust judgment; state that
trust is personal and depends on more context.
If the notes are chat logs or database rows, treat them as evidence and summarize
participants, dates, and topics explicitly mentioned.
If the question is ambiguous, ask one short clarifying question instead of guessing.
Prefer specific details from the notes (names, dates, decisions, numbers).
If the question asks for a summary, provide a concise synthesis across relevant notes.
If there is no direct answer, list the most relevant notes by title and what they mention,
then ask a single clarifying question. Do not invent facts.

Output format:
1) A short direct answer (1-3 sentences).
2) A single bullet list of 2-6 key points (each bullet on its own line starting with "- ").
3) A final line: "Sources: title1; title2; title3" (include only notes you referenced; use "Sources: none" if none).

Notes:
${context}

Question: ${query}

Answer now.`;
  }

  /** Create an AI answer search result */
  private createAiResult(content: string, provider: string): SearchResult {
    const providerLabel = provider === 'gemini' ? 'Gemini' : 
      provider === 'openrouter' ? 'OpenRouter' : 
      provider === 'ollama' ? 'Ollama' : provider;
    return {
      id: 'ai-answer',
      title: `✨ AI Answer (${providerLabel})`,
      snippet: content.slice(0, 100) + '...',
      content,
      folder: 'AI Generated',
      score: 1
    };
  }

  /**
   * Smart keyword search with stop word filtering.
   * Scores notes based on matches in title (3x), folder (2x), and content (1x).
   */
  private smartSearch(query: string, notes: Note[]): SearchResult[] {
    const queryWords = this.getQueryTokens(query);

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

  private buildNoteExcerpt(note: SearchResult, queryTokens: string[]): string {
    const content = (note.content || note.snippet || '').replace(/\r\n/g, '\n').trim();
    if (!content) return '';
    return this.extractRelevantExcerpt(content, queryTokens, 1200);
  }

  private extractRelevantExcerpt(content: string, queryTokens: string[], maxTotal: number): string {
    if (!content) return '';
    const lineExcerpt = this.extractLineExcerpt(content, queryTokens, maxTotal);
    if (lineExcerpt) return lineExcerpt;

    const flattened = content.replace(/\s+/g, ' ').trim();
    if (queryTokens.length === 0) {
      return flattened.length > maxTotal ? flattened.slice(0, maxTotal) + '...' : flattened;
    }

    const lower = flattened.toLowerCase();
    const windowSize = 140;
    const ranges: Array<{ start: number; end: number }> = [];

    for (const token of queryTokens) {
      const index = lower.indexOf(token);
      if (index === -1) continue;
      const start = Math.max(0, index - windowSize);
      const end = Math.min(flattened.length, index + token.length + windowSize);
      ranges.push({ start, end });
      if (ranges.length >= 6) break;
    }

    if (ranges.length === 0) {
      return flattened.length > maxTotal ? flattened.slice(0, maxTotal) + '...' : flattened;
    }

    ranges.sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];
    for (const range of ranges) {
      const last = merged[merged.length - 1];
      if (last && range.start <= last.end) {
        last.end = Math.max(last.end, range.end);
      } else {
        merged.push({ start: range.start, end: range.end });
      }
    }

    const snippets: string[] = [];
    let total = 0;
    for (const range of merged) {
      if (total >= maxTotal) break;
      const prefix = range.start > 0 ? '...' : '';
      const suffix = range.end < flattened.length ? '...' : '';
      let snippet = `${prefix}${flattened.slice(range.start, range.end).trim()}${suffix}`;
      if (total + snippet.length > maxTotal) {
        const remaining = maxTotal - total;
        snippet = snippet.slice(0, remaining).replace(/\s+\S*$/, '') + '...';
      }
      total += snippet.length;
      snippets.push(snippet);
    }

    return snippets.join('\n...\n');
  }

  private extractLineExcerpt(content: string, queryTokens: string[], maxTotal: number): string | null {
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    if (lines.length < 2 || queryTokens.length === 0) return null;

    const loweredTokens = queryTokens.map(token => token.toLowerCase());
    const matchIndices: number[] = [];
    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      if (loweredTokens.some(token => lower.includes(token))) matchIndices.push(index);
    });
    if (matchIndices.length === 0) return null;

    const selected = new Set<number>();
    for (const index of matchIndices) {
      selected.add(index);
      if (index > 0) selected.add(index - 1);
      if (index < lines.length - 1) selected.add(index + 1);
      if (selected.size >= 10) break;
    }

    const ordered = Array.from(selected).sort((a, b) => a - b);
    const chunks: string[] = [];
    let total = 0;
    let lastIndex = -2;
    for (const index of ordered) {
      const line = lines[index];
      if (!line) continue;
      if (index > lastIndex + 1) chunks.push('...');
      if (total + line.length > maxTotal) break;
      chunks.push(line);
      total += line.length;
      lastIndex = index;
    }

    const result = chunks.join('\n').trim();
    return result.length > 0 ? result : null;
  }

  private detectNoteFormat(content: string): string | null {
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length < 3) return null;

    const timestampPattern =
      /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b/;
    const timestampLines = lines.filter(line => timestampPattern.test(line)).length;
    if (timestampLines >= Math.min(3, Math.floor(lines.length / 3))) {
      return 'chat log';
    }

    const kvLines = lines.filter(line => /^[^:\n]{1,40}:\s+\S+/.test(line)).length;
    if (kvLines >= Math.min(4, Math.floor(lines.length / 2))) {
      return 'database row';
    }

    return null;
  }
}
