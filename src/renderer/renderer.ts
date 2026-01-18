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
  getGeminiKeyStatus: () => Promise<{ hasKey: boolean }>;
  setGeminiKey: (apiKey: string | null) => Promise<{ ok: boolean; hasKey: boolean }>;
  getNotionConfig: () => Promise<{ hasToken: boolean }>;
  setNotionToken: (token: string | null) => Promise<{ ok: boolean; hasToken: boolean }>;
  syncNotionNow: () => Promise<{ ok: boolean }>;
  getObsidianConfig: () => Promise<ObsidianConfig>;
  setObsidianConfig: (config: ObsidianConfig) => Promise<{ ok: boolean; vaults: string[] }>;
  selectObsidianVault: () => Promise<{ canceled: boolean; path?: string }>;
  syncObsidianNow: () => Promise<{ ok: boolean }>;
  getLocalConfig: () => Promise<LocalConfig>;
  setLocalConfig: (config: LocalConfig) => Promise<{ ok: boolean; folders: string[]; recursive: boolean }>;
  selectLocalFolder: () => Promise<{ canceled: boolean; path?: string }>;
  syncLocalNow: () => Promise<{ ok: boolean }>;
  openNote: (noteId: string) => void;
  ping?: () => Promise<string>;
}

interface ObsidianConfig {
  vaults?: string[];
}

interface LocalConfig {
  folders?: string[];
  recursive?: boolean;
}

// DOM elements
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsList = document.getElementById('results-list') as HTMLDivElement;
const previewTitle = document.getElementById('preview-title') as HTMLDivElement;
const previewContent = document.getElementById('preview-content') as HTMLDivElement;
const apiKeyToggle = document.getElementById('api-key-toggle') as HTMLButtonElement;
const apiKeyPanel = document.getElementById('api-key-panel') as HTMLDivElement;
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const apiKeySave = document.getElementById('api-key-save') as HTMLButtonElement;
const apiKeyClear = document.getElementById('api-key-clear') as HTMLButtonElement;
const apiKeyStatus = document.getElementById('api-key-status') as HTMLDivElement;
const searchStatus = document.getElementById('search-status') as HTMLDivElement;
const obsidianToggle = document.getElementById('obsidian-toggle') as HTMLButtonElement;
const obsidianPanel = document.getElementById('obsidian-panel') as HTMLDivElement;
const obsidianStatus = document.getElementById('obsidian-status') as HTMLDivElement;
const obsidianAdd = document.getElementById('obsidian-add') as HTMLButtonElement;
const obsidianSync = document.getElementById('obsidian-sync') as HTMLButtonElement;
const obsidianVaults = document.getElementById('obsidian-vaults') as HTMLDivElement;
const localToggle = document.getElementById('local-toggle') as HTMLButtonElement;
const localPanel = document.getElementById('local-panel') as HTMLDivElement;
const localStatus = document.getElementById('local-status') as HTMLDivElement;
const localAdd = document.getElementById('local-add') as HTMLButtonElement;
const localSync = document.getElementById('local-sync') as HTMLButtonElement;
const localRecursive = document.getElementById('local-recursive') as HTMLInputElement;
const localFolders = document.getElementById('local-folders') as HTMLDivElement;
const notionToggle = document.getElementById('notion-toggle') as HTMLButtonElement;
const notionPanel = document.getElementById('notion-panel') as HTMLDivElement;
const notionTokenInput = document.getElementById('notion-token-input') as HTMLInputElement;
const notionSave = document.getElementById('notion-save') as HTMLButtonElement;
const notionClear = document.getElementById('notion-clear') as HTMLButtonElement;
const notionSync = document.getElementById('notion-sync') as HTMLButtonElement;
const notionStatus = document.getElementById('notion-status') as HTMLDivElement;

// State
let selectedIndex = -1;
let results: SearchResult[] = [];
let debounceTimer: number;
let lastQuery = '';
let loggedMissingApi = false;
let aiRequestId = 0;
let aiInFlight = false;
let obsidianVaultList: string[] = [];
let localFolderList: string[] = [];
let localRecursiveEnabled = true;
let notionHasToken = false;

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

