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

  function badge(status) {
    return h("span", { class: `tc-badge tc-badge-${status}` }, T.t(`status.${status}`));
  }

  // Lignes d'affichage côte à côte : [gauche, droite], chacune une opération ou null.
  // Un bloc de suppressions suivi d'ajouts est apparié ligne à ligne (comme la vue « split » de GitHub).
  function pairRows(rows) {
    const out = [];
    let dels = [];
    let adds = [];
    const flush = () => {
      for (let i = 0; i < Math.max(dels.length, adds.length); i++) out.push([dels[i] || null, adds[i] || null]);
      dels = [];
      adds = [];
    };
    for (const o of rows) {
      if (o.t === "-") dels.push(o);
      else if (o.t === "+") adds.push(o);
      else {
        flush();
        out.push(o.t === "=" ? [o, o] : o);
      }
    }
    flush();
    return out;
  }

  function renderCodeSplit(sec, rows, onExpand) {
    const table = h("table", { class: "tc-code tc-code-split" });
    const stA = { inBlock: false };
    const stB = { inBlock: false };
    const cell = (o, side, st) => {
      if (!o) return [h("td", { class: "tc-ln tc-empty" }), h("td", { class: "tc-text tc-empty" })];
      const cls = o.t === "=" ? "" : side === "a" ? "tc-del" : "tc-add";
      const content = sec.lang === "st" ? highlightSt(o.text, st) : [o.text];
      return [h("td", { class: `tc-ln ${cls}` }, side === "a" ? o.a : o.b), h("td", { class: `tc-text ${cls}` }, ...content)];
    };
    for (const r of pairRows(rows)) {
      if (!Array.isArray(r)) {
        const more = r.t === "more";
        table.append(
          h("tr", { class: "tc-skip", onclick: () => onExpand(more ? `${sec.key}#all` : sec.key) },
            h("td", { colspan: 4 }, more ? T.t("code.more", { n: r.count }) : T.tn("code.skip", r.count)))
        );
        stA.inBlock = stB.inBlock = false;
        continue;
      }
      table.append(h("tr", {}, ...cell(r[0], "a", stA), ...cell(r[1], "b", stB)));
    }
    return table;
  }

  function renderCode(sec, opts, onExpand) {
    const table = h("table", { class: "tc-code" });
    const state = { inBlock: false };
    const all = T.withContext(sec.ops, opts.expanded.has(sec.key) ? Infinity : 3);
    // Plafond : au-delà, un bouton affiche la suite (évite des dizaines de milliers de lignes d'un coup).
    const cap = opts.expanded.has(`${sec.key}#all`) ? Infinity : MAX_CODE_ROWS;
    const rows = all.slice(0, cap);
    if (all.length > cap) {
      rows.push({ t: "more", count: all.length - cap });
    }
    // Côte à côte seulement s'il y a les deux côtés (une section ajoutée ou supprimée reste sur une colonne).
    if (opts.split && sec.status === "modified") return renderCodeSplit(sec, rows, onExpand);
    for (const o of rows) {
      if (o.t === "more") {
        table.append(
          h("tr", { class: "tc-skip", onclick: () => onExpand(`${sec.key}#all`) },
            h("td", { colspan: 4 }, T.t("code.more", { n: o.count })))
        );
        continue;
      }
      if (o.t === "skip") {
        table.append(
          h("tr", { class: "tc-skip", onclick: () => onExpand(sec.key), title: T.t("code.showAll") },
            h("td", { colspan: 4 }, T.tn("code.skip", o.count)))
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

  function renderProps(sec, opts, onExpand) {
    const kept = sec.rows.filter((r) => r.t !== "=" || opts.showUnchanged || sec.status === "added" || sec.status === "removed");
    const hidden = sec.rows.length - kept.length;
    const cap = opts.expanded.has(`${sec.key}#all`) ? Infinity : MAX_PROP_ROWS;
    const rows = kept.slice(0, cap);
    const table = h("table", { class: "tc-props" },
      h("thead", {}, h("tr", {}, h("th", {}, T.t("props.key")), h("th", {}, T.t("props.before")), h("th", {}, T.t("props.after")))));
    const tbody = h("tbody");
    for (const r of rows) {
      const cls = { "+": "tc-add", "-": "tc-del", "~": "tc-mod", "=": "" }[r.t];
      tbody.append(h("tr", { class: cls }, h("td", { class: "tc-key" }, r.key), h("td", {}, shortValue(r.a)), h("td", {}, shortValue(r.b))));
    }
    if (kept.length > cap && onExpand) {
      tbody.append(h("tr", { class: "tc-more", onclick: () => onExpand(`${sec.key}#all`) },
        h("td", { colspan: 3 }, T.t("props.more", { n: kept.length - cap }))));
    }
    table.append(tbody);
    return [table, hidden ? h("div", { class: "tc-muted" }, T.tn("props.hidden", hidden)) : null];
  }


  // Garde-fous contre le gel de la page sur les très grosses PR.
  const MAX_CODE_ROWS = 1500; // lignes de code affichées par section avant « afficher la suite »
  const MAX_PROP_ROWS = 400; // propriétés affichées par section avant « afficher la suite »
  const AUTO_ANALYZE_BYTES = 1.5e6; // au-delà, l'analyse d'un fichier attend un clic
  const FILE_ROW_BUDGET = 800; // lignes affichées d'office par fichier, le reste sur clic

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
  // Cache borné par le volume des fichiers analysés (et non par leur nombre) : les nombreux petits
  // fichiers restent en cache, quelques gros ne l'évincent pas entièrement.
  const ANALYSIS_CACHE_BYTES = 40e6;
  const analysisCache = new Map();
  const sizeOf = (entry) => (entry.base || "").length + (entry.head || "").length;
  const cacheGet = (entry) => {
    const c = analysisCache.get(entry);
    if (c) {
      // Remis en fin de file : le moins récemment utilisé part en premier.
      analysisCache.delete(entry);
      analysisCache.set(entry, c);
    }
    return c;
  };
  const cacheSet = (entry, value) => {
    analysisCache.delete(entry);
    analysisCache.set(entry, value);
    let total = 0;
    for (const k of analysisCache.keys()) total += sizeOf(k);
    while (total > ANALYSIS_CACHE_BYTES && analysisCache.size > 1) {
      const oldest = analysisCache.keys().next().value;
      total -= sizeOf(oldest);
      analysisCache.delete(oldest);
    }
  };

  function analyze(entry, opts) {
    const cached = cacheGet(entry);
    if (cached && cached.ignoreWs === opts.ignoreWs) return cached.value;
    T.debug.mark("analyse", entry.path, { ko: Math.round(((entry.base || "").length + (entry.head || "").length) / 1024) });
    const end = T.debug.time("analyse", entry.path, {
      ko: Math.round(((entry.base || "").length + (entry.head || "").length) / 1024),
    });
    let value;
    if (entry.error) value = { error: T.t("file.cannotAnalyze", { err: entry.error }), status: "modified" };
    else {
      const base = entry.base === null ? null : T.modelFile(entry.oldPath || entry.path, entry.base);
      const head = entry.head === null ? null : T.modelFile(entry.path, entry.head);
      const parseErr = (base && base.error) || (head && head.error);
      if (parseErr) value = { error: T.t("file.badXml", { err: parseErr }), status: "modified" };
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
    cacheSet(entry, { ignoreWs: opts.ignoreWs, value });
    end({ statut: value.status });
    return value;
  }

  const partLabel = (part) => (["decl", "impl", "attrs", "props"].includes(part) ? T.t(`part.${part}`) : null);

  // Lignes qu'une section afficherait (estimation, avant rendu).
  function estimateRows(sec, opts) {
    if (sec.kind !== "code") return Math.min(sec.rows.length, MAX_PROP_ROWS);
    const ctxLines = opts.expanded.has(sec.key) ? Infinity : 3;
    const shown = ctxLines === Infinity ? sec.ops.length : T.withContext(sec.ops, ctxLines).length;
    return Math.min(shown, MAX_CODE_ROWS);
  }

  // budget : { rows } restant pour le fichier ; une section qui le dépasse reste repliée
  // derrière un bouton (comme « Load diff » sur GitHub) : le coût d'un fichier est plafonné.
  function renderPart(sec, opts, onExpand, budget) {
    if (sec.kind === "code") {
      const before = sideText(sec, "-");
      const after = sideText(sec, "+");
      if (sec.part === "decl" && isTrivialDecl(before) && isTrivialDecl(after)) return null;
      if (sec.part === "impl" && !before.trim() && !after.trim()) return null;
    }
    const label = sec.lang === "xml" ? sec.label.replace(/^.*· /, "") : partLabel(sec.part) || sec.label;
    const head = h("div", { class: "tc-part-label" }, label, sec.status !== "unchanged" && sec.status !== "added" && sec.status !== "removed" ? badge(sec.status) : null);
    const rows = estimateRows(sec, opts);
    const forced = opts.expanded.has(`${sec.key}#show`);
    if (budget && !forced && rows > budget.rows) {
      budget.rows = 0; // les sections suivantes du fichier restent repliées aussi
      return h("div", { class: `tc-part tc-part-${sec.part || "props"}` }, head,
        h("div", { class: "tc-folded", onclick: () => onExpand(`${sec.key}#show`) }, T.t("part.show", { n: rows })));
    }
    if (budget && !forced) budget.rows -= rows;
    return h("div", { class: `tc-part tc-part-${sec.part || "props"}` }, head,
      sec.kind === "code" ? renderCode(sec, opts, onExpand) : renderProps(sec, opts, onExpand));
  }

  function renderNode(node, ctx, depth) {
    const { opts, onExpand, ids, budget } = ctx;
    const id = `tcn-${ids.next++}`;
    node.domId = id;
    const parts = node.parts
      .filter((p) => p.status !== "unchanged" || opts.showUnchanged)
      .map((p) => renderPart(p, opts, onExpand, budget))
      .filter(Boolean);
    const shownChildren = node.children.filter((c) => c.status !== "unchanged" || opts.showUnchanged);
    const hiddenChildren = node.children.length - shownChildren.length;
    const body = h("div", { class: "tc-node-body" },
      parts,
      shownChildren.map((c) => renderNode(c, ctx, depth + 1)),
      hiddenChildren ? h("div", { class: "tc-muted tc-hidden-note" }, T.tn("node.hidden", hiddenChildren)) : null);
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
    if (entry.pending) {
      entry.ui.body.replaceChildren(h("div", { class: "tc-muted tc-pad" }, T.t("file.downloading")));
      return;
    }
    const bytes = (entry.base || "").length + (entry.head || "").length;
    if (bytes > AUTO_ANALYZE_BYTES && !entry.forceAnalyze && !entry.error) {
      const mo = T.i18n.num(bytes / 1e6, 1);
      T.debug.log("rendu", T.t("log.deferred", { mo, p: entry.path }));
      entry.ui.body.classList.remove("tc-file-pending");
      entry.ui.body.replaceChildren(
        h("div", { class: "tc-muted tc-pad" },
          T.t("file.big", { mo }),
          h("button", { class: "tc-btn tc-btn-inline", onclick: () => { entry.forceAnalyze = true; ctx.refill(entry); } }, T.t("file.analyze")))
      );
      return;
    }
    entry.ui.filled = true;
    const a = analyze(entry, ctx.opts);
    const endRender = T.debug.time("rendu", entry.path);
    const parts = [];
    if (a.error) parts.push(h("div", { class: "tc-error" }, a.error));
    else {
      if (a.noise.length) parts.push(h("div", { class: "tc-noise" }, T.t("file.noise", { list: a.noise.join(", ") })));
      if (a.status !== "noise" || ctx.opts.showUnchanged) {
        for (const n of a.nodes) parts.push(renderNode(n, ctx, 0));
        if (!a.nodes.length) parts.push(h("div", { class: "tc-muted tc-pad" }, T.t("file.noSections")));
      }
    }
    entry.ui.badge.replaceWith((entry.ui.badge = badge(a.status)));
    entry.ui.body.classList.remove("tc-file-pending");
    entry.ui.body.replaceChildren(...parts);
    // Après le rendu (les nœuds ont reçu leur domId) : résumé léger pour la navigation.
    if (a.nodes) {
      entry.navStatus = a.status;
      entry.navMembers = summarize(a.nodes.length === 1 ? a.nodes[0].children : a.nodes);
    }
    endRender({ noeuds: entry.ui.body.getElementsByTagName("*").length });
  }

  // Copie minimale d'un sous-arbre (type, nom, état, enfants) : de quoi dessiner la navigation
  // sans garder les diffs en mémoire.
  function summarize(nodes) {
    return nodes.map((n) => ({ key: n.key, kind: n.kind, label: n.label, status: n.status, domId: n.domId, children: summarize(n.children) }));
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
    const navNode = (node, depth, file) => {
      // Get/Set restent dans le contenu ; la navigation s'arrête à la propriété.
      if (node.kind === "Get" || node.kind === "Set") return null;
      if (node.status === "unchanged" && !ctx.opts.showUnchanged) return null;
      const kids = node.children.map((c) => navNode(c, depth + 1, file)).filter(Boolean);
      return h("li", {},
        h("a", { class: `tc-nav-item tc-st-${node.status}`, href: "#", onclick: (e) => { e.preventDefault(); scrollToId((node.domId && document.getElementById(node.domId) && node.domId) || file.domId); } },
          kindTag(node), h("span", {}, shortLabel(node))),
        kids.length ? h("ul", {}, kids) : null);
    };
    const navFolder = (f) => {
      const items = [];
      for (const c of [...f.folders.values()].sort((x, y) => x.name.localeCompare(y.name))) {
        items.push(h("li", {}, h("div", { class: "tc-nav-folder" }, "📁 ", c.name), h("ul", {}, navFolder(c))));
      }
      for (const e of f.files.slice().sort((x, y) => x.path.localeCompare(y.path))) {
        // Pas d'analyse forcée ici : les membres apparaissent quand le fichier a été affiché une fois.
        const a = { status: e.navStatus || (e.error ? "modified" : e.status) };
        const name = e.path.split("/").pop();
        const kids = (e.navMembers || []).map((n) => navNode(n, 1, e)).filter(Boolean);
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
    const pref = (k, d) => {
      try {
        const v = localStorage.getItem(`tcpr-${k}`);
        return v === null ? d : v === "1";
      } catch (e) {
        return d;
      }
    };
    const savePref = (k, v) => {
      try {
        localStorage.setItem(`tcpr-${k}`, v ? "1" : "0");
      } catch (e) {
        // stockage indisponible : réglage valable pour cette ouverture seulement
      }
    };
    const opts = { ignoreWs: false, showUnchanged: false, split: pref("split", true), expanded: new Set() };
    let entries = [];
    let statusText = T.t("panel.loading");
    let message = null;

    const main = h("div", { class: "tc-body" });
    const nav = h("nav", { class: "tc-nav", "aria-label": T.t("panel.navLabel") });
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

    // Fonction de chargement à la demande fournie par setList (fichiers modifiés).
    let loadFn = null;
    let onLoaded = null;

    const fill = (entry) => {
      if (entry.pending) {
        // Fichier lourd (.tsproj de plusieurs Mo...) : rien n'est téléchargé sans un clic.
        if (entry.heavy && !entry.allowFetch && !entry.requested) {
          entry.ui.body.classList.remove("tc-file-pending");
          entry.ui.body.replaceChildren(
            h("div", { class: "tc-muted tc-pad" },
              T.t("file.heavy"),
              h("button", { class: "tc-btn tc-btn-inline", onclick: () => { entry.allowFetch = true; entry.forceAnalyze = true; fill(entry); } }, T.t("file.fetchAnalyze")))
          );
          return;
        }
        // Contenu pas encore téléchargé : on le demande maintenant, une seule fois.
        if (loadFn && !entry.requested) {
          entry.requested = true;
          const i = entry.index;
          loadFn(i).then((e) => {
            api.updateEntry(i, e);
            if (onLoaded) onLoaded();
          });
        }
        fillFileBody(entry, ctx);
        return;
      }
      // Contexte propre au fichier : déplier des lignes ne redessine que ce fichier.
      const refill = () => {
        entry.ui.filled = false;
        fill(entry);
      };
      const fctx = Object.assign({}, ctx, {
        onExpand: (key) => {
          opts.expanded.add(key);
          refill();
        },
        refill,
        budget: { rows: FILE_ROW_BUDGET },
      });
      fillFileBody(entry, fctx);
      scheduleNav();
    };

    // File de remplissage : un fichier par tâche, pour que la page reste réactive entre deux analyses.
    const fillQueue = [];
    let fillRunning = false;
    const queueFill = (entry) => {
      if (!fillQueue.includes(entry)) fillQueue.push(entry);
      if (fillRunning) return;
      fillRunning = true;
      const step = () => {
        const next = fillQueue.shift();
        if (!next) {
          fillRunning = false;
          return;
        }
        fill(next);
        setTimeout(step, 0);
      };
      setTimeout(step, 0);
    };

    // Virtualisation, comme la vue « Files changed » de GitHub : une carte est montée quand elle
    // approche de l'écran (marge d'un écran et demi) et démontée quand elle s'en éloigne, remplacée
    // par un bloc vide de même hauteur. Le coût ne dépend que de ce qui est à l'écran.
    const unmount = (entry) => {
      if (!entry.ui || !entry.ui.filled) return;
      const height = entry.ui.body.offsetHeight;
      entry.ui.filled = false;
      entry.ui.body.replaceChildren(h("div", { class: "tc-placeholder", style: `height:${height}px` }));
      T.debug.log("rendu", T.t("log.unmounted", { p: entry.path }), { px: height });
    };
    // Deux seuils (hystérésis) : montage à 1 500 px de l'écran, démontage seulement au-delà de
    // 5 000 px, pour qu'un aller-retour de défilement ne refasse pas analyse et rendu.
    const mountObs = new IntersectionObserver(
      (items) => {
        for (const it of items) {
          const entry = it.target.tcEntry;
          if (it.isIntersecting) queueFill(entry);
          else {
            const i = fillQueue.indexOf(entry);
            if (i >= 0) fillQueue.splice(i, 1);
          }
        }
      },
      { root: main, rootMargin: "1500px 0px" }
    );
    const unmountObs = new IntersectionObserver(
      (items) => {
        for (const it of items) if (!it.isIntersecting) unmount(it.target.tcEntry);
      },
      { root: main, rootMargin: "5000px 0px" }
    );
    const observer = {
      observe: (el) => {
        mountObs.observe(el);
        unmountObs.observe(el);
      },
      unobserve: (el) => {
        mountObs.unobserve(el);
        unmountObs.unobserve(el);
      },
      disconnect: () => {
        mountObs.disconnect();
        unmountObs.disconnect();
      },
    };

    // Les premiers fichiers sont remplis d'office (visibles à l'ouverture), les autres à l'approche.
    const EAGER = 3;
    const appendShell = (entry, i) => {
      const card = renderFileShell(entry, i);
      main.append(card);
      observer.observe(card);
      if (i < EAGER) queueFill(entry);
    };

    // Remplace la carte d'un fichier arrivé après coup, à sa place.
    const replaceShell = (entry, i) => {
      const old = document.getElementById(entry.domId);
      const card = renderFileShell(entry, i);
      if (old) {
        observer.unobserve(old);
        old.replaceWith(card);
      } else main.append(card);
      observer.observe(card);
      if (i < EAGER) queueFill(entry);
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
    const toggle = (label, prop, persist) =>
      h("label", { class: "tc-toggle" },
        h("input", {
          type: "checkbox",
          checked: opts[prop] || null,
          onchange: (e) => {
            opts[prop] = e.target.checked;
            if (persist) savePref(prop, opts[prop]);
            rerender();
          },
        }), label);
    // Arbre de navigation repliable, pour donner toute la largeur au code.
    let navShown = pref("nav", true);
    const navBtn = h("button", {
      class: "tc-btn tc-nav-toggle",
      title: T.t("panel.navToggleTitle"),
      onclick: () => {
        navShown = !navShown;
        savePref("nav", navShown);
        nav.hidden = !navShown;
        navBtn.setAttribute("aria-pressed", String(navShown));
      },
    }, T.t("panel.navToggle"));
    nav.hidden = !navShown;
    navBtn.setAttribute("aria-pressed", String(navShown));

    const panel = h("div", { class: "tc-panel", role: "dialog", "aria-label": T.t("panel.aria") },
      h("div", { class: "tc-top" },
        navBtn,
        h("strong", {}, T.t("panel.title", { n: pr.number })),
        status,
        h("span", { class: "tc-spacer" }),
        toggle(T.t("panel.split"), "split", true),
        toggle(T.t("panel.ignoreWs"), "ignoreWs"),
        toggle(T.t("panel.showUnchanged"), "showUnchanged"),
        h("button", { class: "tc-close", onclick: onClose, title: T.t("panel.close") }, "✕")),
      h("div", { class: "tc-split" }, nav, main),
      h("div", { class: "tc-foot tc-muted" }, `TwinCAT Preview for GitHub v${T.SCRIPT_VERSION}`));
    const overlay = h("div", { class: "tc-overlay", onclick: (e) => { if (e.target === overlay) onClose(); } }, panel);

    const api = {
      el: overlay,
      setStatus(t) {
        statusText = t;
        status.textContent = t;
      },
      // Liste connue d'avance (en-têtes affichés tout de suite). Chaque contenu est demandé à load(i)
      // quand sa carte approche de l'écran ; onLoadedCb est appelé après chaque arrivée.
      setList(list, load, onLoadedCb) {
        loadFn = load || null;
        onLoaded = onLoadedCb || null;
        entries = list.map((m, i) => Object.assign({ base: null, head: null, error: null, pending: true, index: i }, m));
        rerender();
      },
      updateEntry(i, e) {
        if (!entries[i]) return;
        Object.assign(entries[i], e, { pending: false, index: i, forceAnalyze: entries[i].forceAnalyze });
        analysisCache.delete(entries[i]);
        if (!message) replaceShell(entries[i], i);
        scheduleNav();
      },
      showMessage(text, isError) {
        message = h("div", { class: isError ? "tc-error" : "tc-muted tc-pad" }, text);
        rerender();
      },
    };
    return api;
  }

  const api = { createOverlay, h, highlightSt };
  root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
