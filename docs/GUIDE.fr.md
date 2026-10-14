# Guide d'utilisation

[English](GUIDE.md) · **Français**

## Langue

L'interface est en français si la langue du navigateur est le français, en anglais sinon. Pour forcer une langue, exécuter dans la console d'une page github.com : `localStorage.setItem("tcpr-lang", "en")` (ou `"fr"`), puis recharger.

## Installation

1. Récupérer le dépôt (clone ou archive ZIP décompressée).
2. Ouvrir `chrome://extensions` (Edge : `edge://extensions`) et activer le **mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée** et choisir le dossier qui contient `manifest.json`.
4. Recharger les onglets GitHub déjà ouverts : Chrome n'injecte pas une extension dans un onglet ouvert avant son installation.

Mise à jour : remplacer les fichiers, cliquer sur ⟳ dans la carte de l'extension sur `chrome://extensions`, puis recharger l'onglet GitHub. Le numéro de version s'affiche en bas du panneau.

## La barre d'outils

Sur une page de pull request, une barre apparaît en bas à droite :

| Bouton | Rôle |
|---|---|
| **TwinCAT : intégré** | Met en forme les fichiers TwinCAT directement dans le diff de GitHub. Réglage mémorisé. L'icône de l'extension fait la même chose. |
| **Panneau** | Ouvre la vue d'ensemble de la PR (`Alt+T`, `Alt+Maj+T` pour tout recharger). |
| **🐞** | Mode debug (voir plus bas). |

## Mise en forme intégrée

À utiliser dans l'onglet **Files changed** de la PR, pour relire et commenter.

- Les lignes de structure XML et le bruit (`LineIds`, GUID, version XAE) sont masqués.
- Le code ST s'affiche sans `<![CDATA[` et coloré.
- Chaque section commence par un bandeau : « Méthode Reset · déclaration », « Propriété Counter · Get · implémentation »... Liseré bleu pour une déclaration, vert pour du code.
- Une ligne de structure qui porte une vraie information (par exemple un attribut `SpecialFunc` modifié) reste visible, grisée.

Les lignes affichées sont celles de GitHub : le bouton « + », les commentaires, les suggestions et les numéros de ligne fonctionnent normalement. Un commentaire est accroché à la vraie ligne du fichier ; un relecteur sans l'extension le voit au même endroit dans le XML. Désactiver la mise en forme rend le diff d'origine.

Concerne les objets PLC : `.TcPOU`, `.TcDUT`, `.TcGVL`, `.TcIO`. Les fichiers de configuration (`.tsproj`, `.xti`, `.plcproj`, `.TcTTO`) restent en XML dans le diff ; le panneau les présente en propriétés.

La mise en forme est d'abord approximative (d'après le texte affiché), puis exacte dès que le fichier complet est disponible : immédiat pour un fichier ajouté ou supprimé, un téléchargement unique pour un fichier modifié.

## Panneau d'ensemble

À utiliser pour comprendre une PR d'un coup d'œil.

- **Arborescence TwinCAT** : un bloc par objet (POU > méthodes / propriétés > Get / Set), avec une pastille par type (FB, PRG, M, P, G, S...) et la signature (`METHOD Reset : BOOL`). Déclaration et code séparés. Chaque bloc se replie.
- **Navigation à gauche** : dossiers > fichiers > membres, pastille de couleur selon l'état (vert ajouté, rouge supprimé, orange modifié). Bouton **☰ Arbre** pour la masquer et donner toute la largeur au code.
- **Côte à côte** : avant à gauche, après à droite (réglage mémorisé). Décocher pour revenir à une seule colonne.
- **Ignorer les espaces** : utile après un passage de formateur (TcBlack), pour ne voir que les vrais changements.
- **Montrer l'inchangé** : affiche aussi les sections et propriétés identiques.
- **Configuration** (`.TcTTO`, `.plcproj`, `.tsproj`, `.xti`) : tableaux Propriété / Avant / Après. Les éléments sont identifiés par leur nom : réordonner des fichiers ou des bibliothèques ne produit pas de différence.

### Grosses PR

- Un fichier n'est téléchargé et analysé que lorsqu'il approche de l'écran, une seule fois par page.
- Les fichiers probablement volumineux (`.tsproj`, `.tmc`, diff énorme) attendent un clic sur **Télécharger et analyser** ; au-delà de 1,5 Mo, l'analyse aussi.
- Au-delà de 800 lignes par fichier, les sections suivantes restent repliées : **Afficher (N lignes)**.

## Mode debug

Le bouton **🐞** ouvre un journal en direct : requêtes (durée, taille), source de la version après (SHA de la page, branche ou `.patch`), analyse et rendu de chaque fichier, passes de mise en forme, tâches longues (page bloquée plus de 200 ms).

- **Copier le rapport** : synthèse par étape (nombre, total, maximum) puis journal complet, à coller dans un ticket.
- **Rapport précédent** : journal sauvegardé de la session précédente, utile si la page s'est figée et a dû être quittée.
- **Désactiver** : arrête la collecte.

Le rapport contient le nom du dépôt et les chemins des fichiers, jamais leur contenu. Le relire avant de le partager hors de l'équipe.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| Pas de barre en bas à droite | Onglet ouvert avant l'installation : le recharger. Ou page qui n'est pas une PR. |
| Mise en forme intégrée sans effet | Ce n'est pas l'onglet « Files changed », ou la PR ne contient pas d'objet PLC. Le journal debug l'indique. |
| « Échec du chargement » | Session GitHub expirée ou accès refusé au dépôt : se reconnecter à GitHub, recharger. |
| Lenteur | Ouvrir le mode debug, reproduire, **Copier le rapport** : la synthèse montre l'étape en cause. |
