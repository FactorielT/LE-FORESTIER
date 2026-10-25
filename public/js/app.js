/* Application : connexion, structure, navigation */
const App = (() => {
  const { $, $$, esc, ic, get, post, err } = UI;
  let user = null;
  let nomEtab = 'LE REPOS DU FORESTIER';

  const NAV = [
    { sec: 'Opérations' },
    { r: '/', t: 'Accueil', i: 'home' },
    { r: '/ventes', t: 'Ventes', i: 'cart' },
    { r: '/stock', t: 'Stock', i: 'box' },
    { r: '/appro', t: 'Approvisions', i: 'truck' },
    { r: '/creances', t: 'Créances', i: 'card' },
    { r: '/depenses', t: 'Dépenses quotidiennes', i: 'wallet' },
    { r: '/caisse', t: 'Fermeture de caisse', i: 'power' },
    { sec: 'Bilans' },
    { r: '/bilans/ventes', t: 'Bilans des ventes', i: 'chart' },
    { r: '/bilans/appros', t: 'Bilans approvisions', i: 'pie' },
    { r: '/bilans/caisse', t: 'Bilans fermeture caisse', i: 'report' },
    { r: '/stats', t: 'Statistiques', i: 'pie' },
    { sec: 'Administration', role: 'admin' },
    { r: '/admin', t: 'Administration', i: 'gear', role: 'admin' },
    { r: '/admin/import', t: 'Importation données', i: 'upload', role: 'superadmin' },
    { r: '/admin/explorer', t: 'Explorateur BD', i: 'db', role: 'superadmin' },
  ];

  const isAdmin = () => user && (user.role === 'admin' || user.role === 'superadmin');
  const isSuper = () => user && user.role === 'superadmin';
  const allowed = (role) => !role || (role === 'admin' ? isAdmin() : isSuper());

  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    return { path: path || '/', params: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  function go(path, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    location.hash = '#' + path + qs;
  }

  // ---------- Connexion ----------
  function renderLogin() {
    $('#app').innerHTML = `<div class="login-wrap"><form class="login-card" autocomplete="on">
      <img src="/img/logo.jpg" alt="Logo">
      <h1>${esc(nomEtab)}</h1><p class="sub">Restaurant · Maquis · Bar — Gestion</p>
      <div class="field"><label>Login</label><input class="input" name="login" autocomplete="username" autocapitalize="none" required></div>
      <div class="field"><label>Mot de passe</label><input class="input" name="mdp" type="password" autocomplete="current-password" required></div>
      <button class="btn lg" type="submit">${ic('check')} Se connecter</button>
    </form></div>`;
    const f = $('.login-card');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = f.querySelector('button');
      b.disabled = true;
      try {
        user = await post('/login', { login: f.login.value, mdp: f.mdp.value });
        renderShell();
        route();
      } catch (x) { err(x); } finally { b.disabled = false; }
    });
    setTimeout(() => f.login.focus(), 50);
  }

  async function deconnexion() {
    if (!(await UI.ask('Voulez-vous vous déconnecter de l\'application ?', { title: 'Déconnexion' }))) return;
    await logout();
    UI.ok('Vous êtes déconnecté.');
  }

  async function logout(silent) {
    if (!silent) { try { await post('/logout'); } catch {} }
    user = null;
    renderLogin();
  }

  // ---------- Structure ----------
  function renderShell() {
    const nav = NAV.filter((x) => allowed(x.role)).map((x) => x.sec ? `<div class="sec">${x.sec}</div>` : `<a href="#${x.r}" data-r="${x.r}">${ic(x.i)}<span>${x.t}</span></a>`).join('');
    const ini = (user.nom || user.login || '?').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
    $('#app').innerHTML = `<div class="shell">
      <aside class="sidebar">
        <div class="brand"><img src="/img/logo.jpg" alt=""><div><b>${esc(nomEtab)}</b><small>Gestion maquis &amp; cave</small></div></div>
        <nav>${nav}</nav>
        <div class="me"><div class="av">${esc(ini)}</div><div class="who"><b>${esc(user.nom)}</b><small>${esc(user.groupe || '')}</small></div>
          <button title="Changer mon mot de passe" data-pwd>${ic('key')}</button>
          <button title="Déconnexion" data-logout>${ic('logout')}</button></div>
      </aside>
      <div class="scrim hidden"></div>
      <div class="main">
        <header class="topbar"><button class="ib menu-btn" aria-label="Menu">${ic('menu')}</button>
          <button class="ib back-btn hidden" aria-label="Retour">${ic('back')}</button><h1 id="page-title"></h1>
          <button class="ib" data-home title="Accueil">${ic('home')}</button>
          <button class="ib out-btn" data-logout-top title="Déconnexion">${ic('logout')}<span>Déconnexion</span></button></header>
        <main class="content" id="page"></main>
      </div></div>`;
    const shell = $('.shell');
    const closeNav = () => { shell.classList.remove('nav-open'); $('.scrim').classList.add('hidden'); };
    $('.menu-btn').addEventListener('click', () => { shell.classList.add('nav-open'); $('.scrim').classList.remove('hidden'); });
    $('.scrim').addEventListener('click', closeNav);
    $$('.sidebar nav a').forEach((a) => a.addEventListener('click', closeNav));
    $('[data-logout]').addEventListener('click', deconnexion);
    $('[data-logout-top]').addEventListener('click', deconnexion);
    $('[data-home]').addEventListener('click', () => go('/'));
    $('[data-pwd]').addEventListener('click', changePwd);
    $('.back-btn').addEventListener('click', () => {
      const p = Pages[parseHash().path];
      if (p && p.back) go(typeof p.back === 'function' ? p.back(parseHash().params) : p.back); else history.back();
    });
  }

  function changePwd() {
    const m = UI.modal({ title: 'Changer mon mot de passe', body: `
      <div class="field"><label>Ancien mot de passe</label><input class="input" type="password" name="a"></div>
      <div class="field"><label>Nouveau mot de passe</label><input class="input" type="password" name="n"></div>
      <div class="field"><label>Confirmer</label><input class="input" type="password" name="c"></div>`,
    foot: `<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>${ic('check')} Enregistrer</button>` });
    m.$('[data-ok]').addEventListener('click', async () => {
      if (!(await UI.ask('Changer votre mot de passe ?'))) return;
      const a = m.$('[name=a]').value, nv = m.$('[name=n]').value, c = m.$('[name=c]').value;
      if (nv !== c) return err('La confirmation ne correspond pas.');
      try { await post('/me/password', { ancien: a, nouveau: nv }); UI.ok('Mot de passe modifié.'); m.close(); } catch (x) { err(x); }
    });
  }

  let renderId = 0;
  async function route() {
    if (!user) return;
    const { path, params } = parseHash();
    const page = Pages[path] || Pages['/'];
    if (page.role && !allowed(page.role)) { UI.err('Accès réservé.'); return go('/'); }
    $('#page-title').textContent = typeof page.title === 'function' ? page.title(params) : page.title;
    document.title = ($('#page-title').textContent || 'Accueil') + ' · ' + nomEtab;
    $('.back-btn').classList.toggle('hidden', path === '/');
    $$('.sidebar nav a').forEach((a) => {
      const r = a.dataset.r;
      a.classList.toggle('active', r === '/' ? path === '/' : path === r || (path.startsWith(r + '/') && !NAV.some((x) => x.r && x.r !== r && path.startsWith(x.r) && x.r.length > r.length)));
    });
    $('#modal-root').innerHTML = '';
    const el = $('#page');
    const id = ++renderId;
    el.innerHTML = '<div class="spin"></div>';
    window.scrollTo(0, 0);
    try {
      el.innerHTML = '';
      await page.render(el, params, () => id === renderId);
    } catch (x) {
      if (id === renderId) el.innerHTML = `<div class="notice err">${ic('warn')}<div>${esc(x.message)}</div></div>`;
    }
  }

  async function start() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    try { nomEtab = (await get('/info')).nom || nomEtab; } catch {}
    try { user = await UI.api('/me'); } catch { user = null; }
    if (!user) return renderLogin();
    renderShell();
    route();
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', start);

  return { go, logout, deconnexion, isAdmin, isSuper, get user() { return user; }, get nom() { return nomEtab; }, parseHash };
})();
