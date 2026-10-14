// TcPR Viewer : vue structurée des fichiers TwinCAT dans les PR GitHub.
//
// Changelog (une version = une ligne) :
//   0.1.0 - Version initiale : parseur XML, modèle TwinCAT (POU/DUT/GVL/Itf/TTO/plcproj/tsproj), diff par section, overlay GitHub.

(function (root) {
  const SCRIPT_VERSION = "0.1.0";
  const SCRIPT_DATE = "2026-10-14";

  const api = { SCRIPT_VERSION, SCRIPT_DATE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
