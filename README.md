# TcReview for GitHub

Extension Chrome (Manifest V3) qui affiche les fichiers **TwinCAT 3** d'une pull request GitHub sous une forme lisible, sans le XML.

- **POU, DUT, GVL, interfaces** : le ST est découpé en sections (déclaration, implémentation, chaque méthode, action, transition, propriété Get/Set) et chaque section a son propre diff, avec coloration ST.
- **Tâches (`.TcTTO`), `.plcproj`, `.tsproj`, `.xti`** : la configuration est présentée en tableaux de propriétés avant/après (cycle, priorité, fichiers, bibliothèques, I/O...). Les éléments sont identifiés par leur nom, donc réordonner un `ItemGroup` ne produit pas de diff.
- **Bruit retiré** : `LineIds`, GUID, `ProductVersion`/`TcVersion`. Un fichier où seul ce bruit change est marqué « bruit XML seulement », avec le détail.
- Option « Ignorer les espaces », pratique après un passage de formateur (TcBlack).
- Langages graphiques (SFC, LD, FBD, CFC) : XML réindenté à défaut de mieux.

Inspiré de TcCompare (Beckhoff) et de [TcPreview](https://github.com/dfreiberger/tc-preview-extension) (aperçu de fichiers TwinCAT dans Azure DevOps).

## Installation (mode développeur)

1. Cloner ce dépôt.
2. Ouvrir `chrome://extensions` (ou `edge://extensions`), activer le **mode développeur**.
3. **Charger l'extension non empaquetée** et choisir le dossier du dépôt (celui qui contient `manifest.json`).
4. Ouvrir une PR sur github.com : un bouton **TwinCAT** apparaît en bas à droite (raccourci `Alt+T`, `Alt+Maj+T` pour forcer le rechargement).

Après une modification du code : bouton ⟳ de l'extension dans `chrome://extensions`, puis recharger l'onglet GitHub.

## Fonctionnement

Aucun token : l'extension réutilise la session GitHub du navigateur, ce qui marche aussi pour les dépôts privés.

1. `/pull/N.diff` : liste des fichiers et hunks, calculés par GitHub contre la merge-base.
2. `/pull/N.patch` : SHA du dernier commit de la PR.
3. `/raw/<sha>/<chemin>` : contenu complet après modification.
4. Contenu avant = contenu après avec les hunks appliqués à l'envers, avec un contrôle à chaque ligne.

Ces URL redirigent vers `patch-diff.githubusercontent.com` et `raw.githubusercontent.com`, qui ne sont pas lisibles depuis la page (CORS). Les requêtes passent donc par le service worker de l'extension (`src/background.js`), limité aux URL de diff, patch et raw de github.com.

| Fichier | Rôle |
|---|---|
| `src/xml.js` | Parseur XML minimal (sans dépendance, Node et navigateur) |
| `src/model.js` | Fichier TwinCAT → sections comparables, extraction du bruit |
| `src/diff.js` | Diff par section, diff de lignes, diff de propriétés |
| `src/github.js` | Diff unifié, reconstruction de la version avant, accès réseau |
| `src/ui.js` | Overlay, coloration ST (tout en `textContent`, jamais `innerHTML`) |
| `src/content.js` | Bouton, raccourci, suivi de la navigation GitHub |
| `src/background.js` | Requêtes réseau pour le content script |

## Tests

```bash
node test/run.js
```

Banc de test visuel sans extension ni réseau, qui rejoue des réponses GitHub enregistrées (PR de démo construite à partir des fixtures TcBlack) :

```bash
node test/harness/serve.mjs
```

puis ouvrir http://localhost:8787/test/harness/.

Les fixtures de `test/fixtures` viennent de [TcBlack](https://github.com/Roald87/TcBlack) (licence MIT).

## Limites connues

- Pas encore de boutons dans l'en-tête de chaque fichier du diff GitHub : la vue est un panneau à part, pour ne pas dépendre du DOM de GitHub qui change souvent.
- `.tsproj` : vue générique en propriétés, sans présentation dédiée des liens I/O ou de la topologie EtherCAT.
- GitHub ne fournit pas `.diff` pour les PR très volumineuses.
- github.com uniquement (pas GitHub Enterprise Server pour l'instant).
