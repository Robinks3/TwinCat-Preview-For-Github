// TwinCAT Preview for GitHub : vue structurée des fichiers TwinCAT dans les PR GitHub.
//
// Changelog (une version = une ligne) :
//   0.1.0 - Version initiale : parseur XML, modèle TwinCAT (POU/DUT/GVL/Itf/TTO/plcproj/tsproj), diff par section, overlay GitHub.
//   0.1.1 - xml.js parseXml : positions start/end des éléments et des CDATA, pour situer chaque ligne du fichier.
//   0.1.2 - lines.js classifyLines : rôle de chaque ligne (code ST sans CDATA, échafaudage, bruit, config), base de la mise en forme en place.
//   0.1.3 - background.js/content.js : clic sur l'icône de l'extension pour ouvrir ou fermer la vue (le clic ne faisait rien).
//   0.1.4 - ui.js/content.js : statut affiché dès l'ouverture et étapes de chargement (le panneau restait vide sans indication sur une grosse PR).
//   0.1.5 - github.js/content.js loadPrFiles : SHA de tête lu dans la page (headOid), vérifié sur un fichier, repli sur le .patch (trop lourd sur une grosse PR).
//   0.1.6 - github.js loadPrFiles : téléchargement des fichiers en parallèle (6 à la fois), affichage toujours dans l'ordre du diff.
//   0.1.7 - diff.js diffLines : diff de Myers au lieu d'une table LCS N×M (centaines de Mo sur un gros POU, plantage sur les grosses PR).
//   0.1.8 - model.js/ui.js : affichage en arborescence TwinCAT (POU > méthodes/propriétés > Get/Set), déclaration et code distincts, navigation à gauche.
//   0.1.9 - ui.js createOverlay : rendu progressif des fichiers (en-tête immédiat, contenu à l'approche de l'écran), plus de redessin complet par fichier reçu.
//   0.1.10 - github.js loadEntry : fichiers ajoutés reconstruits depuis le diff, sans téléchargement (déjà entiers dans le .diff).
//   0.1.11 - github.js/background.js/ui.js : liste des fichiers affichée dès le .diff, gros fichier lent non bloquant, délai de 60 s par requête.
//   0.1.12 - github.js createPrLoader/content.js : téléchargement à la demande (carte proche de l'écran), une seule fois par fichier et par page.
//   0.1.13 - debug.js + instrumentation : mode debug (journal des requêtes, SHA, analyse, rendu) et rapport copiable pour diagnostiquer les lenteurs.
//   0.1.14 - inline.js : mise en forme dans le diff GitHub lui-même (bruit masqué, ST sans CDATA, bandeaux de section), commentaires conservés.
//   0.1.15 - content.js : barre d'outils (intégré / panneau / debug), chargeur partagé, l'icône de l'extension active la mise en forme intégrée.
//   0.1.16 - github.js/content.js : version après lue par la branche de tête de la page avant le repli sur le .patch (SHA absent après navigation sans rechargement).
//   0.1.17 - inline.js : objets PLC seulement (plus les .tsproj/.xti géants) et une passe au plus toutes les 400 ms par table (coût quadratique sur grosse PR).
//   0.1.18 - ui.js : analyse d'un fichier à la fois, analyse sur clic au-delà de 1,5 Mo, listes plafonnées avec « afficher la suite ».
//   0.1.19 - debug.js : journal sauvegardé en continu (rapport précédent après une page figée), repères « début » et tâches longues.
//   0.1.20 - ui.js : virtualisation du panneau comme GitHub (démontage hors écran, cache d'analyses borné, budget de 800 lignes par fichier).
//   0.1.21 - github.js createPrLoader : version après vérifiée sur le plus petit objet PLC, plus sur le premier fichier venu (un .tsproj de 6 Mo retardait tout).
//   0.1.22 - github.js/ui.js : fichiers lourds (.tsproj, .tmc, diff énorme) téléchargés seulement sur clic.
//   0.1.23 - ui.js : démontage avec hystérésis (1 500 / 5 000 px) et cache d'analyses borné par volume, plus de réanalyses à chaque aller-retour.
//   0.1.24 - ui.js/styles.css : panneau pleine largeur, marges et retraits réduits, arborescence repliable (bouton « Arbre », mémorisé).
//   0.1.25 - ui.js renderCodeSplit : vue côte à côte avant | après des sections modifiées, lignes appariées, activée par défaut et mémorisée.
//   0.1.26 - manifest.json/version.js/ui.js : extension renommée « TcReview for GitHub » (nom du dépôt public), documentation et page de confidentialité.
//   0.1.27 - i18n.js + tous les modules + _locales : interface en français ou en anglais selon la langue du navigateur (nom, panneau, vue intégrée, debug, erreurs).
//   0.1.28 - _locales/ui.js/debug.js/i18n.js + docs : extension renommée « TwinCAT Preview for GitHub », comme le dépôt public.
//   0.1.29 - ui.js renderCodeSplit : largeurs de colonnes fixées par colgroup (une première ligne « lignes inchangées » donnait 4 colonnes égales).
//   0.1.30 - styles.css : sur une ligne à bandeau, numéros de ligne et marqueur +/- alignés sur le code plutôt que sur le bandeau.
//   0.1.31 - ui.js fillFileBody : nœuds inchangés masqués aussi au premier niveau d'un fichier (groupes vides du .plcproj affichés).
//   0.1.32 - ui.js signatureOf : signature prise après les commentaires et pragmas (« (* » affiché pour un FB commenté).
//   0.1.33 - ui.js/content.js/styles.css : observateurs débranchés à la fermeture du panneau (démontages fantômes), marge de la mention « propriétés masquées ».

(function (root) {
  const SCRIPT_VERSION = "0.1.33";
  const SCRIPT_DATE = "2026-10-14";

  const api = { SCRIPT_VERSION, SCRIPT_DATE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
