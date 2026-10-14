// Diff sémantique entre deux modèles TwinCAT (voir model.js) et diff ligne à ligne du ST.

(function (root) {
  const L = typeof module !== "undefined" && module.exports ? require("./i18n.js") : root.TcPr;

  // ---------- Diff de lignes (LCS avec élagage du préfixe et du suffixe communs) ----------

  function normWs(s) {
    return s.replace(/\s+/g, " ").trim();
  }

  // Retourne une liste d'opérations { t: "=" | "-" | "+", a?: n° ligne avant, b?: n° ligne après, text }.
  function diffLines(aText, bText, opts = {}) {
    const a = aText === "" ? [] : aText.split("\n");
    const b = bText === "" ? [] : bText.split("\n");
    const ka = opts.ignoreWs ? a.map(normWs) : a;
    const kb = opts.ignoreWs ? b.map(normWs) : b;

    let pre = 0;
    while (pre < a.length && pre < b.length && ka[pre] === kb[pre]) pre++;
    let suf = 0;
    while (suf < a.length - pre && suf < b.length - pre && ka[a.length - 1 - suf] === kb[b.length - 1 - suf]) suf++;

    const n = a.length - pre - suf;
    const m = b.length - pre - suf;
    const ops = [];
    for (let i = 0; i < pre; i++) ops.push({ t: "=", a: i + 1, b: i + 1, text: b[i] });

    const mid = myers(ka.slice(pre, a.length - suf), kb.slice(pre, b.length - suf));
    if (!mid) {
      // Trop de différences : bloc remplacé en entier plutôt que de bloquer l'onglet.
      for (let i = 0; i < n; i++) ops.push({ t: "-", a: pre + i + 1, text: a[pre + i] });
      for (let j = 0; j < m; j++) ops.push({ t: "+", b: pre + j + 1, text: b[pre + j] });
    } else {
      for (const [t, i, j] of mid) {
        if (t === "=") ops.push({ t, a: pre + i + 1, b: pre + j + 1, text: b[pre + j] });
        else if (t === "-") ops.push({ t, a: pre + i + 1, text: a[pre + i] });
        else ops.push({ t, b: pre + j + 1, text: b[pre + j] });
      }
      // Présentation : les suppressions avant les ajouts dans chaque bloc modifié.
      reorderBlocks(ops, pre);
    }

    for (let k = 0; k < suf; k++) {
      ops.push({ t: "=", a: a.length - suf + k + 1, b: b.length - suf + k + 1, text: b[b.length - suf + k] });
    }
    return ops;
  }

  // Diff de Myers (celui de git) : O((N+M)·D) en temps, O(D²) en mémoire, D = nombre de différences.
  // Renvoie [["=", i, j] | ["-", i] | ["+", , j]] dans l'ordre, ou null si D dépasse MAX_D.
  const MAX_D = 2500;

  function myers(a, b) {
    const n = a.length;
    const m = b.length;
    const max = n + m;
    const off = max + 1;
    const V = new Int32Array(2 * max + 3);
    const trace = []; // trace[d] : valeurs de V pour k ∈ [-d, d] au début de l'étape d
    for (let d = 0; d <= max; d++) {
      if (d > MAX_D) return null;
      const snap = new Int32Array(2 * d + 1);
      for (let k = -d; k <= d; k++) snap[k + d] = V[off + k];
      trace.push(snap);
      for (let k = -d; k <= d; k += 2) {
        let x = k === -d || (k !== d && V[off + k - 1] < V[off + k + 1]) ? V[off + k + 1] : V[off + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && a[x] === b[y]) {
          x++;
          y++;
        }
        V[off + k] = x;
        if (x >= n && y >= m) return backtrack(trace, n, m);
      }
    }
    return null;
  }

  function backtrack(trace, n, m) {
    const out = [];
    let x = n;
    let y = m;
    for (let d = trace.length - 1; d >= 0; d--) {
      if (d === 0) {
        while (x > 0 && y > 0) out.push(["=", --x, --y]);
        break;
      }
      const v = trace[d];
      const get = (k) => v[k + d];
      const k = x - y;
      const prevK = k === -d || (k !== d && get(k - 1) < get(k + 1)) ? k + 1 : k - 1;
      const prevX = get(prevK);
      const prevY = prevX - prevK;
      while (x > prevX && y > prevY) out.push(["=", --x, --y]);
      if (x === prevX) out.push(["+", undefined, --y]);
      else out.push(["-", --x]);
    }
    return out.reverse();
  }

  function reorderBlocks(ops, from) {
    let k = from;
    while (k < ops.length) {
      if (ops[k].t === "=") {
        k++;
        continue;
      }
      let e = k;
      while (e < ops.length && ops[e].t !== "=") e++;
      const block = ops.slice(k, e);
      const sorted = block.filter((o) => o.t === "-").concat(block.filter((o) => o.t === "+"));
      ops.splice(k, e - k, ...sorted);
      k = e;
    }
  }

  // Regroupe les opérations en blocs affichables : lignes modifiées + `context` lignes autour,
  // le reste devient un repli { t: "skip", count }.
  function withContext(ops, context = 3) {
    if (context === Infinity) return ops.slice();
    const keep = new Array(ops.length).fill(false);
    ops.forEach((o, k) => {
      if (o.t !== "=") for (let d = -context; d <= context; d++) if (ops[k + d]) keep[k + d] = true;
    });
    const out = [];
    let skipped = 0;
    ops.forEach((o, k) => {
      if (keep[k]) {
        if (skipped) out.push({ t: "skip", count: skipped });
        skipped = 0;
        out.push(o);
      } else skipped++;
    });
    if (skipped) out.push({ t: "skip", count: skipped });
    return out;
  }

  // ---------- Diff de modèles ----------

  function sectionEqual(a, b, opts) {
    if (a.kind !== b.kind) return false;
    if (a.kind === "code") return opts.ignoreWs ? normWs(a.text) === normWs(b.text) : a.text === b.text;
    const ka = Object.keys(a.props);
    const kb = Object.keys(b.props);
    return ka.length === kb.length && ka.every((k) => a.props[k] === b.props[k]);
  }

  function diffProps(a, b) {
    const rows = [];
    const keys = Object.keys(b);
    for (const k of Object.keys(a)) if (!(k in b)) keys.push(k);
    for (const k of keys) {
      const va = a[k];
      const vb = b[k];
      const t = va === undefined ? "+" : vb === undefined ? "-" : va === vb ? "=" : "~";
      rows.push({ t, key: k, a: va, b: vb });
    }
    // Ordre d'affichage : modifiés, ajoutés, supprimés, puis inchangés.
    const rank = { "~": 0, "+": 1, "-": 2, "=": 3 };
    return rows.sort((x, y) => rank[x.t] - rank[y.t]);
  }

  // Ordre des sections : celui de la version après, avec les sections supprimées
  // réinsérées derrière leur voisine d'origine.
  function mergeOrder(baseSecs, headSecs) {
    const headKeys = new Set(headSecs.map((s) => s.key));
    const order = headSecs.map((s) => s.key);
    let prev = null;
    for (const s of baseSecs) {
      if (!headKeys.has(s.key)) {
        const at = prev === null ? 0 : order.indexOf(prev) + 1;
        order.splice(at, 0, s.key);
      }
      prev = s.key;
    }
    return order;
  }

  function noiseSummary(a, b) {
    const out = [];
    if (a.lineIds.join("\n") !== b.lineIds.join("\n")) out.push("LineIds");
    const va = a.versions.join(", ");
    const vb = b.versions.join(", ");
    if (va !== vb) out.push(L.t("noise.version", { a: va || L.t("noise.none"), b: vb || L.t("noise.none") }));
    if (a.guids.slice().sort().join() !== b.guids.slice().sort().join()) out.push("GUID");
    return out;
  }

  // base ou head peut être null (fichier ajouté ou supprimé).
  function diffModels(base, head, opts = {}) {
    const empty = { sections: [], noise: { lineIds: [], versions: [], guids: [] } };
    const A = base || empty;
    const B = head || empty;
    const aMap = new Map(A.sections.map((s) => [s.key, s]));
    const bMap = new Map(B.sections.map((s) => [s.key, s]));

    const sections = [];
    for (const key of mergeOrder(A.sections, B.sections)) {
      const sa = aMap.get(key);
      const sb = bMap.get(key);
      const ref = sb || sa;
      const status = !sa ? "added" : !sb ? "removed" : sectionEqual(sa, sb, opts) ? "unchanged" : "modified";
      const d = { key, label: ref.label, kind: ref.kind, lang: ref.lang, status, tree: ref.tree, part: ref.part };
      if (ref.kind === "code") {
        d.ops = diffLines(sa && sa.kind === "code" ? sa.text : "", sb && sb.kind === "code" ? sb.text : "", opts);
      } else {
        d.rows = diffProps((sa && sa.props) || {}, (sb && sb.props) || {});
      }
      sections.push(d);
    }

    const changed = sections.filter((s) => s.status !== "unchanged").length;
    const noise = base && head ? noiseSummary(A.noise, B.noise) : [];
    let status;
    if (!base) status = "added";
    else if (!head) status = "removed";
    else if (changed) status = "modified";
    else status = noise.length ? "noise" : "unchanged";

    return { status, sections, changed, noise };
  }

  const api = { diffLines, withContext, diffModels };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
