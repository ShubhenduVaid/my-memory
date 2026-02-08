import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSystemTheme } from '../shared/hooks/useSystemTheme';
import { CommandPalette, useCommandPalette, Command } from '../widgets/CommandPalette';
import { SearchBar, SearchResults, NotePreview, useSearch } from '../features/Search';
import { api } from '../shared/api';
import { SettingsModal } from '../widgets/SettingsModal';

type View = 'dashboard' | 'search';

export const App: React.FC = () => {
  useSystemTheme();
  const [view, setView] = useState<View>('search');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { isOpen, close } = useCommandPalette();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { results, selectedIndex, setSelectedIndex, streamingContent, search, openNote, selectedResult, isLoading } = useSearch();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback((query: string) => {
    search(query);
    setRecentSearches(prev => [query, ...prev.filter(s => s !== query)].slice(0, 10));
  }, [search]);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isOpen) return;
      if (e.key !== ',') return;
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      openSettings();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, openSettings]);

  useEffect(() => {
    if (view !== 'search') return;

    const isEditableTarget = (el: Element | null): boolean => {
      if (!el) return false;
      const tag = (el as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
      return Boolean((el as HTMLElement).isContentEditable);
    };

    const handler = (e: KeyboardEvent) => {
      if (isOpen || isSettingsOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const active = document.activeElement;
      const inTextField = isEditableTarget(active);
      const inSearchField = active === searchInputRef.current;
      if (inTextField && !inSearchField) return;

      switch (e.key) {
        case 'ArrowDown': {
          if (results.length <= 0) return;
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        }
        case 'ArrowUp': {
          if (results.length <= 0) return;
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        }
        case 'Enter': {
          if (!selectedResult) return;
          if (selectedResult.id === 'ai-answer' || selectedResult.id === 'ai-streaming') return;
          e.preventDefault();
          openNote(selectedResult);
          break;
        }
        case 'Escape': {
          e.preventDefault();
          void api.hideWindow();
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isSettingsOpen, openNote, results.length, selectedResult, setSelectedIndex, view]);

  const commands: Command[] = [
    { id: 'search', label: 'Go to Search', shortcut: '⌘⇧Space', action: () => setView('search'), category: 'navigation' },
    { id: 'dashboard', label: 'Go to Dashboard', action: () => setView('dashboard'), category: 'navigation' },
    { id: 'settings', label: 'Open Settings', shortcut: '⌘,', action: () => openSettings(), category: 'navigation' },
    { id: 'sync-all', label: 'Sync All Sources', shortcut: '⌘R', action: () => { api.syncObsidianNow(); api.syncLocalNow(); api.syncNotionNow(); }, category: 'action' },
    { id: 'sync-obsidian', label: 'Sync Obsidian', action: () => api.syncObsidianNow(), category: 'action' },
    { id: 'sync-local', label: 'Sync Local Files', action: () => api.syncLocalNow(), category: 'action' },
    { id: 'sync-notion', label: 'Sync Notion', action: () => api.syncNotionNow(), category: 'action' },
  ];

  return (
    <div id="app">
      <CommandPalette commands={commands} isOpen={isOpen} onClose={close} />
      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
      
      {view === 'search' ? (
        <>
          <SearchBar
            onSearch={handleSearch}
            onOpenSettings={openSettings}
            inputRef={searchInputRef}
            selectedIndex={selectedIndex}
            resultsLength={results.length}
            onSelectIndex={setSelectedIndex}
            onOpenSelected={() => {
              if (!selectedResult) return;
              // Avoid trying to “open” the AI answer pseudo-result.
              if (selectedResult.id === 'ai-answer' || selectedResult.id === 'ai-streaming') return;
              openNote(selectedResult);
            }}
            onClose={() => api.hideWindow()}
          />
          <div id="content">
            <SearchResults
              results={results}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onOpen={openNote}
              isLoading={isLoading}
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
