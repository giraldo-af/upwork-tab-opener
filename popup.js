async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setStatus(text) {
  const el = document.getElementById("status");
  el.textContent = text;
}

async function collectUrls(tabId) {
  return await chrome.tabs.sendMessage(tabId, { type: "COLLECT_JOB_URLS" });
}

async function openUrls(urls, openInBackground) {
  return await chrome.runtime.sendMessage({
    type: "OPEN_URLS",
    urls,
    openInBackground,
    delayMs: 200
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

document.getElementById("openBtn").addEventListener("click", async () => {
  setStatus("Working...");

  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      setStatus("No active tab found.");
      return;
    }

    if (!tab.url || !tab.url.startsWith("https://www.upwork.com/")) {
      setStatus("Open an Upwork page first (https://www.upwork.com/).");
      return;
    }

    const maxTabsRaw = Number(document.getElementById("maxTabs").value);
    const maxTabs = clamp(Number.isFinite(maxTabsRaw) ? maxTabsRaw : 50, 1, 200);
    const openInBackground = Boolean(document.getElementById("bg").checked);

    let res;
    try {
      res = await collectUrls(tab.id);
    } catch {
      setStatus(
        "Couldn't connect to the page.\nTry refreshing the Upwork tab, then click the extension again."
      );
      return;
    }
    if (!res?.ok) {
      setStatus("Couldn't collect job links from this page.");
      return;
    }

    const urls = Array.isArray(res.urls) ? res.urls : [];
    if (urls.length === 0) {
      setStatus("No job links found on this page.");
      return;
    }

    const limited = urls.slice(0, maxTabs);
    const openRes = await openUrls(limited, openInBackground);

    if (!openRes?.ok) {
      setStatus(`Failed to open tabs: ${openRes?.error || "unknown error"}`);
      return;
    }

    const extra = urls.length > limited.length ? `\n(Showing first ${limited.length} of ${urls.length})` : "";
    setStatus(`Opened ${openRes.opened} tabs.${extra}`);
  } catch (e) {
    setStatus(`Error: ${String(e?.message || e)}`);
  }
});

