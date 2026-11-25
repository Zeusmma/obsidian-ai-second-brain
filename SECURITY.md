# Security policy

## Supported versions

Only the latest release on the `main` branch receives security fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems. Open a **private security advisory** on GitHub instead (repository page, Security tab, "Report a vulnerability"). Include:

- a description of the issue and its impact,
- steps to reproduce, or a minimal proof of concept,
- the affected version or commit.

You can expect an acknowledgement within a few days. Please allow reasonable time for a fix before any public disclosure.

## Scope notes

- Never include real credentials, API keys or personal data in a report.
- Secrets are read from environment variables only and must never be committed.
