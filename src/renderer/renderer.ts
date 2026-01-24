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

interface ProviderInfo {
  name: string;
  available: boolean;
  capabilities: { supportsModelSelection: boolean; requiresApiKey: boolean };
  error?: string;
}

interface RendererApi {
  search: (query: string) => Promise<SearchResult[]>;
  searchLocal: (query: string) => Promise<SearchResult[]>;
  getGeminiKeyStatus: () => Promise<{ hasKey: boolean }>;
  setGeminiKey: (apiKey: string | null) => Promise<{ ok: boolean; hasKey: boolean }>;
  getLlmConfig: () => Promise<{ provider: string; hasGeminiKey: boolean; hasOpenrouterKey: boolean; providers?: ProviderInfo[] }>;
  setLlmProvider: (provider: string) => Promise<{ ok: boolean; provider: string }>;
  setOpenrouterKey: (apiKey: string | null) => Promise<{ ok: boolean; hasKey: boolean }>;
  getOllamaModels: () => Promise<{ models: string[]; current: string }>;
  setOllamaModel: (model: string) => Promise<{ ok: boolean; model: string }>;
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
  onSearchStreamChunk?: (callback: (chunk: string) => void) => () => void;
  onSearchStreamDone?: (callback: () => void) => () => void;
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
const searchStatus = document.getElementById('search-status') as HTMLDivElement;

// Settings modal elements
const settingsToggle = document.getElementById('settings-toggle') as HTMLButtonElement;
const settingsModal = document.getElementById('settings-modal') as HTMLDivElement;
const settingsClose = document.getElementById('settings-close') as HTMLButtonElement;
const modalBackdrop = settingsModal.querySelector('.modal-backdrop') as HTMLDivElement;
const modalTabs = settingsModal.querySelectorAll('.tab') as NodeListOf<HTMLButtonElement>;
const toastContainer = document.getElementById('toast-container') as HTMLDivElement;

// Tab status indicators
const tabStatusAi = document.getElementById('tab-status-ai') as HTMLSpanElement;
const tabStatusObsidian = document.getElementById('tab-status-obsidian') as HTMLSpanElement;
const tabStatusLocal = document.getElementById('tab-status-local') as HTMLSpanElement;
const tabStatusNotion = document.getElementById('tab-status-notion') as HTMLSpanElement;

// Tab status screen reader text
const tabStatusAiText = document.getElementById('tab-status-ai-text') as HTMLSpanElement;
const tabStatusObsidianText = document.getElementById('tab-status-obsidian-text') as HTMLSpanElement;
const tabStatusLocalText = document.getElementById('tab-status-local-text') as HTMLSpanElement;
const tabStatusNotionText = document.getElementById('tab-status-notion-text') as HTMLSpanElement;

// Empty state hints
const obsidianEmpty = document.getElementById('obsidian-empty') as HTMLDivElement;
const localEmpty = document.getElementById('local-empty') as HTMLDivElement;
const notionEmpty = document.getElementById('notion-empty') as HTMLDivElement;

// AI settings
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const apiKeySave = document.getElementById('api-key-save') as HTMLButtonElement;
const apiKeyClear = document.getElementById('api-key-clear') as HTMLButtonElement;
const apiKeyStatus = document.getElementById('api-key-status') as HTMLDivElement;
const llmProviderSelect = document.getElementById('llm-provider') as HTMLSelectElement;
const geminiKeyRow = document.getElementById('gemini-key-row') as HTMLDivElement;
const openrouterKeyRow = document.getElementById('openrouter-key-row') as HTMLDivElement;
const openrouterKeyInput = document.getElementById('openrouter-key-input') as HTMLInputElement;
const openrouterKeySave = document.getElementById('openrouter-key-save') as HTMLButtonElement;
const openrouterKeyClear = document.getElementById('openrouter-key-clear') as HTMLButtonElement;
const ollamaModelRow = document.getElementById('ollama-model-row') as HTMLDivElement;
const ollamaModelSelect = document.getElementById('ollama-model') as HTMLSelectElement;

// Obsidian settings
const obsidianStatus = document.getElementById('obsidian-status') as HTMLDivElement;
const obsidianAdd = document.getElementById('obsidian-add') as HTMLButtonElement;
const obsidianSync = document.getElementById('obsidian-sync') as HTMLButtonElement;
const obsidianVaults = document.getElementById('obsidian-vaults') as HTMLDivElement;

// Local files settings
const localStatus = document.getElementById('local-status') as HTMLDivElement;
const localAdd = document.getElementById('local-add') as HTMLButtonElement;
const localSync = document.getElementById('local-sync') as HTMLButtonElement;
const localRecursive = document.getElementById('local-recursive') as HTMLInputElement;
const localFolders = document.getElementById('local-folders') as HTMLDivElement;

// Notion settings
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
let currentLlmProvider = 'gemini';
let providerInfoCache: ProviderInfo[] = [];
let streamingContent = '';
let isStreaming = false;

// API accessor
const apiBridge: RendererApi | undefined = (window as any).api;

// Set up streaming listeners
if (apiBridge?.onSearchStreamChunk) {
  apiBridge.onSearchStreamChunk((chunk) => {
    if (isStreaming) {
      streamingContent += chunk;
      // Update preview if AI answer is selected
      if (selectedIndex === 0 && results[0]?.id === 'ai-streaming') {
        previewContent.innerHTML = renderMarkdown(streamingContent) + '<span class="streaming-cursor">▊</span>';
        previewContent.scrollTop = previewContent.scrollHeight;
      }
    }
  });
}

if (apiBridge?.onSearchStreamDone) {
  apiBridge.onSearchStreamDone(() => {
    isStreaming = false;
  });
}

/** Add streaming AI result to top of results list */
function addStreamingAiResult(): void {
  const streamingResult: SearchResult = {
    id: 'ai-streaming',
    title: '✨ AI Answer (streaming...)',
    snippet: 'Generating response...',
    content: '',
    folder: 'AI Generated',
    score: 1
  };
  
  // Add to top of results, removing any existing streaming result
  results = [streamingResult, ...results.filter(r => r.id !== 'ai-streaming' && r.id !== 'ai-answer')];
  renderResults();
  selectResult(0);
}

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
  const provider = providerInfoCache.find(p => p.name === currentLlmProvider);
  const providerName = currentLlmProvider === 'ollama' ? 'Ollama' : 
    currentLlmProvider === 'openrouter' ? 'OpenRouter' : 'Gemini';
  
