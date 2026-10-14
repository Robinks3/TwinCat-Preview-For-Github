# TcReview for GitHub

[English](README.md) · **Français**

Extension Chrome / Edge (Manifest V3) qui rend lisibles les fichiers **TwinCAT 3** d'une pull request GitHub : le code ST sans le XML, organisé comme dans TwinCAT, avec les commentaires de revue qui continuent de fonctionner.

> Projet non officiel, sans lien avec Beckhoff Automation. TwinCAT est une marque de Beckhoff Automation GmbH.

## Fonctionnalités

Une barre en bas à droite de chaque PR : **[TwinCAT : intégré] [Panneau] [🐞]**.

**Mise en forme intégrée au diff GitHub** (onglet « Files changed »)
- échafaudage XML et bruit (`LineIds`, GUID, version XAE) masqués ;
- ST sans `<![CDATA[`, coloré ;
- bandeau au début de chaque section (« Méthode Reset · déclaration »), liseré bleu pour la déclaration, vert pour le code ;
- les lignes restent celles de GitHub : commentaires, bouton « + » et numéros de ligne intacts.

**Panneau d'ensemble** (`Alt+T`)
- arborescence TwinCAT : POU > méthodes / propriétés > Get / Set, déclaration et code séparés ;
- vue côte à côte avant | après, option « Ignorer les espaces » ;
- `.TcTTO`, `.plcproj`, `.tsproj`, `.xti` en tableaux de propriétés avant / après ;
- navigation dossiers > fichiers > membres.

**Grosses PR** : tout est chargé à la demande et une seule fois, le panneau est virtualisé comme la vue de GitHub. Le coût ne dépend que de ce qui est à l'écran (test de charge : 300 fichiers de 2 000 lignes sans gel).

**Mode debug** (🐞) : journal des temps de chargement et rapport copiable pour diagnostiquer une lenteur.

Interface en français ou en anglais selon la langue du navigateur.

Aucun token, aucun serveur : l'extension réutilise la session GitHub du navigateur, y compris pour les dépôts privés. Détails dans [PRIVACY.md](PRIVACY.fr.md).

## Installation

1. Cloner le dépôt ou télécharger l'archive ZIP et la décompresser.
2. Ouvrir `chrome://extensions` (ou `edge://extensions`), activer le **mode développeur**.
3. **Charger l'extension non empaquetée** et choisir le dossier qui contient `manifest.json`.
4. Recharger les onglets GitHub déjà ouverts, puis ouvrir une PR.

## Documentation

- [Guide d'utilisation](docs/GUIDE.fr.md) : modes, réglages, mode debug, dépannage.
- [Architecture](docs/ARCHITECTURE.fr.md) : modules, récupération des données, coexistence avec le rendu de GitHub, tests.
- [Confidentialité](PRIVACY.fr.md) : ce que l'extension lit, stocke et n'envoie pas.

## Tests

```bash
node test/run.js
```

```bash
node test/harness/serve.mjs
```

puis http://localhost:8787/test/harness/ (panneau), `/test/harness/inline.html` (mise en forme intégrée) et `/test/harness/stress.html` (test de charge).

## Crédits et licence

Inspiré de TcCompare (Beckhoff) et de [TcPreview](https://github.com/dfreiberger/tc-preview-extension) (aperçu TwinCAT pour Azure DevOps). Les fichiers de test de `test/fixtures` viennent de [TcBlack](https://github.com/Roald87/TcBlack), sous licence MIT (voir [test/fixtures/LICENSE-TcBlack](test/fixtures/LICENSE-TcBlack)).

Licence du projet : non définie pour l'instant (tous droits réservés).

## Limites connues

- Mise en forme intégrée : nouvelle vue « Files changed » de GitHub uniquement, objets PLC uniquement.
- `.tsproj` : vue générique en propriétés, sans présentation dédiée des liens I/O ou de la topologie EtherCAT.
- github.com uniquement (pas GitHub Enterprise Server).
