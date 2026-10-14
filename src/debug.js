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

  const state = { enabled: readFlag(), t0: now(), events: [], listeners: new Set() };

  function fmt(ms) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
  }

  // Ajoute un événement. `data` : petit objet de valeurs simples (durées, tailles, compteurs).
  function log(cat, msg, data) {
    if (!state.enabled) return;
    const ev = { t: now() - state.t0, cat, msg, data: data || null };
    state.events.push(ev);
    if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
    for (const l of state.listeners) l(ev);
  }

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
    if (on) log("debug", "mode debug activé");
  }

  function line(ev) {
    const d = ev.data
      ? " " + Object.entries(ev.data).map(([k, v]) => `${k}=${k === "ms" ? fmt(v) : v}`).join(" ")
      : "";
    return `${fmt(ev.t).padStart(9)}  [${ev.cat}] ${ev.msg}${d}`;
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
      `TcPR Viewer ${root.TcPr && root.TcPr.SCRIPT_VERSION} · rapport debug`,
      `Page : ${typeof location !== "undefined" ? location.pathname : "?"}`,
      `Navigateur : ${typeof navigator !== "undefined" ? navigator.userAgent.replace(/^.*(Chrome\/[\d.]+).*$/, "$1") : "?"}`,
      `Événements : ${state.events.length}`,
    ];
    if (extra) head.push(...extra);
    const synth = Object.entries(byCat).map(
      ([c, s]) => `  ${c.padEnd(10)} ${String(s.n).padStart(5)} × · total ${fmt(s.ms).padStart(9)} · max ${fmt(s.max)} (${s.maxMsg})`
    );
    return [...head, "", "Synthèse (étapes chronométrées) :", ...synth, "", "Journal :", ...state.events.map(line)].join("\n");
  }

  const api = {
    debug: {
      get enabled() {
        return state.enabled;
      },
      setEnabled,
      log,
      time,
      report,
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
