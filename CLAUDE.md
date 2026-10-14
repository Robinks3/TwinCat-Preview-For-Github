# TwinCAT Preview for GitHub

Chrome MV3 extension in plain JavaScript, no build step: the folder loads as is in Chrome.

- Tests: `node test/run.js` (core) and `node test/harness/serve.mjs`, then http://localhost:8787/test/harness/ (rendering).
- `src/*.js` modules export through `module.exports` (Node) or `globalThis.TcPr` (browser). Keep this dual export.
- Any content coming from a PR is inserted with `textContent`, never `innerHTML`.
- Every visible text goes through `src/i18n.js` (`T.t`, `T.tn`) with both a French AND an English entry; the i18n test in `test/run.js` checks that both dictionaries have the same keys. Documentation: English in `*.md`, French in `*.fr.md`, kept in sync, screenshots in `docs/images/en` and `docs/images/fr`.
- Test the extension on public PRs only, never on a private PR.
- Commit messages in English.

## Versioning: "one version = one line"

The version is `SCRIPT_VERSION` in `src/version.js`; `version` in `manifest.json` must stay identical.

1. On every change, bump `SCRIPT_VERSION` (e.g. 0.1.0 → 0.1.1) and `manifest.json`.
2. Add ONE line to the changelog at the top of `src/version.js`, formatted `//   X.Y.Z - description` (function touched, effect, reason).
3. Update `SCRIPT_DATE` if the date changed.

No exception, even for a one-line fix. Several independent changes = one version and one line each. The highest changelog version always equals `SCRIPT_VERSION`, in strict sequential order.
