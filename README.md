<p align="center">
  <img src="docs/assets/hero.png" alt="My Memory - Search your notes by meaning" width="800">
</p>

<h1 align="center">My Memory</h1>

<p align="center">
  <strong>Search your notes by meaning, not keywords.</strong>
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
</p>

<p align="center">
  <img src="docs/assets/demo.gif" alt="My Memory Demo" width="600">
</p>

## Install

```bash
git clone https://github.com/ShubhenduVaid/my-memory && cd my-memory && npm install && npm start
```

## Why My Memory?

Your notes are scattered. Apple Notes for quick thoughts. Obsidian for deep work. Notion for team stuff. Local files everywhere.

Traditional search fails because you can't remember the exact words you used six months ago.

My Memory fixes this. It understands what you mean, not just what you type. One hotkey (`Cmd+Shift+Space`) searches everything at once.

## Comparison

| Feature | My Memory | Raycast | Alfred | Notion AI |
|---------|-----------|---------|--------|-----------|
| Semantic search | ✅ | ❌ | ❌ | ✅ |
| Apple Notes | ✅ | ❌ | ❌ | ❌ |
| Obsidian | ✅ | ❌ | ❌ | ❌ |
| Notion | ✅ | ❌ | ❌ | ✅ |
| Local files | ✅ | ❌ | ✅ | ❌ |
| Local-first | ✅ | ✅ | ✅ | ❌ |
| Cross-platform | ✅ | ❌ | ❌ | ✅ |

## Features

- **Spotlight-style UI** - `Cmd+Shift+Space` opens search instantly
- **Semantic Search** - Find notes by meaning, not keywords
- **AI Answers** - Get summaries from your notes
- **Multi-source** - Apple Notes, Obsidian, Notion, local files
- **Privacy-first** - All data stays local

## Requirements

- macOS, Windows, or Linux (Apple Notes is macOS-only)
- Node.js 18+
- Gemini API key (free at https://makersuite.google.com/app/apikey)

## Setup

Create `.env` with your API key:

```
GEMINI_API_KEY=your_key_here
```

## Usage

1. Press `Cmd+Shift+Space` to open
2. Type your query
3. Arrow keys to navigate, Enter to open
4. Escape to close

## Integrations

**Obsidian** - Click Obsidian in search bar, add vault folders, Sync now

**Local Files** - Click Local, add folders, toggle subfolders, Sync now

**Notion** - Create integration at notion.so/my-integrations, share pages, paste token

## Contributing

PRs welcome! See [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
