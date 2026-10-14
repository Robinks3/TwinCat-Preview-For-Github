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
      for (const m of s.textContent.matchAll(/"head(?:Oid|Sha)"\s*:\s*"([0-9a-f]{40})"/g)) shas.add(m[1]);
    }
    return shas.size === 1 ? [...shas][0] : null;
  }

  // Branche de tête affichée dans l'en-tête de la PR (« ... into base from tête ») : dernier lien
  // de branche du bloc. Toujours présente, y compris quand on arrive sur « Files changed » sans
  // rechargement (les données embarquées ne contiennent alors pas le SHA).
  function headRefFromPage() {
    for (const box of document.querySelectorAll('[class*="branches"]')) {
      const links = [...box.querySelectorAll('a[href*="/tree/"]')];
      const last = links[links.length - 1];
      const m = last && /^\/([^/]+)\/([^/]+)\/tree\/(.+)$/.exec(last.getAttribute("href") || "");
      if (m && links.length >= 2) return { owner: m[1], repo: m[2], ref: decodeURIComponent(m[3]) };
    }
    return null;
  }

  // Un chargeur par PR, partagé par la vue intégrée et le panneau, gardé pour la page :
  // rien n'est téléchargé deux fois.
  function getLoader(pr, forceReload) {
    const id = prId(pr);
    if (forceReload || !loaders.has(id)) {
      const sha = headShaFromPage();
      const ref = headRefFromPage();
      T.debug.log("chargeur", T.t("log.loaderCreate", { id }), {
        sha_page: sha ? sha.slice(0, 7) : T.t("absent"),
        branche: ref ? `${ref.owner}/${ref.repo}:${ref.ref}` : T.t("absente"),
      });
      const p = T.createPrLoader(pr, T.isTwinCatPath, {
        headShaHint: sha,
        headRefHint: ref,
        onProgress: (t) => progressListeners.forEach((l) => l(t)),
      });
      p.catch((e) => {
        T.debug.log("chargeur", T.t("log.fail"), { erreur: e.message });
        loaders.delete(id); // un échec ne doit pas rester en cache
      });
      loaders.set(id, p);
    }
    return loaders.get(id);
  }

  // ---------- Panneau ----------

  function closePanel() {
    if (overlay) {
      overlay.destroy();
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
        current.showMessage(T.t("panel.noFiles"));
        current.setStatus("");
        return;
      }
      const refresh = () => {
        if (overlay === current) current.setStatus(statusLine(loader));
      };
      current.setList(loader.files, loader.load, refresh);
      refresh();
    } catch (e) {
      if (overlay === current) current.showMessage(T.t("panel.loadFailed", { err: e.message }), true);
    }
  }

  // Ligne d'état : nombre de fichiers, téléchargements faits / nécessaires, source du SHA, temps du diff.
  function statusLine(loader) {
    const s = loader.stats;
    const n = loader.files.length;
    const sec = (ms) => `${T.i18n.num(ms / 1000, 1)} s`;
    const sha = s.headSha ? ` · SHA ${s.headSha.slice(0, 7)} (${T.t(`sha.src.${s.shaSource}`)})` : "";
    return [
      T.tn("status.files", n),
      T.t("status.fetched", { fetched: s.fetched, toFetch: s.toFetch }),
      T.t("status.diff", { sec: sec(s.diffMs), kb: s.diffKb }),
    ].join(" · ") + sha;
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
            extra.push(T.t("report.loader", { s: statusLine(l) }));
          } catch (e) {
            extra.push(T.t("report.loaderFail", { err: e.message }));
          }
        }
        extra.push(T.t("report.inline", {
          state: T.t(T.inline.enabled ? "report.on" : "report.off"),
          tables: document.querySelectorAll("table[data-diff-anchor]").length,
          rows: document.querySelectorAll("tr.diff-line-row").length,
        }));
        const text = T.debug.report(extra);
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = T.t("debug.copied");
        } catch (e) {
          // Presse-papiers refusé : on affiche le rapport pour une copie manuelle.
          list.textContent = text;
          copyBtn.textContent = T.t("debug.selectCopy");
        }
        setTimeout(() => (copyBtn.textContent = T.t("debug.copy")), 2500);
      },
    }, T.t("debug.copy"));
    const el = T.h("div", { class: "tc-debug" },
      T.h("div", { class: "tc-debug-head" },
        T.h("strong", {}, T.t("debug.title")),
        T.h("span", { class: "tc-spacer" }),
        copyBtn,
        T.h("button", {
          class: "tc-btn",
          title: T.t("debug.previousTitle"),
          onclick: async (e) => {
            const prev = T.debug.previousReport();
            const btn = e.currentTarget;
            if (!prev) {
              btn.textContent = T.t("debug.none");
            } else {
              try {
                await navigator.clipboard.writeText(prev);
                btn.textContent = T.t("debug.copied");
              } catch (err) {
                list.textContent = prev;
                btn.textContent = T.t("debug.shownBelow");
              }
            }
            setTimeout(() => (btn.textContent = T.t("debug.previous")), 2500);
          },
        }, T.t("debug.previous")),
        T.h("button", { class: "tc-btn", onclick: () => { T.debug.clear(); render(); } }, T.t("debug.clear")),
        T.h("button", { class: "tc-btn", onclick: () => { T.debug.setEnabled(false); debugPanel.close(); } }, T.t("debug.disable")),
        T.h("button", { class: "tc-btn", title: T.t("debug.closeTitle"), onclick: () => debugPanel.close() }, "✕")),
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
    bar.inlineBtn.textContent = T.t(T.inline.enabled ? "bar.inlineOn" : "bar.inline");
    bar.panelBtn.setAttribute("aria-pressed", String(!!overlay));
    bar.debugBtn.setAttribute("aria-pressed", String(!!debugPanel));
    bar.debugBtn.classList.toggle("tc-on", T.debug.enabled);
  }

  function buildBar() {
    const inlineBtn = T.h("button", {
      class: "tc-btn tc-btn-main",
      title: T.t("bar.inlineTitle"),
      onclick: () => setInlineWanted(!T.inline.enabled),
    });
    const panelBtn = T.h("button", { class: "tc-btn", title: T.t("bar.panelTitle"), onclick: () => (overlay ? closePanel() : openPanel(false)) }, T.t("bar.panel"));
    const debugBtn = T.h("button", { class: "tc-btn", title: T.t("bar.debugTitle"), onclick: toggleDebugPanel }, "🐞");
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
