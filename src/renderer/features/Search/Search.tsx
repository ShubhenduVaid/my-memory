import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, SearchResult } from '../../shared/api';
import { GlassPanel } from '../../shared/ui';

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
    }, 300);
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
}> = ({ results, selectedIndex, onSelect, onOpen }) => (
  <div className="search-results" role="listbox" aria-label="Search results">
    {results.length === 0 ? (
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
    setIsLoading(true);
    setStreamingContent('');
    try {
      const res = await api.search(query);
      setResults(res);
      setSelectedIndex(0);
    } finally {
      setIsLoading(false);
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