  let base: string;
  if (provider?.error) {
    base = `${providerName}: ${provider.error}`;
  } else if (currentLlmProvider === 'ollama') {
    base = 'Using local Ollama';
  } else {
    base = hasKey ? `${providerName} key saved` : `${providerName} key not set`;
  }
  
  apiKeyStatus.textContent = message ? `${base} - ${message}` : base;
  apiKeyStatus.dataset.state = provider?.error ? 'error' : 
    (currentLlmProvider === 'ollama' || hasKey ? 'set' : 'unset');
  
  // Update tab status indicator
  const isConnected = currentLlmProvider === 'ollama' || hasKey;
  tabStatusAi.classList.toggle('connected', isConnected);
  tabStatusAiText.textContent = isConnected ? '(connected)' : '';
}

// Toast notification system
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// Settings modal functions
function openSettingsModal(): void {
  settingsModal.classList.remove('hidden');
  // Focus the close button for keyboard users
  settingsClose.focus();
  // Trap focus in modal
  document.addEventListener('keydown', trapFocus);
}

function closeSettingsModal(): void {
  settingsModal.classList.add('hidden');
  document.removeEventListener('keydown', trapFocus);
  // Return focus to trigger
  settingsToggle.focus();
}

function trapFocus(e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  
  const focusableElements = settingsModal.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  if (e.shiftKey && document.activeElement === firstElement) {
    e.preventDefault();
    lastElement.focus();
  } else if (!e.shiftKey && document.activeElement === lastElement) {
    e.preventDefault();
    firstElement.focus();
  }
}

