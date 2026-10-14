// Service worker : fait les requêtes réseau pour le content script.
// Les redirections de GitHub (.diff/.patch vers patch-diff.githubusercontent.com, /raw/ vers
// raw.githubusercontent.com) ne renvoient pas d'en-têtes CORS lisibles depuis la page ;
// depuis l'extension, les host_permissions suffisent et la session GitHub est réutilisée.

const ALLOWED = /^https:\/\/github\.com\/[^/]+\/[^/]+\/(pull\/\d+\.(diff|patch)|raw\/[0-9a-f]{40}\/)/;

// Clic sur l'icône de l'extension : ouvre ou ferme la vue dans l'onglet courant.
// Un onglet ouvert avant l'installation n'a pas le content script : l'échec est ignoré.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) chrome.tabs.sendMessage(tab.id, { type: "tcpr-toggle" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "tcpr-fetch") return false;
  // On ne relaie que les URL utiles à l'extension, jamais une URL arbitraire.
  if (!ALLOWED.test(msg.url)) {
    sendResponse({ ok: false, status: 0, error: "URL refusée" });
    return false;
  }
  // Délai maximal : une requête bloquée ne doit pas figer le panneau indéfiniment.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  fetch(msg.url, { credentials: "include", signal: ctrl.signal })
    .finally(() => clearTimeout(timer))
    .then(async (r) => {
      const buf = await r.arrayBuffer();
      const text = new TextDecoder("utf-8", { ignoreBOM: !!msg.keepBom }).decode(buf);
      sendResponse({ ok: r.ok, status: r.status, text });
    })
    .catch((e) =>
      sendResponse({
        ok: false,
        status: 0,
        error: e && e.name === "AbortError" ? "délai de 60 s dépassé" : String(e && e.message ? e.message : e),
      })
    );
  return true; // réponse asynchrone
});
