// Settings that differ between the website and the extension.

// Address of the backend, no trailing slash (same address the website is served from).
// Use your own domain here and the same one in host_permissions in manifest.json.
const API_BASE_URL = 'https://webinsight.duckdns.org';

// Pre-fills the url box with the current tab's address. The query string and fragment are cut off since
// they often hold tokens. chrome.tabs can read the address because manifest.json asks for "activeTab".
async function getInitialUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && /^https?:\/\//.test(tab.url)) { // skips chrome://, about:blank, the web store...
      const url = new URL(tab.url);
      return url.origin + url.pathname;
    }
  } catch (err) {
    // no tab info, leave the box empty
  }
  return '';
}
