# My Memory

Intelligent semantic search across your notes using AI.

## Features

- **Spotlight-style UI** - Quick access via `Cmd+Shift+Space`
- **Semantic Search** - Find notes by meaning, not just keywords
- **AI Answers** - Get intelligent summaries from your notes
- **Apple Notes Integration** - Real-time sync with your Notes app
- **Menu Bar App** - Lives in your menu bar, always accessible
- **Plugin Architecture** - Extensible for future integrations (Notion, Teams, etc.)

## Requirements

- macOS
- Node.js 18+
- Gemini API key (free at https://makersuite.google.com/app/apikey)

## Installation

```bash
npm install
```

Create `.env` file with your Gemini API key:
```
GEMINI_API_KEY=your_key_here
```

## Usage

```bash
npm run start
```

1. Press `Cmd+Shift+Space` to open search
2. Type your query (AI-powered semantic search)
3. Use arrow keys to navigate, Enter to open note
4. Click outside or press Escape to close

## Architecture

```
src/
├── main/           # Electron main process
├── renderer/       # Search UI
├── core/           # Core services
│   ├── types.ts    # Plugin interface & data models
│   ├── cache.ts    # SQLite cache
│   └── search-manager.ts # AI search with Gemini
└── adapters/       # Source adapters
    └── apple-notes.ts
```

## Adding New Integrations

Implement `ISourceAdapter`:

```typescript
interface ISourceAdapter {
  readonly name: string;
  initialize(): Promise<void>;
  fetchAll(): Promise<Note[]>;
  watch(callback: WatchCallback): void;
  stop(): void;
}
```

## Building for Distribution

```bash
npm run dist
```

Creates a DMG in the `dist/` folder.