function switchTab(tabName: string): void {
  modalTabs.forEach(tab => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

function updateProviderDropdown(): void {
  const options = [
    { value: 'gemini', label: 'Gemini' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'ollama', label: 'Ollama (local)' },
  ];
  
  llmProviderSelect.innerHTML = options.map(opt => {
    const info = providerInfoCache.find(p => p.name === opt.value);
    let status = '';
    if (info?.error) {
      status = ' ✗';
    } else if (info?.available) {
      status = ' ✓';
    } else if (info?.capabilities.requiresApiKey) {
      status = ' (no key)';
    }
    return `<option value="${opt.value}">${opt.label}${status}</option>`;
  }).join('');
  
  llmProviderSelect.value = currentLlmProvider;
}

function updateLlmProviderUI(): void {
  geminiKeyRow.classList.toggle('hidden', currentLlmProvider !== 'gemini');
  openrouterKeyRow.classList.toggle('hidden', currentLlmProvider !== 'openrouter');
  ollamaModelRow.classList.toggle('hidden', currentLlmProvider !== 'ollama');
  updateProviderDropdown();
  if (currentLlmProvider === 'ollama') refreshOllamaModels();
}

async function refreshOllamaModels(): Promise<void> {
  if (!apiBridge?.getOllamaModels) return;
  try {
    const { models, current } = await apiBridge.getOllamaModels();
    const provider = providerInfoCache.find(p => p.name === 'ollama');
    if (models.length === 0) {
      const hint = provider?.error || 'No models - run: ollama pull llama3.2';
      ollamaModelSelect.innerHTML = `<option value="" disabled selected>${hint}</option>`;
    } else {
      ollamaModelSelect.innerHTML = models.map(m => 
        `<option value="${m}"${m === current ? ' selected' : ''}>${m}</option>`
      ).join('');
    }
  } catch (error) {
    logError('getOllamaModels failed', error);
    ollamaModelSelect.innerHTML = '<option value="" disabled selected>Error loading models</option>';
  }
}

function setNotionStatus(hasToken: boolean, message?: string): void {
  const base = hasToken ? 'Token saved' : 'Token not set';
  notionStatus.textContent = message ? `${base} - ${message}` : base;
  notionStatus.dataset.state = hasToken ? 'set' : 'unset';
  
  // Update tab status and empty hint
  tabStatusNotion.classList.toggle('connected', hasToken);
  tabStatusNotionText.textContent = hasToken ? '(connected)' : '';
  notionEmpty.classList.toggle('hidden', hasToken);
}

function updateNotionControls(): void {
  notionClear.disabled = !notionHasToken;
  notionSync.disabled = !notionHasToken;
}

function setObsidianStatus(message: string): void {
  obsidianStatus.textContent = message;
}

function renderObsidianVaults(): void {
  const hasVaults = obsidianVaultList.length > 0;
  
  if (!hasVaults) {
    obsidianVaults.innerHTML = '';
    obsidianSync.disabled = true;
    setObsidianStatus('No vaults connected');
  } else {
    obsidianSync.disabled = false;
    setObsidianStatus(`${obsidianVaultList.length} vault${obsidianVaultList.length === 1 ? '' : 's'} connected`);
    obsidianVaults.innerHTML = obsidianVaultList
      .map(vault => `
        <div class="item-row">
          <div class="item-path" title="${escapeHtml(vault)}">${escapeHtml(vault)}</div>
          <button class="item-remove btn-secondary" data-path="${encodeURIComponent(vault)}">Remove</button>
        </div>
      `)
      .join('');

    obsidianVaults.querySelectorAll<HTMLButtonElement>('.item-remove').forEach(button => {
      button.addEventListener('click', () => {
        const decoded = decodeURIComponent(button.getAttribute('data-path') || '');
        obsidianVaultList = obsidianVaultList.filter(path => path !== decoded);
        saveObsidianConfig();
      });
    });
  }
  
  // Update tab status and empty hint
  tabStatusObsidian.classList.toggle('connected', hasVaults);
  tabStatusObsidianText.textContent = hasVaults ? '(connected)' : '';
  obsidianEmpty.classList.toggle('hidden', hasVaults);
}

function setLocalStatus(message: string): void {
  localStatus.textContent = message;
}

function renderLocalFolders(): void {
  const hasFolders = localFolderList.length > 0;
  
  if (!hasFolders) {
    localFolders.innerHTML = '';
    setLocalStatus('No folders connected');
    localSync.disabled = true;
  } else {
    setLocalStatus(`${localFolderList.length} folder${localFolderList.length === 1 ? '' : 's'} connected`);
    localSync.disabled = false;
    localFolders.innerHTML = localFolderList
      .map(folder => `
        <div class="item-row">
          <div class="item-path" title="${escapeHtml(folder)}">${escapeHtml(folder)}</div>
          <button class="item-remove btn-secondary" data-path="${encodeURIComponent(folder)}">Remove</button>
        </div>
      `)
      .join('');

    localFolders.querySelectorAll<HTMLButtonElement>('.item-remove').forEach(button => {
      button.addEventListener('click', () => {
        const decoded = decodeURIComponent(button.getAttribute('data-path') || '');
        localFolderList = localFolderList.filter(path => path !== decoded);
        saveLocalConfig();
      });
    });
  }
  
  // Update tab status and empty hint
  tabStatusLocal.classList.toggle('connected', hasFolders);
  tabStatusLocalText.textContent = hasFolders ? '(connected)' : '';
  localEmpty.classList.toggle('hidden', hasFolders);
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

if (apiBridge?.getLlmConfig) {
  apiBridge
    .getLlmConfig()
    .then(({ provider, hasGeminiKey, hasOpenrouterKey, providers }) => {
      currentLlmProvider = provider;
      providerInfoCache = providers || [];
      updateLlmProviderUI();
      const hasKey = provider === 'gemini' ? hasGeminiKey : 
        provider === 'openrouter' ? hasOpenrouterKey : true;
      setApiKeyStatus(hasKey);
    })
    .catch(error => {
      setApiKeyStatus(false, 'status unavailable');
      logError('getLlmConfig failed', error);
    });
} else if (apiBridge?.getGeminiKeyStatus) {
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

// Settings modal events
settingsToggle.addEventListener('click', openSettingsModal);
settingsClose.addEventListener('click', closeSettingsModal);
modalBackdrop.addEventListener('click', closeSettingsModal);
modalTabs.forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab || 'ai'));
});

