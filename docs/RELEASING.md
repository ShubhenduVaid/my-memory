# Releasing

This project uses **GitHub Actions** + **electron-builder** to build and publish desktop releases.

## TL;DR

- **Maintainers:** push a git tag like `v1.2.3` → GitHub Actions builds macOS/Windows/Linux and publishes assets to **GitHub Releases**.
- **Contributors:** use **Actions → Release → Run workflow** to build and download artifacts (no publishing).

## 1) Publish an official release (maintainers)

### Prerequisites

- You have push access to the repo
- The workflow file: `.github/workflows/release.yml`

### Steps

1) Bump version (optional but recommended so the app version matches the tag):

```bash
npm version patch
```

2) Push commits + tags:

```bash
git push --follow-tags
```

3) GitHub Actions will run on the tag `vX.Y.Z` and publish assets to:

- https://github.com/ShubhenduVaid/my-memory/releases

## 2) Build release artifacts without publishing (anyone)

If you just want installable artifacts (for testing) without touching GitHub Releases:

1) Go to **Actions → Release**
2) Click **Run workflow**
3) Download the build artifacts from the workflow run

## 3) Signing & notarization (optional)

By default, the workflow can build and publish **unsigned** artifacts.

If you want signed builds, add these secrets in the GitHub repo settings:

### macOS signing/notarization

- `MAC_CERTS` (base64-encoded signing cert)
- `MAC_CERTS_PASSWORD`
- `APPLE_ID`
- `APPLE_ID_PASSWORD`
- `APPLE_TEAM_ID`

Notes:
- Notarization is implemented in `scripts/notarize.js`.
- If Apple credentials are missing, notarization is skipped (the build still completes).

### Windows code signing

- `WIN_CERTS` (base64-encoded cert)
- `WIN_CERTS_PASSWORD`

## 4) Local builds

To build on your machine for your current OS:

```bash
npm install
npm run dist
```

Output artifacts land in the `release/` folder.
