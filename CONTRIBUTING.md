# Contributing

Use Node.js 22+ and run `npm test` before proposing a change. Runtime and test code currently use Node built-ins and require no dependency installation.

Keep examples synthetic. Do not include resumes, contact details, API keys, `.env`, job exports or browser profiles in issues, commits or screenshots. Report reproducible errors with sanitized inputs and expected/actual behavior.

For extraction changes, include a regression test for stale or mismatched detail content. For API changes, mock the provider and test unsuccessful responses as well as success. Keep model reasoning separate from deterministic keyword scores.

For UI changes, load the extension in Chrome/Edge and verify saved-job loading, status preservation, API consent and export. Describe exactly what was tested; do not imply mocked tests prove live integration.

