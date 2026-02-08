<p align="center">
  <img src="docs/assets/hero.png" alt="My Memory - Search your notes by meaning" width="800">
</p>

<h1 align="center">My Memory</h1>

<p align="center">
  <strong>Search your notes by meaning, not keywords.</strong><br/>
  One hotkey to search across Apple Notes, Obsidian, Notion, and local files.
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
</p>

<p align="center">
  <img src="docs/assets/demo.gif" alt="My Memory Demo" width="600">
</p>

## Download

- **Recommended (fastest):** Download a build from **GitHub Releases**: https://github.com/ShubhenduVaid/my-memory/releases
- **From source (dev mode):** see [Quick start](#quick-start)

> Note: if you don't see releases yet, they're coming soon. Until then, use the source install below.

## Quick start

### Requirements

- macOS, Windows, or Linux (Apple Notes integration is **macOS-only**)
- Node.js 18+
- One LLM option:
  - **Gemini** (default) API key, or
  - **OpenRouter** API key, or
  - **Ollama** installed locally (for a local/offline-ish setup)

### Install & run (source)

```bash
git clone https://github.com/ShubhenduVaid/my-memory
cd my-memory
npm install
npm start
```

### Configure

Create a `.env` file (see `.env.example`). Minimal setup (Gemini):

```bash
GEMINI_API_KEY=your_key_here
```

## Why My Memory?

Your notes are scattered. Apple Notes for quick thoughts. Obsidian for deep work. Notion for team stuff. Local files everywhere.

Traditional search fails because you can’t remember the exact words you used six months ago.

My Memory fixes this. It understands what you mean, not just what you type. One hotkey (`Cmd+Shift+Space`) searches everything at once.

## Privacy & data flow (important)

My Memory is **local-first**:

- Your notes are indexed and cached **locally**.
- Your API keys are stored **locally**.

LLM usage depends on your provider:

- If you choose **Gemini** or **OpenRouter**, parts of your query and selected snippets may be sent to that provider to rank results and/or generate an answer.
- If you choose **Ollama**, requests can stay on your machine (local model), which is the best option for privacy.

See [SECURITY.md](SECURITY.md) for the full security/privacy notes.

## Supported sources & limitations

| Source | Supported | Notes |
|---|---:|---|
| Apple Notes | ✅ | macOS only; may require Notes permissions |
| Obsidian | ✅ | Select vault folders; Markdown-focused |
| Notion | ✅ | Requires a Notion integration + shared pages |
| Local files | ✅ | Add folders; supports subfolders |

## Usage

1. Press `Cmd+Shift+Space` to open
2. Type your query
3. Arrow keys to navigate, Enter to open
4. Escape to close

## Integrations (quick)

- **Obsidian**: Click Obsidian in the search bar → add vault folders → **Sync now**
- **Local Files**: Click Local → add folders → toggle subfolders → **Sync now**
- **Notion**: Create integration at notion.so/my-integrations → share pages with integration → paste token

More details live in the docs:
- Quickstart: [docs/QUICKSTART.md](docs/QUICKSTART.md)
- Integrations: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Development: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- FAQ: [docs/FAQ.md](docs/FAQ.md)
- Contributing starters: [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## Troubleshooting (common)

- **Apple Notes not syncing:** check macOS privacy permissions for Notes/automation.
- **Install errors (native deps):** try a clean install (`rm -rf node_modules && npm install`).
- **LLM errors:** confirm your provider key is set in `.env`, and your provider is reachable (Ollama running locally, etc.).

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

## Contributing

PRs welcome! See [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