// Close modal on Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
    closeSettingsModal();
  }
});

apiKeySave.addEventListener('click', async () => {
  if (!apiBridge?.setGeminiKey) {
    showToast('API unavailable', 'error');
    return;
  }
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('Enter a key to save', 'error');
    return;
  }
  apiKeySave.disabled = true;
  try {
    const result = await apiBridge.setGeminiKey(key);
    setApiKeyStatus(result.hasKey);
    apiKeyInput.value = '';
    showToast('Gemini key saved', 'success');
  } catch (error: unknown) {
    logError('setGeminiKey failed', error);
    showToast('Failed to save key', 'error');
  } finally {
    apiKeySave.disabled = false;
  }
});

apiKeyClear.addEventListener('click', async () => {
  if (!apiBridge?.setGeminiKey) return;
  apiKeyClear.disabled = true;
  try {
    const result = await apiBridge.setGeminiKey(null);
    setApiKeyStatus(result.hasKey);
    apiKeyInput.value = '';
    showToast('Gemini key cleared', 'info');
  } catch (error: unknown) {
    logError('clearGeminiKey failed', error);
    showToast('Failed to clear key', 'error');
  } finally {
    apiKeyClear.disabled = false;
  }
});

apiKeyInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') apiKeySave.click();
});

openrouterKeyInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') openrouterKeySave.click();
});

