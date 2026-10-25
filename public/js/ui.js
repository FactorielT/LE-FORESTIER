/* Outils d'interface : API, formatage, icônes, modales, tableaux */
const UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ----- API -----
  async function api(url, opts = {}) {
    const o = { method: opts.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opts.body instanceof FormData) o.body = opts.body;
    else if (opts.body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
    let r;
    try { r = await fetch('/api' + url, o); } catch { throw new Error('Connexion au serveur impossible. Vérifiez votre connexion internet.'); }
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    if (r.status === 401 && !url.startsWith('/login')) { App.logout(true); throw new Error((data && data.error) || 'Session expirée'); }
    if (!r.ok) throw new Error((data && data.error) || 'Erreur ' + r.status);
    return data;
  }
  const get = (u) => api(u);
  const post = (u, b) => api(u, { method: 'POST', body: b || {} });
  const put = (u, b) => api(u, { method: 'PUT', body: b || {} });
  const del = (u) => api(u, { method: 'DELETE' });

  // ----- Format -----
  const n = (v) => { const x = Number(String(v ?? '').replace(/[\s  ]/g, '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
  const money = (v) => Math.round(Number(v) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ');
  const qty = (v) => { const x = Number(v) || 0; return Number.isInteger(x) ? x.toLocaleString('fr-FR').replace(/ | /g, ' ') : x.toLocaleString('fr-FR', { maximumFractionDigits: 3 }).replace(/ | /g, ' '); };
  const pad = (x) => String(x).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const addDays = (iso, k) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + k); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const firstOfMonth = () => today().slice(0, 8) + '01';
  const dfr = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
  const dlong = (iso) => new Date((iso || today()) + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hm = (t) => (t ? String(t).slice(0, 5) : '');

  // ----- Icônes (style trait) -----
  const P = {
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 7H6.2"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
    wallet: '<path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h14a1.5 1.5 0 0 0 1.5-1.5V9a2 2 0 0 0-2-2H5.5"/><circle cx="16.5" cy="13.5" r="1.2"/>',
    power: '<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    pie: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    report: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 17v-3M12 17v-6M16 17v-2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    db: '<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5v13c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8v-13M4 12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8"/>',
    hash: '<path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    key: '<circle cx="7.5" cy="15.5" r="4"/><path d="m10.5 12.5 9-9M16 7l2.5 2.5M14 9l2 2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.8-4M4 4v4h4M4 13a8 8 0 0 0 14.8 4M20 20v-4h-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  };
  const ic = (name, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ''}</svg>`;

  // ----- Toast -----
  function toast(msg, type = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = (type === 'err' ? ic('warn') : type === 'ok' ? ic('check') : ic('info')) + `<span>${esc(msg)}</span>`;
    $('#toast-root').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, type === 'err' ? 5200 : 3000);
  }
  const ok = (m) => toast(m, 'ok');
  const err = (e) => toast(e && e.message ? e.message : String(e), 'err');

  // ----- Modale -----
  function modal({ title, body, foot, wide, onClose }) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-h"><h3>${esc(title)}</h3><button type="button" data-close aria-label="Fermer">${ic('x')}</button></div>
      <div class="modal-b">${body || ''}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    $$('[data-close]', bg).forEach((b) => b.addEventListener('click', close));
    $('#modal-root').appendChild(bg);
    const first = $('input:not([readonly]):not([type=hidden]), select, textarea', bg);
    if (first && window.matchMedia('(pointer:fine)').matches) setTimeout(() => first.focus(), 30);
    return { el: bg, close, $: (s) => $(s, bg), $$: (s) => $$(s, bg) };
  }
  function alert(msg, title = 'Information') {
    return new Promise((res) => {
      const m = modal({ title, body: `<div class="alert-msg">${ic('info')}<div>${msg}</div></div>`, foot: `<button class="btn" data-ok>OK</button>`, onClose: res });
      m.$('[data-ok]').addEventListener('click', m.close);
      setTimeout(() => m.$('[data-ok]').focus(), 30);
    });
  }
  function confirm(msg, { title = 'Confirmation', okText = 'Oui', danger = false } = {}) {
    return new Promise((res) => {
      let done = false;
      const m = modal({ title, body: `<div class="alert-msg">${ic(danger ? 'warn' : 'info')}<div>${msg}</div></div>`,
        foot: `<button class="btn sec" data-close>Annuler</button><button class="btn ${danger ? 'red' : ''}" data-ok>${esc(okText)}</button>`,
        onClose: () => { if (!done) res(false); } });
      m.$('[data-ok]').addEventListener('click', () => { done = true; m.close(); res(true); });
    });
  }

  // ----- Tableau -----
  /**
   * cols: [{k, t, cls, f(row), r(alignement droite)}]
   * opts: {onClick(row, tr, idx), onDbl, selectable, foot: [..], empty, rowCls(row)}
   */
  function table(el, cols, rows, opts = {}) {
    const th = cols.map((c) => `<th class="${c.r ? 'r' : ''} ${c.c ? 'c' : ''} ${c.first ? 'first' : ''}">${c.t}</th>`).join('');
    const body = rows.length
      ? rows.map((row, i) => `<tr data-i="${i}" class="${opts.onClick || opts.selectable ? 'click' : ''} ${opts.rowCls ? opts.rowCls(row) : ''}">${cols
        .map((c) => `<td class="${c.r ? 'r' : ''} ${c.c ? 'c' : ''} ${c.cls || ''} ${c.first ? 'first' : ''}">${c.f ? c.f(row, i) : esc(row[c.k])}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${cols.length}" class="empty">${opts.empty || 'Aucune donnée'}</td></tr>`;
    const foot = opts.foot && rows.length ? `<tfoot><tr>${opts.foot.map((f, i) => `<td class="${cols[i] && cols[i].r ? 'r' : ''}">${f ?? ''}</td>`).join('')}</tr></tfoot>` : '';
    el.innerHTML = `<table class="tbl ${opts.green ? 'green' : ''}"><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
    let selected = null;
    $$('tbody tr[data-i]', el).forEach((tr) => {
      const i = Number(tr.dataset.i);
      tr.addEventListener('click', (e) => {
        if (e.target.closest('input,button,select')) return;
        if (opts.selectable) {
          $$('tr.sel', el).forEach((x) => x.classList.remove('sel'));
          tr.classList.add('sel');
          selected = i;
          opts.onSelect && opts.onSelect(rows[i], i);
        }
        opts.onClick && opts.onClick(rows[i], tr, i);
      });
      if (opts.onDbl) tr.addEventListener('dblclick', () => opts.onDbl(rows[i], i));
    });
    return { get selected() { return selected === null ? null : rows[selected]; } };
  }

  const loading = (el) => { el.innerHTML = '<div class="spin"></div>'; };
  const sum = (rows, k) => rows.reduce((a, r) => a + (Number(typeof k === 'function' ? k(r) : r[k]) || 0), 0);

  // Champ montant formaté (espaces de milliers)
  function moneyInput(input, onChange) {
    const fmt = () => { const v = n(input.value); input.value = input.value === '' ? '' : money(v); };
    input.setAttribute('inputmode', 'numeric');
    input.addEventListener('focus', () => { input.value = input.value ? String(n(input.value)) : ''; setTimeout(() => input.select(), 0); });
    input.addEventListener('blur', fmt);
    input.addEventListener('input', () => onChange && onChange(n(input.value)));
    return { get: () => n(input.value), set: (v) => { input.value = money(v); } };
  }

  return { $, $$, esc, api, get, post, put, del, n, money, qty, today, addDays, firstOfMonth, dfr, dlong, hm, ic, toast, ok, err, modal, alert, confirm, table, loading, sum, moneyInput };
})();
