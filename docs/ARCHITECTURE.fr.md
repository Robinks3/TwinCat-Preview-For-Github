# Architecture

[English](ARCHITECTURE.md) · **Français**

Extension Chrome Manifest V3 en JavaScript pur, sans dépendance ni étape de build : le dossier se charge tel quel. Chaque module `src/*.js` s'exporte par `module.exports` (tests Node) ou sur `globalThis.TcPr` (navigateur).

## Vue d'ensemble

```
github.com (page de PR)
  content.js ── barre d'outils, raccourcis, suivi de la navigation sans rechargement
     │
     ├── inline.js ── mise en forme dans le diff GitHub (lignes de GitHub conservées)
     │      └── lines.js ── rôle de chaque ligne d'un fichier (code, échafaudage, bruit, config)
     │
     ├── ui.js ── panneau virtualisé (arborescence, côte à côte, propriétés)
     │      ├── model.js ── fichier TwinCAT → sections comparables
     │      └── diff.js ── diff de Myers, diff par section et par propriété
     │
     └── github.js ── chargeur de PR à la demande ──► background.js (service worker) ──► github.com
            xml.js ── parseur XML minimal avec positions (commun à tous)
            debug.js ── journal, chronomètres, rapport
            i18n.js ── textes français / anglais selon la langue du navigateur
```

## Récupération des données

Aucun token : les requêtes partent du service worker avec la session GitHub du navigateur. `background.js` n'accepte que trois formes d'URL de github.com : `/pull/N.diff`, `/pull/N.patch` et `/raw/<sha ou refs/heads/branche>/<chemin>`. Délai maximal de 60 s par requête.

Le chargeur (`createPrLoader`) :

1. télécharge `/pull/N.diff` une fois par page : liste des fichiers TwinCAT et hunks contre la merge-base. Un fichier ajouté ou supprimé y est complet ;
2. pour un fichier modifié, télécharge seulement à la demande la version après (`/raw/...`) puis reconstruit la version avant en appliquant les hunks à l'envers, avec contrôle à chaque ligne ;
3. détermine la version après en essayant, dans l'ordre, le SHA présent dans la page, la branche de tête affichée dans la page, puis le SHA du `.patch` (lourd). Chaque source est vérifiée sur un petit objet PLC témoin ; une source périmée échoue au contrôle et passe à la suivante ;
4. mémorise chaque fichier : jamais deux téléchargements du même fichier dans une page.

## Mise en forme intégrée (`inline.js`)

GitHub dessine le diff en React. Pour coexister :

- aucune ligne n'est créée ni supprimée ; seuls des attributs `data-tcr-*` (masquage, partie, état) et des éléments de classe `tcr-*` (texte ST coloré, bandeau) sont ajoutés ;
- un `MutationObserver` réapplique la mise en forme quand GitHub redessine ; nos propres insertions sont ignorées ;
- chaque cellule de code donne ses numéros de ligne avant / après (`data-diff-line-key="b:…-l:…-r:…"`), ce qui permet d'appliquer le classement exact de `lines.js` calculé sur le fichier complet ;
- seules les tables proches de l'écran sont traitées, par tranches de 12 ms, au plus une passe toutes les 400 ms par table.

## Panneau (`ui.js`)

- `model.js` découpe un fichier en sections avec leur place dans l'arborescence (`tree`) et leur rôle (`part` : déclaration, implémentation, attributs, propriétés) ; le bruit (LineIds, GUID, versions) est extrait à part pour signaler « bruit XML seulement ».
- `diff.js` compare les sections clé par clé (méthode, propriété, Get/Set...), en diff de lignes de Myers pour le code et en diff clé / valeur pour la configuration.
- Virtualisation : une carte est montée à 1 500 px de l'écran et démontée au-delà de 5 000 px (hystérésis), `content-visibility: auto`, cache d'analyses borné à 40 Mo de sources, budget de 800 lignes affichées d'office par fichier.
- Tout contenu issu d'une PR est inséré par `textContent`, jamais par `innerHTML`.

## Langues

Tous les textes visibles passent par `src/i18n.js` (`t(clé, paramètres)`, `tn(clé, n)` pour les pluriels), qui contient les dictionnaires français et anglais. La langue est celle de l'interface du navigateur (`chrome.i18n.getUILanguage()`), forçable par `localStorage["tcpr-lang"]`. Le nom et la description de l'extension sont dans `_locales/`. Un test vérifie que chaque clé existe dans les deux langues.

## Tests

- `node test/run.js` : parseur, modèle, diff (dont 2 000 cas aléatoires comparés à une LCS de référence), reconstruction depuis de vrais diffs git (LF, CRLF, BOM, sans saut de ligne final), chargeur à la demande.
- `node test/harness/serve.mjs` puis :
  - `/test/harness/` : panneau sur une PR de démo ;
  - `/test/harness/inline.html` : mise en forme intégrée sur une imitation de la vue GitHub ;
  - `/test/harness/stress.html?files=300&lines=2000&step=3` : test de charge.

## Versioning

Une version = une ligne : à chaque modification, incrémenter `SCRIPT_VERSION` dans `src/version.js` et `version` dans `manifest.json`, et ajouter une ligne au changelog en tête de `src/version.js`. Le numéro s'affiche en bas du panneau et dans les rapports de debug.
