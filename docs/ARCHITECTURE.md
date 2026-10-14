# Architecture

**English** · [Français](ARCHITECTURE.fr.md)

Chrome Manifest V3 extension in plain JavaScript, with no dependency and no build step: the folder loads as is. Each `src/*.js` module exports through `module.exports` (Node tests) or onto `globalThis.TcPr` (browser).

## Overview

```
github.com (PR page)
  content.js ── toolbar, shortcuts, follows navigation without reload
     │
     ├── inline.js ── formatting inside GitHub's diff (GitHub's rows are kept)
     │      └── lines.js ── role of each line of a file (code, scaffolding, noise, config)
     │
     ├── ui.js ── virtualized panel (tree, side by side, properties)
     │      ├── model.js ── TwinCAT file → comparable sections
     │      └── diff.js ── Myers diff, per-section and per-property diff
     │
     └── github.js ── on-demand PR loader ──► background.js (service worker) ──► github.com
            xml.js ── minimal XML parser with positions (shared)
            debug.js ── log, timers, report
            i18n.js ── English / French texts following the browser language
```

## Data retrieval

No token: requests leave from the service worker with the browser's GitHub session. `background.js` only accepts three kinds of github.com URLs: `/pull/N.diff`, `/pull/N.patch` and `/raw/<sha or refs/heads/branch>/<path>`. 60 s timeout per request.

The loader (`createPrLoader`):

1. downloads `/pull/N.diff` once per page: list of TwinCAT files and hunks against the merge base. An added or removed file is complete in it;
2. for a modified file, downloads the head version (`/raw/...`) only on demand, then rebuilds the base version by applying the hunks in reverse, with a check on every line;
3. finds the head version by trying, in order, the SHA found in the page, the head branch shown in the page, then the SHA from the `.patch` (heavy). Each source is checked on a small PLC object used as a probe; a stale source fails the check and the next one is tried;
4. memoizes each file: the same file is never downloaded twice in a page.

## Inline formatting (`inline.js`)

GitHub renders the diff with React. To coexist:

- no row is created or removed; only `data-tcr-*` attributes (hidden, part, state) and `tcr-*` class elements (highlighted ST text, banner) are added;
- a `MutationObserver` reapplies the formatting when GitHub re-renders; our own insertions are ignored;
- each code cell gives its base / head line numbers (`data-diff-line-key="b:…-l:…-r:…"`), which lets the exact `lines.js` classification computed on the full file be applied;
- only tables close to the screen are processed, in 12 ms slices, at most one pass every 400 ms per table.

## Panel (`ui.js`)

- `model.js` splits a file into sections with their place in the tree (`tree`) and their role (`part`: declaration, implementation, attributes, properties); noise (LineIds, GUIDs, versions) is extracted separately to report "XML noise only".
- `diff.js` compares sections key by key (method, property, Get/Set...), with a Myers line diff for code and a key / value diff for configuration.
- Virtualization: a card is mounted 1,500 px from the screen and unmounted beyond 5,000 px (hysteresis), `content-visibility: auto`, analysis cache bounded to 40 MB of sources, budget of 800 lines rendered up front per file.
- Any content coming from a PR is inserted with `textContent`, never `innerHTML`.

## Languages

Every visible text goes through `src/i18n.js` (`t(key, params)`, `tn(key, n)` for plurals), which holds the French and English dictionaries. The language is the browser UI language (`chrome.i18n.getUILanguage()`), can be forced with `localStorage["tcpr-lang"]`. The extension name and description live in `_locales/`. A test checks that every key exists in both languages.

## Tests

- `node test/run.js`: parser, model, diff (including 2,000 random cases compared against a reference LCS), reconstruction from real git diffs (LF, CRLF, BOM, no final newline), on-demand loader, English texts.
- `node test/harness/serve.mjs`, then:
  - `/test/harness/`: panel on a demo PR;
  - `/test/harness/inline.html`: inline formatting on an imitation of GitHub's view;
  - `/test/harness/stress.html?files=300&lines=2000&step=3`: load test.

## Versioning

One version = one line: on every change, bump `SCRIPT_VERSION` in `src/version.js` and `version` in `manifest.json`, and add one line to the changelog at the top of `src/version.js`. The number is shown at the bottom of the panel and in debug reports.
