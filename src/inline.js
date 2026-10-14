// Mise en forme TwinCAT directement dans le diff GitHub (vue « Files changed » en React).
//
// Principe : on ne recrée aucune ligne. Les lignes de GitHub restent en place (les commentaires
// et le bouton « + » continuent de fonctionner, accrochés aux vraies lignes du fichier) ;
// on se contente de :
//   - masquer les lignes de bruit et d'échafaudage XML (attribut data-tcr-hide sur la ligne) ;
//   - afficher le ST sans l'enveloppe CDATA, coloré (span .tcr-code à côté du texte d'origine masqué) ;
//   - poser un bandeau « Méthode X · déclaration » au début de chaque section visible ;
//   - marquer déclaration et code par un liseré de couleur.
//
// Deux niveaux de classement des lignes :
//   - immédiat (heuristique sur le texte visible), sans rien télécharger ;
//   - exact (lines.js sur le fichier complet), dès que le chargeur l'a fourni : immédiat pour
//     un fichier ajouté ou supprimé (déjà entier dans le .diff), téléchargement unique sinon.
//
// Seuls des attributs data-tcr-* et des éléments de classe tcr-* sont ajoutés, pour coexister
// avec le rendu React de GitHub ; un MutationObserver réapplique quand GitHub redessine.

