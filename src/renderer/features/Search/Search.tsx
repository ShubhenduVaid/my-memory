import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, SearchResult } from '../../shared/api';

export const SearchBar: React.FC<{
  onSearch: (query: string) => void;
  onQueryChange?: (query: string) => void;
}> = ({ onSearch, onQueryChange }) => {
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onQueryChange?.(value);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) onSearch(value);
    }, 500); // Increased debounce to reduce race conditions
  }, [onSearch, onQueryChange]);

  return (
    <div className="search-bar">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Search your notes..."
        autoFocus
        className="glass-input"
      />
    </div>
  );
};

export const SearchResults: React.FC<{
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpen: (result: SearchResult) => void;
  isLoading?: boolean;
}> = ({ results, selectedIndex, onSelect, onOpen, isLoading }) => (
  <div className="search-results" role="listbox" aria-label="Search results">
    {isLoading && <div className="search-loading">Searching...</div>}
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

  const content = streamingContent || result.snippet || result.content || '';

  return (
    <div className="note-preview">
      <div className="preview-title">{result.title}</div>
      <div 
        className="preview-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      {streamingContent && <span className="streaming-cursor">▌</span>}
    </div>
  );
};

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const searchIdRef = useRef(0); // Track which search is current

  useEffect(() => {
    const chunkUnsub = api.onSearchStreamChunk?.((chunk) => {
      setStreamingContent((prev) => prev + chunk);
    });
    const doneUnsub = api.onSearchStreamDone?.(() => {
      setStreamingContent('');
    });
    return () => {
      chunkUnsub?.();
      doneUnsub?.();
    };
  }, []);

  const search = useCallback(async (query: string) => {
    const currentSearchId = ++searchIdRef.current; // Increment and capture
    setIsLoading(true);
    setStreamingContent('');
    
    try {
      const res = await api.search(query);
      
      // Only update if this is still the latest search
      if (currentSearchId === searchIdRef.current) {
        setResults(res);
        setSelectedIndex(0);
        setIsLoading(false);
      }
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
