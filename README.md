# My Memory

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Intelligent semantic search across your notes using AI.

## Screenshots

<!-- Add screenshots of your app here -->
<!-- ![Search Interface](docs/screenshots/search.png) -->
<!-- ![Settings](docs/screenshots/settings.png) -->

*Screenshots coming soon*

## Features

- **Spotlight-style UI** - Quick access via `Cmd+Shift+Space`
- **Semantic Search** - Find notes by meaning, not just keywords
- **AI Answers** - Get intelligent summaries from your notes
- **Apple Notes Integration** - Real-time sync with your Notes app
- **Obsidian Integration** - Search across your vaults
- **Local Files Integration** - Search markdown, text, and PDFs from folders
- **Notion Integration** - Search pages shared with your Notion integration
- **Menu Bar App** - Lives in your menu bar, always accessible
- **Plugin Architecture** - Extensible for future integrations

## Requirements

- macOS, Windows, or Linux (Apple Notes integration is macOS-only)
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

## Integrations

### Obsidian Vaults

1. Click **Obsidian** in the search bar
2. Add one or more vault folders
3. Use **Sync now** to rescan immediately

Notes:
- Only markdown files are indexed (`.md`, `.markdown`)
- Files larger than 2 MB are skipped

### Local Folders

1. Click **Local** in the search bar
2. Add one or more folders to index
3. Toggle **Include subfolders** as needed
4. Use **Sync now** to rescan immediately

Supported file types: `.md`, `.markdown`, `.txt`, `.pdf`

Notes:
- Text files larger than 2 MB and PDFs larger than 10 MB are skipped
- File content is truncated to the first ~20k characters to keep search fast

### Notion

1. Create a Notion integration at https://www.notion.so/my-integrations
2. Copy the **Internal Integration Token**
3. Share the pages/databases you want indexed with the integration
4. Click **Notion** in the search bar, paste the token, and **Sync now**

Notes:
- Only pages/databases explicitly shared with the integration are indexed
- Database items are indexed when their parent database is shared
- Database property values are indexed, even when the page body is empty
- Content is truncated to the first ~20k characters to keep search fast

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

Creates installers in the `release/` folder for your current platform.

## Release & Auto Updates

Auto updates use GitHub Releases and run in packaged builds only. Use the tray menu to check manually.

Required environment variables for publishing:
- `GITHUB_OWNER`, `GITHUB_REPO`
- `GH_TOKEN` (or `GITHUB_TOKEN`)

Code signing:
- macOS: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`
- Windows: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`

Optional:
- `UPDATE_CHANNEL` (`stable`, `beta`, `alpha`)
- `AUTO_UPDATES=false` to disable update checks

Publish a release locally:

```bash
npm run release
```

Or use the GitHub Actions workflow in `.github/workflows/release.yml`.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a PR.

## License

[MIT](LICENSE)
