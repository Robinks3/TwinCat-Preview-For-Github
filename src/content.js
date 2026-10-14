// Amorçage sur github.com : bouton flottant sur les pages de PR, ouverture de l'overlay.
// GitHub navigue sans recharger la page (Turbo), d'où la surveillance de l'URL.

(function (root) {
  const T = root.TcPr;
  const cache = new Map(); // "owner/repo#N" -> entrées déjà chargées
  let button = null;
  let overlay = null;

  function close() {
    if (overlay) overlay.el.remove();
    overlay = null;
    document.removeEventListener("keydown", onKey, true);
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  }

  async function open(forceReload) {
    const pr = T.parsePrUrl(location.href);
    if (!pr) return;
    close();
    overlay = T.createOverlay(pr, close);
    document.body.append(overlay.el);
    document.addEventListener("keydown", onKey, true);

    const id = `${pr.owner}/${pr.repo}#${pr.number}`;
    if (cache.has(id) && !forceReload) {
      const c = cache.get(id);
      overlay.setEntries(c.files);
      overlay.setStatus(statusLine(c));
      return;
    }
    const current = overlay;
    try {
      const res = await T.loadPrFiles(pr, T.isTwinCatPath, (entry) => {
        if (overlay === current) {
          current.addEntry(entry);
          current.setStatus("Chargement…");
        }
      });
      cache.set(id, res);
      if (overlay !== current) return;
      if (!res.files.length) current.showMessage("Aucun fichier TwinCAT dans cette PR.");
      current.setStatus(statusLine(res));
    } catch (e) {
      if (overlay === current) current.showMessage(`Échec du chargement : ${e.message}`, true);
    }
  }

  function statusLine(res) {
    const n = res.files.length;
    const sha = res.headSha ? ` · ${res.headSha.slice(0, 7)}` : "";
    return `${n} fichier${n > 1 ? "s" : ""} TwinCAT${sha}`;
  }

  function sync() {
    const onPr = !!T.parsePrUrl(location.href);
    if (onPr && !button) {
      button = T.h("button", { class: "tc-fab", title: "Vue TwinCAT de la PR (Alt+T)", onclick: () => open(false) }, "TwinCAT");
      document.body.append(button);
    } else if (!onPr && button) {
      button.remove();
      button = null;
      close();
    }
  }

  function toggle(forceReload) {
    if (overlay) close();
    else open(forceReload);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "tcpr-toggle" && T.parsePrUrl(location.href)) toggle(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "t" || e.key === "T") && T.parsePrUrl(location.href)) {
      e.preventDefault();
      toggle(e.shiftKey);
    }
  });

  sync();
  setInterval(sync, 1000);
})(typeof globalThis !== "undefined" ? globalThis : this);
