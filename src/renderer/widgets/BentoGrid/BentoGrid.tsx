import React, { useState, useCallback } from 'react';
import GridLayout, { Layout, LayoutItem } from 'react-grid-layout';
import { GlassPanel } from '../../shared/ui';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './BentoGrid.css';

export interface TileData {
  id: string;
  type: 'recent-searches' | 'pinned-notes' | 'source-status' | 'quick-actions';
  title: string;
}

interface BentoGridProps {
  tiles: TileData[];
  onLayoutChange?: (layout: Layout) => void;
  renderTile: (tile: TileData) => React.ReactNode;
}

const defaultLayout: LayoutItem[] = [
  { i: 'recent-searches', x: 0, y: 0, w: 4, h: 2 },
  { i: 'pinned-notes', x: 4, y: 0, w: 4, h: 2 },
  { i: 'source-status', x: 8, y: 0, w: 4, h: 2 },
  { i: 'quick-actions', x: 0, y: 2, w: 6, h: 2 },
];

export const BentoGrid: React.FC<BentoGridProps> = ({ tiles, onLayoutChange, renderTile }) => {
  const [layout, setLayout] = useState<Layout>(() => {
    const saved = localStorage.getItem('bento-layout');
    return saved ? JSON.parse(saved) : defaultLayout;
  });
  const [dragging, setDragging] = useState<string | null>(null);

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    setLayout(newLayout);
    localStorage.setItem('bento-layout', JSON.stringify(newLayout));
    onLayoutChange?.(newLayout);
  }, [onLayoutChange]);

  return (
    <div className="bento-grid-container">
      <GridLayout
        className="bento-grid"
        layout={layout}
        width={1200}
        gridConfig={{ cols: 12, rowHeight: 80, margin: [16, 16], containerPadding: [16, 16] }}
        dragConfig={{ enabled: true, handle: '.tile-drag-handle' }}
        resizeConfig={{ enabled: true }}
        onLayoutChange={handleLayoutChange}
        onDragStart={(_, item) => setDragging(item.i)}
        onDragStop={() => setDragging(null)}
      >
        {tiles.map((tile) => (
          <div key={tile.id} className={`bento-tile ${dragging === tile.id ? 'dragging' : ''}`}>
            <GlassPanel className="tile-content" padding="16px">
              <div className="tile-header">
                <span className="tile-title">{tile.title}</span>
                <span className="tile-drag-handle">⋮⋮</span>
              </div>
              <div className="tile-body">{renderTile(tile)}</div>
            </GlassPanel>
          </div>
        ))}
      </GridLayout>
    </div>
  );
};

// Default tile components
export const RecentSearchesTile: React.FC<{ searches: string[] }> = ({ searches }) => (
  <ul className="tile-list">
    {searches.slice(0, 5).map((s, i) => (
      <li key={i} className="tile-list-item">{s}</li>
    ))}
  </ul>
);

export const PinnedNotesTile: React.FC<{ notes: { id: string; title: string }[] }> = ({ notes }) => (
  <ul className="tile-list">
    {notes.slice(0, 5).map((n) => (
      <li key={n.id} className="tile-list-item">{n.title}</li>
    ))}
  </ul>
);

export const SourceStatusTile: React.FC<{ sources: { name: string; connected: boolean }[] }> = ({ sources }) => (
  <ul className="tile-list">
    {sources.map((s) => (
      <li key={s.name} className="tile-list-item">
        <span className={`status-dot ${s.connected ? 'connected' : ''}`} />
        {s.name}
      </li>
    ))}
  </ul>
);

export const QuickActionsTile: React.FC<{ actions: { label: string; onClick: () => void }[] }> = ({ actions }) => (
  <div className="quick-actions">
    {actions.map((a) => (
      <button key={a.label} className="quick-action-btn" onClick={a.onClick}>
        {a.label}
      </button>
    ))}
  </div>
);
