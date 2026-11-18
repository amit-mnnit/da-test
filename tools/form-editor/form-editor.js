// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
// Built from the form-editor project via `npm run build:da`; do not edit by hand.
import { mountFormEditor } from './vendor/form-editor-mount.js';

const SOURCE_API = 'https://admin.da.live/source';
const PATH_PATTERN = /^(\/[a-z0-9][a-z0-9_-]*)+$/;

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

(async function init() {
  const { context, actions } = await DA_SDK;
  const { org } = context;
  const site = context.repo ?? context.site;
  if (!org || !site) {
    setStatus('Open this tool from Experience Workspace (missing org/site context).', 'error');
    return;
  }
  prefixEl.textContent = `${org}/${site}`;

  const queryPath = new URLSearchParams(window.location.search).get('form');
  if (queryPath) pathInput.value = queryPath;

  let currentPath = null;
  let dirty = false;
  const sourceUrl = (path) => `${SOURCE_API}/${org}/${site}${path}.json`;

  async function save(schema) {
    if (!currentPath) {
      setStatus('Load or create a form before saving.', 'error');
      return;
    }
    setStatus('Saving…');
    const body = new FormData();
    body.append('data', new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' }));
    const resp = await actions.daFetch(sourceUrl(currentPath), { method: 'PUT', body });
    if (!resp.ok) {
      setStatus(`Save failed (${resp.status}).`, 'error');
      return;
    }
    dirty = false;
    setStatus(`Saved ${currentPath}.json at ${new Date().toLocaleTimeString()}`);
  }

  const editor = mountFormEditor(document.getElementById('editor'), {
    onChange: () => {
      dirty = true;
      setStatus('Unsaved changes', 'dirty');
    },
    onSave: (schema) => { save(schema); },
  });

  async function load(path) {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setStatus('Loading…');
    const resp = await actions.daFetch(sourceUrl(path));
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

  document.getElementById('load-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const path = normalizePath(pathInput.value);
    if (!path) {
      setStatus('Use lowercase letters, digits, "-" or "_", e.g. /forms/contact', 'error');
      return;
    }
    pathInput.value = path;
    load(path);
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault();
  });

  const initial = normalizePath(pathInput.value);
  if (initial) load(initial);
}());
