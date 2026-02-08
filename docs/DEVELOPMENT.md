# Development Guide

## Prerequisites

- Node.js 18+
- npm 9+
- Git
- macOS (for Apple Notes), Windows, or Linux

## Quick Start

For a shorter copy/paste guide, see [QUICKSTART.md](QUICKSTART.md).

```bash
# Clone the repository
git clone https://github.com/ShubhenduVaid/my-memory.git
cd my-memory

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run the app
npm run start
```

## Environment Variables

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_gemini_api_key
```

Get a free API key at https://makersuite.google.com/app/apikey

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Build and run the app |
| `npm run dist` | Create distributable for current platform |
| `npm run release` | Build and publish release |

See [RELEASING.md](RELEASING.md) for the GitHub Actions release workflow and optional signing/notarization.

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed structure.

## Adding a New Source Adapter

1. Create a new file in `src/adapters/`
2. Implement the `ISourceAdapter` interface:

```typescript
import { ISourceAdapter, Note, WatchCallback } from '../core/types';

export class MyAdapter implements ISourceAdapter {
  readonly name = 'my-adapter';

  async initialize(): Promise<void> {
    // Setup code
  }

  async fetchAll(): Promise<Note[]> {
    // Return notes from your source
    return [];
  }

  watch(callback: WatchCallback): void {
    // Monitor for changes
  }

  stop(): void {
    // Cleanup
  }
}
```

3. Register in `src/main/index.ts`:

```typescript
import { MyAdapter } from '../adapters/my-adapter';
pluginRegistry.register(new MyAdapter());
```

## Adding a New LLM Provider

1. Create a new file in `src/adapters/llm/`
2. Implement the `ILLMAdapter` interface
3. Register in `src/core/llm-service.ts`

## Building for Distribution

```bash
# Current platform
npm run dist

# Specific platforms
npm run release:mac
npm run release:win
npm run release:linux
```

Output goes to `release/` folder.

## Debugging

The app uses `electron-log` for logging. Logs are stored at:
- macOS: `~/Library/Logs/my-memory/`
- Windows: `%USERPROFILE%\AppData\Roaming\my-memory\logs\`
- Linux: `~/.config/my-memory/logs/`

## Common Issues

### `better-sqlite3` build errors
Run `npm run postinstall` to rebuild native modules.

### App doesn't start
Check that `.env` file exists with valid `GEMINI_API_KEY`.

### Apple Notes not syncing (macOS)
Grant accessibility permissions in System Preferences > Security & Privacy.
