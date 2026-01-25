# Product Requirements Document (PRD)
## My Memory

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Author:** ShubhenduVaid

---

## 1. Executive Summary

My Memory is an AI-powered desktop application that provides intelligent semantic search across multiple note-taking platforms. It enables users to find information by meaning rather than exact keywords, consolidating fragmented knowledge across Apple Notes, Obsidian, local files, and Notion into a single, instantly accessible search interface.

---

## 2. Problem Statement

### The Challenge
Modern knowledge workers store information across multiple platforms—Apple Notes for quick captures, Obsidian for structured knowledge bases, Notion for collaborative work, and local files for documents. This fragmentation creates several problems:

1. **Information Silos** - Notes scattered across platforms are difficult to search holistically
2. **Keyword Limitations** - Traditional search requires remembering exact words used
3. **Context Switching** - Users must open multiple apps to find related information
4. **Lost Knowledge** - Valuable notes become buried and forgotten over time

### The Opportunity
AI-powered semantic search can understand the meaning behind queries, enabling users to find relevant notes even when they don't remember the exact wording. A unified search interface eliminates context switching and surfaces forgotten knowledge.

---

## 3. Target Audience

### Primary Users
- **Knowledge Workers** - Professionals who take extensive notes for work
- **Researchers & Students** - People managing large volumes of reference material
- **Writers & Content Creators** - Users with extensive note archives
- **Developers** - Technical users with documentation across multiple sources

### User Characteristics
- Use 2+ note-taking platforms regularly
- Value quick access to information (keyboard-centric workflows)
- Comfortable with AI-powered tools
- Privacy-conscious (prefer local-first solutions)

### User Personas

**Alex - Product Manager**
- Uses Apple Notes for meeting notes, Obsidian for product specs, Notion for team wikis
- Needs to quickly reference past decisions during meetings
- Values keyboard shortcuts and speed

**Sam - Graduate Researcher**
- Maintains extensive literature notes in Obsidian
- Has PDFs and markdown files across multiple folders
- Needs semantic search to find related concepts across sources

---

## 4. Product Vision & Goals

### Vision
Become the universal search layer for personal knowledge, making every note instantly findable regardless of where it's stored.

### Goals
1. **Unified Search** - Single interface to search all note sources
2. **Semantic Understanding** - Find notes by meaning, not just keywords
3. **Instant Access** - Spotlight-style UI accessible via global hotkey
4. **Privacy First** - Local processing, no cloud dependency for core features
5. **Extensibility** - Plugin architecture for future integrations

### Success Metrics
- Time to find relevant note < 5 seconds
- User retention (weekly active usage) > 70%
- Notes indexed across 2+ sources per user
- Search accuracy satisfaction > 80%

---

## 5. Features & Requirements

### 5.1 Core Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Spotlight-style UI | Global hotkey (`Cmd+Shift+Space`) opens floating search window | P0 |
| Semantic Search | AI-powered search understands meaning, not just keywords | P0 |
| AI Answers | Generate summaries and answers from relevant notes | P0 |
| Menu Bar App | Persistent tray icon for quick access | P0 |
| SQLite Cache | Local caching for fast offline search | P0 |

### 5.2 Integrations

| Integration | Description | Platform | Priority |
|-------------|-------------|----------|----------|
| Apple Notes | Real-time sync via AppleScript | macOS only | P0 |
| Obsidian | Index markdown files from vaults | All | P0 |
| Local Files | Index .md, .txt, .pdf from folders | All | P0 |
| Notion | API integration for shared pages | All | P0 |

### 5.3 LLM Providers

| Provider | Description | Requirements |
|----------|-------------|--------------|
| Gemini | Google's AI (default, free tier available) | API key |
| OpenRouter | Access to multiple models | API key |
| Ollama | Local models, fully offline | Local installation |

### 5.4 User Experience Requirements

- **Response Time**: Search results appear within 2 seconds
- **Keyboard Navigation**: Full keyboard support (arrows, Enter, Escape)
- **Minimal UI**: Clean, distraction-free interface
- **Auto-updates**: Seamless background updates via GitHub Releases

---

## 6. Technical Architecture

### Technology Stack
- **Framework**: Electron (cross-platform desktop)
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **AI**: Google Generative AI SDK, OpenRouter API, Ollama
- **Build**: electron-builder

