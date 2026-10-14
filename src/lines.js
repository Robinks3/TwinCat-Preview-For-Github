// Classement de chaque ligne d'un fichier TwinCAT, pour remettre en forme le diff GitHub en place.
//
// classifyLines(path, content) -> tableau indexé par n° de ligne (1-based) de :
//   { role: "code" | "scaffold" | "noise" | "config", section?, label?, start?, code? }
//   code     : ligne de ST (dans un CDATA) ; `code` = texte sans l'enveloppe XML,
//              `start` = première ligne de sa section, `label` = nom lisible de la section.
//   scaffold : structure XML sans contenu utile (<Implementation>, ]]></ST>, <?xml ...>, ...).
//   noise    : bruit (blocs LineIds, valeurs GUID).
//   config   : contenu de configuration à garder tel quel (tsproj, plcproj, TcTTO, ...).

(function (root) {
  const X = typeof module !== "undefined" && module.exports ? require("./xml.js") : root.TcPr;

  const GUID_TEXT_RE = /^\s*<(\w+)>\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}?<\/\1>\s*$/;
  const GUID_RE = /\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}?/g;

  const CHILD_LABELS = { Method: "Méthode", Action: "Action", Transition: "Transition", Property: "Propriété" };
  const OBJECT_LABELS = { DUT: "DUT", GVL: "GVL", Itf: "Interface", Task: "Tâche" };

  // Forme d'une ligne sans ce qui relève du bruit : deux lignes de même clé ne diffèrent que par du bruit.
  function noiseKey(line) {
    return line
      .replace(GUID_RE, "{GUID}")
      .replace(/\s(ProductVersion|TcVersion)="[^"]*"/g, "")
      .trim();
  }

  function lineIndex(src) {
    const starts = [0];
    for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
    const lineOf = (off) => {
      let lo = 0;
      let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= off) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1;
    };
    return { starts, lineOf };
  }

  function declKeyword(el) {
    const decl = X.child(el, "Declaration");
    const m = decl && /^\s*(?:\{[^}]*\}\s*|\(\*[\s\S]*?\*\)\s*|\/\/[^\n]*\n\s*)*([A-Z_]+)/.exec(decl.text);
    return m ? m[1] : "POU";
  }

  function classifyLines(path, content) {
    const src = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
    const { starts, lineOf } = lineIndex(src);
    const count = starts.length;
    const lineText = (n) => {
      const s = starts[n - 1];
      const e = n < count ? starts[n] : src.length;
      return src.slice(s, e).replace(/\r?\n$/, "");
    };

    let rootEl;
    try {
      rootEl = X.parseXml(src);
    } catch (e) {
      return { ok: false, error: e.message, lines: [] };
    }
    const plc = rootEl.tag === "TcPlcObject";
    const lines = new Array(count + 1);
    for (let n = 1; n <= count; n++) lines[n] = { role: plc ? "scaffold" : "config" };

    const mark = (el, role) => {
      for (let n = lineOf(el.start); n <= lineOf(Math.max(el.start, el.end - 1)); n++) lines[n] = { role };
    };

    // Lignes de ST d'un élément (Declaration ou ST) : texte du CDATA, ligne par ligne.
    const markCode = (el, key, label) => {
      for (const c of el.cdata || []) {
        if (c.end <= c.start) continue;
        const first = lineOf(c.start);
        const last = lineOf(c.end);
        let isFirst = true;
        for (let n = first; n <= last; n++) {
          const s = Math.max(starts[n - 1], c.start);
          const e = Math.min(n < count ? starts[n] : src.length, c.end);
          const code = src.slice(s, e).replace(/\r?\n$/, "");
          // Dernière ligne réduite à « ]]></Declaration> » : rien à montrer.
          if (n === last && n > first && code === "") continue;
          lines[n] = { role: "code", section: key, label, code, start: isFirst };
          isFirst = false;
        }
      }
    };

    const walkObject = (el, key, label) => {
      for (const c of el.children) {
        if (c.tag === "Declaration") markCode(c, `${key}#decl`, `${label} · déclaration`);
        else if (c.tag === "Implementation") {
          const st = X.child(c, "ST");
          if (st) markCode(st, `${key}#impl`, `${label} · implémentation`);
          else mark(c, "config"); // langage graphique : XML laissé visible
        } else if (CHILD_LABELS[c.tag]) {
          const name = c.attrs.Name || "?";
          walkObject(c, `${key}/${c.tag}:${name}`, `${CHILD_LABELS[c.tag]} ${name}`);
        } else if (c.tag === "Get" || c.tag === "Set") {
          walkObject(c, `${key}/${c.tag}`, `${label} · ${c.tag}`);
        } else if (c.tag !== "LineIds" && c.tag !== "Folder") {
          mark(c, "config");
        }
      }
    };

    if (plc) {
      for (const obj of rootEl.children) {
        const name = obj.attrs.Name || obj.tag;
        if (obj.tag === "Task") {
          mark(obj, "config");
          lines[lineOf(obj.start)] = { role: "scaffold" };
          lines[lineOf(obj.end - 1)] = { role: "scaffold" };
        } else {
          const kind = obj.tag === "POU" ? declKeyword(obj) : OBJECT_LABELS[obj.tag] || obj.tag;
          walkObject(obj, `${obj.tag}:${name}`, `${kind} ${name}`);
        }
      }
    }

    // Bruit, en dernier pour primer sur le reste.
    const walkNoise = (el) => {
      for (const c of el.children) {
        if (c.tag === "LineIds") mark(c, "noise");
        else walkNoise(c);
      }
    };
    walkNoise(rootEl);
    for (let n = 1; n <= count; n++) {
      if (lines[n].role !== "code" && GUID_TEXT_RE.test(lineText(n))) lines[n] = { role: "noise" };
    }

    return { ok: true, plc, lines, lineText };
  }

  const api = { classifyLines, noiseKey };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
