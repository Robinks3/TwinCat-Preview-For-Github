# User guide

**English** · [Français](GUIDE.fr.md)

## Language

The interface is in French if the browser language is French, in English otherwise. To force a language, run in the console of a github.com page: `localStorage.setItem("tcpr-lang", "fr")` (or `"en"`), then reload.

## Installation

1. Get the repository (clone or extracted ZIP archive).
2. Open `chrome://extensions` (Edge: `edge://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select the folder that contains `manifest.json`.
4. Reload GitHub tabs that were already open: Chrome does not inject an extension into tabs opened before it was installed.

Update: replace the files, click ⟳ on the extension card in `chrome://extensions`, then reload the GitHub tab. The version number is shown at the bottom of the panel.

## The toolbar

On a pull request page, a toolbar appears at the bottom right:

| Button | Purpose |
|---|---|
| **TwinCAT: inline** | Formats TwinCAT files directly in GitHub's diff. Setting remembered. The extension icon does the same. |
| **Panel** | Opens the PR overview (`Alt+T`, `Alt+Shift+T` to reload everything). |
| **🐞** | Debug mode (see below). |

## Inline formatting

Use it in the PR's **Files changed** tab, to review and comment.

- XML structure lines and noise (`LineIds`, GUIDs, XAE version) are hidden.
- ST code is shown without `<![CDATA[`, highlighted.
- Each section starts with a banner: "Method Reset · declaration", "Property Counter · Get · implementation"... Blue edge for a declaration, green for code.
- A structure line that carries real information (for example a changed `SpecialFunc` attribute) stays visible, greyed out.

The displayed rows are GitHub's own: the "+" button, comments, suggestions and line numbers work as usual. A comment is attached to the real line of the file; a reviewer without the extension sees it at the same place in the XML. Turning the formatting off restores the original diff.

Applies to PLC objects: `.TcPOU`, `.TcDUT`, `.TcGVL`, `.TcIO`. Configuration files (`.tsproj`, `.xti`, `.plcproj`, `.TcTTO`) stay as XML in the diff; the panel shows them as properties.

Formatting is first approximate (based on the displayed text), then exact as soon as the full file is available: immediate for an added or removed file, a single download for a modified file.

## Overview panel

Use it to understand a PR at a glance.

- **TwinCAT tree**: one block per object (POU > methods / properties > Get / Set), with a badge per type (FB, PRG, M, P, G, S...) and the signature (`METHOD Reset : BOOL`). Declaration and code kept apart. Every block can be collapsed.
- **Navigation on the left**: folders > files > members, colored dot by state (green added, red removed, orange modified). The **☰ Tree** button hides it to give the code the full width.
- **Side by side**: before on the left, after on the right (setting remembered). Uncheck to go back to a single column.
- **Ignore whitespace**: useful after running a formatter (TcBlack), to see only real changes.
- **Show unchanged**: also shows identical sections and properties.
- **Configuration** (`.TcTTO`, `.plcproj`, `.tsproj`, `.xti`): Property / Before / After tables. Items are identified by name: reordering files or libraries does not produce a difference.

### Large PRs

- A file is downloaded and analyzed only when it gets close to the screen, once per page.
- Probably large files (`.tsproj`, `.tmc`, huge diff) wait for a click on **Download and analyze**; above 1.5 MB, the analysis too.
- Beyond 800 lines per file, the following sections stay folded: **Show (N lines)**.

## Debug mode

The **🐞** button opens a live log: requests (duration, size), source of the head version (page SHA, branch or `.patch`), analysis and rendering of each file, formatting passes, long tasks (page blocked for more than 200 ms).

- **Copy report**: summary per step (count, total, maximum) followed by the full log, ready to paste into a ticket.
- **Previous report**: saved log of the previous session, useful when the page froze and had to be closed.
- **Disable**: stops collecting.

The report contains the repository name and file paths, never their content. Review it before sharing it outside your team.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| No toolbar at the bottom right | Tab opened before installation: reload it. Or the page is not a PR. |
| Inline formatting has no effect | Not the "Files changed" tab, or the PR contains no PLC object. The debug log says so. |
| "Loading failed" | Expired GitHub session or no access to the repository: sign in to GitHub again, reload. |
| Slowness | Open debug mode, reproduce, **Copy report**: the summary shows the step at fault. |