llmProviderSelect.addEventListener('change', async () => {
  const provider = llmProviderSelect.value;
  if (!apiBridge?.setLlmProvider) return;
  
  llmProviderSelect.disabled = true;
  
  try {
    const result = await apiBridge.setLlmProvider(provider);
    currentLlmProvider = result.provider;
    const config = await apiBridge.getLlmConfig?.();
    providerInfoCache = config?.providers || [];
    updateLlmProviderUI();
    const hasKey = provider === 'gemini' ? config?.hasGeminiKey : 
      provider === 'openrouter' ? config?.hasOpenrouterKey : true;
    setApiKeyStatus(hasKey ?? false);
    showToast(`Switched to ${provider}`, 'success');
  } catch (error) {
    logError('setLlmProvider failed', error);
    showToast('Failed to switch provider', 'error');
  } finally {
    llmProviderSelect.disabled = false;
  }
});

openrouterKeySave.addEventListener('click', async () => {
  if (!apiBridge?.setOpenrouterKey) return;
  const key = openrouterKeyInput.value.trim();
  if (!key) {
    showToast('Enter a key to save', 'error');
    return;
  }
  openrouterKeySave.disabled = true;
  try {
    const result = await apiBridge.setOpenrouterKey(key);
    setApiKeyStatus(result.hasKey);
    openrouterKeyInput.value = '';
    showToast('OpenRouter key saved', 'success');
  } catch (error) {
    logError('setOpenrouterKey failed', error);
    showToast('Failed to save key', 'error');
  } finally {
    openrouterKeySave.disabled = false;
  }
});

openrouterKeyClear.addEventListener('click', async () => {
  if (!apiBridge?.setOpenrouterKey) return;
  openrouterKeyClear.disabled = true;
  try {
    const result = await apiBridge.setOpenrouterKey(null);
    setApiKeyStatus(result.hasKey);
    openrouterKeyInput.value = '';
    showToast('OpenRouter key cleared', 'info');
  } catch (error) {
    logError('clearOpenrouterKey failed', error);
    showToast('Failed to clear key', 'error');
  } finally {
    openrouterKeyClear.disabled = false;
  }
});

ollamaModelSelect.addEventListener('change', async () => {
  if (!apiBridge?.setOllamaModel) return;
  const model = ollamaModelSelect.value;
  try {
    await apiBridge.setOllamaModel(model);
    setApiKeyStatus(true, `using ${model}`);
    showToast(`Using ${model}`, 'success');
  } catch (error) {
    logError('setOllamaModel failed', error);
    showToast('Failed to set model', 'error');
  }
});

notionTokenInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') notionSave.click();
});

notionSave.addEventListener('click', async () => {
  const token = notionTokenInput.value.trim();
  if (!token) {
    showToast('Enter a token to save', 'error');
    return;
  }
  notionSave.disabled = true;
  try {
    await updateNotionToken(token);
    notionTokenInput.value = '';
    showToast('Notion token saved', 'success');
  } finally {
    notionSave.disabled = false;
  }
});

notionClear.addEventListener('click', async () => {
  notionClear.disabled = true;
  try {
    await updateNotionToken(null);
    notionTokenInput.value = '';
    showToast('Notion token cleared', 'info');
  } finally {
    notionClear.disabled = false;
  }
});

notionSync.addEventListener('click', async () => {
  if (!apiBridge?.syncNotionNow) return;
  notionSync.disabled = true;
  notionSync.textContent = 'Syncing...';
  notionSync.classList.add('btn-syncing');
  try {
    await apiBridge.syncNotionNow();
    showToast('Notion sync complete', 'success');
  } catch (error: unknown) {
    logError('syncNotionNow failed', error);
    showToast('Notion sync failed', 'error');
  } finally {
    notionSync.disabled = false;
    notionSync.textContent = 'Sync Notion Pages';
    notionSync.classList.remove('btn-syncing');
  }
});

