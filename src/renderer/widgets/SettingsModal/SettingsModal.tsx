import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ProviderInfo } from '../../shared/api';
import './SettingsModal.css';

type TabId = 'ai' | 'apple-notes' | 'obsidian' | 'local' | 'notion';

type ActionResult = { ok: boolean; error?: string };

function GearIcon(props: { title?: string }) {
  return (
    <svg
      className="settings-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={props.title ? undefined : true}
      role={props.title ? 'img' : undefined}
    >
      {props.title ? <title>{props.title}</title> : null}
      <path
        d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.24 12.43c.03-.28.05-.57.05-.86 0-.29-.02-.58-.05-.86l2.02-1.57a.5.5 0 0 0 .12-.64l-1.9-3.29a.5.5 0 0 0-.6-.22l-2.38.96a7.52 7.52 0 0 0-1.49-.86l-.36-2.54a.5.5 0 0 0-.5-.43h-3.8a.5.5 0 0 0-.5.43l-.36 2.54c-.53.22-1.03.5-1.49.86l-2.38-.96a.5.5 0 0 0-.6.22l-1.9 3.29a.5.5 0 0 0 .12.64l2.02 1.57c-.03.28-.05.57-.05.86 0 .29.02.58.05.86l-2.02 1.57a.5.5 0 0 0-.12.64l1.9 3.29c.13.22.4.31.6.22l2.38-.96c.46.36.96.64 1.49.86l.36 2.54c.04.24.25.43.5.43h3.8c.25 0 .46-.18.5-.43l.36-2.54c.53-.22 1.03-.5 1.49-.86l2.38.96c.2.08.47 0 .6-.22l1.9-3.29a.5.5 0 0 0-.12-.64l-2.02-1.57Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    try {
      const ua = navigator.userAgent || '';
      const platform = (navigator as any).platform || '';
      setIsMac(/Macintosh|MacIntel|Mac/.test(ua) || /Mac/.test(platform));
    } catch {
      setIsMac(false);
    }
  }, []);
  return isMac;
}

function getActionError(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as any;
  return typeof r.error === 'string' ? r.error : undefined;
}

function firstFocusable(container: HTMLElement): HTMLElement | null {
  const el = container.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  return el || null;
}

