// Parseur XML minimal, sans dépendance, utilisable dans Chrome et dans Node (tests).
// Suffisant pour les fichiers TwinCAT : éléments, attributs, CDATA, commentaires, PI.
// Nœud élément : { tag, attrs: {nom: valeur}, attrOrder: [noms], children: [éléments], text,
//                  start, end, cdata: [{ start, end }] }
// `text` concatène le texte direct (CDATA compris) de l'élément.
// start/end : positions de l'élément dans la source (BOM retiré), cdata : positions du contenu
// de chaque section CDATA ; utilisées pour situer chaque ligne du fichier (voir lines.js).

(function (root) {
  const L = typeof module !== "undefined" && module.exports ? require("./i18n.js") : root.TcPr;
  const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

  function decodeEntities(s) {
    if (s.indexOf("&") < 0) return s;
    return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return Object.prototype.hasOwnProperty.call(ENTITIES, e) ? ENTITIES[e] : m;
    });
  }

  function isSpace(c) {
    return c === " " || c === "\t" || c === "\n" || c === "\r";
  }

  function parseXml(src) {
    if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
    const doc = { tag: "#document", attrs: {}, attrOrder: [], children: [], text: "" };
    const stack = [doc];
    const n = src.length;
    let i = 0;

    const fail = (msg) => {
      throw new Error(L.t("xml.invalid", { msg, i }));
    };
    const indexOrFail = (needle, from, what) => {
      const k = src.indexOf(needle, from);
      if (k < 0) fail(L.t("xml.unclosed", { what }));
      return k;
    };

    while (i < n) {
      const top = stack[stack.length - 1];
      const lt = src.indexOf("<", i);
      if (lt < 0) {
        top.text += decodeEntities(src.slice(i));
        break;
      }
      if (lt > i) top.text += decodeEntities(src.slice(i, lt));

      if (src.startsWith("<![CDATA[", lt)) {
        const end = indexOrFail("]]>", lt + 9, L.t("xml.cdata"));
        top.text += src.slice(lt + 9, end);
        (top.cdata || (top.cdata = [])).push({ start: lt + 9, end });
        i = end + 3;
      } else if (src.startsWith("<!--", lt)) {
        i = indexOrFail("-->", lt + 4, L.t("xml.comment")) + 3;
      } else if (src.startsWith("<?", lt)) {
        i = indexOrFail("?>", lt + 2, L.t("xml.pi")) + 2;
      } else if (src.startsWith("<!", lt)) {
        i = indexOrFail(">", lt + 2, L.t("xml.decl")) + 1;
      } else if (src[lt + 1] === "/") {
        const end = indexOrFail(">", lt + 2, L.t("xml.closeTag"));
        const name = src.slice(lt + 2, end).trim();
        if (stack.length < 2 || top.tag !== name) fail(L.t("xml.unexpected", { name }));
        top.end = end + 1;
        stack.pop();
        i = end + 1;
      } else {
        // Balise ouvrante : nom puis attributs (les valeurs peuvent contenir '>').
        let j = lt + 1;
        while (j < n && !isSpace(src[j]) && src[j] !== "/" && src[j] !== ">") j++;
        const el = { tag: src.slice(lt + 1, j), attrs: {}, attrOrder: [], children: [], text: "", start: lt, end: -1 };
        if (!el.tag) fail(L.t("xml.emptyName"));
        let selfClosing = false;
        for (;;) {
          while (j < n && isSpace(src[j])) j++;
          if (j >= n) fail(L.t("xml.unclosed", { what: L.t("xml.openTag") }));
          if (src[j] === ">") {
            j++;
            break;
          }
          if (src[j] === "/" && src[j + 1] === ">") {
            selfClosing = true;
            j += 2;
            break;
          }
          const ns = j;
          while (j < n && !isSpace(src[j]) && src[j] !== "=" && src[j] !== ">" && src[j] !== "/") j++;
          const aname = src.slice(ns, j);
          while (j < n && isSpace(src[j])) j++;
          if (src[j] !== "=") fail(L.t("xml.attrNoValue", { a: aname }));
          j++;
          while (j < n && isSpace(src[j])) j++;
          const q = src[j];
          if (q !== '"' && q !== "'") fail(L.t("xml.attrNoQuote", { a: aname }));
          const vend = src.indexOf(q, j + 1);
          if (vend < 0) fail(L.t("xml.valueUnclosed", { a: aname }));
          el.attrs[aname] = decodeEntities(src.slice(j + 1, vend));
          el.attrOrder.push(aname);
          j = vend + 1;
        }
        top.children.push(el);
        if (selfClosing) el.end = j;
        else stack.push(el);
        i = j;
      }
    }
    if (stack.length !== 1) fail(L.t("xml.unclosed", { what: `<${stack[stack.length - 1].tag}>` }));
    const rootEl = doc.children[0];
    if (!rootEl) fail(L.t("xml.noRoot"));
    return rootEl;
  }

  function child(el, tag) {
    return el.children.find((c) => c.tag === tag) || null;
  }

  function childrenOf(el, tag) {
    return el.children.filter((c) => c.tag === tag);
  }

  function escapeXml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Réécriture indentée d'un sous-arbre (pour les implémentations non textuelles : SFC, LD, FBD, CFC).
  function toXml(el, indent = "") {
    const attrs = el.attrOrder.map((a) => ` ${a}="${escapeXml(el.attrs[a])}"`).join("");
    const text = el.text.trim();
    if (!el.children.length && !text) return `${indent}<${el.tag}${attrs} />`;
    if (!el.children.length) {
      return text.includes("\n")
        ? `${indent}<${el.tag}${attrs}>\n${text}\n${indent}</${el.tag}>`
        : `${indent}<${el.tag}${attrs}>${escapeXml(text)}</${el.tag}>`;
    }
    const inner = el.children.map((c) => toXml(c, indent + "  ")).join("\n");
    const textLine = text ? `\n${indent}  ${text}` : "";
    return `${indent}<${el.tag}${attrs}>${textLine}\n${inner}\n${indent}</${el.tag}>`;
  }

  const api = { parseXml, child, childrenOf, toXml, decodeEntities };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
