import React from 'react';
import '../shared/styles/global.css';

export const App: React.FC = () => {
  return (
    <div id="app">
      <div id="search-bar">
        <div id="search-row">
          <input type="text" id="search" placeholder="Search your notes..." autoFocus />
          <button id="settings-toggle" type="button" aria-label="Open settings">⚙</button>
        </div>
        <div id="search-status" data-state="idle" aria-live="polite"></div>
      </div>
      <div id="content">
        <div id="results-list" role="listbox" aria-label="Search results"></div>
        <div id="preview" aria-live="polite">
          <div id="preview-title">Select a note to preview</div>
          <div id="preview-content"></div>
        </div>
      </div>
    </div>
  );
};