function showEmptyState(message: string): void {
  resultsList.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function setSearchStatus(message?: string): void {
  if (!message) {
    searchStatus.textContent = '';
    searchStatus.dataset.state = 'idle';
    return;
  }
  searchStatus.textContent = message;
  searchStatus.dataset.state = 'busy';
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

function setApiKeyStatus(hasKey: boolean, message?: string): void {
  const base = hasKey ? 'AI key saved' : 'AI key not set';
  apiKeyStatus.textContent = message ? `${base} - ${message}` : base;
  apiKeyStatus.dataset.state = hasKey ? 'set' : 'unset';
}

function toggleApiKeyPanel(force?: boolean): void {
  const show = typeof force === 'boolean' ? force : !apiKeyPanel.classList.contains('is-open');
  apiKeyPanel.classList.toggle('is-open', show);
  if (show) apiKeyInput.focus();
}

function setNotionStatus(hasToken: boolean, message?: string): void {
  const base = hasToken ? 'Notion token saved' : 'Notion token not set';
  notionStatus.textContent = message ? `${base} - ${message}` : base;
  notionStatus.dataset.state = hasToken ? 'set' : 'unset';
}

function updateNotionControls(): void {
  notionClear.disabled = !notionHasToken;
  notionSync.disabled = !notionHasToken;
}

function toggleNotionPanel(force?: boolean): void {
  const show = typeof force === 'boolean' ? force : !notionPanel.classList.contains('is-open');
  notionPanel.classList.toggle('is-open', show);
  if (show) notionTokenInput.focus();
}

function toggleObsidianPanel(force?: boolean): void {
  const show = typeof force === 'boolean' ? force : !obsidianPanel.classList.contains('is-open');
  obsidianPanel.classList.toggle('is-open', show);
}

function setObsidianStatus(message: string): void {
  obsidianStatus.textContent = message;
}

function renderObsidianVaults(): void {
  if (obsidianVaultList.length === 0) {
    obsidianVaults.innerHTML = '';
    obsidianSync.disabled = true;
    setObsidianStatus('No vaults selected');
    return;
  }

  obsidianSync.disabled = false;
  setObsidianStatus(`${obsidianVaultList.length} vault${obsidianVaultList.length === 1 ? '' : 's'} selected`);
  obsidianVaults.innerHTML = obsidianVaultList
    .map(
      vault => `
        <div class="obsidian-vault">
          <div class="obsidian-vault-path" title="${escapeHtml(vault)}">${escapeHtml(vault)}</div>
          <button class="obsidian-remove" data-path="${encodeURIComponent(vault)}">Remove</button>
        </div>
      `
    )
    .join('');

  obsidianVaults.querySelectorAll<HTMLButtonElement>('.obsidian-remove').forEach(button => {
    button.addEventListener('click', () => {
      const encoded = button.getAttribute('data-path') || '';
      const decoded = decodeURIComponent(encoded);
      obsidianVaultList = obsidianVaultList.filter(path => path !== decoded);
      saveObsidianConfig();
    });
  });
}

function toggleLocalPanel(force?: boolean): void {
  const show = typeof force === 'boolean' ? force : !localPanel.classList.contains('is-open');
  localPanel.classList.toggle('is-open', show);
}

function setLocalStatus(message: string): void {
  localStatus.textContent = message;
}

function renderLocalFolders(): void {
  if (localFolderList.length === 0) {
    localFolders.innerHTML = '';
    setLocalStatus('No folders selected');
    localSync.disabled = true;
    return;
  }

  setLocalStatus(`${localFolderList.length} folder${localFolderList.length === 1 ? '' : 's'} selected`);
  localSync.disabled = false;
  localFolders.innerHTML = localFolderList
    .map(
      folder => `
        <div class="local-folder">
          <div class="local-folder-path" title="${escapeHtml(folder)}">${escapeHtml(folder)}</div>
          <button class="local-remove" data-path="${encodeURIComponent(folder)}">Remove</button>
        </div>
      `
    )
    .join('');

  localFolders.querySelectorAll<HTMLButtonElement>('.local-remove').forEach(button => {
    button.addEventListener('click', () => {
      const encoded = button.getAttribute('data-path') || '';
      const decoded = decodeURIComponent(encoded);
      localFolderList = localFolderList.filter(path => path !== decoded);
      saveLocalConfig();
    });
  });
}

async function refreshNotionConfig(): Promise<void> {
  if (!apiBridge?.getNotionConfig) {
    setNotionStatus(false, 'Notion unavailable');
    notionSave.disabled = true;
    updateNotionControls();
    return;
  }
  try {
    const config = await apiBridge.getNotionConfig();
    notionHasToken = config.hasToken;
    notionSave.disabled = false;
    setNotionStatus(notionHasToken);
    updateNotionControls();
  } catch (error: unknown) {
    logError('getNotionConfig failed', error);
    setNotionStatus(false, 'Notion unavailable');
    notionSave.disabled = true;
    updateNotionControls();
  }
}

async function updateNotionToken(token: string | null): Promise<void> {
  if (!apiBridge?.setNotionToken) return;
  try {
    const result = await apiBridge.setNotionToken(token);
    notionHasToken = result.hasToken;
    setNotionStatus(notionHasToken, token ? 'saved' : 'cleared');
    updateNotionControls();
  } catch (error: unknown) {
    logError('setNotionToken failed', error);
    setNotionStatus(notionHasToken, 'save failed');
  }
}

async function refreshObsidianConfig(): Promise<void> {
  if (!apiBridge?.getObsidianConfig) {
    setObsidianStatus('Obsidian unavailable');
    obsidianAdd.disabled = true;
    obsidianSync.disabled = true;
    return;
  }
  try {
    const config = await apiBridge.getObsidianConfig();
    obsidianVaultList = config.vaults || [];
    obsidianAdd.disabled = false;
    renderObsidianVaults();
  } catch (error: unknown) {
    logError('getObsidianConfig failed', error);
    setObsidianStatus('Obsidian unavailable');
    obsidianAdd.disabled = true;
    obsidianSync.disabled = true;
  }
}

async function saveObsidianConfig(): Promise<void> {
  if (!apiBridge?.setObsidianConfig) return;
  try {
    const result = await apiBridge.setObsidianConfig({ vaults: obsidianVaultList });
    obsidianVaultList = result.vaults;
    renderObsidianVaults();
  } catch (error: unknown) {
    logError('setObsidianConfig failed', error);
    setObsidianStatus('Failed to save vaults');
  }
}

async function refreshLocalConfig(): Promise<void> {
  if (!apiBridge?.getLocalConfig) {
    setLocalStatus('Local folders unavailable');
    return;
  }
  try {
    const config = await apiBridge.getLocalConfig();
    localFolderList = config.folders || [];
    localRecursiveEnabled = config.recursive ?? true;
    localRecursive.checked = localRecursiveEnabled;
    renderLocalFolders();
  } catch (error: unknown) {
    logError('getLocalConfig failed', error);
    setLocalStatus('Local folders unavailable');
  }
}

async function saveLocalConfig(): Promise<void> {
  if (!apiBridge?.setLocalConfig) return;
  try {
    const result = await apiBridge.setLocalConfig({
      folders: localFolderList,
      recursive: localRecursiveEnabled
    });
    localFolderList = result.folders;
    localRecursiveEnabled = result.recursive;
    localRecursive.checked = localRecursiveEnabled;
    renderLocalFolders();
  } catch (error: unknown) {
    logError('setLocalConfig failed', error);
    setLocalStatus('Failed to save folders');
  }
}

if (apiBridge?.getGeminiKeyStatus) {
  apiBridge
    .getGeminiKeyStatus()
    .then(({ hasKey }) => setApiKeyStatus(hasKey))
    .catch(error => {
      setApiKeyStatus(false, 'status unavailable');
      logError('getGeminiKeyStatus failed', error);
    });
} else {
  setApiKeyStatus(false, 'API unavailable');
}

refreshObsidianConfig();
refreshLocalConfig();
refreshNotionConfig();

// Event listeners
searchInput.addEventListener('input', handleInput);
window.addEventListener('keydown', handleKeydown);
apiKeyToggle.addEventListener('click', () => toggleApiKeyPanel());
obsidianToggle.addEventListener('click', () => toggleObsidianPanel());
localToggle.addEventListener('click', () => toggleLocalPanel());
notionToggle.addEventListener('click', () => toggleNotionPanel());
apiKeySave.addEventListener('click', async () => {
  if (!apiBridge?.setGeminiKey) {
    setApiKeyStatus(false, 'API unavailable');
    return;
  }
  const key = apiKeyInput.value.trim();
  if (!key) {
    setApiKeyStatus(false, 'enter a key to save');
    return;
  }
  apiKeySave.disabled = true;
  try {
    const result = await apiBridge.setGeminiKey(key);
    setApiKeyStatus(result.hasKey, 'saved');
    apiKeyInput.value = '';
  } catch (error: unknown) {
    logError('setGeminiKey failed', error);
    setApiKeyStatus(false, 'save failed');
  } finally {
    apiKeySave.disabled = false;
  }
});
apiKeyClear.addEventListener('click', async () => {
  if (!apiBridge?.setGeminiKey) {
    setApiKeyStatus(false, 'API unavailable');
    return;
  }
  apiKeyClear.disabled = true;
  try {
    const result = await apiBridge.setGeminiKey(null);
    setApiKeyStatus(result.hasKey, 'cleared');
    apiKeyInput.value = '';
  } catch (error: unknown) {
    logError('clearGeminiKey failed', error);
    setApiKeyStatus(false, 'clear failed');
  } finally {
    apiKeyClear.disabled = false;
  }
});
apiKeyInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') apiKeySave.click();
});
notionTokenInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') notionSave.click();
});
notionSave.addEventListener('click', async () => {
  const token = notionTokenInput.value.trim();
  if (!token) {
    setNotionStatus(notionHasToken, 'enter a token to save');
    return;
  }
  notionSave.disabled = true;
  try {
    await updateNotionToken(token);
    notionTokenInput.value = '';
  } finally {
    notionSave.disabled = false;
  }
});
notionClear.addEventListener('click', async () => {
  notionClear.disabled = true;
  try {
    await updateNotionToken(null);
    notionTokenInput.value = '';
  } finally {
    notionClear.disabled = false;
  }
});
notionSync.addEventListener('click', async () => {
  if (!apiBridge?.syncNotionNow) return;
  try {
    await apiBridge.syncNotionNow();
  } catch (error: unknown) {
    logError('syncNotionNow failed', error);
  }
});
obsidianAdd.addEventListener('click', async () => {
  if (!apiBridge?.selectObsidianVault) {
    setObsidianStatus('Obsidian unavailable');
    return;
  }
  try {
    const result = await apiBridge.selectObsidianVault();
    if (result.canceled || !result.path) return;
    if (!obsidianVaultList.includes(result.path)) {
      obsidianVaultList = [...obsidianVaultList, result.path];
      await saveObsidianConfig();
    }
  } catch (error: unknown) {
    logError('selectObsidianVault failed', error);
    setObsidianStatus('Failed to add vault');
  }
});
obsidianSync.addEventListener('click', async () => {
  if (!apiBridge?.syncObsidianNow) return;
  try {
    await apiBridge.syncObsidianNow();
  } catch (error: unknown) {
    logError('syncObsidianNow failed', error);
  }
});
localAdd.addEventListener('click', async () => {
  if (!apiBridge?.selectLocalFolder) {
    setLocalStatus('Local folders unavailable');
    return;
  }
  try {
    const result = await apiBridge.selectLocalFolder();
    if (result.canceled || !result.path) return;
    if (!localFolderList.includes(result.path)) {
      localFolderList = [...localFolderList, result.path];
      await saveLocalConfig();
    }
  } catch (error: unknown) {
    logError('selectLocalFolder failed', error);
    setLocalStatus('Failed to add folder');
  }
});
localSync.addEventListener('click', async () => {
  if (!apiBridge?.syncLocalNow) return;
  try {
    await apiBridge.syncLocalNow();
  } catch (error: unknown) {
    logError('syncLocalNow failed', error);
  }
});
localRecursive.addEventListener('change', () => {
  localRecursiveEnabled = localRecursive.checked;
  saveLocalConfig();
});