### Architecture Overview
```
┌─────────────────────────────────────────────────┐
│              Electron Application               │
├─────────────────────────────────────────────────┤
│  Renderer (UI)  ◄──IPC──►  Main Process         │
│                           ├── Search Manager    │
│                           ├── LLM Service       │
│                           ├── Plugin Registry   │
│                           ├── Source Adapters   │
│                           └── SQLite Cache      │
└─────────────────────────────────────────────────┘
```

### Plugin Architecture
New integrations implement the `ISourceAdapter` interface:
```typescript
interface ISourceAdapter {
  readonly name: string;
  initialize(): Promise<void>;
  fetchAll(): Promise<Note[]>;
  watch(callback: WatchCallback): void;
  stop(): void;
}
```

### Data Model
```typescript
interface Note {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceId: string;
  modifiedAt: Date;
  metadata?: Record<string, unknown>;
}
```

---

## 7. Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| macOS | Full Support | All features including Apple Notes |
| Windows | Supported | No Apple Notes integration |
| Linux | Supported | No Apple Notes integration |

### System Requirements
- Node.js 18+ (development)
- 4GB RAM minimum
- 100MB disk space (plus cache)

---

## 8. Security & Privacy

### Principles
- **Local-First**: All note data stored locally in SQLite
- **No Telemetry**: No usage data collected
- **API Keys**: Stored locally, never transmitted except to chosen LLM provider
- **Open Source**: MIT license, fully auditable

### Data Handling
- Notes are cached locally for performance
- Content truncated to ~20k characters per note
- Large files skipped (2MB text, 10MB PDF)
- No cloud sync of note content

---

## 9. Roadmap

### v1.0.0 (Current)
- ✅ Core search functionality
- ✅ Apple Notes, Obsidian, Local Files, Notion integrations
- ✅ Multiple LLM providers
- ✅ Cross-platform builds

### v1.1 (Short-term)
- [ ] Improved search ranking
- [ ] Keyboard shortcut customization
- [ ] Dark/light theme toggle
- [ ] Search history

### v1.2 (Medium-term)
- [ ] Google Drive integration
- [ ] Dropbox integration
- [ ] Evernote integration
- [ ] Browser extension

### v2.0 (Long-term)
- [ ] Cloud sync (optional)
- [ ] Mobile companion app
- [ ] Collaborative features
- [ ] Custom AI model fine-tuning

---

## 10. Competitive Analysis

| Product | Strengths | Weaknesses vs My Memory |
|---------|-----------|------------------------|
| Raycast Notes | Fast, native macOS | Single platform, no semantic search |
| Alfred | Powerful workflows | No AI, limited note integration |
| Notion AI | Built-in AI | Notion-only, cloud-dependent |
| Obsidian Search | Fast local search | Obsidian-only, keyword-based |

### Differentiation
- **Cross-platform note aggregation** - Search across multiple sources
- **Semantic AI search** - Find by meaning, not keywords
- **Privacy-focused** - Local-first with optional cloud LLMs
- **Extensible** - Plugin architecture for new integrations

---

## 11. Success Criteria

### Launch Criteria (v1.0)
- [x] Stable builds for macOS, Windows, Linux
- [x] 4 source integrations working
- [x] 3 LLM providers supported
- [x] Auto-update mechanism
- [x] Documentation complete

### Growth Metrics
- GitHub stars growth
- Download count
- Community contributions
- Feature request volume

---

## 12. Open Questions & Risks

### Technical Risks
- **LLM API costs** - Heavy users may incur significant API costs
- **Apple Notes access** - AppleScript may break with macOS updates
- **Native module compatibility** - better-sqlite3 requires rebuilding per platform

### Product Risks
- **User adoption** - Requires behavior change (new hotkey habit)
- **Integration maintenance** - Third-party APIs may change
- **Competition** - Large players may add similar features

### Mitigations
- Support local LLMs (Ollama) for cost-conscious users
- Abstract adapter interface for easy updates
- Focus on multi-source aggregation as key differentiator

---

## 13. Appendix

### Glossary
- **Semantic Search**: AI-powered search that understands meaning and context
- **Source Adapter**: Plugin that connects to a note source (Apple Notes, Obsidian, etc.)
- **LLM**: Large Language Model used for AI features

### References
- [Architecture Documentation](ARCHITECTURE.md)
- [Development Guide](DEVELOPMENT.md)
- [Roadmap](ROADMAP.md)
- [Contributing Guide](../CONTRIBUTING.md)

### Contact
- GitHub: [ShubhenduVaid/my-memory](https://github.com/ShubhenduVaid/my-memory)
- Issues: [GitHub Issues](https://github.com/ShubhenduVaid/my-memory/issues)
