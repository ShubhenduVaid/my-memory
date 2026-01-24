# Contributing to My Memory

Thank you for your interest in contributing to My Memory! This document provides guidelines for contributing.

## How to Contribute

### Reporting Bugs

1. Check existing [issues](../../issues) to avoid duplicates
2. Use the bug report template
3. Include steps to reproduce, expected vs actual behavior, and your environment

### Suggesting Features

1. Check existing issues and discussions first
2. Use the feature request template
3. Explain the use case and why it would benefit users

### Code Contributions

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test your changes locally
5. Commit with clear messages
6. Push and open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- macOS (for Apple Notes integration) or Windows/Linux

### Local Development

```bash
# Clone your fork
git clone https://github.com/ShubhenduVaid/my-memory.git
cd my-memory

# Install dependencies
npm install

# Create .env file
echo "GEMINI_API_KEY=your_key_here" > .env

# Run in development
npm run start
```

### Building

```bash
npm run build    # Compile TypeScript
npm run dist     # Create distributable
```

## Code Style

- Use TypeScript
- Follow existing code patterns
- Add comments for complex logic
- Keep functions focused and small

## Commit Messages

Use clear, descriptive commit messages:
- `feat: add obsidian vault sync`
- `fix: resolve search indexing issue`
- `docs: update installation guide`

## Pull Request Process

1. Update documentation if needed
2. Ensure the app builds and runs
3. Link related issues in the PR description
4. Request review from maintainers

## Questions?

Open a [discussion](../../discussions) or issue if you need help.