(function (root) {
  const T = root.TcPr;
  const PLC_EXT_RE = /\.(tcpou|tcdut|tcgvl|tcio)$/i; // objets PLC : code ST dans des CDATA
  const ATTRS = ["data-tcr-hide", "data-tcr-part", "data-tcr-dim", "data-tcr-code", "data-tcr-stamp"];

  let enabled = false;
  let getLoader = null; // () => Promise<loader> de la PR courante
  let loaderPromise = null;
  let mutationObs = null;
  let viewObs = null;
  const files = new Map(); // chemin -> état du fichier
  let queued = false;
  const dirty = new Set();

  // ---------- Lecture du DOM de GitHub ----------

  function tablePath(table) {
    const m = /^Diff for: (.+)$/.exec(table.getAttribute("aria-label") || "");
    return m ? m[1].trim() : null;
  }

  function cellInfo(td) {
    const m = /l:(\w+)-r:(\w+)/.exec(td.getAttribute("data-diff-line-key") || "");
    if (!m) return null;
    const l = m[1] === "null" ? null : +m[1];
    const r = m[2] === "null" ? null : +m[2];
    const type = l === null ? "+" : r === null ? "-" : "=";
    const left = td.getAttribute("data-diff-side") === "left";
    const useBase = type === "-" || (type === "=" && left && td.parentElement.querySelectorAll("td.diff-text-cell").length > 1);
    const code = td.querySelector("code.diff-text");
    const inner = code && code.querySelector(".diff-text-inner");
    if (!inner) return null;
    return { td, code, inner, type, side: useBase ? "base" : "head", line: useBase ? l : r, text: inner.textContent };
  }

  // ---------- Classement heuristique (texte seul, sans le fichier complet) ----------

  const OBJ_LABELS = { POU: "POU", DUT: "DUT", GVL: "GVL", Itf: "Interface", Method: "Méthode", Property: "Propriété", Action: "Action", Transition: "Transition" };

  function newHeuristic() {
    return { obj: null, acc: null, part: null };
  }

  function sectionLabel(h) {
    return [h.obj, h.acc].filter(Boolean).join(" · ") + (h.part === "decl" ? " · déclaration" : " · implémentation");
  }

  // Décide du traitement d'une ligne d'après son texte et l'état courant (mis à jour en place).
  function quickDecide(text, h) {
    const t = text.trim();
    if (/^<\/?LineIds?\b/.test(t)) return { role: "noise" };
    if (/^<\?xml\b/.test(t) || /^<\/?TcPlcObject\b/.test(t)) return { role: "scaffold" };
    let m = /^<(POU|DUT|GVL|Itf|Method|Property|Action|Transition|Get|Set)\b[^>]*>$/.exec(t);
    if (m) {
      const name = (/\sName="([^"]*)"/.exec(t) || [])[1] || "";
      if (m[1] === "Get" || m[1] === "Set") h.acc = m[1];
      else if (["POU", "DUT", "GVL", "Itf"].includes(m[1])) {
        h.obj = name;
        h.acc = null;
      } else {
        h.obj = `${OBJ_LABELS[m[1]]} ${name}`;
        h.acc = null;
      }
      h.part = null;
      return { role: "scaffold" };
    }
    if (/^<\/(Get|Set)>$/.test(t)) {
      h.acc = null;
      return { role: "scaffold" };
    }
    if (/^<\/(POU|DUT|GVL|Itf|Method|Property|Action|Transition)>$/.test(t)) return { role: "scaffold" };
    if (/^<\/?(Implementation|Folder)\b[^>]*>$/.test(t) || /^<ST><!\[CDATA\[\]\]><\/ST>$/.test(t)) return { role: "scaffold" };
    if (/^\]\]><\/(Declaration|ST)>$/.test(t)) {
      h.part = null;
      return { role: "scaffold" };
    }
    m = /^(\s*)<(Declaration|ST)><!\[CDATA\[/.exec(text);
    if (m) {
      h.part = m[2] === "Declaration" ? "decl" : "impl";
      const part = h.part;
      const label = sectionLabel(h);
      let code = text.slice(m[0].length);
      const close = /\]\]><\/(Declaration|ST)>\s*$/.exec(code);
      if (close) {
        code = code.slice(0, close.index);
        h.part = null;
      }
      return { role: "code", code, part, label };
    }
    if (h.part) {
      const part = h.part;
      const label = sectionLabel(h);
      let code = text;
      const close = /\]\]><\/(Declaration|ST)>\s*$/.exec(code);
      if (close) {
        code = code.slice(0, close.index);
        h.part = null;
      }
      return { role: "code", code, part, label };
    }
    return { role: "unknown" };
  }

  // Balise ouvrante avec au moins un attribut autre que Name, Id ou les versions (bruit).
  function isInformative(text) {
    const t = text.trim();
    if (!/^<\w+\s/.test(t)) return false;
    const rest = t.replace(/\s(Name|Id|Version|ProductVersion|TcVersion)="[^"]*"/g, "");
    return /\s[\w:]+="/.test(rest);
  }

  // ---------- Classement exact (fichier complet) ----------

  function exactDecide(st, c) {
    const cls = st.exact && st.exact[c.side];
    const info = cls && cls.lines[c.line];
    if (!info) return null;
    if (info.role === "code") {
      return { role: "code", code: info.code, part: /#decl$/.test(info.section) ? "decl" : "impl", label: info.label, section: info.section };
    }
    return { role: info.role };
  }

  // ---------- État par fichier et chargement exact ----------

  function fileState(path) {
    let st = files.get(path);
    if (!st) {
      st = { path, plc: PLC_EXT_RE.test(path), exact: null, version: 0, requested: false };
      files.set(path, st);
    }
    return st;
  }

  function requestExact(st, table) {
    if (st.requested || !st.plc || !getLoader) return;
    st.requested = true;
    if (!loaderPromise) loaderPromise = getLoader();
    loaderPromise
      .then((loader) => {
        const k = loader.files.findIndex((f) => f.path === st.path);
        if (k < 0) throw new Error("fichier absent du .diff");
        return loader.load(k);
      })
      .then((entry) => {
        if (entry.error) throw new Error(entry.error);
        const end = T.debug.time("intégré", `classement exact ${st.path}`);
        st.exact = {
          base: entry.base ? T.classifyLines(st.path, entry.base) : null,
          head: entry.head ? T.classifyLines(st.path, entry.head) : null,
        };
        st.version++;
        end();
        markDirty(table);
      })
      .catch((e) => T.debug.log("intégré", `classement exact impossible ${st.path}`, { erreur: e.message }));
  }

  // ---------- Application sur une table ----------

  function ensureCodeSpan(code) {
    let span = code.querySelector(":scope > .tcr-code");
    if (!span) {
      span = document.createElement("span");
      span.className = "tcr-code";
      code.append(span);
    }
    return span;
  }

  function setBanner(td, label) {
    let b = td.querySelector(":scope > .tcr-banner");
    if (!label) {
      if (b) b.remove();
      return;
    }
    if (!b) {
      b = document.createElement("div");
      b.className = "tcr-banner";
      td.prepend(b);
    }
    if (b.textContent !== label) b.textContent = label;
  }

  function clearRow(tr) {
    for (const a of ATTRS) tr.removeAttribute(a);
    for (const el of tr.querySelectorAll("[data-tcr-part],[data-tcr-code]")) {
      el.removeAttribute("data-tcr-part");
      el.removeAttribute("data-tcr-code");
    }
    for (const el of tr.querySelectorAll(".tcr-code,.tcr-banner")) el.remove();
  }

  function processTable(table) {
    const path = tablePath(table);
    if (!path || !T.isTwinCatPath(path)) return;
    const st = fileState(path);
    requestExact(st, table);
    const stamp = st.exact ? `x${st.version}` : "h";
    const end = T.debug.time("intégré", `passe ${path.split("/").pop()}`, { mode: st.exact ? "exact" : "heuristique" });

    const rows = table.querySelectorAll("tr.diff-line-row");
    const h = newHeuristic();
    let lastSection = null;
    let written = 0;
    let hidden = 0;

    // Passe 1 : décision par cellule.
    const decided = [];
    for (const tr of rows) {
      const cells = [...tr.querySelectorAll("td.diff-text-cell[data-diff-line-key]")];
      if (!cells.length) {
        // Ligne de hunk (@@ ... @@) : le contexte heuristique repart de zéro.
        lastSection = null;
        decided.push({ tr, hunk: true });
        continue;
      }
      const ds = cells.map((td) => {
        const c = cellInfo(td);
        if (!c) return null;
        let d = exactDecide(st, c);
        const q = st.plc ? quickDecide(c.text, h) : { role: "unknown" };
        if (!d) d = q;
        return { c, d };
      });
      decided.push({ tr, ds });
    }

    // Passe 2 : bruit apparié (ligne supprimée / ajoutée identiques au bruit près : GUID, version XAE).
    let block = [];
    const flush = () => {
      const minus = new Map();
      for (const x of block) if (x.c.type === "-") minus.set(T.noiseKey(x.c.text), (minus.get(T.noiseKey(x.c.text)) || []).concat(x));
      for (const x of block) {
        if (x.c.type !== "+") continue;
        const list = minus.get(T.noiseKey(x.c.text));
        if (list && list.length) {
          const y = list.shift();
          if (x.c.text.trim() !== y.c.text.trim()) {
            x.d = { role: "noise" };
            y.d = { role: "noise" };
          }
        }
      }
      block = [];
    };
    for (const row of decided) {
      if (row.hunk || !row.ds) {
        flush();
        continue;
      }
      for (const x of row.ds) {
        if (!x) continue;
        if (x.c.type === "=") flush();
        else block.push(x);
      }
    }
    flush();

    // Passe 3 : écriture dans le DOM (seulement si la décision a changé).
    for (const row of decided) {
      const { tr } = row;
      if (row.hunk) continue;
      const main = row.ds.find(Boolean);
      if (!main) continue;
      const d = main.d;
      // Échafaudage : toujours masqué, sauf une ligne modifiée qui porte une vraie information
      // (attribut autre que Name/Id, ex. SpecialFunc) : gardée, grisée.
      const keep = d.role === "scaffold" && main.c.type !== "=" && isInformative(main.c.text);
      const hide = d.role === "noise" || (d.role === "scaffold" && !keep);
      const dim = keep;
      let banner = null;
      if (d.role === "code") {
        const sec = d.section || d.label;
        if (sec !== lastSection) banner = d.label;
        lastSection = sec;
      }
      const key = `${stamp}|${hide}|${dim}|${d.role}|${d.part || ""}|${banner || ""}|${d.code === undefined ? "" : d.code}`;
      if (tr.getAttribute("data-tcr-stamp") === key) continue;
      written++;
      tr.setAttribute("data-tcr-stamp", key);
      tr.toggleAttribute("data-tcr-hide", hide);
      tr.toggleAttribute("data-tcr-dim", dim);
      if (hide) hidden++;
      for (const x of row.ds) {
        if (!x) continue;
        const { c } = x;
        if (x.d.role === "code" && x.d.code !== undefined) {
          c.td.setAttribute("data-tcr-part", x.d.part);
          c.code.setAttribute("data-tcr-code", "");
          const span = ensureCodeSpan(c.code);
          const state = { inBlock: false };
          span.replaceChildren(...T.highlightSt(x.d.code, state));
        } else {
          c.td.removeAttribute("data-tcr-part");
          c.code.removeAttribute("data-tcr-code");
          const span = c.code.querySelector(":scope > .tcr-code");
          if (span) span.remove();
        }
      }
      setBanner(main.c.td, banner);
    }
    end({ lignes: rows.length, écrites: written, masquées: hidden });
  }

  // ---------- Ordonnancement ----------

  function markDirty(table) {
    if (table) dirty.add(table);
    if (queued) return;
    queued = true;
    setTimeout(runQueue, 60);
  }

  // Traite les tables en attente par tranches de ~12 ms pour ne pas figer la page.
  function runQueue() {
    queued = false;
    if (!enabled) return;
    const t0 = performance.now();
    for (const table of [...dirty]) {
      dirty.delete(table);
      if (!table.isConnected || !isNear(table)) continue;
      processTable(table);
      if (performance.now() - t0 > 12 && dirty.size) {
        markDirty(null);
        return;
      }
    }
  }

  // Table à moins d'un écran et demi de la zone visible (seules celles-là sont traitées).
  function isNear(table) {
    const r = table.getBoundingClientRect();
    const margin = 1500;
    return r.bottom > -margin && r.top < (window.innerHeight || 800) + margin;
  }

  function isOurs(node) {
    return node.nodeType === 1 && typeof node.className === "string" && /\btcr-/.test(node.className);
  }

  function watchTables() {
    for (const table of document.querySelectorAll("table[data-diff-anchor]")) {
      if (table.tcrWatched) continue;
      const path = tablePath(table);
      if (!path || !T.isTwinCatPath(path)) continue;
      table.tcrWatched = true;
      viewObs.observe(table);
      dirty.add(table);
    }
  }

  function onMutations(records) {
    let relevant = false;
    for (const r of records) {
      if (r.target.nodeType === 1 && r.target.closest && r.target.closest(".tcr-code,.tcr-banner")) continue;
      const nodes = [...r.addedNodes, ...r.removedNodes];
      if (nodes.length && nodes.every(isOurs)) continue;
      relevant = true;
      const table = r.target.nodeType === 1 && r.target.closest ? r.target.closest("table[data-diff-anchor]") : null;
      if (table) dirty.add(table);
    }
    if (!relevant) return;
    watchTables();
    markDirty(null);
  }

  // ---------- Activation ----------

  function enable(loaderGetter) {
    if (enabled) return;
    enabled = true;
    getLoader = loaderGetter;
    loaderPromise = null;
    T.debug.log("intégré", "mise en forme intégrée activée", { tables: document.querySelectorAll("table[data-diff-anchor]").length });
    viewObs = new IntersectionObserver(
      (items) => {
        for (const it of items) {
          // Simple signal : isNear() décide au moment du traitement.
          if (it.isIntersecting) markDirty(it.target);
        }
      },
      { rootMargin: "1500px 0px" }
    );
    mutationObs = new MutationObserver(onMutations);
    mutationObs.observe(document.body, { childList: true, subtree: true });
    watchTables();
    markDirty(null);
    if (!document.querySelector("table[data-diff-anchor]")) {
      T.debug.log("intégré", "aucune table de diff de la nouvelle vue GitHub sur cette page (onglet « Files changed » ?)");
    }
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    if (mutationObs) mutationObs.disconnect();
    if (viewObs) viewObs.disconnect();
    mutationObs = viewObs = null;
    dirty.clear();
    for (const table of document.querySelectorAll("table[data-diff-anchor]")) table.tcrWatched = false;
    for (const tr of document.querySelectorAll("tr[data-tcr-stamp]")) clearRow(tr);
    T.debug.log("intégré", "mise en forme intégrée désactivée");
  }

  // Changement de PR (navigation sans rechargement) : on oublie les états de fichier.
  function reset() {
    files.clear();
    loaderPromise = null;
  }

  root.TcPr = Object.assign(root.TcPr || {}, {
    inline: {
      enable,
      disable,
      reset,
      get enabled() {
        return enabled;
      },
      _quickDecide: quickDecide,
      _newHeuristic: newHeuristic,
    },
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
