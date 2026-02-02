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

async function openUrls(urls, openInBackground, delayMs) {
  return await chrome.runtime.sendMessage({
    type: "OPEN_URLS",
    urls,
    openInBackground,
    delayMs
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function ageToMinutes(value, unit) {
  const v = Number.isFinite(value) ? value : 0;
  switch (unit) {
    case "minutes":
      return v;
    case "hours":
      return v * 60;
    case "days":
      return v * 60 * 24;
    case "weeks":
      return v * 60 * 24 * 7;
    case "months":
      return v * 60 * 24 * 30;
    default:
      return v * 60;
  }
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

    const ageEnabled = Boolean(document.getElementById("ageEnabled").checked);
    const ageValueRaw = Number(document.getElementById("ageValue").value);
    const ageValue = clamp(Number.isFinite(ageValueRaw) ? ageValueRaw : 24, 0, 9999);
    const ageUnit = String(document.getElementById("ageUnit").value || "hours");
    const maxAgeMinutes = ageEnabled ? ageToMinutes(ageValue, ageUnit) : null;

    let res;
    try {
      res = await chrome.tabs.sendMessage(tab.id, {
        type: "COLLECT_JOB_URLS",
        maxAgeMinutes
      });
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
      const suffix =
        ageEnabled && typeof res?.skippedOld === "number"
          ? `\nFiltered out ${res.skippedOld || 0} old / ${res.skippedUnknown || 0} unknown-age jobs.`
          : "";
      setStatus(`No job links found on this page.${suffix}`);
      return;
    }

    const delayRaw = Number(document.getElementById("delayMs").value);
    const delayMs = clamp(Number.isFinite(delayRaw) ? delayRaw : 300, 0, 5000);

    const limited = urls.slice(0, maxTabs);
    const openRes = await openUrls(limited, openInBackground, delayMs);

    if (!openRes?.ok) {
      setStatus(`Failed to open tabs: ${openRes?.error || "unknown error"}`);
      return;
    }

    const extra = urls.length > limited.length ? `\n(Showing first ${limited.length} of ${urls.length})` : "";
    const filtered =
      ageEnabled && (typeof res?.skippedOld === "number" || typeof res?.skippedUnknown === "number")
        ? `\nFiltered out ${res.skippedOld || 0} old / ${res.skippedUnknown || 0} unknown-age jobs.`
        : "";
    setStatus(`Opened ${openRes.opened} tabs.${extra}${filtered}`);
  } catch (e) {
    setStatus(`Error: ${String(e?.message || e)}`);
  }
});