export const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const isMac = useIsMac();

  const [activeTab, setActiveTab] = useState<TabId>('ai');

  // LLM
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'openrouter' | 'ollama'>('gemini');
  const [providerInfos, setProviderInfos] = useState<ProviderInfo[]>([]);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasOpenrouterKey, setHasOpenrouterKey] = useState(false);
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('');
  const [openrouterKeyDraft, setOpenrouterKeyDraft] = useState('');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaCurrentModel, setOllamaCurrentModel] = useState('');
  const [llmBusy, setLlmBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState<string>('');
  const [aiStatusState, setAiStatusState] = useState<'unset' | 'set' | 'error'>('unset');

  // Obsidian
  const [obsidianVaults, setObsidianVaults] = useState<string[]>([]);
  const [obsidianBusy, setObsidianBusy] = useState(false);
  const [obsidianStatus, setObsidianStatus] = useState<string>('');
  const [obsidianStatusState, setObsidianStatusState] = useState<'unset' | 'set' | 'error'>('unset');

  // Local
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const [localRecursive, setLocalRecursive] = useState(true);
  const [localBusy, setLocalBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState<string>('');
  const [localStatusState, setLocalStatusState] = useState<'unset' | 'set' | 'error'>('unset');

  // Notion
  const [notionHasToken, setNotionHasToken] = useState(false);
  const [notionBusy, setNotionBusy] = useState(false);
  const [notionTokenDraft, setNotionTokenDraft] = useState('');
  const [notionStatus, setNotionStatus] = useState<string>('');
  const [notionStatusState, setNotionStatusState] = useState<'unset' | 'set' | 'error'>('unset');

  // Modal focus management
  const containerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const currentProviderInfo = useMemo(
    () => providerInfos.find((p) => p.name === llmProvider),
    [providerInfos, llmProvider]
  );

  const aiConnected = useMemo(() => {
    const provider = currentProviderInfo;
    if (!provider) {
      if (llmProvider === 'ollama') return false;
      if (llmProvider === 'gemini') return hasGeminiKey;
      return hasOpenrouterKey;
    }

    if (provider.error) return false;
    if (llmProvider === 'ollama') return provider.available;
    if (llmProvider === 'gemini') return hasGeminiKey;
    return hasOpenrouterKey;
  }, [currentProviderInfo, hasGeminiKey, hasOpenrouterKey, llmProvider]);

  const appleNotesConnected = useMemo(() => isMac, [isMac]);
  const obsidianConnected = useMemo(() => obsidianVaults.length > 0, [obsidianVaults.length]);
  const localConnected = useMemo(() => localFolders.length > 0, [localFolders.length]);
  const notionConnected = useMemo(() => notionHasToken, [notionHasToken]);

  const refreshLlmConfig = useCallback(async () => {
    if (!api?.getLlmConfig) return;
    try {
      const cfg = await api.getLlmConfig();
      const provider = (cfg.provider || 'gemini') as any;
      setLlmProvider(provider);
      setHasGeminiKey(Boolean(cfg.hasGeminiKey));
      setHasOpenrouterKey(Boolean(cfg.hasOpenrouterKey));
      setProviderInfos(Array.isArray(cfg.providers) ? cfg.providers : []);

      // Status text
      const pInfo = (Array.isArray(cfg.providers) ? cfg.providers : []).find((p: ProviderInfo) => p.name === provider);
      if (pInfo?.error) {
        setAiStatus(pInfo.error);
        setAiStatusState('error');
      } else if (provider === 'ollama') {
        setAiStatus(pInfo?.available ? 'Ollama connected' : 'Ollama not ready');
        setAiStatusState(pInfo?.available ? 'set' : 'unset');
      } else if (provider === 'gemini') {
        setAiStatus(cfg.hasGeminiKey ? 'Gemini key saved' : 'Gemini key not set');
        setAiStatusState(cfg.hasGeminiKey ? 'set' : 'unset');
      } else {
        setAiStatus(cfg.hasOpenrouterKey ? 'OpenRouter key saved' : 'OpenRouter key not set');
        setAiStatusState(cfg.hasOpenrouterKey ? 'set' : 'unset');
      }
    } catch {
      setAiStatus('LLM config unavailable');
      setAiStatusState('error');
    }
  }, []);

  const refreshOllamaModels = useCallback(async () => {
    if (!api?.getOllamaModels) return;
    try {
      const res = await api.getOllamaModels();
      setOllamaModels(Array.isArray(res.models) ? res.models : []);
      setOllamaCurrentModel(res.current || '');
    } catch {
      setOllamaModels([]);
      setOllamaCurrentModel('');
    }
  }, []);

  const refreshObsidianConfig = useCallback(async () => {
    if (!api?.getObsidianConfig) return;
    try {
      const cfg = await api.getObsidianConfig();
      const vaults = Array.isArray(cfg.vaults) ? (cfg.vaults as string[]) : [];
      setObsidianVaults(vaults);
      if (vaults.length > 0) {
        setObsidianStatus(`${vaults.length} vault(s) configured`);
        setObsidianStatusState('set');
      } else {
        setObsidianStatus('No vaults configured');
        setObsidianStatusState('unset');
      }
    } catch {
      setObsidianVaults([]);
      setObsidianStatus('Obsidian unavailable');
      setObsidianStatusState('error');
    }
  }, []);

  const refreshLocalConfig = useCallback(async () => {
    if (!api?.getLocalConfig) return;
    try {
      const cfg = await api.getLocalConfig();
      const folders = Array.isArray(cfg.folders) ? (cfg.folders as string[]) : [];
      const recursive = cfg.recursive ?? true;
      setLocalFolders(folders);
      setLocalRecursive(Boolean(recursive));

      if (folders.length > 0) {
        setLocalStatus(`${folders.length} folder(s) configured`);
        setLocalStatusState('set');
      } else {
        setLocalStatus('No folders configured');
        setLocalStatusState('unset');
      }
    } catch {
      setLocalFolders([]);
      setLocalRecursive(true);
      setLocalStatus('Local files unavailable');
      setLocalStatusState('error');
    }
  }, []);

  const refreshNotionConfig = useCallback(async () => {
    if (!api?.getNotionConfig) return;
    try {
      const cfg = await api.getNotionConfig();
      const hasToken = Boolean(cfg.hasToken);
      setNotionHasToken(hasToken);
      setNotionStatus(hasToken ? 'Notion token saved' : 'Notion token not set');
      setNotionStatusState(hasToken ? 'set' : 'unset');
    } catch {
      setNotionHasToken(false);
      setNotionStatus('Notion unavailable');
      setNotionStatusState('error');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshLlmConfig(), refreshObsidianConfig(), refreshLocalConfig(), refreshNotionConfig()]);
  }, [refreshLlmConfig, refreshLocalConfig, refreshNotionConfig, refreshObsidianConfig]);

  useEffect(() => {
    if (!isOpen) return;
    void refreshAll();
  }, [isOpen, refreshAll]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab !== 'ai') return;
    if (llmProvider !== 'ollama') return;
    void refreshOllamaModels();
  }, [activeTab, isOpen, llmProvider, refreshOllamaModels]);

  // Focus trap + ESC
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = (document.activeElement as HTMLElement) || null;

    // Wait for the modal to mount, then focus close.
    const t = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusables = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first) {
          e.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);

      // Restore focus
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    // Keep focus inside modal if something else steals it.
    const onFocusIn = (e: FocusEvent) => {
      const container = containerRef.current;
      if (!container) return;
      if (container.contains(e.target as Node)) return;

      const next = closeBtnRef.current || firstFocusable(container);
      next?.focus();
    };

    window.addEventListener('focusin', onFocusIn);
    return () => window.removeEventListener('focusin', onFocusIn);
  }, [isOpen]);

  const setProvider = useCallback(
    async (provider: 'gemini' | 'openrouter' | 'ollama') => {
      if (!api?.setLlmProvider) return;
      setLlmBusy(true);
      try {
        const res = (await api.setLlmProvider(provider)) as any;
        if (!res?.ok) {
          setAiStatus(getActionError(res) || 'Failed to update provider');
          setAiStatusState('error');
          return;
        }
        await refreshLlmConfig();
        if (provider === 'ollama') await refreshOllamaModels();
      } finally {
        setLlmBusy(false);
      }
    },
    [refreshLlmConfig, refreshOllamaModels]
  );

  const saveGeminiKey = useCallback(async () => {
    if (!api?.setGeminiKey) return;
    const key = geminiKeyDraft.trim();
    if (!key) return;
    setLlmBusy(true);
    try {
      const res = (await api.setGeminiKey(key)) as unknown as ActionResult;
      if (!res.ok) {
        setAiStatus(getActionError(res) || 'Failed to save key');
        setAiStatusState('error');
        return;
      }
      setGeminiKeyDraft('');
      await refreshLlmConfig();
    } finally {
      setLlmBusy(false);
    }
  }, [geminiKeyDraft, refreshLlmConfig]);

  const clearGeminiKey = useCallback(async () => {
    if (!api?.setGeminiKey) return;
    setLlmBusy(true);
    try {
      const res = (await api.setGeminiKey(null)) as unknown as ActionResult;
      if (!res.ok) {
        setAiStatus(getActionError(res) || 'Failed to clear key');
        setAiStatusState('error');
        return;
      }
      await refreshLlmConfig();
    } finally {
      setLlmBusy(false);
    }
  }, [refreshLlmConfig]);

  const saveOpenrouterKey = useCallback(async () => {
    if (!api?.setOpenrouterKey) return;
    const key = openrouterKeyDraft.trim();
    if (!key) return;
    setLlmBusy(true);
    try {
      const res = (await api.setOpenrouterKey(key)) as unknown as ActionResult;
      if (!res.ok) {
        setAiStatus(getActionError(res) || 'Failed to save key');
        setAiStatusState('error');
        return;
      }
      setOpenrouterKeyDraft('');
      await refreshLlmConfig();
    } finally {
      setLlmBusy(false);
    }
  }, [openrouterKeyDraft, refreshLlmConfig]);

  const clearOpenrouterKey = useCallback(async () => {
    if (!api?.setOpenrouterKey) return;
    setLlmBusy(true);
    try {
      const res = (await api.setOpenrouterKey(null)) as unknown as ActionResult;
      if (!res.ok) {
        setAiStatus(getActionError(res) || 'Failed to clear key');
        setAiStatusState('error');
        return;
      }
      await refreshLlmConfig();
    } finally {
      setLlmBusy(false);
    }
  }, [refreshLlmConfig]);

  const setOllamaModel = useCallback(async (model: string) => {
    if (!api?.setOllamaModel) return;
    setLlmBusy(true);
    try {
      const res = (await api.setOllamaModel(model)) as any;
      if (!res?.ok) {
        setAiStatus('Failed to set model');
        setAiStatusState('error');
        return;
      }
      setOllamaCurrentModel(res.model || model);
      setAiStatus('Ollama model updated');
      setAiStatusState('set');
    } finally {
      setLlmBusy(false);
    }
  }, []);

  const addObsidianVault = useCallback(async () => {
    if (!api?.selectObsidianVault || !api?.setObsidianConfig) return;
    setObsidianBusy(true);
    try {
      const pick = await api.selectObsidianVault();
      if (pick.canceled || !pick.path) return;
      const next = Array.from(new Set([...obsidianVaults, pick.path]));
      const res = (await api.setObsidianConfig({ vaults: next })) as any;
      if (!res?.ok) {
        setObsidianStatus('Failed to update vaults');
        setObsidianStatusState('error');
        return;
      }
      setObsidianVaults(Array.isArray(res.vaults) ? res.vaults : next);
      const count = Array.isArray(res.vaults) ? res.vaults.length : next.length;
      setObsidianStatus(`${count} vault(s) configured`);
      setObsidianStatusState(count > 0 ? 'set' : 'unset');
    } finally {
      setObsidianBusy(false);
    }
  }, [obsidianVaults]);

  const removeObsidianVault = useCallback(async (path: string) => {
    if (!api?.setObsidianConfig) return;
    setObsidianBusy(true);
    try {
      const next = obsidianVaults.filter((v) => v !== path);
      const res = (await api.setObsidianConfig({ vaults: next })) as any;
      if (!res?.ok) {
        setObsidianStatus('Failed to update vaults');
        setObsidianStatusState('error');
        return;
      }
      const vaults = Array.isArray(res.vaults) ? res.vaults : next;
      setObsidianVaults(vaults);
      setObsidianStatus(vaults.length > 0 ? `${vaults.length} vault(s) configured` : 'No vaults configured');
      setObsidianStatusState(vaults.length > 0 ? 'set' : 'unset');
    } finally {
      setObsidianBusy(false);
    }
  }, [obsidianVaults]);

  const syncObsidian = useCallback(async () => {
    if (!api?.syncObsidianNow) return;
    setObsidianBusy(true);
    try {
      await api.syncObsidianNow();
      setObsidianStatus('Sync complete');
      setObsidianStatusState(obsidianVaults.length > 0 ? 'set' : 'unset');
    } catch {
      setObsidianStatus('Sync failed');
      setObsidianStatusState('error');
    } finally {
      setObsidianBusy(false);
    }
  }, [obsidianVaults.length]);

  const addLocalFolder = useCallback(async () => {
    if (!api?.selectLocalFolder || !api?.setLocalConfig) return;
    setLocalBusy(true);
    try {
      const pick = await api.selectLocalFolder();
      if (pick.canceled || !pick.path) return;
      const next = Array.from(new Set([...localFolders, pick.path]));
      const res = (await api.setLocalConfig({ folders: next, recursive: localRecursive })) as any;
      if (!res?.ok) {
        setLocalStatus('Failed to update folders');
        setLocalStatusState('error');
        return;
      }
      const folders = Array.isArray(res.folders) ? res.folders : next;
      setLocalFolders(folders);
      setLocalRecursive(Boolean(res.recursive ?? localRecursive));
      setLocalStatus(folders.length > 0 ? `${folders.length} folder(s) configured` : 'No folders configured');
      setLocalStatusState(folders.length > 0 ? 'set' : 'unset');
    } finally {
      setLocalBusy(false);
    }
  }, [localFolders, localRecursive]);

  const removeLocalFolder = useCallback(async (path: string) => {
    if (!api?.setLocalConfig) return;
    setLocalBusy(true);
    try {
      const next = localFolders.filter((f) => f !== path);
      const res = (await api.setLocalConfig({ folders: next, recursive: localRecursive })) as any;
      if (!res?.ok) {
        setLocalStatus('Failed to update folders');
        setLocalStatusState('error');
        return;
      }
      const folders = Array.isArray(res.folders) ? res.folders : next;
      setLocalFolders(folders);
      setLocalRecursive(Boolean(res.recursive ?? localRecursive));
      setLocalStatus(folders.length > 0 ? `${folders.length} folder(s) configured` : 'No folders configured');
      setLocalStatusState(folders.length > 0 ? 'set' : 'unset');
    } finally {
      setLocalBusy(false);
    }
  }, [localFolders, localRecursive]);

  const toggleLocalRecursive = useCallback(async (nextRecursive: boolean) => {
    if (!api?.setLocalConfig) {
      setLocalRecursive(nextRecursive);
      return;
    }
    setLocalBusy(true);
    try {
      const res = (await api.setLocalConfig({ folders: localFolders, recursive: nextRecursive })) as any;
      if (!res?.ok) {
        setLocalStatus('Failed to update setting');
        setLocalStatusState('error');
        return;
      }
      setLocalRecursive(Boolean(res.recursive ?? nextRecursive));
      setLocalStatus(localFolders.length > 0 ? `${localFolders.length} folder(s) configured` : 'No folders configured');
      setLocalStatusState(localFolders.length > 0 ? 'set' : 'unset');
    } finally {
      setLocalBusy(false);
    }
  }, [localFolders]);

  const syncLocal = useCallback(async () => {
    if (!api?.syncLocalNow) return;
    setLocalBusy(true);
    try {
      await api.syncLocalNow();
      setLocalStatus('Sync complete');
      setLocalStatusState(localFolders.length > 0 ? 'set' : 'unset');
    } catch {
      setLocalStatus('Sync failed');
      setLocalStatusState('error');
    } finally {
      setLocalBusy(false);
    }
  }, [localFolders.length]);

  const saveNotionToken = useCallback(async () => {
    if (!api?.setNotionToken) return;
    const token = notionTokenDraft.trim();
    if (!token) return;
    setNotionBusy(true);
    try {
      const res = (await api.setNotionToken(token)) as any;
      if (!res?.ok) {
        setNotionStatus(getActionError(res) || 'Failed to save token');
        setNotionStatusState('error');
        return;
      }
      setNotionTokenDraft('');
      setNotionHasToken(Boolean(res.hasToken));
      setNotionStatus('Notion token saved');
      setNotionStatusState('set');
    } finally {
      setNotionBusy(false);
    }
  }, [notionTokenDraft]);

  const clearNotionToken = useCallback(async () => {
    if (!api?.setNotionToken) return;
    setNotionBusy(true);
    try {
      const res = (await api.setNotionToken(null)) as any;
      if (!res?.ok) {
        setNotionStatus(getActionError(res) || 'Failed to clear token');
        setNotionStatusState('error');
        return;
      }
      setNotionHasToken(Boolean(res.hasToken));
      setNotionStatus('Notion token cleared');
      setNotionStatusState('unset');
    } finally {
      setNotionBusy(false);
    }
  }, []);

  const syncNotion = useCallback(async () => {
    if (!api?.syncNotionNow) return;
    setNotionBusy(true);
    try {
      await api.syncNotionNow();
      setNotionStatus('Sync complete');
      setNotionStatusState(notionHasToken ? 'set' : 'unset');
    } catch {
      setNotionStatus('Sync failed');
      setNotionStatusState('error');
    } finally {
      setNotionBusy(false);
    }
  }, [notionHasToken]);

  const tabs = useMemo(
    () =>
      [
        { id: 'ai' as const, label: 'AI / LLM', connected: aiConnected },
        { id: 'apple-notes' as const, label: 'Apple Notes', connected: appleNotesConnected },
        { id: 'obsidian' as const, label: 'Obsidian', connected: obsidianConnected },
        { id: 'local' as const, label: 'Local Files', connected: localConnected },
        { id: 'notion' as const, label: 'Notion', connected: notionConnected },
      ],
    [aiConnected, appleNotesConnected, localConnected, notionConnected, obsidianConnected]
  );

  if (!isOpen) return null;

  return (
    <div className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content" ref={containerRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="settings-title">Settings</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="modal-close"
            aria-label="Close settings"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="modal-tabs" role="tablist" aria-label="Settings sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${activeTab === t.id ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === t.id}
              aria-controls={`settings-panel-${t.id}`}
              id={`settings-tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
            >
              <span className="tab-label">{t.label}</span>
              <span className={`tab-status ${t.connected ? 'connected' : ''}`} aria-hidden="true" />
              <span className="sr-only">{t.connected ? 'connected' : 'not connected'}</span>
            </button>
          ))}
        </div>

        <div className="modal-body">
          <div
            className={`tab-content ${activeTab === 'ai' ? 'active' : ''}`}
            role="tabpanel"
            id="settings-panel-ai"
            aria-labelledby="settings-tab-ai"
          >
            <div className="setting-group">
              <label htmlFor="llm-provider">Provider</label>
              <select
                id="llm-provider"
                value={llmProvider}
                disabled={llmBusy}
                onChange={(e) => setProvider(e.target.value as any)}
              >
                <option value="gemini">Gemini</option>
                <option value="openrouter">OpenRouter</option>
                <option value="ollama">Ollama (local)</option>
              </select>
            </div>

            {llmProvider === 'gemini' && (
              <div className="setting-group">
                <div className="setting-header">
                  <label htmlFor="gemini-api-key">Gemini API Key</label>
                  <span>{hasGeminiKey ? 'Saved' : 'Not set'}</span>
                </div>
                <div className="input-row">
                  <input
                    id="gemini-api-key"
                    type="password"
                    placeholder="Paste Gemini API key"
                    value={geminiKeyDraft}
                    onChange={(e) => setGeminiKeyDraft(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={llmBusy}
                  />
                  <div className="btn-group">
                    <button type="button" onClick={saveGeminiKey} disabled={llmBusy || !geminiKeyDraft.trim()}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={clearGeminiKey}
                      disabled={llmBusy || !hasGeminiKey}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {llmProvider === 'openrouter' && (
              <div className="setting-group">
                <div className="setting-header">
                  <label htmlFor="openrouter-api-key">OpenRouter API Key</label>
                  <span>{hasOpenrouterKey ? 'Saved' : 'Not set'}</span>
                </div>
                <div className="input-row">
                  <input
                    id="openrouter-api-key"
                    type="password"
                    placeholder="Paste OpenRouter API key"
                    value={openrouterKeyDraft}
                    onChange={(e) => setOpenrouterKeyDraft(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={llmBusy}
                  />
                  <div className="btn-group">
                    <button type="button" onClick={saveOpenrouterKey} disabled={llmBusy || !openrouterKeyDraft.trim()}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={clearOpenrouterKey}
                      disabled={llmBusy || !hasOpenrouterKey}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {llmProvider === 'ollama' && (
              <div className="setting-group">
                <div className="setting-header">
                  <label htmlFor="ollama-model">Ollama Model</label>
                  <span>{ollamaCurrentModel ? `Current: ${ollamaCurrentModel}` : ''}</span>
                </div>
                <div className="input-row">
                  <select
                    id="ollama-model"
                    value={ollamaCurrentModel}
                    disabled={llmBusy || ollamaModels.length === 0}
                    onChange={(e) => setOllamaModel(e.target.value)}
                  >
                    {ollamaModels.length === 0 ? (
                      <option value="" disabled>
                        {currentProviderInfo?.error || 'No models found (run: ollama pull llama3.2)'}
                      </option>
                    ) : (
                      ollamaModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => refreshOllamaModels()}
                    disabled={llmBusy}
                  >
                    Refresh
                  </button>
                </div>
                <div className="status-text" data-state={aiStatusState}>
                  {currentProviderInfo?.error
                    ? currentProviderInfo.error
                    : 'Ollama must run locally on http://localhost:11434'}
                </div>
              </div>
            )}

            {llmProvider !== 'ollama' && (
              <div className="status-text" data-state={aiStatusState}>
                {aiStatus}
              </div>
            )}
          </div>

          <div
            className={`tab-content ${activeTab === 'apple-notes' ? 'active' : ''}`}
            role="tabpanel"
            id="settings-panel-apple-notes"
            aria-labelledby="settings-tab-apple-notes"
          >
            <div className="setting-group">
              <div className="status-text" data-state={appleNotesConnected ? 'set' : 'unset'}>
                {isMac
                  ? 'Apple Notes is zero-config. On first run, macOS may ask for permission to access Notes. For live updates, grant Full Disk Access.'
                  : 'Apple Notes is available on macOS only.'}
              </div>
            </div>
          </div>

          <div
            className={`tab-content ${activeTab === 'obsidian' ? 'active' : ''}`}
            role="tabpanel"
            id="settings-panel-obsidian"
            aria-labelledby="settings-tab-obsidian"
          >
            <div className="setting-group">
              <div className="setting-header">
                <label>Vaults</label>
                <div className="btn-group">
                  <button type="button" onClick={addObsidianVault} disabled={obsidianBusy}>
                    Add Vault
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={syncObsidian}
                    disabled={obsidianBusy || obsidianVaults.length === 0}
                  >
                    Sync
                  </button>
                </div>
              </div>

              <div className="item-list" aria-label="Configured Obsidian vaults">
                {obsidianVaults.map((v) => (
                  <div className="item-row" key={v}>
                    <div className="item-path" title={v}>
                      {v}
                    </div>
                    <button
                      type="button"
                      className="btn-secondary item-remove"
                      onClick={() => removeObsidianVault(v)}
                      disabled={obsidianBusy}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {obsidianVaults.length === 0 && (
                <div className="empty-hint">Add your Obsidian vault folder(s) to index markdown notes.</div>
              )}

              <div className="status-text" data-state={obsidianStatusState}>
                {obsidianStatus}
              </div>
            </div>
          </div>

          <div
            className={`tab-content ${activeTab === 'local' ? 'active' : ''}`}
            role="tabpanel"
            id="settings-panel-local"
            aria-labelledby="settings-tab-local"
          >
            <div className="setting-group">
              <div className="setting-header">
                <label>Folders</label>
                <div className="btn-group">
                  <button type="button" onClick={addLocalFolder} disabled={localBusy}>
                    Add Folder
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={syncLocal}
                    disabled={localBusy || localFolders.length === 0}
                  >
                    Sync
                  </button>
                </div>
              </div>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={localRecursive}
                  onChange={(e) => toggleLocalRecursive(e.target.checked)}
                  disabled={localBusy}
                />
                Index subfolders (recursive)
              </label>

              <div className="item-list" aria-label="Configured local folders">
                {localFolders.map((f) => (
                  <div className="item-row" key={f}>
                    <div className="item-path" title={f}>
                      {f}
                    </div>
                    <button
                      type="button"
                      className="btn-secondary item-remove"
                      onClick={() => removeLocalFolder(f)}
                      disabled={localBusy}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {localFolders.length === 0 && (
                <div className="empty-hint">Add folder(s) to index .md/.txt and PDFs (up to 10MB per PDF).</div>
              )}

              <div className="status-text" data-state={localStatusState}>
                {localStatus}
              </div>
            </div>
          </div>

          <div
            className={`tab-content ${activeTab === 'notion' ? 'active' : ''}`}
            role="tabpanel"
            id="settings-panel-notion"
            aria-labelledby="settings-tab-notion"
          >
            <div className="setting-group">
              <div className="setting-header">
                <label htmlFor="notion-token">Integration Token</label>
                <span>{notionHasToken ? 'Saved' : 'Not set'}</span>
              </div>

              <div className="input-row">
                <input
                  id="notion-token"
                  type="password"
                  placeholder="Paste Notion integration token"
                  value={notionTokenDraft}
                  onChange={(e) => setNotionTokenDraft(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={notionBusy}
                />
                <div className="btn-group">
                  <button type="button" onClick={saveNotionToken} disabled={notionBusy || !notionTokenDraft.trim()}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={clearNotionToken}
                    disabled={notionBusy || !notionHasToken}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary btn-full"
                onClick={syncNotion}
                disabled={notionBusy || !notionHasToken}
                style={{ marginTop: 10 }}
              >
                Sync Notion
              </button>

              {!notionHasToken && (
                <div className="empty-hint">
                  Create a Notion internal integration and share pages with it, then paste the token here.
                </div>
              )}

              <div className="status-text" data-state={notionStatusState}>
                {notionStatus}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function SettingsButton(props: { onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      id="settings-toggle"
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.title || 'Settings'}
      title={props.title || 'Settings'}
    >
      <GearIcon />
    </button>
  );
}
