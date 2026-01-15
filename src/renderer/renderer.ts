/**
 * Renderer script for the search UI.
 * Handles user input, search requests, and result display.
 */

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  content?: string;
  folder?: string;
  score: number;
}

// DOM elements
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsList = document.getElementById('results-list') as HTMLDivElement;
const previewTitle = document.getElementById('preview-title') as HTMLDivElement;
const previewContent = document.getElementById('preview-content') as HTMLDivElement;

// State
let selectedIndex = -1;
let results: SearchResult[] = [];
let debounceTimer: number;
let lastQuery = '';

// API accessor
const api = (window as any).api;

// Event listeners
searchInput.addEventListener('input', handleInput);
searchInput.addEventListener('keydown', handleKeydown);

/** Handle search input with debouncing */
function handleInput(): void {
  clearTimeout(debounceTimer);
  const query = searchInput.value.trim();

  // Immediate local search for responsiveness
  if (query.length >= 2 && query !== lastQuery) {
    api.searchLocal(query).then((localResults: SearchResult[]) => {
      if (searchInput.value.trim() === query) {
        results = localResults;
        renderResults();
        if (results.length > 0) selectResult(0);
      }
    });
  }

  // Debounced AI search after typing stops
  debounceTimer = window.setTimeout(async () => {
    if (query.length < 2) {
      clearResults();
      return;
    }
    lastQuery = query;
    results = await api.search(query);
    renderResults();
    if (results.length > 0) selectResult(0);
  }, 800);
}

/** Handle keyboard navigation */
function handleKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectResult(selectedIndex + 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectResult(selectedIndex - 1);
      break;
    case 'Enter':
      if (selectedIndex >= 0 && results[selectedIndex]) {
        api.openNote(results[selectedIndex].id);
      }
      break;
  }
}

/** Clear search results */
function clearResults(): void {
  resultsList.innerHTML = '';
  previewTitle.textContent = 'Select a note to preview';
  previewContent.textContent = '';
  results = [];
  selectedIndex = -1;
}

/** Render search results list */
function renderResults(): void {
  resultsList.innerHTML = results
    .map((result, index) => `
      <div class="result ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
        <div class="result-title">${escapeHtml(result.title)}</div>
        <div class="result-folder">${escapeHtml(result.folder || '')}</div>
      </div>
    `)
    .join('');

  // Add click handlers
  resultsList.querySelectorAll('.result').forEach(element => {
    element.addEventListener('click', () => {
      const index = parseInt(element.getAttribute('data-index') || '0', 10);
      selectResult(index);
    });
    element.addEventListener('dblclick', () => {
      const index = parseInt(element.getAttribute('data-index') || '0', 10);
      api.openNote(results[index].id);
    });
  });
}

/** Select a result by index */
function selectResult(index: number): void {
  if (results.length === 0) return;

  // Clamp index to valid range
  selectedIndex = Math.max(0, Math.min(index, results.length - 1));

  // Update selection styling
  resultsList.querySelectorAll('.result').forEach((element, i) => {
    element.classList.toggle('selected', i === selectedIndex);
  });

  // Update preview
  const selected = results[selectedIndex];
  previewTitle.textContent = selected.title;

  // Render markdown for AI answers
  if (selected.id === 'ai-answer') {
    previewContent.innerHTML = renderMarkdown(selected.content || selected.snippet || '');
  } else {
    previewContent.textContent = selected.content || selected.snippet || '';
  }
}

/** Simple markdown renderer for AI answers */
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br>');
}

/** Escape HTML to prevent XSS */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
