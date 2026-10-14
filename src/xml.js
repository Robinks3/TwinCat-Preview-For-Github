// Parseur XML minimal, sans dépendance, utilisable dans Chrome et dans Node (tests).
// Suffisant pour les fichiers TwinCAT : éléments, attributs, CDATA, commentaires, PI.
// Nœud élément : { tag, attrs: {nom: valeur}, attrOrder: [noms], children: [éléments], text }
// `text` concatène le texte direct (CDATA compris) de l'élément.

(function (root) {
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
      throw new Error(`XML invalide (${msg}) vers le caractère ${i}`);
    };
    const indexOrFail = (needle, from, what) => {
      const k = src.indexOf(needle, from);
      if (k < 0) fail(`${what} non fermé`);
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
        const end = indexOrFail("]]>", lt + 9, "CDATA");
        top.text += src.slice(lt + 9, end);
        i = end + 3;
      } else if (src.startsWith("<!--", lt)) {
        i = indexOrFail("-->", lt + 4, "commentaire") + 3;
      } else if (src.startsWith("<?", lt)) {
        i = indexOrFail("?>", lt + 2, "instruction") + 2;
      } else if (src.startsWith("<!", lt)) {
        i = indexOrFail(">", lt + 2, "déclaration") + 1;
      } else if (src[lt + 1] === "/") {
        const end = indexOrFail(">", lt + 2, "balise fermante");
        const name = src.slice(lt + 2, end).trim();
        if (stack.length < 2 || top.tag !== name) fail(`</${name}> inattendu`);
        stack.pop();
        i = end + 1;
      } else {
        // Balise ouvrante : nom puis attributs (les valeurs peuvent contenir '>').
        let j = lt + 1;
        while (j < n && !isSpace(src[j]) && src[j] !== "/" && src[j] !== ">") j++;
        const el = { tag: src.slice(lt + 1, j), attrs: {}, attrOrder: [], children: [], text: "" };
        if (!el.tag) fail("nom de balise vide");
        let selfClosing = false;
        for (;;) {
          while (j < n && isSpace(src[j])) j++;
          if (j >= n) fail("balise ouvrante non fermée");
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
          if (src[j] !== "=") fail(`attribut ${aname} sans valeur`);
          j++;
          while (j < n && isSpace(src[j])) j++;
          const q = src[j];
          if (q !== '"' && q !== "'") fail(`attribut ${aname} sans guillemets`);
          const vend = src.indexOf(q, j + 1);
          if (vend < 0) fail(`valeur de ${aname} non fermée`);
          el.attrs[aname] = decodeEntities(src.slice(j + 1, vend));
          el.attrOrder.push(aname);
          j = vend + 1;
        }
        top.children.push(el);
        if (!selfClosing) stack.push(el);
        i = j;
      }
    }
    if (stack.length !== 1) fail(`<${stack[stack.length - 1].tag}> non fermé`);
    const rootEl = doc.children[0];
    if (!rootEl) fail("aucun élément racine");
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
