# FAQ

## What does My Memory do?
My Memory is a desktop app that lets you search your notes **by meaning** (semantic search) across multiple sources from a single search bar.

## What sources are supported?
- Apple Notes (macOS only)
- Obsidian vault folders
- Notion (via an integration + shared pages)
- Local files/folders

See: [INTEGRATIONS.md](INTEGRATIONS.md)

## Is it "local-first"?
Yes.

- Notes are fetched, indexed, and cached **locally**.
- Your API keys live **locally** in your `.env` file.

## Do my notes get sent to an AI provider?
It depends on which LLM provider you choose:

- **Gemini / OpenRouter:** parts of your query and selected snippets may be sent to the provider to rank results and/or generate an answer.
- **Ollama:** requests can stay on your machine (local model), which is the best option for privacy.

See: [SECURITY.md](../SECURITY.md)

## Can I use it without an API key?
If you use **Ollama**, you can run a local model without a hosted API key.

## Does it work offline?
- **Search + indexing** can work offline once your sources are synced.
- **AI answers** require the chosen provider to be reachable (unless you use a local Ollama model).

## Where is the index stored?
Locally on your machine (exact path depends on OS). See logging paths and app data notes in [DEVELOPMENT.md](DEVELOPMENT.md).

## Why is Apple Notes macOS-only?
Apple Notes access relies on macOS-specific automation/permissions.

## I’m getting permission prompts on macOS — is that expected?
Yes. Apple Notes integration may require granting relevant macOS privacy permissions.

## How do I build an installer?
Run:

```bash
npm run dist
```

Artifacts go to `release/`.

## How do maintainers publish GitHub Releases?
See: [RELEASING.md](RELEASING.md)
