// Service worker : fait les requêtes réseau pour le content script.
// Les redirections de GitHub (.diff/.patch vers patch-diff.githubusercontent.com, /raw/ vers
// raw.githubusercontent.com) ne renvoient pas d'en-têtes CORS lisibles depuis la page ;
// depuis l'extension, les host_permissions suffisent et la session GitHub est réutilisée.

const ALLOWED = /^https:\/\/github\.com\/[^/]+\/[^/]+\/(pull\/\d+\.(diff|patch)|raw\/[0-9a-f]{40}\/)/;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "tcpr-fetch") return false;
  // On ne relaie que les URL utiles à l'extension, jamais une URL arbitraire.
  if (!ALLOWED.test(msg.url)) {
    sendResponse({ ok: false, status: 0, error: "URL refusée" });
    return false;
  }
  fetch(msg.url, { credentials: "include" })
    .then(async (r) => {
      const buf = await r.arrayBuffer();
      const text = new TextDecoder("utf-8", { ignoreBOM: !!msg.keepBom }).decode(buf);
      sendResponse({ ok: r.ok, status: r.status, text });
    })
    .catch((e) => sendResponse({ ok: false, status: 0, error: String(e && e.message ? e.message : e) }));
  return true; // réponse asynchrone
});
