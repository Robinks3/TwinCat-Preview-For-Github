// Amorçage sur github.com : barre d'outils sur les pages de PR (mise en forme intégrée au diff,
// panneau, debug). GitHub navigue sans recharger la page (Turbo), d'où la surveillance de l'URL.

(function (root) {
  const T = root.TcPr;
  const INLINE_KEY = "tcpr-inline";
  const loaders = new Map(); // "owner/repo#N" -> Promise du chargeur de la PR
  const progressListeners = new Set();
  let bar = null;
  let overlay = null;
  let debugPanel = null;
  let currentPr = null;

  function prId(pr) {
    return `${pr.owner}/${pr.repo}#${pr.number}`;
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

  // Un chargeur par PR, partagé par la vue intégrée et le panneau, gardé pour la page :
  // rien n'est téléchargé deux fois.
  function getLoader(pr, forceReload) {
    const id = prId(pr);
    if (forceReload || !loaders.has(id)) {
      const sha = headShaFromPage();
      T.debug.log("chargeur", `création pour ${id}`, { sha_page: sha ? sha.slice(0, 7) : "absent" });
      const p = T.createPrLoader(pr, T.isTwinCatPath, {
        headShaHint: sha,
        onProgress: (t) => progressListeners.forEach((l) => l(t)),
      });
      p.catch((e) => {
        T.debug.log("chargeur", "échec", { erreur: e.message });
        loaders.delete(id); // un échec ne doit pas rester en cache
      });
      loaders.set(id, p);
    }
    return loaders.get(id);
  }

  // ---------- Panneau ----------

  function closePanel() {
    if (overlay) {
      overlay.el.remove();
      progressListeners.delete(overlay.onProgress);
    }
    overlay = null;
    document.removeEventListener("keydown", onKey, true);
    refreshBar();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      closePanel();
    }
  }

  async function openPanel(forceReload) {
    const pr = T.parsePrUrl(location.href);
    if (!pr) return;
    closePanel();
    const current = (overlay = T.createOverlay(pr, closePanel));
    current.onProgress = (t) => {
      if (overlay === current) current.setStatus(t);
    };
    progressListeners.add(current.onProgress);
    document.body.append(current.el);
    document.addEventListener("keydown", onKey, true);
    refreshBar();
    try {
      const loader = await getLoader(pr, forceReload);
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

  // Ligne d'état : nombre de fichiers, téléchargements faits / nécessaires, source du SHA, temps du diff.
  function statusLine(loader) {
    const s = loader.stats;
    const n = loader.files.length;
    const sec = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
    const sha = s.headSha ? ` · SHA ${s.headSha.slice(0, 7)} (${s.shaSource})` : "";
    return `${n} fichier${n > 1 ? "s" : ""} TwinCAT · ${s.fetched}/${s.toFetch} modifié${s.toFetch > 1 ? "s" : ""} téléchargé${s.fetched > 1 ? "s" : ""} · diff ${sec(s.diffMs)} (${s.diffKb} Ko)${sha}`;
  }

  // ---------- Mise en forme intégrée ----------

  function inlineWanted() {
    try {
      return localStorage.getItem(INLINE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setInlineWanted(on) {
    try {
      localStorage.setItem(INLINE_KEY, on ? "1" : "0");
    } catch (e) {
      // stockage indisponible : réglage valable pour la page seulement
    }
    applyInline();
  }

  function applyInline() {
    const pr = T.parsePrUrl(location.href);
    if (pr && inlineWanted()) T.inline.enable(() => getLoader(pr));
    else T.inline.disable();
    refreshBar();
  }

  // ---------- Debug ----------

  function toggleDebugPanel() {
    if (debugPanel) {
      debugPanel.close();
      return;
    }
    if (!T.debug.enabled) T.debug.setEnabled(true);
    const list = T.h("pre", { class: "tc-debug-log" });
    const render = () => {
      const evs = T.debug.events().slice(-300);
      list.textContent = evs.map(T.debug.line).join("\n");
      list.scrollTop = list.scrollHeight;
    };
    let queued = false;
    const unsub = T.debug.onEvent(() => {
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        render();
      }, 200);
    });
    const copyBtn = T.h("button", {
      class: "tc-btn",
      onclick: async () => {
        const pr = T.parsePrUrl(location.href);
        const extra = [];
        if (pr && loaders.has(prId(pr))) {
          try {
            const l = await loaders.get(prId(pr));
            extra.push(`Chargeur : ${statusLine(l)}`);
          } catch (e) {
            extra.push(`Chargeur : échec (${e.message})`);
          }
        }
        extra.push(`Mise en forme intégrée : ${T.inline.enabled ? "active" : "inactive"} · tables de diff : ${document.querySelectorAll("table[data-diff-anchor]").length} · lignes : ${document.querySelectorAll("tr.diff-line-row").length}`);
        const text = T.debug.report(extra);
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = "Copié ✓";
        } catch (e) {
          // Presse-papiers refusé : on affiche le rapport pour une copie manuelle.
          list.textContent = text;
          copyBtn.textContent = "Sélectionne et copie le texte";
        }
        setTimeout(() => (copyBtn.textContent = "Copier le rapport"), 2500);
      },
    }, "Copier le rapport");
    const el = T.h("div", { class: "tc-debug" },
      T.h("div", { class: "tc-debug-head" },
        T.h("strong", {}, "Debug TcPR"),
        T.h("span", { class: "tc-spacer" }),
        copyBtn,
        T.h("button", { class: "tc-btn", onclick: () => { T.debug.clear(); render(); } }, "Vider"),
        T.h("button", { class: "tc-btn", onclick: () => { T.debug.setEnabled(false); debugPanel.close(); } }, "Désactiver"),
        T.h("button", { class: "tc-btn", title: "Fermer (le journal continue)", onclick: () => debugPanel.close() }, "✕")),
      list);
    document.body.append(el);
    debugPanel = {
      close() {
        unsub();
        el.remove();
        debugPanel = null;
        refreshBar();
      },
    };
    render();
    refreshBar();
  }

  // ---------- Barre d'outils ----------

  function refreshBar() {
    if (!bar) return;
    bar.inlineBtn.setAttribute("aria-pressed", String(T.inline.enabled));
    bar.inlineBtn.textContent = T.inline.enabled ? "TwinCAT : intégré ✓" : "TwinCAT : intégré";
    bar.panelBtn.setAttribute("aria-pressed", String(!!overlay));
    bar.debugBtn.setAttribute("aria-pressed", String(!!debugPanel));
    bar.debugBtn.classList.toggle("tc-on", T.debug.enabled);
  }

  function buildBar() {
    const inlineBtn = T.h("button", {
      class: "tc-btn tc-btn-main",
      title: "Mettre en forme les fichiers TwinCAT directement dans le diff (icône de l'extension)",
      onclick: () => setInlineWanted(!T.inline.enabled),
    });
    const panelBtn = T.h("button", { class: "tc-btn", title: "Vue d'ensemble en panneau (Alt+T)", onclick: () => (overlay ? closePanel() : openPanel(false)) }, "Panneau");
    const debugBtn = T.h("button", { class: "tc-btn", title: "Mode debug : journal des temps de chargement", onclick: toggleDebugPanel }, "🐞");
    const el = T.h("div", { class: "tc-bar" }, inlineBtn, panelBtn, debugBtn);
    return { el, inlineBtn, panelBtn, debugBtn };
  }

  function sync() {
    const pr = T.parsePrUrl(location.href);
    const id = pr ? prId(pr) : null;
    if (id !== currentPr) {
      // Changement de PR sans rechargement : états de la précédente oubliés.
      currentPr = id;
      T.inline.reset();
      if (overlay) closePanel();
      if (pr) T.debug.log("page", `PR ${id}`, { vue: location.pathname.split("/").pop() });
    }
    if (pr && !bar) {
      bar = buildBar();
      document.body.append(bar.el);
    } else if (!pr && bar) {
      bar.el.remove();
      bar = null;
    }
    if (pr && inlineWanted() && !T.inline.enabled) applyInline();
    if (!pr && T.inline.enabled) T.inline.disable();
    refreshBar();
  }

  // Icône de l'extension : active ou coupe la mise en forme intégrée.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "tcpr-toggle" && T.parsePrUrl(location.href)) setInlineWanted(!T.inline.enabled);
  });

  document.addEventListener("keydown", (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "t" || e.key === "T") && T.parsePrUrl(location.href)) {
      e.preventDefault();
      if (overlay) closePanel();
      else openPanel(e.shiftKey);
    }
  });

  sync();
  setInterval(sync, 1000);
})(typeof globalThis !== "undefined" ? globalThis : this);
