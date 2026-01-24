# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

1. **Do not** open a public GitHub issue
2. Email the maintainers directly (or use GitHub's private vulnerability reporting)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to understand and address the issue.

## Security Considerations

### API Keys
- API keys are stored locally in `.env` (development) or system keychain (production)
- Never commit `.env` files to version control
- Keys are not transmitted except to their respective API endpoints

### Local Data
- Notes are cached locally in SQLite
- Cache is stored in the user's app data directory
- No data is sent to external servers except for LLM queries

### Permissions
- macOS: Requires accessibility permissions for Apple Notes integration
- The app requests only necessary permissions for its functionality
