import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GlassPanel } from '../../shared/ui';
import './CommandPalette.css';

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category?: 'navigation' | 'action' | 'input';
}

interface CommandPaletteProps {
  commands: Command[];
  isOpen: boolean;
  onClose: () => void;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ commands, isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? commands.filter((c) => fuzzyMatch(query, c.label))
    : commands;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[selectedIndex]) {
            filtered[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette-container" onClick={(e) => e.stopPropagation()}>
        <GlassPanel className="command-palette" padding="0" cornerRadius={16}>
          <div className="command-palette-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              className="command-palette-input"
              placeholder="Type a command..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Command search"
            />
          </div>
          <ul className="command-palette-list" role="listbox">
            {filtered.map((cmd, i) => (
              <li
                key={cmd.id}
                className={`command-palette-item ${i === selectedIndex ? 'selected' : ''}`}
                role="option"
                aria-selected={i === selectedIndex}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
              >
                <span className="command-label">{cmd.label}</span>
                {cmd.shortcut && <span className="command-shortcut">{cmd.shortcut}</span>}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="command-palette-empty">No commands found</li>
            )}
          </ul>
        </GlassPanel>
      </div>
    </div>
  );
};

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}
