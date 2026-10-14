// Mode debug : journal horodaté des étapes (requêtes, analyse, rendu, transformation du diff),
// affichable en direct et copiable en un rapport texte pour diagnostiquer les lenteurs.
// Le rapport contient chemins de fichiers et nom du dépôt, jamais le contenu des fichiers.

(function (root) {
  const KEY = "tcpr-debug";
  const MAX_EVENTS = 3000;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function readFlag() {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  const tr = (k, p) => (root.TcPr && root.TcPr.t ? root.TcPr.t(k, p) : k);
  const JOURNAL_KEY = "tcpr-debug-journal";
  const JOURNAL_LINES = 400;

  // Journal de la session précédente (lu avant d'être écrasé) : seul témoin d'une page figée puis quittée.
  function readPrevious() {
    try {
      return localStorage.getItem(JOURNAL_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  const state = { enabled: readFlag(), t0: now(), events: [], listeners: new Set(), previous: readPrevious(), saveQueued: false };

  function save() {
    state.saveQueued = false;
    try {
      const lines = state.events.slice(-JOURNAL_LINES).map(line);
      const lang = root.TcPr && root.TcPr.i18n ? root.TcPr.i18n.lang : "fr";
      const head = tr("report.saved", { date: new Date().toLocaleString(lang === "fr" ? "fr-FR" : "en-GB"), page: typeof location !== "undefined" ? location.pathname : "" });
      localStorage.setItem(JOURNAL_KEY, [head, ...lines].join("\n"));
    } catch (e) {
      // quota ou stockage indisponible : tant pis pour la sauvegarde
    }
  }

  function scheduleSave(now) {
    if (now) return save();
    if (state.saveQueued) return;
    state.saveQueued = true;
    setTimeout(save, 1000);
  }

  function fmt(ms) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
  }

  // Ajoute un événement. `data` : petit objet de valeurs simples (durées, tailles, compteurs).
  // flush : sauvegarde immédiate (repère posé juste avant un traitement qui pourrait figer la page).
  function log(cat, msg, data, flush) {
    if (!state.enabled) return;
    const ev = { t: now() - state.t0, cat, msg, data: data || null };
    state.events.push(ev);
    if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
    for (const l of state.listeners) l(ev);
    scheduleSave(!!flush);
  }

  // Repère de début d'un traitement lourd, sauvegardé tout de suite.
  function mark(cat, msg, data) {
    log(cat, tr("log.start", { msg }), data, true);
  }

  // Tâches longues (page bloquée plus de 200 ms), signalées par le navigateur une fois terminées.
  function watchLongTasks() {
    try {
      if (typeof PerformanceObserver === "undefined") return;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.duration >= 200) log("gel", tr("log.longTask"), { ms: Math.round(e.duration) });
        }
      }).observe({ type: "longtask", buffered: false });
    } catch (e) {
      // type « longtask » non pris en charge
    }
  }
  watchLongTasks();

  // Chronomètre : const end = time("réseau", "diff"); ... end({ ko: 12 });
  function time(cat, msg, data) {
    if (!state.enabled) return () => {};
    const t = now();
    return (more) => log(cat, msg, Object.assign({ ms: Math.round(now() - t) }, data, more));
  }

  function setEnabled(on) {
    state.enabled = !!on;
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch (e) {
      // stockage indisponible : le réglage vaut pour la page seulement
    }
    if (on) log("debug", tr("log.enabled"));
  }

  function line(ev) {
    // Catégories et clés de données traduites à l'affichage (gardées en français dans le code).
    const key = (k) => (root.TcPr && root.TcPr.i18n ? root.TcPr.i18n.dataKey(k) : k);
    const d = ev.data
      ? " " + Object.entries(ev.data).map(([k, v]) => `${key(k)}=${k === "ms" ? fmt(v) : v}`).join(" ")
      : "";
    return `${fmt(ev.t).padStart(9)}  [${tr(`cat.${ev.cat}`)}] ${ev.msg}${d}`;
  }

  // Synthèse par catégorie + journal complet.
  function report(extra) {
    const byCat = {};
    for (const ev of state.events) {
      if (!ev.data || typeof ev.data.ms !== "number") continue;
      const c = (byCat[ev.cat] = byCat[ev.cat] || { n: 0, ms: 0, max: 0, maxMsg: "" });
      c.n++;
      c.ms += ev.data.ms;
      if (ev.data.ms > c.max) {
        c.max = ev.data.ms;
        c.maxMsg = ev.msg;
      }
    }
    const head = [
      tr("report.title", { name: "TwinCAT Preview for GitHub", v: root.TcPr && root.TcPr.SCRIPT_VERSION }),
      tr("report.page", { p: typeof location !== "undefined" ? location.pathname : "?" }),
      tr("report.browser", { b: typeof navigator !== "undefined" ? navigator.userAgent.replace(/^.*(Chrome\/[\d.]+).*$/, "$1") : "?" }),
      tr("report.events", { n: state.events.length }),
    ];
    if (extra) head.push(...extra);
    const synth = Object.entries(byCat).map(
      ([c, s]) => `  ${tr(`cat.${c}`).padEnd(10)} ${String(s.n).padStart(5)} × · total ${fmt(s.ms).padStart(9)} · max ${fmt(s.max)} (${s.maxMsg})`
    );
    return [...head, "", tr("report.synth"), ...synth, "", tr("report.log"), ...state.events.map(line)].join("\n");
  }

  const api = {
    debug: {
      get enabled() {
        return state.enabled;
      },
      setEnabled,
      log,
      mark,
      time,
      report,
      previousReport: () => state.previous,
      line,
      events: () => state.events.slice(),
      clear: () => (state.events = []),
      onEvent: (fn) => {
        state.listeners.add(fn);
        return () => state.listeners.delete(fn);
      },
    },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
