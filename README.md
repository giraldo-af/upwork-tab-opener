# Upwork Job Tabs Opener (Chrome Extension)

Simple Chrome extension that **opens all Upwork job links on the current page** in new tabs.

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `upwork-tab-opener`

## Use

1. Open an Upwork job results page (for example a Jobs search page)
2. Click the extension icon
3. Choose **Max tabs** (default 50) and whether to open in the **background**
4. Click **Open jobs**

## Notes

- It opens links that contain `/jobs/` and are on `www.upwork.com`.
- Optional filter: only open jobs whose card text includes `Posted N units ago` within your chosen max age.
- If Upwork changes markup/URLs, the selector logic in `contentScript.js` is where to adjust.

