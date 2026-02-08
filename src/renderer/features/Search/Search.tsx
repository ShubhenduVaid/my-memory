import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, SearchResult } from '../../shared/api';
import { SettingsButton } from '../../widgets/SettingsModal';

export const SearchBar: React.FC<{
  onSearch: (query: string) => void;
  selectedIndex?: number;
  resultsLength?: number;
  onSelectIndex?: (index: number) => void;
  onOpenSelected?: () => void;
  onClose?: () => void;
  onOpenSettings?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}> = ({
  onSearch,
  inputRef,
  onOpenSettings,
}) => {
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      // If the user clears the query, clear results immediately.
      if (!value.trim()) {
        onSearch('');
        return;
      }

      debounceRef.current = setTimeout(() => {
        onSearch(value);
      }, 300);
    },
    [onSearch]
  );

  return (
    <div className="search-bar">
      <div className="search-row">
        <SettingsButton onClick={() => onOpenSettings?.()} disabled={!onOpenSettings} />
        <input
          ref={inputRef as any}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search your notes..."
          autoFocus
          className="glass-input"
        />
      </div>
    </div>
  );
};

export const SearchResults: React.FC<{
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpen: (result: SearchResult) => void;
  isLoading?: boolean;
}> = ({ results, selectedIndex, onSelect, onOpen, isLoading }) => {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.search-result.selected');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, results.length]);

  return (
    <div ref={listRef} className="search-results" role="listbox" aria-label="Search results">
      {isLoading && results.length === 0 && <div className="search-loading">Searching...</div>}
      {!isLoading && results.length === 0 ? (
        <div className="search-empty">No results found</div>
      ) : (
        results.map((result, i) => (
          <div
            key={result.id}
            className={`search-result ${i === selectedIndex ? 'selected' : ''}`}
            role="option"
            aria-selected={i === selectedIndex}
            onClick={() => onSelect(i)}
            onDoubleClick={() => onOpen(result)}
          >
            <div className="result-title">{result.title}</div>
            {result.folder && <div className="result-folder">{result.folder}</div>}
          </div>
        ))
      )}
    </div>
  );
};

export const NotePreview: React.FC<{
  result: SearchResult | null;
  streamingContent?: string;
}> = ({ result, streamingContent }) => {
  if (!result) {
    return (
      <div className="note-preview">
        <div className="preview-placeholder">Select a note to preview</div>
      </div>
    );
  }

  // For AI answer, show streaming content or final content
  const isAiAnswer = result.id === 'ai-answer' || result.id === 'ai-streaming';
  const content = isAiAnswer
    ? (streamingContent || result.content || result.snippet || '')
    : (result.content || result.snippet || '');

  return (
    <div className="note-preview">
      <div className="preview-title">{result.title}</div>
      <div className="preview-content">{content}</div>
      {isAiAnswer && streamingContent && <span className="streaming-cursor">▌</span>}
    </div>
  );
};

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const searchIdRef = useRef(0);

  useEffect(() => {
    const chunkUnsub = api.onSearchStreamChunk?.((chunk) => {
      setStreamingContent((prev) => prev + chunk);
    });
    const doneUnsub = api.onSearchStreamDone?.(() => {
      // Streaming done - content is now in the AI result
    });
    return () => {
      chunkUnsub?.();
      doneUnsub?.();
    };
  }, []);

  const search = useCallback(async (query: string) => {
    const currentSearchId = ++searchIdRef.current;

    // Empty query = clear UI state.
    if (!query.trim()) {
      setResults([]);
      setSelectedIndex(0);
      setStreamingContent('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setStreamingContent('');

    try {
      // First, get local results immediately (fast)
      const localResults = await api.searchLocal(query);
      
      if (currentSearchId !== searchIdRef.current) return;
      
      // Show local results right away
      setResults(localResults);
      setSelectedIndex(0);
      setIsLoading(false);
      
      // Then start AI search in background (slow, but streams)
      const aiResults = await api.search(query);
      
      if (currentSearchId !== searchIdRef.current) return;
      
      // Update with AI results (includes AI answer as first result)
      setResults(aiResults);
      
    } catch (err) {
      if (currentSearchId === searchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const openNote = useCallback((result: SearchResult) => {
    api.openNote(result.id);
  }, []);

  return {
    results,
    selectedIndex,
    setSelectedIndex,
    isLoading,
    streamingContent,
    search,
    openNote,
    selectedResult: results[selectedIndex] || null,
  };
}
