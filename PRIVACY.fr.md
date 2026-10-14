# Confidentialité

[English](PRIVACY.md) · **Français**

TwinCAT Preview for GitHub fonctionne entièrement dans le navigateur. Aucune donnée n'est envoyée ailleurs qu'à GitHub, et aucune n'est envoyée au développeur de l'extension ni à un tiers.

## Ce que l'extension lit

- La page de pull request ouverte sur github.com : structure du diff, nom de la branche de tête et SHA du dernier commit quand la page les contient.
- Via la session GitHub déjà ouverte dans le navigateur, et seulement sur des URL de github.com de la forme :
  - `/<propriétaire>/<dépôt>/pull/<n>.diff` et `.patch` ;
  - `/<propriétaire>/<dépôt>/raw/<commit ou branche>/<chemin>`.

Ces adresses redirigent vers `patch-diff.githubusercontent.com` et `raw.githubusercontent.com` (domaines de GitHub), d'où les trois autorisations d'hôte du manifeste. Le service worker refuse toute autre URL.

## Ce que l'extension stocke

Dans le `localStorage` de github.com, sur la machine uniquement :

| Clé | Contenu |
|---|---|
| `tcpr-inline` | mise en forme intégrée active ou non |
| `tcpr-split`, `tcpr-nav` | préférences d'affichage du panneau |
| `tcpr-debug` | mode debug actif ou non |
| `tcpr-lang` | langue forcée (seulement si définie à la main) |
| `tcpr-debug-journal` | 400 dernières lignes du journal debug (si le mode debug est actif) : noms de dépôt, chemins de fichiers, durées, tailles ; jamais le contenu des fichiers |

Le contenu des fichiers téléchargés reste en mémoire, le temps de la page.

## Ce que l'extension n'utilise pas

Aucun token GitHub, aucun compte, aucune télémétrie, aucun service d'analyse, aucun serveur externe, aucune bibliothèque chargée depuis Internet.

## Mode debug

Le rapport copié par **Copier le rapport** contient le nom du dépôt, le numéro de la PR et les chemins des fichiers. Il ne quitte la machine que si vous le collez quelque part : le relire avant de le partager.
