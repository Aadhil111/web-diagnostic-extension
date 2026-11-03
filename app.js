// Same file in the website and the extension. The only differences live in platform.js.
// The backend does all the work: we send the url and draw what comes back.

const REQUEST_TIMEOUT_MS = 40000; // the backend stops at 30s, so give it a bit longer than that

const form = document.getElementById('diagnose-form');
const urlInput = document.getElementById('url-input');
const diagnoseButton = document.getElementById('diagnose-button');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');
const copyBar = document.getElementById('copy-bar');
const copyButton = document.getElementById('copy-button');

let lastResult = null; // last successful response, kept for the copy button

async function init() {
  document.getElementById('api-label').textContent = apiHost();
  urlInput.value = await getInitialUrl(); // comes from platform.js
  form.addEventListener('submit', handleDiagnose);
  copyButton.addEventListener('click', handleCopy);
}

// shown in the footer so people can see where the url they type is sent
function apiHost() {
  try {
    return new URL(API_BASE_URL || window.location.origin).host;
  } catch (err) {
    return API_BASE_URL;
  }
}

async function handleDiagnose(event) {
  event.preventDefault();
  const url = urlInput.value.trim();

  clearMessages();
  if (/your-domain/.test(API_BASE_URL)) {
    showError('This build has not been configured with a backend address yet.');
    return;
  }
  if (!url) {
    showError('Please enter a URL, for example example.com');
    return;
  }

  setLoading(true);
  try {
    const result = await requestDiagnostic(url);
    lastResult = result;
    renderResults(result);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

// The backend cleans up the url itself (adds https://, drops the query string), so it goes out as typed.
async function requestDiagnostic(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(API_BASE_URL + '/api/v1/diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The diagnostic took too long and was cancelled. Please try again.');
    }
    // fetch only throws when no response came back at all (offline, server down, blocked by CORS)
    throw new Error('Cannot reach the diagnostic server. Check your internet connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  try {
    return await response.json();
  } catch (err) {
    throw new Error('The server sent a response that is not valid JSON.');
  }
}

// the backend sends errors as {"timestamp", "status", "error", "message"}
async function readApiError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch (err) {
    // not JSON (an error page from a proxy, for example), use the generic message below
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    return 'Too many requests.' + (retryAfter ? ' Try again in ' + retryAfter + ' seconds.' : ' Please wait a moment.');
  }
  if (response.status === 503) {
    return 'The diagnostic server is busy. Please try again in a few seconds.';
  }
  if (body && body.message) {
    return body.message;
  }
  if (response.status === 403) {
    // a 403 without a JSON body comes from the CORS filter, so the backend doesn't know this origin
    return 'The server refused the request (HTTP 403).';
  }
  const requestId = response.headers.get('X-Request-Id');
  return 'The server returned an error (HTTP ' + response.status + ').' + (requestId ? ' Request ID: ' + requestId : '');
}

