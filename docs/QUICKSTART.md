# Quickstart (from source)

This guide gets you running locally in a few minutes.

## 1) Install & run

```bash
git clone https://github.com/ShubhenduVaid/my-memory.git
cd my-memory
npm install

cp .env.example .env
# edit .env

npm start
```

> In development mode, the app reads `.env` from the project root.

## 2) Choose an LLM provider

You can switch providers inside the app settings.

### Option A — Gemini (default)

Set:

```bash
GEMINI_API_KEY=... 
```

### Option B — OpenRouter

Set:

```bash
OPENROUTER_API_KEY=...
```

### Option C — Ollama (local)

1) Install Ollama: https://ollama.com/
2) Start it:

```bash
ollama serve
```

3) Pull a model (example):

```bash
ollama pull llama3.2
```

4) (Optional) Configure defaults via `.env`:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

## 3) If something fails

- Native dependency errors: try a clean install (`rm -rf node_modules && npm install`).
- Ollama provider says “not running”: ensure `ollama serve` is running and `OLLAMA_BASE_URL` is localhost.

For more: [DEVELOPMENT.md](DEVELOPMENT.md) and [INTEGRATIONS.md](INTEGRATIONS.md).
