# Security & Copyright Reporting Policy

## Local Security Architecture

AntiPersonality is engineered to minimize attack surface on developer workstations:

- **Loopback-Only Binding:** The local HTTP bridge in `injector.js` binds strictly to `127.0.0.1:51788` (never `0.0.0.0`) and enforces an explicit `Origin` allowlist (`isAllowedOrigin`) rejecting external websites from triggering local theme or persona endpoints.
- **CSP-Safe Bundling:** `core/bundle_runtime.js` compiles plugins without `eval()` or `new Function()`.
- **Top-Frame Isolation:** The runtime skips execution inside child `<iframe>` contexts so untrusted preview frames cannot access `window.AgyApi`.

## Reporting a Vulnerability

Please **do not** post exploitable local privilege or cross-origin bridge vulnerabilities in public GitHub issues. Instead:

1. Use GitHub's **Report a vulnerability** (Private Security Advisories) feature on this repository, **or**
2. Open a minimal issue requesting a private maintainer contact channel without disclosing exploit payloads publicly.

## Copyright / Trademark Concerns

This repository distributes original source code and CSS token files only. If you believe any content in this repository infringes your copyright or trademark, please open an issue on the GitHub repository with `[Legal]` in the title identifying the specific file and claim so maintainers can review and address it promptly.