function setLoading(isLoading) {
  loadingEl.hidden = !isLoading;
  diagnoseButton.disabled = isLoading;
  urlInput.disabled = isLoading;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearMessages() {
  lastResult = null;
  copyBar.hidden = true;
  errorEl.hidden = true;
  resultsEl.hidden = true;
  resultsEl.replaceChildren();
}

// copies the whole response, pretty-printed (useful for bug reports)
async function handleCopy() {
  if (!lastResult) return;
  const json = JSON.stringify(lastResult, null, 2);
  let copied = false;
  try {
    await navigator.clipboard.writeText(json);
    copied = true;
  } catch (err) {
    copied = copyWithFallback(json); // clipboard API missing or blocked
  }
  copyButton.textContent = copied ? 'Copied!' : 'Copy failed';
  setTimeout(() => { copyButton.textContent = 'Copy Report (JSON)'; }, 2000);
}

// fallback for browsers without the clipboard API: select text in a hidden textarea and copy that
function copyWithFallback(text) {
  const textarea = makeElement('textarea', 'sr-only');
  textarea.value = text;
  document.body.append(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (err) {
    ok = false;
  }
  textarea.remove();
  return ok;
}

// Everything from the network goes in through textContent (see makeElement), never innerHTML,
// so a hostile site can't inject markup into the page.
function renderResults(result) {
  const cards = [
    renderSummary(result),
    renderDns(result.dns),
    renderHttp(result.http),
    renderSsl(result.ssl),
    renderRedirects(result.redirect),
    renderTiming(result.timing),
  ];
  resultsEl.replaceChildren(...cards.filter(Boolean)); // sections the backend left out are skipped
  resultsEl.hidden = false;
  copyBar.hidden = false;
}

function renderSummary(result) {
  const card = createCard('Result');
  addRow(card, 'Tested URL', result.url);
  addRow(card, 'Checked at', formatDate(result.checkedAt));
  addRow(card, 'Duration', formatMs(result.durationMs));
  return card;
}

function renderDns(dns) {
  if (!dns) return null;
  const card = createCard('DNS', dns.resolved ? badge('ok', 'Resolved') : badge('bad', 'Failed'));
  addMessage(card, dns.message);
  addRow(card, 'Domain', dns.domain);
  addRow(card, 'IP addresses', (dns.ipAddresses || []).join(', '));
  addRow(card, 'Lookup time', formatMs(dns.resolutionTimeMs));
  return card;
}

function renderHttp(http) {
  if (!http) return null;
  const card = createCard('HTTP', httpStatus(http));
  addMessage(card, http.message);
  addRow(card, 'Status code', http.statusCode);
  addRow(card, 'Final URL', http.finalUrl);
  addRow(card, 'Response time', formatMs(http.responseTimeMs));
  addRow(card, 'Total time', formatMs(http.totalTimeMs));
  addRow(card, 'Protocol', http.httpVersion);
  addRow(card, 'Content encoding', http.contentEncoding);
  addRow(card, 'Content length', http.contentLength == null ? null : http.contentLength + ' bytes');

  const headerNames = Object.keys(http.headers || {});
  if (headerNames.length > 0) {
    const details = makeElement('details', 'details');
    details.append(makeElement('summary', null, 'Response headers (' + headerNames.length + ')'));
    for (const name of headerNames) addRow(details, name, http.headers[name]);
    card.append(details);
  }
  return card;
}

function renderSsl(ssl) {
  if (!ssl) return null;
  const card = createCard('SSL / TLS', sslStatus(ssl));
  addMessage(card, ssl.message);
  if (ssl.https && ssl.checked) {
    addRow(card, 'Certificate', checkText(ssl.certificateValidity));
    addRow(card, 'Trusted', checkText(ssl.certificateTrust));
    addRow(card, 'Hostname match', checkText(ssl.hostnameMatch));
    addRow(card, 'Subject', ssl.subject);
    addRow(card, 'Issuer', ssl.issuer);
    addRow(card, 'Valid from', formatDate(ssl.validFrom));
    addRow(card, 'Valid until', formatDate(ssl.validUntil));
    addRow(card, 'Days until expiry', ssl.daysUntilExpiry);
    addRow(card, 'Self-signed', ssl.selfSigned == null ? null : ssl.selfSigned ? 'Yes' : 'No');
    addRow(card, 'TLS version', ssl.tlsVersion);
    addRow(card, 'Cipher suite', ssl.cipherSuite);
  }
  return card;
}

function renderRedirects(redirect) {
  if (!redirect) return null;
  const card = createCard('Redirects', redirectStatus(redirect));
  addMessage(card, redirect.message);
  const chain = redirect.chain || [];
  if (redirect.redirected && chain.length > 0) {
    const list = makeElement('ol', 'hops');
    for (const hop of chain) {
      const item = makeElement('li');
      item.append(makeElement('span', 'hop-code', hop.statusCode == null ? '—' : hop.statusCode));
      item.append(makeElement('span', 'hop-url', hop.url));
      list.append(item);
    }
    card.append(list);
  }
  return card;
}

function renderTiming(timing) {
  if (!timing) return null;
  const card = createCard('Timing');
  addRow(card, 'DNS', formatMs(timing.dnsMs));
  addRow(card, 'TCP connect', formatMs(timing.tcpConnectMs));
  addRow(card, 'TLS handshake', formatMs(timing.tlsHandshakeMs));
  addRow(card, 'HTTP response', formatMs(timing.httpResponseMs));
  addRow(card, 'Total', formatMs(timing.totalMs));
  return card;
}

// builds one element; text is set with textContent so it's never parsed as HTML
function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function createCard(title, chip) {
  const card = makeElement('section', 'card');
  const cardHead = makeElement('div', 'card-head');
  cardHead.append(makeElement('h2', 'card-title', title));
  if (chip) cardHead.append(makeElement('span', 'chip chip-' + chip.kind, chip.text));
  card.append(cardHead);
  return card;
}

function addMessage(parent, text) {
  if (text) parent.append(makeElement('p', 'message', text));
}

// one "label  value" line; empty values are skipped so a card only shows what was measured
function addRow(parent, label, value) {
  if (value === undefined || value === null || value === '') return;
  const row = makeElement('div', 'row');
  row.append(makeElement('span', 'row-label', label), makeElement('span', 'row-value', String(value)));
  parent.append(row);
}

// badges only turn fields the backend already decided (resolved, reachable, ...) into a colour
function badge(kind, text) {
  return { kind: kind, text: text };
}

function httpStatus(http) {
  if (!http.checked) return badge('neutral', 'Not checked');
  if (!http.reachable) return badge('bad', 'Unreachable');
  const code = http.statusCode;
  if (code >= 200 && code < 300) return badge('ok', String(code));
  if (code >= 300 && code < 400) return badge('warn', String(code));
  return badge('bad', String(code));
}

function sslStatus(ssl) {
  if (!ssl.https) return badge('warn', 'No HTTPS');
  if (!ssl.checked) return badge('neutral', 'Not checked');
  const checks = [ssl.certificateValidity, ssl.certificateTrust, ssl.hostnameMatch];
  if (checks.includes('INVALID')) return badge('bad', 'Invalid');
  if (checks.every((check) => check === 'VALID')) return badge('ok', 'Valid');
  return badge('neutral', 'Partial');
}

function redirectStatus(redirect) {
  if (!redirect.checked) return badge('neutral', 'Not checked');
  if (redirect.loopDetected || redirect.truncated || redirect.blockedHop) return badge('bad', 'Problem');
  if (redirect.redirected) return badge('neutral', redirect.count + (redirect.count === 1 ? ' redirect' : ' redirects'));
  return badge('ok', 'None');
}

function checkText(value) {
  if (value === 'VALID') return 'Valid';
  if (value === 'INVALID') return 'Invalid';
  return 'Not checked';
}

function formatMs(ms) {
  return ms === undefined || ms === null ? null : ms + ' ms';
}

function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  return isNaN(date) ? String(iso) : date.toLocaleString();
}

init();
