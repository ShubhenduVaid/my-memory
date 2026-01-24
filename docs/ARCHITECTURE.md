# Architecture

This document describes the high-level architecture of My Memory.

## Overview

My Memory is an Electron-based desktop application that provides semantic search across multiple note sources using AI.

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron App                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    IPC     ┌─────────────────────────────┐ │
│  │  Renderer   │◄──────────►│      Main Process           │ │
│  │  (Search UI)│            │                             │ │
│  └─────────────┘            │  ┌───────────────────────┐  │ │
│                             │  │    Search Manager     │  │ │
│                             │  │  (AI-powered search)  │  │ │
│                             │  └───────────┬───────────┘  │ │
│                             │              │              │ │
│                             │  ┌───────────▼───────────┐  │ │
│                             │  │     LLM Service       │  │ │
│                             │  │ (Gemini/OpenRouter/   │  │ │
│                             │  │       Ollama)         │  │ │
│                             │  └───────────────────────┘  │ │
│                             │                             │ │
│                             │  ┌───────────────────────┐  │ │
│                             │  │   Plugin Registry     │  │ │
│                             │  └───────────┬───────────┘  │ │
│                             │              │              │ │
│                             │  ┌───────────▼───────────┐  │ │
│                             │  │   Source Adapters     │  │ │
│                             │  │ ┌─────┐ ┌─────────┐   │  │ │
│                             │  │ │Apple│ │Obsidian │   │  │ │
│                             │  │ │Notes│ │         │   │  │ │
│                             │  │ └─────┘ └─────────┘   │  │ │
│                             │  │ ┌─────┐ ┌──────┐      │  │ │
│                             │  │ │Local│ │Notion│      │  │ │
│                             │  │ │Files│ │      │      │  │ │
│                             │  │ └─────┘ └──────┘      │  │ │
│                             │  └───────────────────────┘  │ │
│                             │                             │ │
│                             │  ┌───────────────────────┐  │ │
│                             │  │   SQLite Cache        │  │ │
│                             │  └───────────────────────┘  │ │
│                             └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── main/               # Electron main process
│   ├── index.ts        # App entry, window/tray management, IPC handlers
│   ├── preload.ts      # Secure bridge between main and renderer
│   ├── user-config.ts  # User preferences persistence
│   └── update-service.ts # Auto-update functionality
├── renderer/           # Frontend UI
│   ├── index.html      # Search window markup
│   ├── styles.css      # UI styling
│   └── renderer.ts     # UI logic and IPC calls
├── core/               # Core business logic
│   ├── types.ts        # Interfaces (Note, ISourceAdapter, ILLMAdapter)
│   ├── cache.ts        # SQLite-based note caching
│   ├── search-manager.ts # AI search orchestration
│   └── llm-service.ts  # LLM provider management
└── adapters/           # Data source integrations
    ├── apple-notes.ts  # macOS Notes.app via AppleScript
    ├── obsidian.ts     # Obsidian vault markdown files
    ├── local-files.ts  # Local markdown/text/PDF files
    ├── notion.ts       # Notion API integration
    └── llm/            # LLM provider adapters
        ├── gemini.ts
        ├── openrouter.ts
        └── ollama.ts
```

## Key Components

### Plugin Registry
Central registry managing source adapters. Allows dynamic registration and lifecycle management of adapters.

### Source Adapters
Implement `ISourceAdapter` interface to fetch notes from different sources:
- `fetchAll()` - Retrieve all notes
- `watch()` - Monitor for changes
- `stop()` - Cleanup resources

### LLM Service
Manages multiple LLM providers (Gemini, OpenRouter, Ollama) for semantic search and AI-powered answers.

### Search Manager
Orchestrates search by:
1. Querying the cache for relevant notes
2. Using LLM to rank and summarize results
3. Generating AI answers from context

### SQLite Cache
Persists indexed notes locally for fast retrieval and offline access.

## Data Flow

1. **Indexing**: Adapters fetch notes → stored in SQLite cache
2. **Search**: User query → Search Manager → LLM ranks results → UI displays
3. **Updates**: Adapters watch for changes → cache updated → UI refreshed