/** Handle search input with debouncing */
function handleInput(): void {
  clearTimeout(debounceTimer);
  const query = searchInput.value.trim();

  if (!apiBridge) {
    if (!loggedMissingApi) {
      logError('window.api is missing (preload not loaded?)');
      loggedMissingApi = true;
    }
    if (query.length >= 2) {
      setSearchStatus('Search API unavailable (preload failed)');
      if (results.length === 0) showEmptyState('Search API unavailable (preload failed)');
    } else {
      setSearchStatus();
      clearResults();
    }
    return;
  }

  // Immediate local search for responsiveness
  if (query.length >= 2 && query !== lastQuery) {
    const startedAt = performance.now();
    setSearchStatus('Searching...');
    if (results.length === 0) showEmptyState('Searching...');
    log(`searchLocal start len=${query.length} "${formatQueryForLog(query)}"`);
    try {
      apiBridge
        .searchLocal(query)
        .then((localResults: SearchResult[]) => {
          log(
            `searchLocal done results=${localResults.length} (${Math.round(performance.now() - startedAt)}ms) "${formatQueryForLog(query)}"`
          );
          if (searchInput.value.trim() === query) {
            applyResults(localResults, true);
            if (!aiInFlight) setSearchStatus();
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
      setSearchStatus();
      aiInFlight = false;
      aiRequestId = 0;
      return;
    }
    lastQuery = query;
    const startedAt = performance.now();
    const requestId = ++aiRequestId;
    aiInFlight = true;
    setSearchStatus('Searching with AI...');
    if (results.length === 0) showEmptyState('Searching with AI...');
    log(`search start len=${query.length} "${formatQueryForLog(query)}"`);
    try {
      const aiResults = await apiBridge.search(query);
      log(
        `search done results=${aiResults.length} (${Math.round(performance.now() - startedAt)}ms) "${formatQueryForLog(query)}"`
      );
      if (requestId !== aiRequestId || searchInput.value.trim() !== query) return;
      applyResults(aiResults, true);
      setSearchStatus();
    } catch (error: unknown) {
      logError('search error', error);
      if (requestId !== aiRequestId) return;
      if (results.length === 0) showEmptyState('Search failed (see logs)');
      setSearchStatus('AI search failed (see logs)');
    } finally {
      if (requestId === aiRequestId) aiInFlight = false;
    }
  }, 800);
}

/** Handle keyboard navigation */
function handleKeydown(event: KeyboardEvent): void {
  if (!shouldHandleKeydown(event)) return;

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

function shouldHandleKeydown(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return true;

  if (target === apiKeyInput) return false;
  if (target.tagName === 'TEXTAREA') return false;
  if (target.tagName === 'INPUT' && target !== searchInput) return false;
  if (target.isContentEditable) return false;

  return true;
}

/** Clear search results */
function clearResults(): void {
  resultsList.innerHTML = '';
  previewTitle.textContent = 'Select a note to preview';
  previewContent.textContent = '';
  results = [];
  selectedIndex = -1;
}

function applyResults(nextResults: SearchResult[], preserveSelection: boolean): void {
  const selectedId = results[selectedIndex]?.id;
  results = nextResults;

  if (results.length === 0) {
    selectedIndex = -1;
    renderResults();
    return;
  }

  let nextIndex = 0;
  if (preserveSelection && selectedId) {
    const foundIndex = results.findIndex(result => result.id === selectedId);
    if (foundIndex >= 0) nextIndex = foundIndex;
  }

  selectedIndex = nextIndex;
  renderResults();
  selectResult(nextIndex);
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
  const escaped = escapeHtml(text);
  return escaped
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
