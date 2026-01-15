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

interface RendererApi {
  search: (query: string) => Promise<SearchResult[]>;
  searchLocal: (query: string) => Promise<SearchResult[]>;
  openNote: (noteId: string) => void;
  ping?: () => Promise<string>;
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
let loggedMissingApi = false;

// API accessor
const apiBridge: RendererApi | undefined = (window as any).api;

function formatQueryForLog(query: string): string {
  const normalized = query.replace(/\s+/g, ' ').trim();
  if (!normalized) return '<empty>';
  return normalized.length > 120 ? normalized.slice(0, 120) + '...' : normalized;
}

function log(message: string, data?: unknown): void {
  if (data === undefined) console.log(`[Renderer] ${message}`);
  else console.log(`[Renderer] ${message}`, data);
}

function logError(message: string, error?: unknown): void {
  if (error === undefined) console.error(`[Renderer] ${message}`);
  else console.error(`[Renderer] ${message}`, error);
}

function showStatus(message: string): void {
  resultsList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

window.addEventListener('error', event => {
  const error = (event as ErrorEvent).error ?? (event as ErrorEvent).message;
  logError('window error', error);
});

window.addEventListener('unhandledrejection', event => {
  logError('unhandledrejection', (event as PromiseRejectionEvent).reason);
});

log('loaded', { hasApi: Boolean(apiBridge) });
const pingPromise = apiBridge?.ping?.();
if (pingPromise) {
  pingPromise.then(result => log(`ping ${result}`)).catch(error => logError('ping failed', error));
} else {
  log('ping unavailable');
}

// Event listeners
searchInput.addEventListener('input', handleInput);
searchInput.addEventListener('keydown', handleKeydown);

/** Handle search input with debouncing */
function handleInput(): void {
  clearTimeout(debounceTimer);
  const query = searchInput.value.trim();

  if (!apiBridge) {
    if (!loggedMissingApi) {
      logError('window.api is missing (preload not loaded?)');
      loggedMissingApi = true;
    }
    if (query.length >= 2) showStatus('Search API unavailable (preload failed)');
    return;
  }

  // Immediate local search for responsiveness
  if (query.length >= 2 && query !== lastQuery) {
    const startedAt = performance.now();
    showStatus('Searching...');
    log(`searchLocal start len=${query.length} "${formatQueryForLog(query)}"`);
    try {
      apiBridge
        .searchLocal(query)
        .then((localResults: SearchResult[]) => {
          log(
            `searchLocal done results=${localResults.length} (${Math.round(performance.now() - startedAt)}ms) "${formatQueryForLog(query)}"`
          );
          if (searchInput.value.trim() === query) {
            results = localResults;
            renderResults();
            if (results.length > 0) selectResult(0);
          }
        })
        .catch((error: unknown) => logError('searchLocal error', error));
    } catch (error: unknown) {
      logError('searchLocal threw', error);
    }
  }

  // Debounced AI search after typing stops
  debounceTimer = window.setTimeout(async () => {
    if (query.length < 2) {
      clearResults();
      return;
    }
    lastQuery = query;
    const startedAt = performance.now();
    showStatus('Searching with AI...');
    log(`search start len=${query.length} "${formatQueryForLog(query)}"`);
    try {
      results = await apiBridge.search(query);
      log(
        `search done results=${results.length} (${Math.round(performance.now() - startedAt)}ms) "${formatQueryForLog(query)}"`
      );
      renderResults();
      if (results.length > 0) selectResult(0);
    } catch (error: unknown) {
      logError('search error', error);
      showStatus('Search failed (see logs)');
    }
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
        apiBridge?.openNote(results[selectedIndex].id);
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
  if (results.length === 0) {
    resultsList.innerHTML = `<div class="empty-state">No results</div>`;
    return;
  }

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
      apiBridge?.openNote(results[index].id);
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
