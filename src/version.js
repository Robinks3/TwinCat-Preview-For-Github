// TcPR Viewer : vue structurée des fichiers TwinCAT dans les PR GitHub.
//
// Changelog (une version = une ligne) :
//   0.1.0 - Version initiale : parseur XML, modèle TwinCAT (POU/DUT/GVL/Itf/TTO/plcproj/tsproj), diff par section, overlay GitHub.
//   0.1.1 - xml.js parseXml : positions start/end des éléments et des CDATA, pour situer chaque ligne du fichier.
//   0.1.2 - lines.js classifyLines : rôle de chaque ligne (code ST sans CDATA, échafaudage, bruit, config), base de la mise en forme en place.
//   0.1.3 - background.js/content.js : clic sur l'icône de l'extension pour ouvrir ou fermer la vue (le clic ne faisait rien).

(function (root) {
  const SCRIPT_VERSION = "0.1.3";
  const SCRIPT_DATE = "2026-10-14";

  const api = { SCRIPT_VERSION, SCRIPT_DATE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
