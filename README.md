# TcReview for GitHub

Extension Chrome (Manifest V3) qui rend lisibles les fichiers **TwinCAT 3** d'une pull request GitHub, sans le XML.

Deux modes, depuis la barre en bas à droite d'une PR : **[TwinCAT : intégré] [Panneau] [🐞]**.

### Mise en forme intégrée au diff GitHub

Dans l'onglet « Files changed », les lignes de GitHub sont transformées sur place (aucune n'est recréée) :

- lignes d'échafaudage XML (`<Implementation>`, `]]></Declaration>`, `<Method Name=...>`) et bruit (`LineIds`, ligne modifiée seulement par un GUID ou la version XAE) masqués ;
- ST affiché sans `<![CDATA[`, coloré ;
- bandeau de section au début de chaque bloc (« Méthode Reset · déclaration », « Propriété Counter · Get · implémentation »), liseré bleu pour la déclaration, vert pour le code.

Les commentaires, le bouton « + » et les numéros de ligne restent ceux de GitHub, accrochés aux vraies lignes du fichier. Désactiver rend le diff d'origine. Concerne les objets PLC (`.TcPOU`, `.TcDUT`, `.TcGVL`, `.TcIO`).

Activation : bouton **TwinCAT : intégré** ou icône de l'extension (réglage mémorisé).

### Panneau d'ensemble

`Alt+T` ou bouton **Panneau** :

- arborescence TwinCAT par fichier (POU > méthodes / propriétés > Get / Set), déclaration et code séparés, navigation dossiers > fichiers > membres ;
- `.TcTTO`, `.plcproj`, `.tsproj`, `.xti` en tableaux de propriétés avant / après, éléments identifiés par leur nom (réordonner un `ItemGroup` ne produit pas de diff) ;
- option « Ignorer les espaces », pratique après un passage de formateur (TcBlack) ;
- langages graphiques (SFC, LD, FBD, CFC) : XML réindenté.

### Mode debug

Bouton **🐞** : journal en direct des requêtes (durée, taille), de la résolution du SHA, de l'analyse et du rendu de chaque fichier, des passes de mise en forme et des tâches longues (page bloquée plus de 200 ms). **Copier le rapport** donne une synthèse par étape et le journal complet. Le journal est sauvegardé en continu : après une page figée puis quittée, **Rapport précédent** le restitue. Le rapport contient le nom du dépôt et les chemins des fichiers, jamais leur contenu.

Inspiré de TcCompare (Beckhoff) et de [TcPreview](https://github.com/dfreiberger/tc-preview-extension) (aperçu de fichiers TwinCAT dans Azure DevOps).

## Installation (mode développeur)

1. Cloner ce dépôt.
2. Ouvrir `chrome://extensions` (ou `edge://extensions`), activer le **mode développeur**.
3. **Charger l'extension non empaquetée** et choisir le dossier du dépôt (celui qui contient `manifest.json`).
4. Ouvrir une PR sur github.com.

Après une modification du code : bouton ⟳ de l'extension dans `chrome://extensions`, puis recharger l'onglet GitHub.

## Fonctionnement

Aucun token : l'extension réutilise la session GitHub du navigateur, ce qui marche aussi pour les dépôts privés.

1. `/pull/N.diff`, une fois par page : liste des fichiers et hunks (contre la merge-base). Les fichiers ajoutés ou supprimés y sont complets.
2. Fichier modifié, seulement quand il approche de l'écran et une seule fois : `/raw/<version après>/<chemin>`. La version après est le SHA lu dans la page, sinon la branche de tête affichée dans la page, sinon le SHA du `/pull/N.patch`.
3. Contenu avant = contenu après avec les hunks appliqués à l'envers, contrôlé à chaque ligne (une source périmée est ainsi détectée et écartée).

Ces URL redirigent vers `patch-diff.githubusercontent.com` et `raw.githubusercontent.com`, illisibles depuis la page (CORS) : les requêtes passent par le service worker (`src/background.js`), limité à ces URL de github.com, avec un délai maximal de 60 s.

### Grosses PR

Comme la vue « Files changed » de GitHub, le coût ne dépend que de ce qui est à l'écran :

- mise en forme intégrée : seules les tables proches de l'écran sont traitées, par tranches de 12 ms, au plus une passe toutes les 400 ms par table ;
- panneau virtualisé : un fichier est monté à l'approche de l'écran et démonté quand il s'en éloigne, `content-visibility: auto`, cache d'analyses borné à 25 fichiers ;
- 800 lignes affichées d'office par fichier, au-delà les sections restent repliées (« Afficher (N lignes) ») ; fichiers de plus de 1,5 Mo analysés sur clic.

Test de charge (`test/harness/stress.html`, 300 fichiers de 2 000 lignes, `.diff` de 13,9 Mo) : défilement complet sans gel, tâche la plus longue 141 ms, 4 500 éléments dans la page à la fin.

| Fichier | Rôle |
|---|---|
| `src/xml.js` | Parseur XML minimal avec positions (sans dépendance, Node et navigateur) |
| `src/model.js` | Fichier TwinCAT → sections comparables, place dans l'arborescence, extraction du bruit |
| `src/lines.js` | Rôle de chaque ligne d'un fichier (code ST, échafaudage, bruit, configuration) |
| `src/diff.js` | Diff de Myers, diff par section, diff de propriétés |
| `src/github.js` | Diff unifié, reconstruction de la version avant, chargeur à la demande |
| `src/inline.js` | Mise en forme dans le diff GitHub |
| `src/ui.js` | Panneau virtualisé, coloration ST (tout en `textContent`, jamais `innerHTML`) |
| `src/debug.js` | Mode debug |
| `src/content.js` | Barre d'outils, raccourcis, suivi de la navigation GitHub |
| `src/background.js` | Requêtes réseau pour le content script |

## Tests

```bash
node test/run.js
```

Bancs de test visuels, sans extension ni réseau :

```bash
node test/harness/serve.mjs
```

puis ouvrir :

- http://localhost:8787/test/harness/ : panneau sur une PR de démo (fixtures TcBlack) ;
- http://localhost:8787/test/harness/inline.html : mise en forme intégrée sur une imitation de la vue GitHub ;
- http://localhost:8787/test/harness/stress.html?files=300&lines=2000&step=3 : test de charge du panneau.

Les fixtures de `test/fixtures` viennent de [TcBlack](https://github.com/Roald87/TcBlack) (licence MIT).

## Limites connues

- Vue intégrée : uniquement la nouvelle vue « Files changed » de GitHub (React), pas l'ancienne.
- `.tsproj` : vue générique en propriétés, sans présentation dédiée des liens I/O ou de la topologie EtherCAT.
- GitHub ne fournit pas `.diff` pour les PR extrêmement volumineuses.
- github.com uniquement (pas GitHub Enterprise Server pour l'instant).
