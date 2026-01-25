import React, { useState, useCallback } from 'react';
import { useSystemTheme } from '../shared/hooks/useSystemTheme';
import { CommandPalette, useCommandPalette, Command } from '../widgets/CommandPalette';
import { SearchBar, SearchResults, NotePreview, useSearch } from '../features/Search';
import { BentoGrid, TileData, RecentSearchesTile, SourceStatusTile, QuickActionsTile } from '../widgets/BentoGrid';
import { api } from '../shared/api';
import '../shared/styles/global.css';
import '../shared/styles/theme.css';
import '../shared/styles/glass.css';

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

  const tiles: TileData[] = [
    { id: 'recent-searches', type: 'recent-searches', title: 'Recent Searches' },
    { id: 'source-status', type: 'source-status', title: 'Sources' },
    { id: 'quick-actions', type: 'quick-actions', title: 'Quick Actions' },
  ];

  const sources = [
    { name: 'Apple Notes', connected: true },
    { name: 'Obsidian', connected: false },
    { name: 'Local Files', connected: false },
    { name: 'Notion', connected: false },
  ];

  const quickActions = [
    { label: 'New Search', onClick: () => setView('search') },
    { label: 'Sync All', onClick: () => { api.syncObsidianNow(); api.syncLocalNow(); api.syncNotionNow(); } },
  ];

  const renderTile = (tile: TileData) => {
    switch (tile.type) {
      case 'recent-searches': return <RecentSearchesTile searches={recentSearches} />;
      case 'source-status': return <SourceStatusTile sources={sources} />;
      case 'quick-actions': return <QuickActionsTile actions={quickActions} />;
      default: return null;
    }
  };

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
        <div style={{ padding: 16, height: '100%' }}>
          <BentoGrid tiles={tiles} renderTile={renderTile} />
        </div>
      )}
    </div>
  );
};
