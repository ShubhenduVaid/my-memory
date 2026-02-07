# Integrations

My Memory can index multiple sources. This doc covers setup steps and common gotchas.

## Apple Notes (macOS only)

**Requirements**
- macOS only
- Apple Notes app installed and signed in

**Setup**
1. In My Memory, select **Apple Notes** as a source.
2. Run a sync.

**Common issues**
- **No notes found / permission denied**: check macOS privacy permissions for the app (Automation / Accessibility, depending on how the adapter reads Notes).
- **Slow sync**: initial sync can take time on large libraries.

## Obsidian

**What is indexed**
- Markdown notes under the folders you select (your vault).

**Setup**
1. In My Memory, select **Obsidian**.
2. Add one or more vault folders.
3. Run **Sync now**.

**Tips**
- Exclude large folders that aren’t useful (e.g. `.git`, `node_modules`, build output) if you add a broad directory.

## Local files

**Setup**
1. In My Memory, select **Local files**.
2. Add one or more folders.
3. Optionally enable subfolders.
4. Run **Sync now**.

## Notion

**High-level model**
Notion access is granted via a Notion integration token. Only pages that you explicitly share with the integration can be indexed.

**Setup**
1. Create a Notion integration: https://www.notion.so/my-integrations
2. Copy the integration token.
3. Share the specific pages/databases you want indexed with the integration.
4. Paste the token into My Memory and run a sync.

**Common issues**
- **Nothing imports**: you probably haven’t shared pages with the integration.
- **Access errors**: regenerate the token and re-share the pages.

