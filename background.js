/**
 * Service worker: receives "openUrls" requests and opens tabs.
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || message.type !== "OPEN_URLS") return;

    const urls = Array.isArray(message.urls) ? message.urls : [];
    const openInBackground = message.openInBackground !== false; // default true
    const delayMs = Number.isFinite(message.delayMs) ? message.delayMs : 75;

    let opened = 0;
    for (const url of urls) {
      if (typeof url !== "string" || !url.startsWith("http")) continue;
      // If opening in the foreground, focus only the first created tab.
      const active = openInBackground ? false : opened === 0;
      await chrome.tabs.create({ url, active });
      opened += 1;
      if (delayMs > 0) await sleep(delayMs);
    }

    sendResponse({ ok: true, opened });
  })().catch((err) => {
    sendResponse({ ok: false, error: String(err?.message || err) });
  });

  // Keep message channel open for async sendResponse
  return true;
});

