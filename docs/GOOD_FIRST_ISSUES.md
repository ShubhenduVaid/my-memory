# Good first issues (draft)

If you want to contribute, these are intentionally scoped so you can ship value without needing deep context.

## 1) Improve `.env.example` completeness
**Goal:** Make first-run configuration obvious.

- Add `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `AUTO_UPDATES`, `UPDATE_CHANNEL` with short comments.
- Ensure README/Development docs reference the same env vars.

**Acceptance:** New users can configure Gemini/OpenRouter/Ollama without reading source.

## 2) Add a dedicated `docs/QUICKSTART.md`
**Goal:** “Time-to-try < 2 minutes” with copy/paste steps.

- Include 3 paths: Gemini, OpenRouter, Ollama.
- Include a small troubleshooting section for native deps / Ollama not running.

**Acceptance:** Quickstart doc is linked from README and works on macOS/Windows/Linux.

## 3) Add a health/status panel for integrations
**Goal:** Help users self-diagnose sync problems.

- Show last sync time per source, number of notes indexed, last error.
- UI can be simple text in settings.

**Acceptance:** Users can identify “Notion token invalid” vs “Apple Notes permissions” quickly.

## 4) Notion: clearer setup UX
**Goal:** Reduce Notion onboarding friction.

- Add inline instructions + deep link to Notion integrations page.
- Validate token format and show actionable errors.

**Acceptance:** Fewer “Notion not syncing” issues.

## 5) Add basic telemetry toggle + documentation (local-only)
**Goal:** Make privacy posture explicit.

- If any telemetry/log shipping exists, ensure it is opt-in.
- Document what is logged locally and where.

**Acceptance:** `SECURITY.md` and FAQ clearly describe behavior.

## 6) Add CI for tests/build sanity
**Goal:** Catch breakages early.

- Run `npm test` on PRs.
- Optionally run `npm run build` on all OSs.

**Acceptance:** PRs get a green/red signal without manual testing.
