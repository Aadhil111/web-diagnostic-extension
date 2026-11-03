# Chrome Web Store listing

Text to paste into the developer dashboard. Swap `<your-domain>` for your own domain.

## Store listing tab

**Name:** Web Diagnostic

**Summary (max 132 characters):** Check DNS, HTTP, SSL/TLS, redirects and response timing of the website in your current tab.

**Category:** Developer Tools

**Language:** English

**Description**

> Web Diagnostic checks how a website looks from a server's point of view. Open any website, click the icon, press DIAGNOSE.
>
> You get:
> • DNS: whether the name resolves, the IP addresses and the lookup time
> • HTTP: the final status code, protocol, content encoding and a safe selection of response headers
> • Redirects: every hop with its status code, loop detection and unsafe-redirect detection
> • SSL/TLS: certificate validity, trust, hostname match, issuer, expiry date and TLS version
> • Timing: DNS, TCP connect, TLS handshake and response time
>
> The checks run on the Web Diagnostic server, not in your browser, so you see what the rest of the internet sees. Nothing is sent until you press DIAGNOSE; the query string and fragment of the address are never sent. No account, no tracking, no ads. Results can be copied as JSON for bug reports.

**Privacy policy URL:** `https://<your-domain>/privacy.html`

**Assets to make yourself:** at least one screenshot (1280×800 or 640×400) of the popup showing a real result from your deployed backend.
The 128×128 icon is `icons/icon128.png`. The dashboard may ask for other images too (a small promo tile, for example).

## Privacy practices tab

**Single purpose:** Diagnose the DNS, HTTP, redirect and SSL/TLS status of a website address chosen by the user.

**Permission justifications**

| Permission | Justification |
|---|---|
| `activeTab` | When the user clicks the extension icon, the address of the current tab is read once to pre-fill the input box. Only the address is read, only on that click, and only the origin and path are used (query string and fragment are dropped). |
| Host permission `https://<your-domain>/*` | The popup sends the diagnostic request to the Web Diagnostic server at this address. It is the only host the extension contacts. |

**Remote code:** No. All JavaScript is inside the package; there is no `eval`, no remotely hosted script and no inline script.

**Data usage** (the dashboard asks which data types you collect. This is based on what the code does, but the answers are yours to confirm):

- Data type: **Web history**. The website address the user chooses to diagnose (pre-filled from the current tab, editable) is sent to the diagnostic server when the user presses DIAGNOSE. Nothing else is collected.
- Certify all three statements: the data is not sold to third parties; it is not used or transferred for purposes unrelated to the item's single purpose; it is not used or transferred to determine creditworthiness or for lending.
- Every other category (personal information, health, financial, authentication, personal communications, location, user activity, website content): **not collected**.
