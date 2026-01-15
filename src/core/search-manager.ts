import { GoogleGenerativeAI } from '@google/generative-ai';
import { cache } from './cache';
import { Note } from './types';

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  content?: string;
  folder?: string;
  score: number;
}

export class SearchManager {
  private genAI: GoogleGenerativeAI | null = null;
  private models: any[] = [];
  private modelIndex = 0;

  async initialize(): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Rotate between these models (latest to oldest) to spread rate limits
      const modelNames = [
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
      this.models = modelNames.map(name => ({ name, model: this.genAI!.getGenerativeModel({ model: name }) }));
      console.log('[SearchManager] Gemini ready with', modelNames.length, 'models');
    } else {
      console.log('[SearchManager] No GEMINI_API_KEY');
    }
  }

  private getNextModel(): { name: string; model: any } | null {
    if (this.models.length === 0) return null;
    const entry = this.models[this.modelIndex];
    this.modelIndex = (this.modelIndex + 1) % this.models.length;
    return entry;
  }

  async search(query: string): Promise<SearchResult[]> {
    const notes = cache.getAllNotes();
    if (notes.length === 0) return [];

    const matches = this.smartSearch(query, notes);
    const modelEntry = this.getNextModel();
    
    if (modelEntry && matches.length > 0) {
      try {
        const aiResponse = await this.generateAnswer(query, matches, modelEntry.model);
        if (aiResponse) {
          return [{
            id: 'ai-answer',
            title: '✨ AI Answer',
            snippet: aiResponse.slice(0, 100) + '...',
            content: aiResponse,
            folder: 'AI Generated',
            score: 1
          }, ...matches];
        }
      } catch (e: any) {
        if (e.status === 429) {
          console.log('[Search] Rate limited, retrying...');
          const nextEntry = this.getNextModel();
          if (nextEntry) {
            try {
              const aiResponse = await this.generateAnswer(query, matches, nextEntry.model);
              if (aiResponse) {
                return [{
                  id: 'ai-answer',
                  title: '✨ AI Answer',
                  snippet: aiResponse.slice(0, 100) + '...',
                  content: aiResponse,
                  folder: 'AI Generated',
                  score: 1
                }, ...matches];
              }
            } catch (e2) {
              console.error('[Search] Retry failed');
            }
          }
        }
      }
    }

    return matches;
  }

  searchLocal(query: string): SearchResult[] {
    const notes = cache.getAllNotes();
    if (notes.length === 0) return [];
    return this.smartSearch(query, notes);
  }

  private async generateAnswer(query: string, notes: SearchResult[], model: any): Promise<string | null> {
    const context = notes.slice(0, 5).map(n => 
      `Note: "${n.title}" (${n.folder})\n${n.content?.slice(0, 500) || n.snippet}`
    ).join('\n\n---\n\n');

    const prompt = `Based on these notes, answer the question concisely.

Notes:
${context}

Question: ${query}

Answer based only on the notes above. If the notes don't contain relevant info, say so.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  private smartSearch(query: string, notes: Note[]): SearchResult[] {
    const stopWords = new Set([
      'what', 'did', 'i', 'is', 'the', 'a', 'an', 'with', 'was', 'were', 
      'do', 'does', 'how', 'when', 'where', 'who', 'which', 'about', 
      'discuss', 'discussed', 'discussing', 'talk', 'talked', 'talking', 
      'my', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'have', 'has',
      'been', 'being', 'am', 'are', 'this', 'that', 'these', 'those'
    ]);
    
    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));
    
    if (queryWords.length === 0) {
      const q = query.toLowerCase();
      return notes
        .filter(n => 
          n.title.toLowerCase().includes(q) || 
          n.content.toLowerCase().includes(q) ||
          (n.metadata?.folder || '').toLowerCase().includes(q)
        )
        .slice(0, 20)
        .map(n => ({
          id: n.id,
          title: n.title,
          snippet: n.content.slice(0, 100),
          content: n.content,
          folder: n.metadata?.folder || '',
          score: 0.5
        }));
    }

    const scored = notes.map(n => {
      const titleLower = n.title.toLowerCase();
      const contentLower = n.content.toLowerCase();
      const folderLower = (n.metadata?.folder || '').toLowerCase();
      
      let score = 0;
      for (const word of queryWords) {
        if (titleLower.includes(word)) score += 3;
        if (folderLower.includes(word)) score += 2;
        if (contentLower.includes(word)) score += 1;
      }
      
      return { note: n, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(s => ({
        id: s.note.id,
        title: s.note.title,
        snippet: s.note.content.slice(0, 100),
        content: s.note.content,
        folder: s.note.metadata?.folder || '',
        score: s.score / (queryWords.length * 3)
      }));
  }

  stop(): void {}
}
