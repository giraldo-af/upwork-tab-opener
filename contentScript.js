/**
 * Content script: extracts Upwork job URLs from the current page.
 *
 * Upwork markup can change; this script uses several heuristics:
 * - Any link containing "/jobs/" (excluding saved searches etc.)
 * - Canonicalizes relative URLs and removes tracking params.
 */

const POSTED_RE =
  /Posted\s+(?:(\d+)\s+(second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months)|just\s+now)\s+ago/i;

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

function parsePostedAgeMinutes(text) {
  const m = POSTED_RE.exec(text);
  if (!m) return null;

  // "Posted just now ago" (yes, Upwork uses "... ago" after "just now" too)
  if (!m[1] && /just\s+now/i.test(m[0])) return 0;

  const n = Number(m[1]);
  const unit = String(m[2] || "").toLowerCase();
  if (!Number.isFinite(n)) return null;

  if (unit.startsWith("second")) return n / 60;
  if (unit.startsWith("minute")) return n;
  if (unit.startsWith("hour")) return n * 60;
  if (unit.startsWith("day")) return n * 60 * 24;
  if (unit.startsWith("week")) return n * 60 * 24 * 7;
  if (unit.startsWith("month")) return n * 60 * 24 * 30;
  return null;
}

function findPostedAgeMinutesNear(element) {
  // Walk up the DOM looking for the "Posted ... ago" text within a reasonable container.
  let node = element;
  for (let i = 0; i < 10 && node; i += 1) {
    const text = node.innerText || "";
    const minutes = parsePostedAgeMinutes(text);
    if (minutes !== null) return minutes;
    node = node.parentElement;
  }
  return null;
}

function collectJobUrlsFromPage(maxAgeMinutes) {
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const urls = [];
  let skippedOld = 0;
  let skippedUnknown = 0;

  for (const a of anchors) {
    const href = a.getAttribute("href");
    if (!href) continue;
    if (!href.includes("/jobs/")) continue;

    const url = canonicalizeUrl(href);
    if (!url) continue;

    if (typeof maxAgeMinutes === "number") {
      const ageMinutes = findPostedAgeMinutesNear(a);
      if (ageMinutes === null) {
        skippedUnknown += 1;
        continue;
      }
      if (ageMinutes > maxAgeMinutes) {
        skippedOld += 1;
        continue;
      }
    }

    urls.push(url);
  }

  // De-dupe while preserving order.
  const seen = new Set();
  const unique = [];
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
  }
  return { urls: unique, skippedOld, skippedUnknown };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "COLLECT_JOB_URLS") return;

  const maxAgeMinutes =
    typeof message.maxAgeMinutes === "number" && Number.isFinite(message.maxAgeMinutes)
      ? message.maxAgeMinutes
      : null;

  const res = collectJobUrlsFromPage(maxAgeMinutes);
  sendResponse({
    ok: true,
    urls: res.urls,
    count: res.urls.length,
    skippedOld: res.skippedOld,
    skippedUnknown: res.skippedUnknown
  });
});

