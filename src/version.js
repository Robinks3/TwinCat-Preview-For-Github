// TcPR Viewer : vue structurée des fichiers TwinCAT dans les PR GitHub.
//
// Changelog (une version = une ligne) :
//   0.1.0 - Version initiale : parseur XML, modèle TwinCAT (POU/DUT/GVL/Itf/TTO/plcproj/tsproj), diff par section, overlay GitHub.
//   0.1.1 - xml.js parseXml : positions start/end des éléments et des CDATA, pour situer chaque ligne du fichier.
//   0.1.2 - lines.js classifyLines : rôle de chaque ligne (code ST sans CDATA, échafaudage, bruit, config), base de la mise en forme en place.
//   0.1.3 - background.js/content.js : clic sur l'icône de l'extension pour ouvrir ou fermer la vue (le clic ne faisait rien).
//   0.1.4 - ui.js/content.js : statut affiché dès l'ouverture et étapes de chargement (le panneau restait vide sans indication sur une grosse PR).
//   0.1.5 - github.js/content.js loadPrFiles : SHA de tête lu dans la page (headOid), vérifié sur un fichier, repli sur le .patch (trop lourd sur une grosse PR).
//   0.1.6 - github.js loadPrFiles : téléchargement des fichiers en parallèle (6 à la fois), affichage toujours dans l'ordre du diff.

(function (root) {
  const SCRIPT_VERSION = "0.1.6";
  const SCRIPT_DATE = "2026-10-14";

  const api = { SCRIPT_VERSION, SCRIPT_DATE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
