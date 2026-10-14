// Amorçage sur github.com : bouton flottant sur les pages de PR, ouverture de l'overlay.
// GitHub navigue sans recharger la page (Turbo), d'où la surveillance de l'URL.

(function (root) {
  const T = root.TcPr;
  const loaders = new Map(); // "owner/repo#N" -> Promise du chargeur de la PR
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
    const current = (overlay = T.createOverlay(pr, close));
    document.body.append(current.el);
    document.addEventListener("keydown", onKey, true);

    // Un chargeur par PR, gardé pour la page : rouvrir le panneau ne retélécharge rien.
    const id = `${pr.owner}/${pr.repo}#${pr.number}`;
    if (forceReload || !loaders.has(id)) {
      const p = T.createPrLoader(pr, T.isTwinCatPath, {
        headShaHint: headShaFromPage(),
        onProgress: (t) => {
          if (overlay === current) current.setStatus(t);
        },
      });
      p.catch(() => loaders.delete(id)); // un échec ne doit pas rester en cache
      loaders.set(id, p);
    }
    try {
      const loader = await loaders.get(id);
      if (overlay !== current) return;
      if (!loader.files.length) {
        current.showMessage("Aucun fichier TwinCAT dans cette PR.");
        current.setStatus("");
        return;
      }
      const refresh = () => {
        if (overlay === current) current.setStatus(statusLine(loader));
      };
      current.setList(loader.files, loader.load, refresh);
      refresh();
    } catch (e) {
      if (overlay === current) current.showMessage(`Échec du chargement : ${e.message}`, true);
    }
  }

  // SHA de tête présent dans les données embarquées de la page de PR (« headOid »).
  // Ignoré s'il est ambigu ; le chargeur le vérifie de toute façon avant de s'en servir.
  function headShaFromPage() {
    const shas = new Set();
    for (const s of document.querySelectorAll('script[type="application/json"]')) {
      for (const m of s.textContent.matchAll(/"headOid"\s*:\s*"([0-9a-f]{40})"/g)) shas.add(m[1]);
    }
    return shas.size === 1 ? [...shas][0] : null;
  }

  // Ligne d'état : nombre de fichiers, téléchargements faits / nécessaires, source du SHA, temps du diff.
  function statusLine(loader) {
    const s = loader.stats;
    const n = loader.files.length;
    const sec = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
    const sha = s.headSha ? ` · SHA ${s.headSha.slice(0, 7)} (${s.shaSource})` : "";
    return `${n} fichier${n > 1 ? "s" : ""} TwinCAT · ${s.fetched}/${s.toFetch} modifié${s.toFetch > 1 ? "s" : ""} téléchargé${s.fetched > 1 ? "s" : ""} · diff ${sec(s.diffMs)} (${s.diffKb} Ko)${sha}`;
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
