# TwinCAT Preview for GitHub

**English** · [Français](README.fr.md)

Chrome / Edge extension (Manifest V3) that makes **TwinCAT 3** files readable in GitHub pull requests: ST code without the XML, organized like in TwinCAT, with review comments that keep working.

> Unofficial project, not affiliated with Beckhoff Automation. TwinCAT is a trademark of Beckhoff Automation GmbH.

## Features

A toolbar at the bottom right of every PR: **[TwinCAT: inline] [Panel] [🐞]**.

**Inline formatting in the GitHub diff** ("Files changed" tab)
- XML scaffolding and noise (`LineIds`, GUIDs, XAE version) hidden;
- ST without `<![CDATA[`, syntax highlighted;
- a banner at the start of each section ("Method Reset · declaration"), blue edge for declarations, green for code;
- the rows are still GitHub's own: comments, the "+" button and line numbers are untouched.

**Overview panel** (`Alt+T`)
- TwinCAT tree: POU > methods / properties > Get / Set, declaration and code kept apart;
- side-by-side before | after view, "Ignore whitespace" option;
- `.TcTTO`, `.plcproj`, `.tsproj`, `.xti` as before / after property tables;
- navigation by folder > file > member.

**Large PRs**: everything is loaded on demand and only once, and the panel is virtualized like GitHub's own view. The cost depends only on what is on screen (load test: 300 files of 2,000 lines, no freeze).

**Debug mode** (🐞): log of loading times and a copyable report to diagnose slowness.

The interface is in English or French, following the browser language.

No token, no server: the extension reuses the browser's GitHub session, private repositories included. Details in [PRIVACY.md](PRIVACY.md).

## Installation

1. Clone the repository, or download the ZIP archive and extract it.
2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select the folder that contains `manifest.json`.
4. Reload GitHub tabs that were already open, then open a PR.

## Documentation

- [User guide](docs/GUIDE.md): modes, settings, debug mode, troubleshooting.
- [Architecture](docs/ARCHITECTURE.md): modules, data retrieval, coexistence with GitHub's rendering, tests.
- [Privacy](PRIVACY.md): what the extension reads, stores, and never sends.

## Tests

```bash
node test/run.js
```

```bash
node test/harness/serve.mjs
```

then http://localhost:8787/test/harness/ (panel), `/test/harness/inline.html` (inline formatting) and `/test/harness/stress.html` (load test).

## Credits and license

Inspired by TcCompare (Beckhoff) and [TcPreview](https://github.com/dfreiberger/tc-preview-extension) (TwinCAT preview for Azure DevOps). The test files in `test/fixtures` come from [TcBlack](https://github.com/Roald87/TcBlack), under the MIT license (see [test/fixtures/LICENSE-TcBlack](test/fixtures/LICENSE-TcBlack)).

Project license: [MIT](LICENSE).

## Known limitations

- Inline formatting: GitHub's new "Files changed" view only, PLC objects only.
- `.tsproj`: generic property view, no dedicated presentation of I/O links or EtherCAT topology.
- github.com only (no GitHub Enterprise Server).
