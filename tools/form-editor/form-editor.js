// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
// Built from the form-editor project via `npm run build:da`; do not edit by hand.
import { mountFormEditor } from './vendor/form-editor-mount.js';

const SOURCE_API = 'https://admin.da.live/source';
const PATH_PATTERN = /^(\/[a-z0-9][a-z0-9_-]*)+$/;
// DA_SDK only resolves when Experience Workspace frames this page (da.live/app/...).
const SDK_TIMEOUT_MS = 5000;

const loadForm = document.getElementById('load-form');
const statusEl = document.getElementById('status');
const pathInput = document.getElementById('form-path');
const prefixEl = document.getElementById('form-prefix');

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = `fe-host-status${kind ? ` is-${kind}` : ''}`;
}

function normalizePath(raw) {
  const path = `/${raw.trim().toLowerCase().replace(/^\/+/, '').replace(/\.json$/, '')}`;
  return PATH_PATTERN.test(path) ? path : null;
}

function appUrl() {
  // https://main--{site}--{org}.aem.page/tools/x/y.html -> https://da.live/app/{org}/{site}/tools/x/y
  const { hostname, pathname } = window.location;
  const [, site, org] = hostname.split('.')[0].split('--');
  if (!site || !org || !/\.aem\.(page|live)$/.test(hostname)) return null;
  return `https://da.live/app/${org}/${site}${pathname.replace(/\.html$/, '')}`;
}

// Attach immediately so submitting never falls back to a full page reload.
let onLoadRequest = () => setStatus('Connecting to Experience Workspace…');
loadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const path = normalizePath(pathInput.value);
  if (!path) {
    setStatus('Use lowercase letters, digits, "-" or "_", e.g. /forms/contact', 'error');
    return;
  }
  pathInput.value = path;
  onLoadRequest(path);
});

const queryPath = new URLSearchParams(window.location.search).get('form');
if (queryPath) pathInput.value = queryPath;

let currentPath = null;
let dirty = false;
let sdk = null;

const editor = mountFormEditor(document.getElementById('editor'), {
  onChange: () => {
    dirty = true;
    setStatus('Unsaved changes', 'dirty');
  },
  // eslint-disable-next-line no-use-before-define
  onSave: (schema) => { save(schema); },
});

const sourceUrl = (path) => `${SOURCE_API}/${sdk.org}/${sdk.site}${path}.json`;

async function save(schema) {
  if (!sdk) {
    setStatus('Not connected to Experience Workspace; cannot save.', 'error');
    return;
  }
  if (!currentPath) {
    setStatus('Load or create a form before saving.', 'error');
    return;
  }
  setStatus('Saving…');
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' }));
  const resp = await sdk.actions.daFetch(sourceUrl(currentPath), { method: 'PUT', body });
  if (!resp.ok) {
    setStatus(`Save failed (${resp.status}).`, 'error');
    return;
  }
  dirty = false;
  setStatus(`Saved ${currentPath}.json at ${new Date().toLocaleTimeString()}`);
}

async function load(path) {
  if (dirty && !window.confirm('Discard unsaved changes?')) return;
  setStatus('Loading…');
  const resp = await sdk.actions.daFetch(sourceUrl(path));
  if (resp.status === 404) {
    editor.setSchema({ version: 1, title: path.split('/').pop(), fields: [] });
    setStatus(`New form: ${path}.json (not saved yet)`);
  } else if (!resp.ok) {
    setStatus(`Could not load ${path}.json (${resp.status}).`, 'error');
    return;
  } else {
    try {
      editor.setSchema(await resp.json());
      setStatus(`Loaded ${path}.json`);
    } catch {
      setStatus(`${path}.json is not valid JSON.`, 'error');
      return;
    }
  }
  currentPath = path;
  dirty = false;
}

window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});

(async function init() {
  setStatus('Connecting to Experience Workspace…');
  const timeout = new Promise((resolve) => { setTimeout(resolve, SDK_TIMEOUT_MS, null); });
  const result = await Promise.race([DA_SDK, timeout]);
  const org = result?.context?.org;
  const site = result?.context?.repo ?? result?.context?.site;
  if (!org || !site) {
    const url = appUrl();
    onLoadRequest = () => {};
    setStatus(
      `Not connected to Experience Workspace, so forms can't be loaded or saved. Open ${url ?? 'this tool via https://da.live/app/{org}/{site}/<tool-path>'}`,
      'error',
    );
    return;
  }

  sdk = { org, site, actions: result.actions };
  prefixEl.textContent = `${org}/${site}`;
  onLoadRequest = load;
  const initial = normalizePath(pathInput.value);
  if (initial) load(initial);
}());
