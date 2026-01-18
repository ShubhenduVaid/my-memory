# My Memory

Intelligent semantic search across your notes using AI.

## Features

- **Spotlight-style UI** - Quick access via `Cmd+Shift+Space`
- **Semantic Search** - Find notes by meaning, not just keywords
- **AI Answers** - Get intelligent summaries from your notes
- **Apple Notes Integration** - Real-time sync with your Notes app
- **Obsidian Integration** - Search across your vaults
- **Local Files Integration** - Search markdown, text, and PDFs from folders
- **Notion Integration** - Search pages shared with your Notion integration
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

## Obsidian Vaults

1. Click **Obsidian** in the search bar.
2. Add one or more vault folders.
3. Use **Sync now** to rescan immediately.

Notes:

- Only markdown files are indexed (`.md`, `.markdown`).
- Files larger than 2 MB are skipped.

## Local Folders

1. Click **Local** in the search bar.
2. Add one or more folders to index.
3. Toggle **Include subfolders** as needed.
4. Use **Sync now** to rescan immediately.

Supported file types: `.md`, `.markdown`, `.txt`, `.pdf`

Notes:

- Text files larger than 2 MB and PDFs larger than 10 MB are skipped.
- File content is truncated to the first ~20k characters to keep search fast.

## Notion

1. Create a Notion integration at https://www.notion.so/my-integrations
2. Copy the **Internal Integration Token**.
3. Share the pages/databases you want indexed with the integration.
4. Click **Notion** in the search bar, paste the token, and **Sync now**.

Notes:

- Only pages/databases explicitly shared with the integration are indexed.
- Database items are indexed when their parent database is shared with the integration.
- Database property values are indexed, even when the page body is empty.
- Content is truncated to the first ~20k characters to keep search fast.

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
    ├── apple-notes.ts
    ├── obsidian.ts
    ├── local-files.ts
    └── notion.ts
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