obsidianAdd.addEventListener('click', async () => {
  if (!apiBridge?.selectObsidianVault) {
    showToast('Obsidian unavailable', 'error');
    return;
  }
  try {
    const result = await apiBridge.selectObsidianVault();
    if (result.canceled || !result.path) return;
    if (!obsidianVaultList.includes(result.path)) {
      obsidianVaultList = [...obsidianVaultList, result.path];
      await saveObsidianConfig();
      showToast('Vault added', 'success');
    }
  } catch (error: unknown) {
    logError('selectObsidianVault failed', error);
    showToast('Failed to add vault', 'error');
  }
});

obsidianSync.addEventListener('click', async () => {
  if (!apiBridge?.syncObsidianNow) return;
  obsidianSync.disabled = true;
  const originalText = obsidianSync.textContent;
  obsidianSync.textContent = 'Syncing...';
  obsidianSync.classList.add('btn-syncing');
  try {
    await apiBridge.syncObsidianNow();
    showToast('Obsidian sync complete', 'success');
  } catch (error: unknown) {
    logError('syncObsidianNow failed', error);
    showToast('Obsidian sync failed', 'error');
  } finally {
    obsidianSync.disabled = false;
    obsidianSync.textContent = originalText;
    obsidianSync.classList.remove('btn-syncing');
  }
});

localAdd.addEventListener('click', async () => {
  if (!apiBridge?.selectLocalFolder) {
    showToast('Local folders unavailable', 'error');
    return;
  }
  try {
    const result = await apiBridge.selectLocalFolder();
    if (result.canceled || !result.path) return;
    if (!localFolderList.includes(result.path)) {
      localFolderList = [...localFolderList, result.path];
      await saveLocalConfig();
      showToast('Folder added', 'success');
    }
  } catch (error: unknown) {
    logError('selectLocalFolder failed', error);
    showToast('Failed to add folder', 'error');
  }
});

localSync.addEventListener('click', async () => {
  if (!apiBridge?.syncLocalNow) return;
  localSync.disabled = true;
  const originalText = localSync.textContent;
  localSync.textContent = 'Syncing...';
  localSync.classList.add('btn-syncing');
  try {
    await apiBridge.syncLocalNow();
    showToast('Local sync complete', 'success');
  } catch (error: unknown) {
    logError('syncLocalNow failed', error);
    showToast('Local sync failed', 'error');
  } finally {
    localSync.disabled = false;
    localSync.textContent = originalText;
    localSync.classList.remove('btn-syncing');
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
    log(`search start len=${query.length} "${formatQueryForLog(query)}"`);
    
    // Start streaming mode - add streaming result to list
    isStreaming = true;
    streamingContent = '';
    addStreamingAiResult();
    previewContent.innerHTML = '<span class="streaming-cursor">▊</span>';
    
    try {
      const aiResults = await apiBridge.search(query);
      log(
        `search done results=${aiResults.length} (${Math.round(performance.now() - startedAt)}ms) "${formatQueryForLog(query)}"`
      );
      isStreaming = false;
      if (requestId !== aiRequestId || searchInput.value.trim() !== query) return;
      applyResults(aiResults, true);
      setSearchStatus();
    } catch (error: unknown) {
      logError('search error', error);
      isStreaming = false;
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
      <div class="result ${index === selectedIndex ? 'selected' : ''}" 
           data-index="${index}"
           role="option"
           aria-selected="${index === selectedIndex}"
           tabindex="${index === selectedIndex ? '0' : '-1'}">
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

  // Update selection styling and ARIA
  resultsList.querySelectorAll('.result').forEach((element, i) => {
    const isSelected = i === selectedIndex;
    element.classList.toggle('selected', isSelected);
    element.setAttribute('aria-selected', String(isSelected));
    element.setAttribute('tabindex', isSelected ? '0' : '-1');
  });

  // Update preview
  const selected = results[selectedIndex];
  previewTitle.textContent = selected.title;

  // Handle streaming AI answer
  if (selected.id === 'ai-streaming') {
    if (streamingContent) {
      previewContent.innerHTML = renderMarkdown(streamingContent) + '<span class="streaming-cursor">▊</span>';
    } else {
      previewContent.innerHTML = '<span class="streaming-cursor">▊</span>';
    }
  } else if (selected.id === 'ai-answer') {
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
