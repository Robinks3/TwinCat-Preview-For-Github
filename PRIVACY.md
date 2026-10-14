# Privacy

**English** · [Français](PRIVACY.fr.md)

TwinCAT Preview for GitHub runs entirely in the browser. No data is sent anywhere other than GitHub, and nothing is sent to the extension's developer or to any third party.

## What the extension reads

- The pull request page open on github.com: diff structure, head branch name and last commit SHA when the page contains them.
- Through the GitHub session already open in the browser, and only on github.com URLs of the form:
  - `/<owner>/<repo>/pull/<n>.diff` and `.patch`;
  - `/<owner>/<repo>/raw/<commit or branch>/<path>`.

These addresses redirect to `patch-diff.githubusercontent.com` and `raw.githubusercontent.com` (GitHub domains), hence the three host permissions in the manifest. The service worker rejects any other URL.

## What the extension stores

In github.com's `localStorage`, on the machine only:

| Key | Content |
|---|---|
| `tcpr-inline` | inline formatting on or off |
| `tcpr-split`, `tcpr-nav` | panel display preferences |
| `tcpr-debug` | debug mode on or off |
| `tcpr-lang` | forced language (only if set by hand) |
| `tcpr-debug-journal` | last 400 lines of the debug log (when debug mode is on): repository names, file paths, durations, sizes; never file contents |

Downloaded file contents stay in memory for the lifetime of the page.

## What the extension does not use

No GitHub token, no account, no telemetry, no analytics service, no external server, no library loaded from the Internet.

## Debug mode

The report copied with **Copy report** contains the repository name, the PR number and file paths. It only leaves the machine if you paste it somewhere: review it before sharing.
