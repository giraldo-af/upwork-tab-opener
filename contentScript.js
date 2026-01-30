/**
 * Content script: extracts Upwork job URLs from the current page.
 *
 * Upwork markup can change; this script uses several heuristics:
 * - Any link containing "/jobs/" (excluding saved searches etc.)
 * - Canonicalizes relative URLs and removes tracking params.
 */

function canonicalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl, window.location.href);

    // Keep within Upwork.
    if (u.hostname !== "www.upwork.com") return null;

    // Only job detail pages.
    // Common patterns:
    // - /jobs/~<token>/
    // - /jobs/<slug>_<numericId>/
    // - /jobs/<numericId>/
    if (!u.pathname.startsWith("/jobs/")) return null;

    // Exclude routes that are clearly not a job detail page.
    if (u.pathname.startsWith("/nx/search/jobs")) return null;
    if (u.pathname === "/jobs" || u.pathname === "/jobs/") return null;

    // Heuristic: require either "~" token or a segment with a digit.
    // This avoids opening category/landing/help pages under /jobs/.
    const firstSegment = u.pathname.split("/")[2] || "";
    const looksLikeJob =
      firstSegment.startsWith("~") || firstSegment.includes("~") || /[0-9]/.test(firstSegment);
    if (!looksLikeJob) return null;

    // Strip common tracking noise while keeping anything essential.
    // Upwork job pages typically work without querystring.
    u.search = "";
    u.hash = "";

    return u.toString();
  } catch {
    return null;
  }
}

function collectJobUrlsFromPage() {
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const urls = [];

  for (const a of anchors) {
    const href = a.getAttribute("href");
    if (!href) continue;
    if (!href.includes("/jobs/")) continue;

    const url = canonicalizeUrl(href);
    if (url) urls.push(url);
  }

  // De-dupe while preserving order.
  const seen = new Set();
  const unique = [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
  }
  return unique;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "COLLECT_JOB_URLS") return;

  const urls = collectJobUrlsFromPage();
  sendResponse({ ok: true, urls, count: urls.length });
});

