/* Application : connexion, structure, navigation */
const App = (() => {
  const { $, $$, esc, ic, get, post, err } = UI;
  let user = null;
  let nomEtab = 'LE REPOS DU FORESTIER';
  let nomResto = 'RESTO DU FORESTIER';
  let espace = null; // 'maquis' | 'resto' | 'portail'
  let dernierEspace = 'maquis';
  try { dernierEspace = localStorage.getItem('forestier-espace') || 'maquis'; } catch {}

  const NAV_RESTO = [
    { sec: 'Restaurant' },
    { r: '/resto', t: 'Accueil restaurant', i: 'home' },
    { r: '/resto/vente', t: 'Vente (caisse)', i: 'cart' },
    { r: '/resto/tickets', t: 'Tickets / reçus', i: 'list' },
    { r: '/resto/menus', t: 'Menus', i: 'report' },
    { r: '/resto/stock', t: 'Stock', i: 'box' },
    { r: '/resto/depenses', t: 'Dépenses quotidiennes', i: 'wallet' },
    { r: '/resto/caisse', t: 'Fermeture de caisse', i: 'power' },
    { r: '/resto/imprimante', t: 'Imprimante tickets', i: 'print' },
    { sec: 'Bilans' },
    { r: '/resto/bilans', t: 'Bilans des ventes', i: 'chart' },
    { r: '/resto/bilans/caisse', t: 'Bilans fermeture caisse', i: 'pie' },
    { r: '/resto/stock/mouvements', t: 'Mouvements de stock', i: 'truck' },
    { sec: 'Administration', role: 'admin' },
    { r: '/resto/parametres', t: 'Paramètres restaurant', i: 'gear', role: 'admin' },
    { r: '/admin', t: 'Administration', i: 'users', role: 'admin' },
    { r: '/admin/explorer', t: 'Tables de la BD', i: 'db', role: 'superadmin' },
  ];

  const NAV = [
    { sec: 'Opérations' },
    { r: '/', t: 'Accueil', i: 'home' },
    { r: '/ventes', t: 'Ventes', i: 'cart' },
    { r: '/stock', t: 'Stock', i: 'box' },
    { r: '/appro', t: 'Approvisions', i: 'truck' },
    { r: '/creances', t: 'Créances', i: 'card' },
    { r: '/depenses', t: 'Dépenses quotidiennes', i: 'wallet' },
    { r: '/caisse', t: 'Fermeture de caisse', i: 'power' },
    { r: '/inventaire', t: 'Inventaire', i: 'list' },
    { sec: 'Bilans' },
    { r: '/bilans/ventes', t: 'Bilans des ventes', i: 'chart' },
    { r: '/bilans/produits', t: 'Bilan par produit', i: 'box' },
    { r: '/bilans/appros', t: 'Bilans approvisions', i: 'pie' },
    { r: '/bilans/caisse', t: 'Bilans fermeture caisse', i: 'report' },
    { r: '/stats', t: 'Statistiques', i: 'pie' },
    { sec: 'Administration', role: 'admin' },
    { r: '/admin', t: 'Administration', i: 'gear', role: 'admin' },
    { r: '/admin/import', t: 'Importation données', i: 'upload', role: 'superadmin' },
    { r: '/admin/explorer', t: 'Tables de la BD', i: 'db', role: 'superadmin' },
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

  // ---------- Connexion : choix de l'application puis identifiants propres à l'application ----------
  const homeDe = (app) => (app === 'resto' ? '/resto' : '/');
  function renderLogin(app) {
    if (app === undefined) { try { app = sessionStorage.getItem('forestier-login-app') || null; } catch { app = null; } }
    document.body.classList.toggle('espace-resto', app === 'resto');
    if (!app) {
      $('#app').innerHTML = `<div class="login-wrap"><div class="login-choix">
        <img src="/img/logo.jpg" alt="Logo" class="lc-logo">
        <h1>Bienvenue</h1><p class="sub">Choisissez l'application à laquelle vous voulez vous connecter.</p>
        <div class="portail-grid">
          <button type="button" class="app-card maquis" data-app="maquis"><div class="app-ic">${ic('cart')}</div>
            <div class="app-k">Maquis · Bar · Cave</div><h3>${esc(nomEtab)}</h3><p>Ventes des boissons, stock, créances, caisse.</p><span class="app-go">Se connecter ›</span></button>
          <button type="button" class="app-card resto" data-app="resto"><div class="app-ic">${ic('report')}</div>
            <div class="app-k">Restaurant</div><h3>${esc(nomResto)}</h3><p>Vente au comptoir avec reçu, menus, stock, caisse.</p><span class="app-go">Se connecter ›</span></button>
        </div></div></div>`;
      $$('[data-app]').forEach((b) => b.addEventListener('click', () => {
        try { sessionStorage.setItem('forestier-login-app', b.dataset.app); } catch {}
        renderLogin(b.dataset.app);
      }));
      return;
    }
    const nom = app === 'resto' ? nomResto : nomEtab;
    $('#app').innerHTML = `<div class="login-wrap"><form class="login-card ${app}" autocomplete="on">
      <img src="/img/logo.jpg" alt="Logo">
      <div class="lc-k">${app === 'resto' ? 'Restaurant' : 'Maquis · Bar · Cave'}</div>
      <h1>${esc(nom)}</h1><p class="sub">Connectez-vous avec les identifiants de cette application.</p>
      <div class="field"><label>Login</label><input class="input" name="login" autocomplete="username" autocapitalize="none" required></div>
      <div class="field"><label>Mot de passe</label><input class="input" name="mdp" type="password" autocomplete="current-password" required></div>
      <button class="btn lg" type="submit">${ic('check')} Se connecter</button>
      <button class="btn ghost block" type="button" data-autre style="margin-top:8px">${ic('back')} Choisir une autre application</button>
    </form></div>`;
    const f = $('.login-card');
    $('[data-autre]').addEventListener('click', () => { try { sessionStorage.removeItem('forestier-login-app'); } catch {} renderLogin(null); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = f.querySelector('button[type=submit]');
      b.disabled = true;
      try {
        user = await post('/login', { login: f.login.value, mdp: f.mdp.value, app });
        espace = null;
        const cible = '#' + homeDe(user.app);
        if (location.hash !== cible) location.hash = cible; else route();
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
    const app = user ? user.app : undefined;
    user = null;
    espace = null;
    renderLogin(app);
  }

  // ---------- Structure ----------
  function espaceDe(path) {
    if (path === '/portail') return 'portail';
    if (path === '/resto' || path.startsWith('/resto/')) return 'resto';
    if (path === '/admin' || path.startsWith('/admin/')) return espace && espace !== 'portail' ? espace : dernierEspace;
    return 'maquis';
  }
  const accueil = () => (espace === 'resto' ? '/resto' : espace === 'portail' ? '/portail' : '/');

  function renderShell() {
    const resto = espace === 'resto';
    document.body.classList.toggle('espace-resto', resto);
    const liste = espace === 'portail' ? [] : resto ? NAV_RESTO : NAV;
    const nav = (espace === 'portail'
      ? `<div class="sec">Applications</div><a href="#/">${ic('cart')}<span>${esc(nomEtab)}</span></a><a href="#/resto">${ic('report')}<span>${esc(nomResto)}</span></a>`
      : user.acces === 'TOUS' ? `<a href="#/portail" data-r="/portail" class="switch-app">${ic('refresh')}<span>Changer d'application</span></a>`
        : `<a href="#" data-autre-app class="switch-app">${ic('refresh')}<span>Changer d'application</span></a>`) + liste.filter((x) => allowed(x.role)).map((x) => x.sec ? `<div class="sec">${x.sec}</div>` : `<a href="#${x.r}" data-r="${x.r}">${ic(x.i)}<span>${x.t}</span></a>`).join('');
    const ini = (user.nom || user.login || '?').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();
    $('#app').innerHTML = `<div class="shell">
      <aside class="sidebar">
        <div class="brand"><img src="/img/logo.jpg" alt=""><div><b>${esc(resto ? nomResto : nomEtab)}</b><small>${resto ? 'Gestion du restaurant' : espace === 'portail' ? 'Choix de l\'application' : 'Gestion maquis &amp; cave'}</small></div></div>
        <nav>${nav}</nav>
        <div class="me"><div class="av">${esc(ini)}</div><div class="who"><b>${esc(user.nom)}</b><small>${esc(user.groupe || '')}</small></div>
          <button title="Changer mon mot de passe" data-pwd>${ic('key')}</button>
          <button title="Déconnexion" data-logout>${ic('logout')}</button></div>
      </aside>
      <div class="scrim hidden"></div>
      <div class="main">
        <header class="topbar"><button class="ib menu-btn" aria-label="Menu">${ic('menu')}</button>
          <button class="ib back-btn hidden" aria-label="Retour">${ic('back')}</button><h1 id="page-title"></h1>
          <button class="ib pdf-btn hidden" data-pdf title="Télécharger cette page en PDF">${ic('down')}<span>PDF</span></button>
          <button class="ib" data-home title="Accueil">${ic('home')}</button>
          <button class="ib out-btn" data-logout-top title="Déconnexion">${ic('logout')}<span>Déconnexion</span></button></header>
        <div class="print-head"><img src="/img/logo.jpg" alt=""><div><b>${esc(resto ? nomResto : nomEtab)}</b><span id="print-title"></span></div></div>
        <main class="content" id="page"></main>
      </div></div>`;
    const shell = $('.shell');
    const closeNav = () => { shell.classList.remove('nav-open'); $('.scrim').classList.add('hidden'); };
    $('.menu-btn').addEventListener('click', () => { shell.classList.add('nav-open'); $('.scrim').classList.remove('hidden'); });
    $('.scrim').addEventListener('click', closeNav);
    $$('.sidebar nav a').forEach((a) => a.addEventListener('click', closeNav));
    $('[data-logout]').addEventListener('click', deconnexion);
    $('[data-logout-top]').addEventListener('click', deconnexion);
    $('[data-home]').addEventListener('click', () => go(accueil()));
    $('[data-pdf]').addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { const f = await PDF.page({ root: $('#page') }); UI.ok(`PDF téléchargé : ${f}`); } catch (x) { UI.err(x.message || String(x)); } finally { b.disabled = false; }
    });
    $('[data-pwd]').addEventListener('click', changePwd);
    const aa = $('[data-autre-app]');
    if (aa) aa.addEventListener('click', async (e) => {
      e.preventDefault();
      const autre = user.app === 'resto' ? nomEtab : nomResto;
      if (!(await UI.ask(`Pour ouvrir <b>${esc(autre)}</b>, il faut vous déconnecter puis vous connecter avec les identifiants de cette application.<br><br>Se déconnecter maintenant ?`, { title: "Changer d'application" }))) return;
      try { await post('/logout'); } catch {}
      user = null; espace = null;
      try { sessionStorage.removeItem('forestier-login-app'); } catch {}
      renderLogin(null);
    });
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
    let page = Pages[path] || Pages[homeDe(user.app)];
    let esp = Pages[path] ? espaceDe(path) : user.app === 'resto' ? 'resto' : 'maquis';
    // Chaque compte n'ouvre que son application (sauf accès aux deux applications)
    if (esp === 'portail' && user.acces !== 'TOUS') return go(homeDe(user.app));
    if ((esp === 'maquis' || esp === 'resto') && esp !== user.app) {
      if (user.acces === 'TOUS') {
        try { user = await post('/changer-app', { app: esp }); } catch (x) { return err(x); }
      } else {
        UI.err(esp === 'resto' ? `Votre compte n'a pas accès à ${nomResto}.` : `Votre compte n'a pas accès à ${nomEtab}.`);
        return go(homeDe(user.app));
      }
    }
    if (esp !== espace || !$('.shell')) {
      espace = esp;
      if (esp !== 'portail') { dernierEspace = esp; try { localStorage.setItem('forestier-espace', esp); } catch {} }
      renderShell();
    }
    if (page.role && !allowed(page.role)) { UI.err('Accès réservé.'); return go(accueil()); }
    $('#page-title').textContent = typeof page.title === 'function' ? page.title(params) : page.title;
    document.title = ($('#page-title').textContent || 'Accueil') + ' · ' + (espace === 'resto' ? nomResto : nomEtab);
    $('#print-title').textContent = $('#page-title').textContent;
    $('.pdf-btn').classList.toggle('hidden', !page.pdf);
    $('.back-btn').classList.toggle('hidden', path === '/' || path === '/resto' || path === '/portail');
    $$('.sidebar nav a').forEach((a) => {
      const r = a.dataset.r;
      const all = [...NAV, ...NAV_RESTO];
      a.classList.toggle('active', r === '/' || r === '/resto' ? path === r : path === r || (path.startsWith(r + '/') && !all.some((x) => x.r && x.r !== r && path.startsWith(x.r) && x.r.length > r.length)));
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
    try { const i = await get('/info'); nomEtab = i.nom || nomEtab; nomResto = i.resto || nomResto; } catch {}
    try { user = await UI.api('/me'); } catch { user = null; }
    if (!user) return renderLogin();
    if (!location.hash || location.hash === '#') { location.hash = '#' + homeDe(user.app); return; }
    route();
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', start);

  return { go, logout, deconnexion, get espace() { return espace; }, get nomResto() { return nomResto; }, isAdmin, isSuper, get user() { return user; }, get nom() { return nomEtab; }, parseHash };
})();
