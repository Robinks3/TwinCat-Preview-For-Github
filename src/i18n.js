// Textes de l'interface en français et en anglais, selon la langue du navigateur
// (français si elle commence par « fr », anglais sinon).
//
// t("clé", { n: 3 })      -> texte avec paramètres {n}
// tn("clé", n, { ... })   -> pluriel : clé.one ou clé.other selon n (règles française ou anglaise)

(function (root) {
  const DICT = {
    fr: {
      // États
      "status.added": "ajouté",
      "status.removed": "supprimé",
      "status.modified": "modifié",
      "status.renamed": "renommé",
      "status.unchanged": "inchangé",
      "status.noise": "bruit XML seulement",

      // Code et propriétés
      "code.more": "Afficher les {n} lignes suivantes",
      "code.skip.one": "⋯ {n} ligne inchangée",
      "code.skip.other": "⋯ {n} lignes inchangées",
      "code.showAll": "Afficher tout",
      "props.key": "Propriété",
      "props.before": "Avant",
      "props.after": "Après",
      "props.more": "Afficher les {n} propriétés suivantes",
      "props.hidden.one": "{n} propriété inchangée masquée",
      "props.hidden.other": "{n} propriétés inchangées masquées",

      // Parties et nœuds
      "part.decl": "Déclaration",
      "part.impl": "Code",
      "part.attrs": "Attributs",
      "part.props": "Propriétés",
      "part.show": "Afficher ({n} lignes)",
      "node.hidden.one": "{n} élément inchangé",
      "node.hidden.other": "{n} éléments inchangés",

      // Fichiers
      "file.cannotAnalyze": "Impossible d'analyser ce fichier : {err}",
      "file.badXml": "XML illisible : {err}",
      "file.downloading": "Téléchargement…",
      "file.big": "Fichier volumineux ({mo} Mo) : analyse à la demande pour ne pas figer la page. ",
      "file.analyze": "Analyser",
      "file.heavy": "Fichier probablement volumineux : téléchargement à la demande. ",
      "file.fetchAnalyze": "Télécharger et analyser",
      "file.noise": "Bruit ignoré : {list}",
      "file.noSections": "Aucune section structurée.",

      // Panneau
      "panel.loading": "Chargement…",
      "panel.aria": "Vue TwinCAT",
      "panel.title": "Vue TwinCAT · PR #{n}",
      "panel.navLabel": "Arborescence des fichiers TwinCAT",
      "panel.navToggle": "☰ Arbre",
      "panel.navToggleTitle": "Afficher / masquer l'arborescence",
      "panel.split": "Côte à côte",
      "panel.ignoreWs": "Ignorer les espaces",
      "panel.showUnchanged": "Montrer l'inchangé",
      "panel.close": "Fermer (Échap)",
      "panel.noFiles": "Aucun fichier TwinCAT dans cette PR.",
      "panel.loadFailed": "Échec du chargement : {err}",
      "status.files.one": "{n} fichier TwinCAT",
      "status.files.other": "{n} fichiers TwinCAT",
      "status.fetched": "{fetched}/{toFetch} modifiés téléchargés",
      "status.diff": "diff {sec} ({kb} Ko)",
      "sha.src.page": "page",
      "sha.src.branche": "branche",
      "sha.src..patch": ".patch",
      "sha.src.aucun": "aucune",

      // Barre d'outils
      "bar.inline": "TwinCAT : intégré",
      "bar.inlineOn": "TwinCAT : intégré ✓",
      "bar.inlineTitle": "Mettre en forme les fichiers TwinCAT directement dans le diff (icône de l'extension)",
      "bar.panel": "Panneau",
      "bar.panelTitle": "Vue d'ensemble en panneau (Alt+T)",
      "bar.debugTitle": "Mode debug : journal des temps de chargement",

      // Panneau de debug et rapport
      "debug.title": "Debug TcReview",
      "debug.copy": "Copier le rapport",
      "debug.copied": "Copié ✓",
      "debug.selectCopy": "Sélectionne et copie le texte",
      "debug.previous": "Rapport précédent",
      "debug.previousTitle": "Journal sauvegardé de la session précédente (utile après une page figée)",
      "debug.none": "Aucun",
      "debug.shownBelow": "Affiché ci-dessous",
      "debug.clear": "Vider",
      "debug.disable": "Désactiver",
      "debug.closeTitle": "Fermer (le journal continue)",
      "report.title": "{name} {v} · rapport debug",
      "report.page": "Page : {p}",
      "report.browser": "Navigateur : {b}",
      "report.events": "Événements : {n}",
      "report.loader": "Chargeur : {s}",
      "report.loaderFail": "Chargeur : échec ({err})",
      "report.inline": "Mise en forme intégrée : {state} · tables de diff : {tables} · lignes : {rows}",
      "report.on": "active",
      "report.off": "inactive",
      "report.synth": "Synthèse (étapes chronométrées) :",
      "report.log": "Journal :",
      "report.saved": "Journal sauvegardé · {date} · {page}",

      // Journal de debug
      "log.start": "début · {msg}",
      "log.longTask": "tâche longue (page bloquée)",
      "log.enabled": "mode debug activé",
      "log.loaderCreate": "création pour {id}",
      "log.fail": "échec",
      "log.parseDiff": "lecture du .diff",
      "log.resolve": "résolution de la version après",
      "log.sourceRefused": "source « {s} » refusée",
      "log.exact": "classement exact {p}",
      "log.exactFail": "classement exact impossible {p}",
      "log.bigTable": "grosse table {f}",
      "log.pass": "passe {f}",
      "log.inlineOn": "mise en forme intégrée activée",
      "log.inlineOff": "mise en forme intégrée désactivée",
      "log.noTables": "aucune table de diff de la nouvelle vue GitHub sur cette page (onglet « Files changed » ?)",
      "log.deferred": "analyse différée ({mo} Mo) {p}",
      "log.unmounted": "démonté {p}",
      "mode.exact": "exact",
      "mode.heuristic": "heuristique",
      "absent": "absent",
      "absente": "absente",
      "yes": "oui",
      "no": "non",

      // Libellés TwinCAT
      "label.method": "Méthode",
      "label.property": "Propriété",
      "label.action": "Action",
      "label.transition": "Transition",
      "label.interface": "Interface",
      "label.task": "Tâche",
      "sec.decl": "déclaration",
      "sec.impl": "implémentation",
      "sec.attrs": "attributs",
      "sec.nonText": "{label} ({lang}, non textuel)",
      "group.props": "Propriétés du projet",
      "group.files": "Fichiers",
      "group.folders": "Dossiers",
      "group.libs": "Bibliothèques",
      "group.ext": "Extensions",
      "group.root": "(racine)",
      "noise.version": "version XAE ({a} → {b})",
      "noise.none": "aucune",

      // Chargement et erreurs
      "progress.diff": "Récupération du diff de la PR…",
      "err.hunkOut": "hunk @@ +{n} hors du fichier",
      "err.mismatch": "le diff ne correspond pas au fichier (ligne {n})",
      "err.noSha": "SHA du dernier commit introuvable dans le .patch",
      "err.binary": "fichier traité comme binaire par GitHub",
      "err.notInDiff": "fichier absent du .diff",
      "err.timeout": "délai de 60 s dépassé",
      "err.refused": "URL refusée",
      "err.failed": "échec",
      "err.on": "{what} sur {url}",
      "xml.invalid": "XML invalide ({msg}) vers le caractère {i}",
      "xml.unclosed": "{what} non fermé",
      "xml.cdata": "CDATA",
      "xml.comment": "commentaire",
      "xml.pi": "instruction",
      "xml.decl": "déclaration",
      "xml.closeTag": "balise fermante",
      "xml.openTag": "balise ouvrante",
      "xml.unexpected": "</{name}> inattendu",
      "xml.emptyName": "nom de balise vide",
      "xml.attrNoValue": "attribut {a} sans valeur",
      "xml.attrNoQuote": "attribut {a} sans guillemets",
      "xml.valueUnclosed": "valeur de {a} non fermée",
      "xml.noRoot": "aucun élément racine",

      // Catégories du journal et clés de données
      "cat.réseau": "réseau",
      "cat.analyse": "analyse",
      "cat.rendu": "rendu",
      "cat.intégré": "intégré",
      "cat.sha": "sha",
      "cat.chargeur": "chargeur",
      "cat.page": "page",
      "cat.gel": "gel",
      "cat.debug": "debug",
    },

    en: {
      "status.added": "added",
      "status.removed": "removed",
      "status.modified": "modified",
      "status.renamed": "renamed",
      "status.unchanged": "unchanged",
      "status.noise": "XML noise only",

      "code.more": "Show the next {n} lines",
      "code.skip.one": "⋯ {n} unchanged line",
      "code.skip.other": "⋯ {n} unchanged lines",
      "code.showAll": "Show all",
      "props.key": "Property",
      "props.before": "Before",
      "props.after": "After",
      "props.more": "Show the next {n} properties",
      "props.hidden.one": "{n} unchanged property hidden",
      "props.hidden.other": "{n} unchanged properties hidden",

      "part.decl": "Declaration",
      "part.impl": "Code",
      "part.attrs": "Attributes",
      "part.props": "Properties",
      "part.show": "Show ({n} lines)",
      "node.hidden.one": "{n} unchanged item",
      "node.hidden.other": "{n} unchanged items",

      "file.cannotAnalyze": "Cannot analyze this file: {err}",
      "file.badXml": "Unreadable XML: {err}",
      "file.downloading": "Downloading…",
      "file.big": "Large file ({mo} MB): analyzed on demand to keep the page responsive. ",
      "file.analyze": "Analyze",
      "file.heavy": "Probably a large file: downloaded on demand. ",
      "file.fetchAnalyze": "Download and analyze",
      "file.noise": "Ignored noise: {list}",
      "file.noSections": "No structured section.",

      "panel.loading": "Loading…",
      "panel.aria": "TwinCAT view",
      "panel.title": "TwinCAT view · PR #{n}",
      "panel.navLabel": "TwinCAT file tree",
      "panel.navToggle": "☰ Tree",
      "panel.navToggleTitle": "Show / hide the tree",
      "panel.split": "Side by side",
      "panel.ignoreWs": "Ignore whitespace",
      "panel.showUnchanged": "Show unchanged",
      "panel.close": "Close (Esc)",
      "panel.noFiles": "No TwinCAT file in this PR.",
      "panel.loadFailed": "Loading failed: {err}",
      "status.files.one": "{n} TwinCAT file",
      "status.files.other": "{n} TwinCAT files",
      "status.fetched": "{fetched}/{toFetch} modified files downloaded",
      "status.diff": "diff {sec} ({kb} KB)",
      "sha.src.page": "page",
      "sha.src.branche": "branch",
      "sha.src..patch": ".patch",
      "sha.src.aucun": "none",

      "bar.inline": "TwinCAT: inline",
      "bar.inlineOn": "TwinCAT: inline ✓",
      "bar.inlineTitle": "Format TwinCAT files directly in the diff (extension icon)",
      "bar.panel": "Panel",
      "bar.panelTitle": "Overview panel (Alt+T)",
      "bar.debugTitle": "Debug mode: loading time log",

      "debug.title": "TcReview debug",
      "debug.copy": "Copy report",
      "debug.copied": "Copied ✓",
      "debug.selectCopy": "Select and copy the text",
      "debug.previous": "Previous report",
      "debug.previousTitle": "Saved log of the previous session (useful after a frozen page)",
      "debug.none": "None",
      "debug.shownBelow": "Shown below",
      "debug.clear": "Clear",
      "debug.disable": "Disable",
      "debug.closeTitle": "Close (logging continues)",
      "report.title": "{name} {v} · debug report",
      "report.page": "Page: {p}",
      "report.browser": "Browser: {b}",
      "report.events": "Events: {n}",
      "report.loader": "Loader: {s}",
      "report.loaderFail": "Loader: failed ({err})",
      "report.inline": "Inline formatting: {state} · diff tables: {tables} · rows: {rows}",
      "report.on": "on",
      "report.off": "off",
      "report.synth": "Summary (timed steps):",
      "report.log": "Log:",
      "report.saved": "Log saved · {date} · {page}",

      "log.start": "start · {msg}",
      "log.longTask": "long task (page blocked)",
      "log.enabled": "debug mode enabled",
      "log.loaderCreate": "created for {id}",
      "log.fail": "failed",
      "log.parseDiff": "parsing the .diff",
      "log.resolve": "resolving the head version",
      "log.sourceRefused": "source \"{s}\" rejected",
      "log.exact": "exact classification {p}",
      "log.exactFail": "exact classification failed {p}",
      "log.bigTable": "large table {f}",
      "log.pass": "pass {f}",
      "log.inlineOn": "inline formatting enabled",
      "log.inlineOff": "inline formatting disabled",
      "log.noTables": "no diff table of the new GitHub view on this page (\"Files changed\" tab?)",
      "log.deferred": "analysis deferred ({mo} MB) {p}",
      "log.unmounted": "unmounted {p}",
      "mode.exact": "exact",
      "mode.heuristic": "heuristic",
      "absent": "absent",
      "absente": "absent",
      "yes": "yes",
      "no": "no",

      "label.method": "Method",
      "label.property": "Property",
      "label.action": "Action",
      "label.transition": "Transition",
      "label.interface": "Interface",
      "label.task": "Task",
      "sec.decl": "declaration",
      "sec.impl": "implementation",
      "sec.attrs": "attributes",
      "sec.nonText": "{label} ({lang}, non-textual)",
      "group.props": "Project properties",
      "group.files": "Files",
      "group.folders": "Folders",
      "group.libs": "Libraries",
      "group.ext": "Extensions",
      "group.root": "(root)",
      "noise.version": "XAE version ({a} → {b})",
      "noise.none": "none",

      "progress.diff": "Fetching the PR diff…",
      "err.hunkOut": "hunk @@ +{n} outside the file",
      "err.mismatch": "the diff does not match the file (line {n})",
      "err.noSha": "last commit SHA not found in the .patch",
      "err.binary": "file treated as binary by GitHub",
      "err.notInDiff": "file not in the .diff",
      "err.timeout": "60 s timeout exceeded",
      "err.refused": "URL rejected",
      "err.failed": "failed",
      "err.on": "{what} on {url}",
      "xml.invalid": "Invalid XML ({msg}) near character {i}",
      "xml.unclosed": "unclosed {what}",
      "xml.cdata": "CDATA",
      "xml.comment": "comment",
      "xml.pi": "processing instruction",
      "xml.decl": "declaration",
      "xml.closeTag": "closing tag",
      "xml.openTag": "opening tag",
      "xml.unexpected": "unexpected </{name}>",
      "xml.emptyName": "empty tag name",
      "xml.attrNoValue": "attribute {a} without a value",
      "xml.attrNoQuote": "attribute {a} without quotes",
      "xml.valueUnclosed": "unclosed value of {a}",
      "xml.noRoot": "no root element",

      "cat.réseau": "network",
      "cat.analyse": "analysis",
      "cat.rendu": "render",
      "cat.intégré": "inline",
      "cat.sha": "sha",
      "cat.chargeur": "loader",
      "cat.page": "page",
      "cat.gel": "freeze",
      "cat.debug": "debug",
    },
  };

  // Clés des données du journal de debug (gardées en français dans le code, traduites à l'affichage).
  const DATA_KEYS_EN = {
    ko: "kb", statut: "status", erreur: "error", fichiers: "files", modifiés: "modified", lignes: "rows",
    écrites: "written", masquées: "hidden", noeuds: "nodes", indice: "hint", indice_sha: "sha_hint",
    indice_branche: "branch_hint", sha_page: "page_sha", branche: "branch", vue: "view",
  };

  function detect() {
    try {
      const forced = typeof localStorage !== "undefined" && localStorage.getItem("tcpr-lang");
      if (forced === "fr" || forced === "en") return forced;
    } catch (e) {
      // stockage indisponible
    }
    let l = "";
    try {
      if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getUILanguage) l = chrome.i18n.getUILanguage();
    } catch (e) {
      // contexte sans chrome.i18n (pages de test)
    }
    if (!l && typeof navigator !== "undefined") l = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    return /^fr\b/i.test(l) ? "fr" : "en";
  }

  let lang = detect();

  function t(key, params) {
    const s = DICT[lang][key] !== undefined ? DICT[lang][key] : DICT.fr[key] !== undefined ? DICT.fr[key] : key;
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
  }

  // Pluriel : en français, 0 et 1 sont au singulier ; en anglais, seul 1 l'est.
  function tn(key, n, params) {
    const one = lang === "fr" ? n <= 1 : n === 1;
    return t(`${key}.${one ? "one" : "other"}`, Object.assign({ n }, params));
  }

  // Nombre décimal à la mode de la langue (virgule en français).
  function num(x, digits) {
    const s = x.toFixed(digits);
    return lang === "fr" ? s.replace(".", ",") : s;
  }

  function dataKey(k) {
    return lang === "en" && DATA_KEYS_EN[k] ? DATA_KEYS_EN[k] : k;
  }

  const api = {
    t,
    tn,
    i18n: {
      get lang() {
        return lang;
      },
      setLang: (l) => (lang = l === "fr" ? "fr" : "en"),
      num,
      dataKey,
      dict: DICT,
    },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
