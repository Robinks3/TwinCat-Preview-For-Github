// Accès aux données d'une PR GitHub avec la session déjà ouverte dans le navigateur (aucun token).
//
// Stratégie, indépendante du DOM de GitHub (qui change souvent) :
//   1. /pull/N.diff  : liste des fichiers et hunks, calculés par GitHub contre la merge-base.
//   2. /pull/N.patch : SHA du dernier commit de la PR (ligne « From <sha> »).
//   3. /raw/<sha>/<chemin> : contenu complet après modification.
//   4. Contenu avant = contenu après avec les hunks appliqués à l'envers, contrôle à chaque ligne.

(function (root) {
  // ---------- Diff unifié ----------

  // Découpe un texte en lignes en gardant leur terminaison, pour une reconstruction octet pour octet.
  function splitKeepEol(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const k = s.indexOf("\n", i);
      if (k < 0) {
        out.push(s.slice(i));
        break;
      }
      out.push(s.slice(i, k + 1));
      i = k + 1;
    }
    return out;
  }

  function unquotePath(p) {
    // git entoure de guillemets les chemins avec caractères spéciaux et échappe l'UTF-8 en octal.
    if (!p.startsWith('"')) return p;
    const bytes = [];
    const body = p.slice(1, -1);
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === "\\") {
        const n = body[i + 1];
        if (/[0-7]/.test(n)) {
          bytes.push(parseInt(body.substr(i + 1, 3), 8));
          i += 3;
        } else {
          bytes.push({ n: 10, t: 9, '"': 34, "\\": 92 }[n] ?? n.charCodeAt(0));
          i += 1;
        }
      } else bytes.push(...new TextEncoder().encode(c));
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  function stripPrefix(p, prefix) {
    p = unquotePath(p.trim());
    return p.startsWith(prefix) ? p.slice(prefix.length) : p;
  }

  function parseUnifiedDiff(text) {
    const files = [];
    const lines = splitKeepEol(text);
    let f = null;
    let h = null;
    let oldLeft = 0;
    let newLeft = 0;

    for (const raw of lines) {
      const line = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
      if (line.startsWith("diff --git ")) {
        f = { oldPath: null, newPath: null, status: "modified", hunks: [], binary: false };
        const m = /^diff --git (?:"?a\/)(.+?)"? (?:"?b\/)(.+?)"?$/.exec(line);
        if (m) {
          f.oldPath = m[1];
          f.newPath = m[2];
        }
        files.push(f);
        h = null;
        continue;
      }
      if (!f) continue;

      if (h && (oldLeft > 0 || newLeft > 0)) {
        const tag = line[0];
        const body = raw.slice(1);
        if (tag === " " || tag === "-" || tag === "+") {
          h.lines.push({ t: tag, text: body });
          if (tag !== "+") oldLeft--;
          if (tag !== "-") newLeft--;
          continue;
        }
      }
      if (line.startsWith("\\")) {
        // « \ No newline at end of file » : la ligne précédente n'a pas de saut de ligne.
        const last = h && h.lines[h.lines.length - 1];
        if (last) last.text = last.text.replace(/\r?\n$/, (m) => (m === "\r\n" ? "\r" : ""));
        continue;
      }
      const hm = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (hm) {
        h = {
          oldStart: +hm[1],
          oldCount: hm[2] === undefined ? 1 : +hm[2],
          newStart: +hm[3],
          newCount: hm[4] === undefined ? 1 : +hm[4],
          lines: [],
        };
        oldLeft = h.oldCount;
        newLeft = h.newCount;
        f.hunks.push(h);
        continue;
      }
      if (line.startsWith("new file mode")) f.status = "added";
      else if (line.startsWith("deleted file mode")) f.status = "removed";
      else if (line.startsWith("rename from ")) f.oldPath = unquotePath(line.slice(12));
      else if (line.startsWith("rename to ")) {
        f.newPath = unquotePath(line.slice(10));
        f.status = "renamed";
      } else if (line.startsWith("Binary files")) f.binary = true;
      else if (line.startsWith("--- ")) {
        const p = line.slice(4);
        if (p !== "/dev/null") f.oldPath = stripPrefix(p, "a/");
      } else if (line.startsWith("+++ ")) {
        const p = line.slice(4);
        if (p !== "/dev/null") f.newPath = stripPrefix(p, "b/");
      }
    }
    return files;
  }

  // Reconstruit le contenu avant à partir du contenu après et des hunks.
  function reverseApply(headText, hunks) {
    const head = splitKeepEol(headText);
    const out = [];
    let pos = 0;
    for (const h of hunks) {
      const start = h.newCount === 0 ? h.newStart : h.newStart - 1;
      if (start < pos || start > head.length) throw new Error(`hunk @@ +${h.newStart} hors du fichier`);
      while (pos < start) out.push(head[pos++]);
      for (const l of h.lines) {
        if (l.t === "-") {
          out.push(l.text);
          continue;
        }
        if (head[pos] !== l.text) {
          throw new Error(`le diff ne correspond pas au fichier (ligne ${pos + 1})`);
        }
        if (l.t === " ") out.push(head[pos]);
        pos++;
      }
    }
    while (pos < head.length) out.push(head[pos++]);
    return out.join("");
  }

  function textFromHunks(hunks, keep) {
    return hunks.flatMap((h) => h.lines.filter((l) => l.t === keep || l.t === " ").map((l) => l.text)).join("");
  }

  // ---------- Accès réseau (contexte de la page github.com) ----------

  function parsePrUrl(href) {
    const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(href);
    return m ? { owner: m[1], repo: m[2], number: +m[3] } : null;
  }

  // Les requêtes passent par le service worker (voir background.js) ; `fetchImpl` permet
  // de substituer une source de données (page de test).
  async function fetchText(path, keepBom) {
    const url = `https://github.com${path}`;
    if (api.fetchImpl) return api.fetchImpl(url, keepBom);
    const res = await chrome.runtime.sendMessage({ type: "tcpr-fetch", url, keepBom: !!keepBom });
    if (!res || !res.ok) throw new Error(`${res && res.status ? res.status : res && res.error ? res.error : "échec"} sur ${url}`);
    return res.text;
  }

  function encodePath(p) {
    return p.split("/").map(encodeURIComponent).join("/");
  }

  async function headShaFromPatch(pr) {
    const patch = await fetchText(`/${pr.owner}/${pr.repo}/pull/${pr.number}.patch`);
    const all = [...patch.matchAll(/^From ([0-9a-f]{40}) /gm)];
    if (!all.length) throw new Error("SHA du dernier commit introuvable dans le .patch");
    return all[all.length - 1][1];
  }

  // Fichier ajouté ou supprimé : son contenu complet est déjà dans le diff, rien à télécharger.
  function needsFetch(f) {
    return !f.binary && f.status !== "added" && f.status !== "removed";
  }

  async function loadEntry(pr, f, headSha) {
    const entry = { path: f.newPath || f.oldPath, oldPath: f.oldPath, status: f.status, base: null, head: null, error: null };
    try {
      if (f.binary) throw new Error("fichier traité comme binaire par GitHub");
      if (f.status === "removed") entry.base = textFromHunks(f.hunks, "-");
      else if (f.status === "added") entry.head = textFromHunks(f.hunks, "+");
      else {
        entry.head = await fetchText(`/${pr.owner}/${pr.repo}/raw/${headSha}/${encodePath(f.newPath)}`, true);
        entry.base = reverseApply(entry.head, f.hunks);
      }
    } catch (e) {
      entry.error = e.message;
    }
    return entry;
  }

  // Limiteur de concurrence : au plus `n` tâches en cours, les autres attendent leur tour.
  function makeLimiter(n) {
    let active = 0;
    const queue = [];
    const next = () => {
      if (active >= n || !queue.length) return;
      active++;
      const { task, resolve, reject } = queue.shift();
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          next();
        });
    };
    return (task) =>
      new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        next();
      });
  }

  // Chargeur paresseux d'une PR : seul le .diff est téléchargé d'emblée (liste des fichiers,
  // contenu complet des fichiers ajoutés ou supprimés). Un fichier modifié n'est téléchargé
  // que lorsqu'on le demande (load), une seule fois : le résultat est mémorisé.
  //   opts.headShaHint : SHA de tête lu dans la page, vérifié au premier téléchargement ;
  //                      repli sur le .patch (lourd sur une grosse PR) s'il est périmé.
  // Retour : { files: [{ path, oldPath, status, needsFetch }], load(k) -> Promise<entry>, stats }
  async function createPrLoader(pr, isWanted, opts = {}) {
    const progress = opts.onProgress || (() => {});
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const t0 = now();
    progress("Récupération du diff de la PR…");
    const diffText = await fetchText(`/${pr.owner}/${pr.repo}/pull/${pr.number}.diff`, true);
    const files = parseUnifiedDiff(diffText).filter((f) => isWanted(f.newPath || f.oldPath));
    const stats = {
      diffMs: now() - t0,
      diffKb: Math.round(diffText.length / 1024),
      toFetch: files.filter(needsFetch).length,
      fetched: 0,
      shaSource: "aucun",
      headSha: null,
    };

    let shaPromise = null;
    const resolveSha = (firstFile) => {
      if (!shaPromise) {
        shaPromise = (async () => {
          if (opts.headShaHint) {
            const e = await loadEntry(pr, firstFile, opts.headShaHint);
            if (!e.error) {
              stats.shaSource = "page";
              stats.headSha = opts.headShaHint;
              return { sha: opts.headShaHint, file: firstFile, entry: e };
            }
          }
          const sha = await headShaFromPatch(pr);
          stats.shaSource = ".patch";
          stats.headSha = sha;
          return { sha };
        })();
      }
      return shaPromise;
    };

    const limit = makeLimiter(6);
    const memo = new Map();
    const load = (k) => {
      if (memo.has(k)) return memo.get(k);
      const f = files[k];
      const p = !needsFetch(f)
        ? loadEntry(pr, f, null)
        : limit(async () => {
            try {
              const s = await resolveSha(f);
              const e = s.file === f ? s.entry : await loadEntry(pr, f, s.sha);
              stats.fetched++;
              return e;
            } catch (err) {
              return { path: f.newPath || f.oldPath, oldPath: f.oldPath, status: f.status, base: null, head: null, error: err.message };
            }
          });
      memo.set(k, p);
      return p;
    };

    return {
      files: files.map((f) => ({ path: f.newPath || f.oldPath, oldPath: f.oldPath, status: f.status, needsFetch: needsFetch(f) })),
      load,
      stats,
    };
  }

  // Charge tout d'un coup (banc de test et usages simples) : liste puis chaque fichier.
  async function loadPrFiles(pr, isWanted, onFile, opts = {}) {
    const loader = await createPrLoader(pr, isWanted, opts);
    if (opts.onList) opts.onList(loader.files);
    const entries = await Promise.all(
      loader.files.map((_, k) =>
        loader.load(k).then((e) => {
          if (onFile) onFile(e, k);
          return e;
        })
      )
    );
    return { headSha: loader.stats.headSha, files: entries, stats: loader.stats };
  }

  const api = { parseUnifiedDiff, reverseApply, splitKeepEol, parsePrUrl, loadPrFiles, createPrLoader, fetchImpl: null };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TcPr = Object.assign(root.TcPr || {}, api, { setFetchImpl: (f) => (api.fetchImpl = f) });
})(typeof globalThis !== "undefined" ? globalThis : this);
