# TcReview for GitHub

Extension Chrome MV3 en JavaScript pur, sans étape de build : le dossier se charge tel quel dans Chrome.

- Tests : `node test/run.js` (cœur) et `node test/harness/serve.mjs` puis http://localhost:8787/test/harness/ (rendu).
- Les modules `src/*.js` s'exportent via `module.exports` (Node) ou `globalThis.TcPr` (navigateur). Garder ce double export.
- Tout contenu venant d'une PR s'insère avec `textContent`, jamais `innerHTML`.

## Versioning : « une version = une ligne »

La version est `SCRIPT_VERSION` dans `src/version.js`, et `version` dans `manifest.json` doit rester identique.

1. À chaque modification, incrémenter `SCRIPT_VERSION` (ex. 0.1.0 → 0.1.1) et `manifest.json`.
2. Ajouter UNE ligne au changelog en tête de `src/version.js`, au format `//   X.Y.Z - description` (fonction touchée, effet, motivation).
3. Mettre à jour `SCRIPT_DATE` si la date a changé.

Aucune exception, même pour une ligne. Plusieurs modifications indépendantes = une version et une ligne chacune. La version la plus haute du changelog est toujours égale à `SCRIPT_VERSION`, en ordre séquentiel strict.
