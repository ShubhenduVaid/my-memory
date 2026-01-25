import React, { useState, useCallback } from 'react';
import { useSystemTheme } from '../shared/hooks/useSystemTheme';
import { CommandPalette, useCommandPalette, Command } from '../widgets/CommandPalette';
import { SearchBar, SearchResults, NotePreview, useSearch } from '../features/Search';
import { api } from '../shared/api';

type View = 'dashboard' | 'search';

export const App: React.FC = () => {
  useSystemTheme();
  const [view, setView] = useState<View>('search');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { isOpen, close } = useCommandPalette();
  const { results, selectedIndex, setSelectedIndex, streamingContent, search, openNote, selectedResult } = useSearch();

  const handleSearch = useCallback((query: string) => {
    search(query);
    setRecentSearches(prev => [query, ...prev.filter(s => s !== query)].slice(0, 10));
  }, [search]);

  const commands: Command[] = [
    { id: 'search', label: 'Go to Search', shortcut: '⌘⇧Space', action: () => setView('search'), category: 'navigation' },
    { id: 'dashboard', label: 'Go to Dashboard', action: () => setView('dashboard'), category: 'navigation' },
    { id: 'sync-all', label: 'Sync All Sources', shortcut: '⌘R', action: () => { api.syncObsidianNow(); api.syncLocalNow(); api.syncNotionNow(); }, category: 'action' },
    { id: 'sync-obsidian', label: 'Sync Obsidian', action: () => api.syncObsidianNow(), category: 'action' },
    { id: 'sync-local', label: 'Sync Local Files', action: () => api.syncLocalNow(), category: 'action' },
    { id: 'sync-notion', label: 'Sync Notion', action: () => api.syncNotionNow(), category: 'action' },
  ];

  return (
    <div id="app">
      <CommandPalette commands={commands} isOpen={isOpen} onClose={close} />
      
      {view === 'search' ? (
        <>
          <SearchBar onSearch={handleSearch} />
          <div id="content">
            <SearchResults
              results={results}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onOpen={openNote}
            />
            <NotePreview result={selectedResult} streamingContent={streamingContent} />
          </div>
        </>
      ) : (
        <div style={{ padding: 16, paddingTop: 50 }}>
          <h2 style={{ color: '#fff', marginBottom: 16 }}>Dashboard</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Recent searches: {recentSearches.length}</p>
          <button className="glass-button" onClick={() => setView('search')} style={{ marginTop: 16 }}>
            Back to Search
          </button>
        </div>
      )}
    </div>
  );
};
