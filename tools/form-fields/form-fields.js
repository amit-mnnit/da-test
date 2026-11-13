// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

// Column names understood by blocks/form/transform.js (fieldPropertyMapping)
const COLUMNS = ['Type', 'Name', 'Label', 'Placeholder', 'Value', 'Mandatory', 'Options', 'OptionNames', 'Fieldset', 'Style'];

const FIELDS = {
  text: { Type: 'text', Label: 'Text', Placeholder: 'Enter text' },
  email: {
    Type: 'email', Label: 'Email', Placeholder: 'name@example.com', Mandatory: 'x',
  },
  tel: { Type: 'tel', Label: 'Phone', Placeholder: 'Enter phone number' },
  number: { Type: 'number', Label: 'Number' },
  date: { Type: 'date', Label: 'Date' },
  password: { Type: 'password', Label: 'Password', Mandatory: 'x' },
  textarea: { Type: 'textarea', Label: 'Message', Placeholder: 'Enter your message' },
  select: { Type: 'select', Label: 'Dropdown', Options: 'Option 1,Option 2,Option 3' },
  'radio-group': { Type: 'radio-group', Label: 'Choose one', Options: 'Yes,No' },
  'checkbox-group': { Type: 'checkbox-group', Label: 'Choose any', Options: 'A,B,C' },
  checkbox: { Type: 'checkbox', Label: 'I agree', Value: 'on' },
  file: { Type: 'file', Label: 'Upload file' },
  rating: { Type: 'rating', Label: 'Rating', Options: '1,2,3,4,5' },
  range: { Type: 'range', Label: 'Range' },
  'plain-text': { Type: 'plain-text', Label: 'Some descriptive text' },
  fieldset: { Type: 'fieldset', Label: 'Group' },
  tnc: { Type: 'tnc', Label: 'Terms and conditions' },
  submit: { Type: 'submit', Label: 'Submit', Value: 'Thank you for your submission.' },
  reset: { Type: 'reset', Label: 'Reset' },
};

const TEMPLATES = {
  Contact: [
    {
      Type: 'text', Name: 'name', Label: 'Name', Mandatory: 'x',
    },
    {
      Type: 'email', Name: 'email', Label: 'Email', Mandatory: 'x',
    },
    { Type: 'textarea', Name: 'message', Label: 'Message' },
    {
      Type: 'submit', Name: 'submit', Label: 'Send', Value: 'Thanks, we will be in touch.',
    },
  ],
  Newsletter: [
    {
      Type: 'email', Name: 'email', Label: 'Email', Placeholder: 'name@example.com', Mandatory: 'x',
    },
    {
      Type: 'checkbox', Name: 'consent', Label: 'I agree to receive emails', Value: 'on', Mandatory: 'x',
    },
    {
      Type: 'submit', Name: 'submit', Label: 'Subscribe', Value: 'Subscribed!',
    },
  ],
  Login: [
    {
      Type: 'email', Name: 'email', Label: 'Email', Mandatory: 'x',
    },
    {
      Type: 'password', Name: 'password', Label: 'Password', Mandatory: 'x',
    },
    { Type: 'submit', Name: 'submit', Label: 'Log in' },
  ],
  Feedback: [
    {
      Type: 'rating', Name: 'rating', Label: 'How was your experience?', Options: '1,2,3,4,5',
    },
    {
      Type: 'radio-group', Name: 'recommend', Label: 'Would you recommend us?', Options: 'Yes,No',
    },
    { Type: 'textarea', Name: 'comments', Label: 'Comments' },
    {
      Type: 'submit', Name: 'submit', Label: 'Submit', Value: 'Thank you for your feedback.',
    },
  ],
};

const basket = [];
let activeTab = 'fields';
let status = '';

const app = document.getElementById('app');

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v === false) node.removeAttribute(k);
    else node.setAttribute(k, v === true ? '' : v);
  });
  node.append(...children);
  return node;
}

function uniqueName(base) {
  const root = base.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const used = new Set(basket.map((f) => f.Name));
  let name = root;
  for (let i = 2; used.has(name); i += 1) name = `${root}_${i}`;
  return name;
}

function addField(key) {
  basket.push({ ...FIELDS[key], Name: uniqueName(key) });
}

function addTemplate(name) {
  TEMPLATES[name].forEach((row) => {
    basket.push({ ...row, Name: uniqueName(row.Name) });
  });
}

function usedColumns() {
  return COLUMNS.filter((c) => c === 'Type' || c === 'Name' || basket.some((f) => f[c]));
}

function toRows() {
  const cols = usedColumns();
  return basket.map((f) => Object.fromEntries(cols.map((c) => [c, f[c] || ''])));
}

// Form block carrying a sheet-style definition, as read by blocks/form/form.js
function toBlockHTML() {
  const json = JSON.stringify({ ':type': 'sheet', data: toRows() }, null, 2)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div class="form"><div><div><pre><code>${json}</code></pre></div></div></div>`;
}

function toTSV() {
  const cols = usedColumns();
  return [cols.join('\t'), ...basket.map((f) => cols.map((c) => f[c] || '').join('\t'))].join('\n');
}

function move(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= basket.length) return;
  [basket[i], basket[j]] = [basket[j], basket[i]];
}

function render(actions) {
  const rerender = (msg = '') => { status = msg; render(actions); };

  const tabs = el(
    'div',
    { class: 'tabs' },
    ...[['fields', 'Fields'], ['templates', 'Templates']].map(([id, label]) => el(
      'button',
      {
        'aria-pressed': String(activeTab === id),
        onclick: () => { activeTab = id; rerender(); },
      },
      label,
    )),
  );

  const palette = el('div', { class: 'grid' });
  if (activeTab === 'fields') {
    Object.keys(FIELDS).forEach((key) => {
      palette.append(el('button', { onclick: () => { addField(key); rerender(); } }, `+ ${key}`));
    });
  } else {
    Object.keys(TEMPLATES).forEach((name) => {
      palette.append(el('button', { onclick: () => { addTemplate(name); rerender(); } }, `+ ${name} form`));
    });
  }

  const list = el('ul', { class: 'basket' });
  basket.forEach((f, i) => {
    list.append(el(
      'li',
      {},
      el('span', { class: 'name' }, f.Label || f.Name, el('small', {}, `${f.Type} · ${f.Name}`)),
      el('button', { title: 'Move up', onclick: () => { move(i, -1); rerender(); } }, '↑'),
      el('button', { title: 'Move down', onclick: () => { move(i, 1); rerender(); } }, '↓'),
      el('button', { title: 'Remove', onclick: () => { basket.splice(i, 1); rerender(); } }, '✕'),
    ));
  });

  const empty = basket.length === 0;
  const actionBar = el(
    'div',
    { class: 'actions' },
    el('button', {
      class: 'primary',
      disabled: empty,
      onclick: () => { actions.sendHTML(toBlockHTML()); rerender('Inserted form block.'); },
    }, 'Insert form block'),
    el('button', {
      disabled: empty,
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(toTSV());
          rerender('Rows copied. Paste into your form sheet.');
        } catch {
          rerender('Copy failed: clipboard not available.');
        }
      },
    }, 'Copy rows'),
    el('button', { disabled: empty, onclick: () => { basket.length = 0; rerender(); } }, 'Clear'),
  );

  app.replaceChildren(
    tabs,
    palette,
    el('h4', {}, `Selected (${basket.length})`),
    empty ? el('p', { class: 'empty' }, 'Pick fields or a template above.') : list,
    actionBar,
    el('p', { class: 'status' }, status),
  );
}

(async function init() {
  const { actions } = await DA_SDK;
  render(actions);
}());
