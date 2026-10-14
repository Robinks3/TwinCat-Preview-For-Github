// Modèle structuré d'un fichier TwinCAT : liste de sections comparables entre deux versions.
//
// Section : { key, label, kind: "code" | "props", lang?: "st" | "xml", text?, props?: {clé: valeur} }
// Le bruit (LineIds, GUID, ProductVersion/TcVersion) est retiré du modèle et résumé dans `noise`
// pour pouvoir dire « seul du bruit XML a changé ».

(function (root) {
  const X = typeof module !== "undefined" && module.exports ? require("./xml.js") : root.TcPr;

  const GUID_RE = /^\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}?$/;
  const VERSION_ATTRS = new Set(["ProductVersion", "TcVersion"]);

  const TWINCAT_EXT_RE = /\.(tc[a-z]+|tsproj|tspproj|xti|plcproj|tmc)$/i;

  function isTwinCatPath(path) {
    return TWINCAT_EXT_RE.test(path);
  }

  function extOf(path) {
    const m = /\.([^./\\]+)$/.exec(path);
    return m ? m[1].toLowerCase() : "";
  }

  function newNoise() {
    return { lineIds: [], versions: [], guids: [] };
  }

  // Retire en place les blocs <LineIds> et mémorise leur contenu pour la détection de bruit.
  function stripLineIds(el, noise) {
    el.children = el.children.filter((c) => {
      if (c.tag === "LineIds") {
        noise.lineIds.push(X.toXml(c));
        return false;
      }
      stripLineIds(c, noise);
      return true;
    });
  }

  function cleanCode(text) {
    // Fins de ligne normalisées ; lignes vides de fin retirées (TwinCAT en ajoute selon les versions).
    return text.replace(/\r\n?/g, "\n").replace(/\s+$/, "");
  }

  // ---------- Objets PLC (TcPOU, TcDUT, TcGVL, TcIO, TcTTO, ...) ----------

  const CHILD_LABELS = {
    Method: "Méthode",
    Action: "Action",
    Transition: "Transition",
    Property: "Propriété",
  };

  const OBJECT_LABELS = { POU: "POU", DUT: "DUT", GVL: "GVL", Itf: "Interface", Task: "Tâche" };

  function declHeadline(el) {
    const decl = X.child(el, "Declaration");
    if (!decl) return "";
    // Premier mot-clé significatif (FUNCTION_BLOCK, PROGRAM, TYPE, ...), hors attributs {attribute ...}.
    const m = /^\s*(?:\{[^}]*\}\s*|\(\*[\s\S]*?\*\)\s*|\/\/[^\n]*\n\s*)*([A-Z_]+)/.exec(decl.text);
    return m ? m[1] : "";
  }

  function attrProps(el, skip, noise) {
    const props = {};
    for (const a of el.attrOrder) {
      if (skip.has(a)) continue;
      const v = el.attrs[a];
      if (VERSION_ATTRS.has(a)) {
        noise.versions.push(`${a}=${v}`);
        continue;
      }
      if (GUID_RE.test(v)) {
        noise.guids.push(`${a}=${v}`);
        continue;
      }
      props[a] = v;
    }
    return props;
  }

  function implementationSection(impl, key, label) {
    const st = X.child(impl, "ST");
    if (st) return { key, label, kind: "code", lang: "st", text: cleanCode(st.text) };
    const lang = impl.children[0];
    if (!lang) return { key, label, kind: "code", lang: "st", text: "" };
    // Langage graphique : pas de texte ST, on montre le XML réindenté plutôt que rien.
    return {
      key,
      label: `${label} (${lang.tag}, non textuel)`,
      kind: "code",
      lang: "xml",
      text: X.toXml(lang),
    };
  }

  // Sections d'un objet PLC et de ses sous-objets (méthodes, actions, transitions, propriétés).
  function plcObjectSections(el, keyPrefix, labelPrefix, noise, out) {
    const props = attrProps(el, new Set(["Name"]), noise);
    if (Object.keys(props).length) {
      out.push({ key: `${keyPrefix}#attrs`, label: `${labelPrefix} · attributs`, kind: "props", props });
    }
    for (const c of el.children) {
      if (c.tag === "Declaration") {
        out.push({ key: `${keyPrefix}#decl`, label: `${labelPrefix} · déclaration`, kind: "code", lang: "st", text: cleanCode(c.text) });
      } else if (c.tag === "Implementation") {
        out.push(implementationSection(c, `${keyPrefix}#impl`, `${labelPrefix} · implémentation`));
      } else if (CHILD_LABELS[c.tag]) {
        const name = c.attrs.Name || "?";
        const folder = c.attrs.FolderPath ? `${c.attrs.FolderPath.replace(/\\$/, "")}\\` : "";
        plcObjectSections(c, `${keyPrefix}/${c.tag}:${name}`, `${CHILD_LABELS[c.tag]} ${folder}${name}`, noise, out);
      } else if (c.tag === "Get" || c.tag === "Set") {
        plcObjectSections(c, `${keyPrefix}/${c.tag}`, `${labelPrefix} · ${c.tag}`, noise, out);
      } else if (c.tag === "Folder") {
        // Simple dossier d'organisation dans l'arbre du projet, sans contenu.
      } else {
        const p = {};
        flatten(c, "", p, noise, []);
        if (Object.keys(p).length) out.push({ key: `${keyPrefix}/${c.tag}`, label: `${labelPrefix} · ${c.tag}`, kind: "props", props: p });
      }
    }
  }

  function modelPlcObject(rootEl, noise) {
    const sections = [];
    attrProps(rootEl, new Set(["Version"]), noise);
    let title = "";
    for (const obj of rootEl.children) {
      const name = obj.attrs.Name || obj.tag;
      const kindWord = obj.tag === "POU" ? declHeadline(obj) || "POU" : OBJECT_LABELS[obj.tag] || obj.tag;
      if (!title) title = `${kindWord} ${name}`;
      if (obj.tag === "Task") {
        // Tâche (.TcTTO) : tout en propriétés, les GUID internes partent dans le bruit.
        const props = {};
        flatten(obj, "", props, noise, ["Name"]);
        sections.push({ key: `${obj.tag}:${name}`, label: `Tâche ${name}`, kind: "props", props });
      } else {
        plcObjectSections(obj, `${obj.tag}:${name}`, kindWord === name ? name : `${kindWord} ${name}`, noise, sections);
      }
    }
    return { title, sections };
  }

  // ---------- Aplatissement générique (tsproj, xti, plcproj, ...) ----------

  // Éléments sans identité propre : on ne les fait pas apparaître dans le chemin,
  // sinon un simple réordonnancement des groupes décalerait toutes les clés.
  const TRANSPARENT = new Set(["ItemGroup", "PropertyGroup"]);
  const IDENT_ATTRS = ["Name", "Include", "Identifier", "VarA"];

  function identOf(el) {
    for (const a of IDENT_ATTRS) {
      if (el.attrs[a] !== undefined) {
        if (a === "VarA" && el.attrs.VarB !== undefined) return { value: `${el.attrs.VarA} ↔ ${el.attrs.VarB}`, attrs: ["VarA", "VarB"] };
        return { value: el.attrs[a], attrs: [a] };
      }
    }
    const nameChild = X.child(el, "Name");
    if (nameChild && !nameChild.children.length && nameChild.text.trim()) return { value: nameChild.text.trim(), child: nameChild };
    return null;
  }

  function flatten(el, path, props, noise, skipAttrs) {
    const skip = new Set(skipAttrs || []);
    const own = attrProps(el, skip, noise);
    for (const [a, v] of Object.entries(own)) props[`${path}@${a}`] = v;

    const text = el.text.trim();
    if (!el.children.length && text) {
      if (GUID_RE.test(text)) noise.guids.push(`${path}=${text}`);
      else props[path || "(valeur)"] = text;
    }

    const counts = {};
    for (const c of el.children) counts[c.tag] = (counts[c.tag] || 0) + 1;
    const seen = {};
    const skipChild = (identOf(el) || {}).child;

    for (const c of el.children) {
      if (c === skipChild) continue;
      if (TRANSPARENT.has(c.tag) && c.attrs.Condition === undefined) {
        flatten(c, path, props, noise, []);
        continue;
      }
      const id = identOf(c);
      let seg = c.tag;
      if (id) seg += `[${id.value}]`;
      else if (counts[c.tag] > 1) {
        seen[c.tag] = (seen[c.tag] || 0) + 1;
        seg += `[${seen[c.tag]}]`;
      }
      const p = path ? `${path}/${seg}` : seg;
      const before = Object.keys(props).length;
      flatten(c, p, props, noise, id && id.attrs ? id.attrs : []);
      // Élément sans valeur propre (ex. lien I/O ou dossier) : on le garde pour voir les ajouts/suppressions.
      if (Object.keys(props).length === before && id) props[p] = "✓";
    }
  }

  const PLCPROJ_GROUPS = [
    [/^(Compile|None|Content|EmbeddedResource)\[/, "Fichiers"],
    [/^Folder\[/, "Dossiers"],
    [/^(PlaceholderReference|PlaceholderResolution|LibraryReference|SupportFiles)\[/, "Bibliothèques"],
    [/^ProjectExtensions/, "Extensions"],
  ];

  function groupPlcproj(key) {
    for (const [re, label] of PLCPROJ_GROUPS) if (re.test(key)) return label;
    return "Propriétés du projet";
  }

  // tsproj/xti : une section par élément de niveau 3 (ex. Project/Io/Device[EtherCAT Master]).
  function groupTsproj(key) {
    const segs = key.split("@")[0].split("/");
    return segs.slice(0, 3).join(" › ") || "(racine)";
  }

  function modelGeneric(rootEl, noise, groupFn) {
    const props = {};
    flatten(rootEl, "", props, noise, []);
    const groups = new Map();
    for (const [k, v] of Object.entries(props)) {
      const g = groupFn(k);
      if (!groups.has(g)) groups.set(g, {});
      groups.get(g)[k] = v;
    }
    const sections = [...groups].map(([g, p]) => ({ key: g, label: g, kind: "props", props: p }));
    return { title: rootEl.tag, sections };
  }

  // ---------- Point d'entrée ----------

  function modelFile(path, content) {
    const noise = newNoise();
    const ext = extOf(path);
    let rootEl;
    try {
      rootEl = X.parseXml(content);
    } catch (e) {
      return { path, ext, error: e.message, sections: [], noise };
    }
    stripLineIds(rootEl, noise);

    let m;
    if (rootEl.tag === "TcPlcObject") m = modelPlcObject(rootEl, noise);
    else if (ext === "plcproj") m = modelGeneric(rootEl, noise, groupPlcproj);
    else m = modelGeneric(rootEl, noise, groupTsproj);

    return { path, ext, title: m.title, sections: m.sections, noise };
  }

  const api = { modelFile, isTwinCatPath, GUID_RE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
