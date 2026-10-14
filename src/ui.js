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

  function renderSection(sec, opts, onExpand) {
    return h("div", { class: "tc-section" },
      h("div", { class: "tc-section-head" }, h("span", { class: "tc-section-title" }, sec.label), badge(sec.status)),
      sec.kind === "code" ? renderCode(sec, opts, onExpand) : renderProps(sec, opts));
  }

  function renderFile(entry, opts, onExpand) {
    const card = h("div", { class: "tc-file" });
    const title = entry.oldPath && entry.oldPath !== entry.path ? `${entry.oldPath} → ${entry.path}` : entry.path;
    const head = h("div", { class: "tc-file-head" }, h("span", { class: "tc-path" }, title));
    card.append(head);

    if (entry.error) {
      head.append(badge("modified"));
      card.append(h("div", { class: "tc-error" }, `Impossible d'analyser ce fichier : ${entry.error}`));
      return card;
    }

    const base = entry.base === null ? null : T.modelFile(entry.oldPath || entry.path, entry.base);
    const headM = entry.head === null ? null : T.modelFile(entry.path, entry.head);
    const parseErr = (base && base.error) || (headM && headM.error);
    if (parseErr) {
      card.append(h("div", { class: "tc-error" }, `XML illisible : ${parseErr}`));
      return card;
    }
    const d = T.diffModels(base, headM, opts);
    const status = entry.status === "renamed" && d.status === "unchanged" ? "renamed" : d.status;
    head.append(badge(status));
    const m = headM || base;
    if (m && m.title) head.append(h("span", { class: "tc-muted" }, m.title));

    if (d.noise.length) card.append(h("div", { class: "tc-noise" }, `Bruit ignoré : ${d.noise.join(", ")}`));

    const shown = d.sections.filter((s) => s.status !== "unchanged" || opts.showUnchanged);
    for (const s of shown) card.append(renderSection(s, opts, onExpand));
    const hidden = d.sections.length - shown.length;
    if (hidden) card.append(h("div", { class: "tc-muted tc-pad" }, `${hidden} section${hidden > 1 ? "s" : ""} inchangée${hidden > 1 ? "s" : ""}`));
    if (!d.sections.length) card.append(h("div", { class: "tc-muted tc-pad" }, "Aucune section structurée."));
    return card;
  }

  // ---------- Overlay ----------

  function createOverlay(pr, onClose) {
    const opts = { ignoreWs: false, showUnchanged: false, expanded: new Set() };
    let entries = [];
    let statusText = "Chargement…";

    const body = h("div", { class: "tc-body" });
    const status = h("span", { class: "tc-muted" });
    const rerender = () => {
      body.replaceChildren(...entries.map((e) => renderFile(e, opts, onExpand)));
      status.textContent = statusText;
    };
    const onExpand = (key) => {
      opts.expanded.add(key);
      rerender();
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
      body,
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
        body.append(renderFile(e, opts, onExpand));
      },
      setEntries(list) {
        entries = list.slice();
        rerender();
      },
      showMessage(text, isError) {
        body.replaceChildren(h("div", { class: isError ? "tc-error" : "tc-muted tc-pad" }, text));
      },
    };
  }

  const api = { createOverlay, h, highlightSt };
  root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
