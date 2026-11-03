# Web Diagnostic: Chrome extension

A Manifest V3 popup that diagnoses the website in your current tab: DNS, HTTP, SSL/TLS, redirects and timing.
Plain HTML, CSS and JavaScript, no framework and no runtime dependencies.

It's one of three repositories:

- web-diagnostic-backend: the Spring Boot API and the Docker Compose + Caddy deployment
- web-diagnostic-website: the website, served by the same Caddy as the API
- web-diagnostic-extension (this one): calls the same API at the same address as the website

The extension has no diagnostic logic. It sends `POST {API}/api/v1/diagnostic` with `{"url": "..."}` and draws the JSON the backend returns.

```
manifest.json     Manifest V3: the "activeTab" permission and one host permission (the API)
popup.html        the popup
app.js            the whole app (same file as the website's app.js)
platform.js       what differs from the website: API_BASE_URL and the pre-fill from the current tab
style.css
icons/            16, 32, 48 and 128 px icons
STORE_LISTING.md  text and answers for the Chrome Web Store dashboard
```

On privacy: the address pre-filled from the current tab has its query string and fragment removed before it's shown, and
nothing is sent until you press DIAGNOSE. The backend drops query strings too. The policy is served by the website at `/privacy.html`.

## Set your domain

Before loading or publishing the extension, put the address your backend is served from (same as the website) in two places:

- `platform.js`: `const API_BASE_URL = 'https://<your-domain>';`
- `manifest.json`: `"host_permissions": ["https://<your-domain>/*"]`

Use `https://`, no trailing slash, no path. If `API_BASE_URL` still contains the `your-domain` placeholder, the popup says it hasn't been configured.

## Trying it out

1. Set your domain as above.
2. Open `chrome://extensions`, turn on Developer mode, click Load unpacked and pick this folder (the one with `manifest.json`).
3. Copy the extension's ID from its card and give it to the backend (`EXTENSION_ID` in the backend's `.env`, then `docker compose up -d`).
   The backend answers 403 to any extension it doesn't know, even though `host_permissions` is granted. See the backend's `DEPLOYMENT.md`.
4. Open any website, click the extension icon and press DIAGNOSE.

An unpacked extension gets a different ID from the Chrome Web Store one, so list both in `EXTENSION_ID`, comma separated.

### With a local backend

Run the backend with `mvn spring-boot:run -Dspring-boot.run.profiles=dev` (it accepts any unpacked extension), then temporarily set
`API_BASE_URL = 'http://localhost:8080'` in `platform.js` and add `"http://localhost:8080/*"` to `host_permissions`.
Don't commit or publish that, the Chrome Web Store only accepts `https://` hosts.

## Publishing on the Chrome Web Store

1. Set your domain, zip the extension files so `manifest.json` sits at the top level of the ZIP, and bump `"version"` in `manifest.json` for every upload. The store rejects a version that isn't higher than the last one.
2. Register at the [developer dashboard](https://chrome.google.com/webstore/devconsole) (one-time fee), choose Add new item and upload the ZIP.
3. Fill in the listing and privacy tabs using the text in [STORE_LISTING.md](STORE_LISTING.md). You'll need to add at least one screenshot yourself.
4. Copy the item's ID into the backend's `EXTENSION_ID` (that's what lets the published extension call the API), then submit for review.

## Keeping it in sync with the website

`app.js` is the same file as `public/app.js` in `web-diagnostic-website`. If you change one, copy it to the other.
