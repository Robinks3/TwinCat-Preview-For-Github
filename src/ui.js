// Rendu de la vue TwinCAT. Tout le contenu venant de la PR passe par textContent (jamais innerHTML).

(function (root) {
  const T = root.TcPr;

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  // ---------- Coloration ST (légère, ligne par ligne) ----------

  const ST_KEYWORDS = new Set(
    (
      "PROGRAM END_PROGRAM FUNCTION_BLOCK END_FUNCTION_BLOCK FUNCTION END_FUNCTION METHOD END_METHOD PROPERTY END_PROPERTY " +
      "INTERFACE END_INTERFACE ACTION END_ACTION TYPE END_TYPE STRUCT END_STRUCT UNION END_UNION EXTENDS IMPLEMENTS " +
      "VAR VAR_INPUT VAR_OUTPUT VAR_IN_OUT VAR_GLOBAL VAR_TEMP VAR_STAT VAR_INST VAR_EXTERNAL VAR_CONFIG END_VAR CONSTANT RETAIN PERSISTENT " +
      "PUBLIC PRIVATE PROTECTED INTERNAL ABSTRACT FINAL AT " +
      "IF THEN ELSIF ELSE END_IF CASE OF END_CASE FOR TO BY DO END_FOR WHILE END_WHILE REPEAT UNTIL END_REPEAT EXIT CONTINUE RETURN JMP " +
      "AND AND_THEN OR OR_ELSE XOR NOT MOD TRUE FALSE THIS SUPER ARRAY POINTER REFERENCE REF REF= ADR SIZEOF __NEW __DELETE __QUERYINTERFACE __ISVALIDREF"
    ).split(" ")
  );
  const ST_TYPES = new Set(
    "BOOL BYTE WORD DWORD LWORD SINT USINT INT UINT DINT UDINT LINT ULINT REAL LREAL TIME LTIME DATE TIME_OF_DAY TOD DATE_AND_TIME DT STRING WSTRING ANY BIT XWORD UXINT __UXINT __XINT PVOID".split(" ")
  );

  // Retourne [fragments], nouvel état (dans un commentaire bloc ou non).
  function highlightSt(line, state) {
    const out = [];
    let i = 0;
    let inBlock = state.inBlock;
    const push = (cls, s) => out.push(cls ? h("span", { class: cls }, s) : s);
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf("*)", i);
        const stop = end < 0 ? line.length : end + 2;
        push("tc-com", line.slice(i, stop));
        i = stop;
        inBlock = end < 0;
        continue;
      }
      const rest = line.slice(i);
      let m;
      if (rest.startsWith("(*")) {
        inBlock = true;
        push("tc-com", "(*");
        i += 2;
      } else if (rest.startsWith("//")) {
        push("tc-com", rest);
        i = line.length;
      } else if ((m = /^'(?:\$.|[^'])*'?|^"(?:\$.|[^"])*"?/.exec(rest))) {
        push("tc-str", m[0]);
        i += m[0].length;
      } else if ((m = /^\{[^}]*\}?/.exec(rest))) {
        push("tc-pragma", m[0]);
        i += m[0].length;
      } else if ((m = /^(?:[A-Za-z_]+#)?(?:16#[0-9A-Fa-f_]+|2#[01_]+|8#[0-7_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?|\d+(?:[dhms]|ms)\S*)/.exec(rest)) && !/[A-Za-z_]/.test(line[i - 1] || "")) {
        push("tc-num", m[0]);
        i += m[0].length;
      } else if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest))) {
        const up = m[0].toUpperCase();
        push(ST_KEYWORDS.has(up) ? "tc-kw" : ST_TYPES.has(up) ? "tc-type" : null, m[0]);
        i += m[0].length;
      } else {
        push(null, line[i]);
        i++;
      }
    }
    state.inBlock = inBlock;
    return out;
  }

  // ---------- Rendu ----------

  const STATUS_LABELS = {
    added: "ajouté",
    removed: "supprimé",
    modified: "modifié",
    renamed: "renommé",
    unchanged: "inchangé",
    noise: "bruit XML seulement",
  };

  function badge(status) {
    return h("span", { class: `tc-badge tc-badge-${status}` }, STATUS_LABELS[status] || status);
  }

  function renderCode(sec, opts, onExpand) {
    const table = h("table", { class: "tc-code" });
    const state = { inBlock: false };
    const rows = T.withContext(sec.ops, opts.expanded.has(sec.key) ? Infinity : 3);
    for (const o of rows) {
      if (o.t === "skip") {
        table.append(
          h("tr", { class: "tc-skip", onclick: () => onExpand(sec.key), title: "Afficher tout" },
            h("td", { colspan: 4 }, `⋯ ${o.count} ligne${o.count > 1 ? "s" : ""} inchangée${o.count > 1 ? "s" : ""}`))
        );
        state.inBlock = false;
        continue;
      }
      const cls = o.t === "+" ? "tc-add" : o.t === "-" ? "tc-del" : "";
      const content = sec.lang === "st" ? highlightSt(o.text, state) : [o.text];
      table.append(
        h("tr", { class: cls },
          h("td", { class: "tc-ln" }, o.a || ""),
          h("td", { class: "tc-ln" }, o.b || ""),
          h("td", { class: "tc-sign" }, o.t === "=" ? " " : o.t),
          h("td", { class: "tc-text" }, ...content))
      );
    }
    return table;
  }

  function shortValue(v) {
    if (v === undefined) return h("span", { class: "tc-none" }, "—");
    return v.length > 160 ? h("span", { title: v }, `${v.slice(0, 160)}… (${v.length} car.)`) : v;
  }

  function renderProps(sec, opts) {
    const rows = sec.rows.filter((r) => r.t !== "=" || opts.showUnchanged || sec.status === "added" || sec.status === "removed");
    const hidden = sec.rows.length - rows.length;
    const table = h("table", { class: "tc-props" },
      h("thead", {}, h("tr", {}, h("th", {}, "Propriété"), h("th", {}, "Avant"), h("th", {}, "Après"))));
    const tbody = h("tbody");
    for (const r of rows) {
      const cls = { "+": "tc-add", "-": "tc-del", "~": "tc-mod", "=": "" }[r.t];
      tbody.append(h("tr", { class: cls }, h("td", { class: "tc-key" }, r.key), h("td", {}, shortValue(r.a)), h("td", {}, shortValue(r.b))));
    }
    table.append(tbody);
    return [table, hidden ? h("div", { class: "tc-muted" }, `${hidden} propriété${hidden > 1 ? "s" : ""} inchangée${hidden > 1 ? "s" : ""} masquée${hidden > 1 ? "s" : ""}`) : null];
  }


  // ---------- Arborescence TwinCAT ----------

  // Pastille par type d'objet, comme les icônes de l'explorateur de solution TwinCAT.
  const KIND_TAGS = {
    Method: ["M", "method"],
    Property: ["P", "property"],
    Get: ["G", "accessor"],
    Set: ["S", "accessor"],
    Action: ["A", "action"],
    Transition: ["T", "action"],
    DUT: ["DUT", "type"],
    GVL: ["GVL", "type"],
    Itf: ["I", "itf"],
    Task: ["⏱", "task"],
    Group: ["⚙", "group"],
  };

  function kindTag(node) {
    let tag = KIND_TAGS[node.kind];
    if (node.kind === "POU") {
      const w = node.label.split(" ")[0];
      tag = [{ FUNCTION_BLOCK: "FB", PROGRAM: "PRG", FUNCTION: "FUN" }[w] || "POU", "pou"];
    }
    tag = tag || [node.kind.slice(0, 3), "group"];
    return h("span", { class: `tc-kind tc-kind-${tag[1]}` }, tag[0]);
  }

  // Nom affiché sans le mot-clé déjà porté par la pastille.
  function shortLabel(node) {
    if (node.kind === "POU") return node.label.split(" ").slice(1).join(" ") || node.label;
    if (["Method", "Property", "Action", "Transition"].includes(node.kind)) return node.label.split(" ").slice(1).join(" ");
    return node.label;
  }

  function aggregate(statuses) {
    if (!statuses.length) return "unchanged";
    if (statuses.every((s) => s === "unchanged")) return "unchanged";
    if (statuses.every((s) => s === "added")) return "added";
    if (statuses.every((s) => s === "removed")) return "removed";
    return "modified";
  }

  // Texte d'un côté d'une section de code, reconstitué depuis les opérations du diff.
  function sideText(sec, side) {
    return sec.ops.filter((o) => o.t === "=" || o.t === side).map((o) => o.text).join("\n");
  }

  // Déclaration sans contenu (rien, ou VAR/END_VAR vide) : inutile à afficher.
  function isTrivialDecl(text) {
    return /^\s*(VAR\s+END_VAR\s*)?$/.test(text);
  }

  // Première ligne de la déclaration (FUNCTION_BLOCK ..., METHOD X : BOOL, PROPERTY Y : LREAL),
  // seulement pour les objets qui ont une vraie signature.
  const SIGNED_KINDS = new Set(["POU", "Method", "Property", "Itf", "DUT"]);

  function signatureOf(node) {
    if (!SIGNED_KINDS.has(node.kind)) return "";
    const decl = node.parts.find((p) => p.part === "decl" && p.kind === "code");
    if (!decl) return "";
    const side = decl.status === "removed" ? "-" : "+";
    const line = decl.ops.find((o) => (o.t === "=" || o.t === side) && o.text.trim());
    return line ? line.text.trim() : "";
  }

  function buildTree(sections) {
    const root = { children: [], byKey: new Map() };
    for (const sec of sections) {
      let parent = root;
      for (const t of sec.tree || [{ key: sec.key, kind: "Group", label: sec.label }]) {
        let node = parent.byKey.get(t.key);
        if (!node) {
          node = { key: t.key, kind: t.kind, label: t.label, parts: [], children: [], byKey: new Map() };
          parent.byKey.set(t.key, node);
          parent.children.push(node);
        }
        parent = node;
      }
      parent.parts.push(sec);
    }
    const finish = (node) => {
      node.children.forEach(finish);
      node.status = aggregate(node.parts.map((p) => p.status).concat(node.children.map((c) => c.status)));
      node.signature = signatureOf(node);
    };
    root.children.forEach(finish);
    return root.children;
  }

  // Analyse d'un fichier (modèles + diff + arbre), mise en cache par réglage « ignorer les espaces ».
  const analysisCache = new WeakMap();

  function analyze(entry, opts) {
    const cached = analysisCache.get(entry);
    if (cached && cached.ignoreWs === opts.ignoreWs) return cached.value;
    let value;
    if (entry.error) value = { error: `Impossible d'analyser ce fichier : ${entry.error}`, status: "modified" };
    else {
      const base = entry.base === null ? null : T.modelFile(entry.oldPath || entry.path, entry.base);
      const head = entry.head === null ? null : T.modelFile(entry.path, entry.head);
      const parseErr = (base && base.error) || (head && head.error);
      if (parseErr) value = { error: `XML illisible : ${parseErr}`, status: "modified" };
      else {
        const d = T.diffModels(base, head, opts);
        const m = head || base;
        value = {
          status: entry.status === "renamed" && d.status === "unchanged" ? "renamed" : d.status,
          title: m && m.title,
          noise: d.noise,
          nodes: buildTree(d.sections),
        };
      }
    }
    analysisCache.set(entry, { ignoreWs: opts.ignoreWs, value });
    return value;
  }

  const PART_LABELS = { decl: "Déclaration", impl: "Code", attrs: "Attributs", props: "Propriétés" };

  function renderPart(sec, opts, onExpand) {
    if (sec.kind === "code") {
      const before = sideText(sec, "-");
      const after = sideText(sec, "+");
      if (sec.part === "decl" && isTrivialDecl(before) && isTrivialDecl(after)) return null;
      if (sec.part === "impl" && !before.trim() && !after.trim()) return null;
    }
    const label = sec.lang === "xml" ? sec.label.replace(/^.*· /, "") : PART_LABELS[sec.part] || sec.label;
    return h("div", { class: `tc-part tc-part-${sec.part || "props"}` },
      h("div", { class: "tc-part-label" }, label, sec.status !== "unchanged" && sec.status !== "added" && sec.status !== "removed" ? badge(sec.status) : null),
      sec.kind === "code" ? renderCode(sec, opts, onExpand) : renderProps(sec, opts));
  }

  function renderNode(node, ctx, depth) {
    const { opts, onExpand, ids } = ctx;
    const id = `tcn-${ids.next++}`;
    node.domId = id;
    const parts = node.parts
      .filter((p) => p.status !== "unchanged" || opts.showUnchanged)
      .map((p) => renderPart(p, opts, onExpand))
      .filter(Boolean);
    const shownChildren = node.children.filter((c) => c.status !== "unchanged" || opts.showUnchanged);
    const hiddenChildren = node.children.length - shownChildren.length;
    const body = h("div", { class: "tc-node-body" },
      parts,
      shownChildren.map((c) => renderNode(c, ctx, depth + 1)),
      hiddenChildren ? h("div", { class: "tc-muted tc-hidden-note" }, `${hiddenChildren} élément${hiddenChildren > 1 ? "s" : ""} inchangé${hiddenChildren > 1 ? "s" : ""}`) : null);
    const empty = !parts.length && !shownChildren.length;
    const sig = node.signature && node.signature !== node.label ? node.signature : "";
    return h("details", { class: `tc-node tc-depth-${Math.min(depth, 3)}${empty ? " tc-node-empty" : ""}`, id, open: !empty },
      h("summary", { class: "tc-node-head" },
        kindTag(node),
        h("span", { class: "tc-node-name" }, shortLabel(node)),
        sig ? h("code", { class: "tc-node-sig" }, sig) : null,
        node.status !== "unchanged" ? badge(node.status) : null),
      body);
  }

  // Carte d'un fichier en deux temps, comme GitHub sur les grosses PR : l'en-tête tout de suite,
  // le contenu (analyse + diff + DOM) seulement quand la carte approche de la zone visible.
  function renderFileShell(entry, fileIdx) {
    entry.domId = `tcf-${fileIdx}`;
    const title = entry.oldPath && entry.oldPath !== entry.path ? `${entry.oldPath} → ${entry.path}` : entry.path;
    const status = entry.error ? "modified" : entry.status;
    entry.ui = {
      badge: badge(status),
      body: h("div", { class: "tc-file-body tc-file-pending" }, h("div", { class: "tc-muted tc-pad" }, "…")),
      filled: false,
    };
    const card = h("details", { class: "tc-file", id: entry.domId, open: true },
      h("summary", { class: "tc-file-head" }, h("span", { class: "tc-path" }, title), entry.ui.badge),
      entry.ui.body);
    card.tcEntry = entry;
    return card;
  }

  function fillFileBody(entry, ctx) {
    if (entry.ui.filled) return;
    entry.ui.filled = true;
    const a = analyze(entry, ctx.opts);
    const parts = [];
    if (a.error) parts.push(h("div", { class: "tc-error" }, a.error));
    else {
      if (a.noise.length) parts.push(h("div", { class: "tc-noise" }, `Bruit ignoré : ${a.noise.join(", ")}`));
      if (a.status !== "noise" || ctx.opts.showUnchanged) {
        for (const n of a.nodes) parts.push(renderNode(n, ctx, 0));
        if (!a.nodes.length) parts.push(h("div", { class: "tc-muted tc-pad" }, "Aucune section structurée."));
      }
    }
    entry.ui.badge.replaceWith((entry.ui.badge = badge(a.status)));
    entry.ui.body.classList.remove("tc-file-pending");
    entry.ui.body.replaceChildren(...parts);
  }

  // ---------- Navigation (arborescence des fichiers et de leurs membres) ----------

  function folderTree(entries) {
    const rootF = { name: "", folders: new Map(), files: [] };
    for (const e of entries) {
      const segs = e.path.split("/");
      let f = rootF;
      for (const s of segs.slice(0, -1)) {
        if (!f.folders.has(s)) f.folders.set(s, { name: s, folders: new Map(), files: [] });
        f = f.folders.get(s);
      }
      f.files.push(e);
    }
    // Dossiers à enfant unique fusionnés (a/b/c), comme l'arbre de fichiers de GitHub.
    const squash = (f) => {
      for (const [k, c] of [...f.folders]) {
        squash(c);
        if (!c.files.length && c.folders.size === 1) {
          const [only] = c.folders.values();
          f.folders.delete(k);
          only.name = `${c.name}/${only.name}`;
          f.folders.set(only.name, only);
        }
      }
    };
    squash(rootF);
    return rootF;
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    for (let p = el; p; p = p.parentElement) if (p.tagName === "DETAILS") p.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderNav(entries, ctx) {
    const navNode = (node, depth) => {
      // Get/Set restent dans le contenu ; la navigation s'arrête à la propriété.
      if (node.kind === "Get" || node.kind === "Set") return null;
      if (node.status === "unchanged" && !ctx.opts.showUnchanged) return null;
      const kids = node.children.map((c) => navNode(c, depth + 1)).filter(Boolean);
      return h("li", {},
        h("a", { class: `tc-nav-item tc-st-${node.status}`, href: "#", onclick: (e) => { e.preventDefault(); scrollToId(node.domId); } },
          kindTag(node), h("span", {}, shortLabel(node))),
        kids.length ? h("ul", {}, kids) : null);
    };
    const navFolder = (f) => {
      const items = [];
      for (const c of [...f.folders.values()].sort((x, y) => x.name.localeCompare(y.name))) {
        items.push(h("li", {}, h("div", { class: "tc-nav-folder" }, "📁 ", c.name), h("ul", {}, navFolder(c))));
      }
      for (const e of f.files.slice().sort((x, y) => x.path.localeCompare(y.path))) {
        // Pas d'analyse forcée ici : les membres apparaissent quand le fichier a été affiché.
        const c = analysisCache.get(e);
        const a = c && c.ignoreWs === ctx.opts.ignoreWs ? c.value : { status: e.error ? "modified" : e.status };
        const name = e.path.split("/").pop();
        // Membres du fichier : enfants de l'objet principal (méthodes, propriétés...), ou ses groupes.
        const members = a.nodes ? (a.nodes.length === 1 ? a.nodes[0].children : a.nodes) : [];
        const kids = members.map((n) => navNode(n, 1)).filter(Boolean);
        items.push(h("li", {},
          h("a", { class: `tc-nav-item tc-nav-file tc-st-${a.status}`, href: "#", onclick: (ev) => { ev.preventDefault(); scrollToId(e.domId); } },
            h("span", { class: "tc-dot" }), h("span", {}, name)),
          kids.length ? h("ul", {}, kids) : null));
      }
      return items;
    };
    return h("ul", { class: "tc-nav-root" }, navFolder(folderTree(entries)));
  }

  // ---------- Overlay ----------

  function createOverlay(pr, onClose) {
    const opts = { ignoreWs: false, showUnchanged: false, expanded: new Set() };
    let entries = [];
    let statusText = "Chargement…";
    let message = null;

    const main = h("div", { class: "tc-body" });
    const nav = h("nav", { class: "tc-nav", "aria-label": "Arborescence des fichiers TwinCAT" });
    const status = h("span", { class: "tc-muted" }, statusText);
    const ctx = { opts, onExpand: null, ids: { next: 0 } };

    // Navigation recalculée au plus une fois toutes les 50 ms, quel que soit le nombre de fichiers remplis.
    // setTimeout plutôt que requestAnimationFrame, qui ne se déclenche pas dans un onglet non dessiné.
    let navQueued = false;
    const scheduleNav = () => {
      if (navQueued) return;
      navQueued = true;
      setTimeout(() => {
        navQueued = false;
        nav.replaceChildren(renderNav(entries, ctx));
      }, 50);
    };

    const fill = (entry) => {
      // Contexte propre au fichier : déplier des lignes ne redessine que ce fichier.
      const fctx = Object.assign({}, ctx, {
        onExpand: (key) => {
          opts.expanded.add(key);
          entry.ui.filled = false;
          fill(entry);
        },
      });
      fillFileBody(entry, fctx);
      scheduleNav();
    };

    // Remplit les cartes à l'approche de la zone visible (marge d'un écran et demi).
    const observer = new IntersectionObserver(
      (items) => {
        for (const it of items) {
          if (!it.isIntersecting) continue;
          observer.unobserve(it.target);
          fill(it.target.tcEntry);
        }
      },
      { root: main, rootMargin: "1500px 0px" }
    );

    // Les premiers fichiers sont remplis d'office (visibles à l'ouverture), les autres à l'approche.
    const EAGER = 3;
    const appendShell = (entry, i) => {
      const card = renderFileShell(entry, i);
      main.append(card);
      if (i < EAGER) fill(entry);
      else observer.observe(card);
    };

    const rerender = () => {
      const scroll = main.scrollTop;
      observer.disconnect();
      ctx.ids.next = 0;
      main.replaceChildren();
      if (message) main.append(message);
      else entries.forEach(appendShell);
      scheduleNav();
      status.textContent = statusText;
      main.scrollTop = scroll;
    };
    const toggle = (label, prop) =>
      h("label", { class: "tc-toggle" },
        h("input", { type: "checkbox", onchange: (e) => { opts[prop] = e.target.checked; rerender(); } }), label);

    const panel = h("div", { class: "tc-panel", role: "dialog", "aria-label": "Vue TwinCAT" },
      h("div", { class: "tc-top" },
        h("strong", {}, `Vue TwinCAT · PR #${pr.number}`),
        status,
        h("span", { class: "tc-spacer" }),
        toggle("Ignorer les espaces", "ignoreWs"),
        toggle("Montrer l'inchangé", "showUnchanged"),
        h("button", { class: "tc-close", onclick: onClose, title: "Fermer (Échap)" }, "✕")),
      h("div", { class: "tc-split" }, nav, main),
      h("div", { class: "tc-foot tc-muted" }, `TcPR Viewer v${T.SCRIPT_VERSION}`));
    const overlay = h("div", { class: "tc-overlay", onclick: (e) => { if (e.target === overlay) onClose(); } }, panel);

    return {
      el: overlay,
      setStatus(t) {
        statusText = t;
        status.textContent = t;
      },
      addEntry(e) {
        entries.push(e);
        if (!message) appendShell(e, entries.length - 1);
        scheduleNav();
      },
      setEntries(list) {
        entries = list.slice();
        rerender();
      },
      showMessage(text, isError) {
        message = h("div", { class: isError ? "tc-error" : "tc-muted tc-pad" }, text);
        rerender();
      },
    };
  }

  const api = { createOverlay, h, highlightSt };
  root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
