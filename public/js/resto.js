/* ===== RESTO DU FORESTIER : pages de l'application restaurant + portail ===== */
(() => {
  const { $, $$, esc, ic, get, post, put, del, n, money, qty, today, addDays, dfr, dlong, hm, toast, ok, err, modal, alert, confirm, table, sum, moneyInput, firstOfMonth } = UI;
  const go = (...a) => App.go(...a);
  const adminOnly = () => App.isAdmin();
  const MODES = { ESPECE: 'Espèce', WAVE: 'Wave', OM: 'Orange Money' };
  let INFO = null;
  const info = async () => (INFO = INFO || (await get('/resto/info')));
  const unites = (v, u) => `${qty(Math.round(v * 100) / 100)} ${u}${Math.abs(v) > 1 ? 's' : ''}`;

  // ================= PORTAIL : choix de l'application =================
  Pages['/portail'] = {
    title: 'Choisir une application',
    async render(el) {
      el.innerHTML = `<div class="portail">
        <div class="portail-h"><img src="/img/logo.jpg" alt=""><div><h2>Bonjour ${esc((App.user.nom || '').split(' ')[0])}</h2><p>Choisissez l'application à ouvrir.</p></div></div>
        <div class="portail-grid">
          <a class="app-card maquis" href="#/">
            <div class="app-ic">${ic('cart')}</div>
            <div class="app-k">Maquis · Bar · Cave</div><h3>${esc(App.nom)}</h3>
            <p>Ventes journalières des boissons, stock, approvisionnements, créances, dépenses, fermeture de caisse et bilans.</p>
            <div class="app-stat" id="pt-m">…</div><span class="app-go">Ouvrir ›</span></a>
          <a class="app-card resto" href="#/resto">
            <div class="app-ic">${ic('report')}</div>
            <div class="app-k">Restaurant</div><h3>${esc(App.nomResto)}</h3>
            <p>Vente au comptoir avec reçu, menus fixes et menus du jour, stock (riz, poisson, poulets, charbon), dépenses, fermeture de caisse et bilans.</p>
            <div class="app-stat" id="pt-r">…</div><span class="app-go">Ouvrir ›</span></a>
        </div></div>`;
      get('/dashboard').then((d) => { $('#pt-m').innerHTML = `Ventes du mois : <b>${money(d.mois.ventes)}</b>`; }).catch(() => { $('#pt-m').textContent = ''; });
      get('/resto/dashboard').then((d) => { $('#pt-r').innerHTML = `Ventes du jour : <b>${money(d.jour.totalVentes)}</b> · ${d.jour.nbTickets} ticket(s)`; }).catch(() => { $('#pt-r').textContent = ''; });
    },
  };

  // ================= ACCUEIL RESTAURANT =================
  Pages['/resto'] = {
    title: 'Accueil restaurant',
    async render(el) {
      const h = new Date().getHours();
      el.innerHTML = `
        <section class="hero hero-resto">
          <div class="hero-in"><img src="/img/logo.jpg" alt="Logo" class="hero-logo">
            <div class="hero-txt"><div class="hero-kicker">Restaurant</div><h2>${esc(App.nomResto)}</h2>
              <p>${h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'} <b>${esc((App.user.nom || '').split(' ')[0])}</b> — <span style="text-transform:capitalize">${dlong(today())}</span></p></div></div>
          <div class="hero-actions">
            <a class="hbtn" href="#/resto/vente">${ic('cart')}<span>Nouvelle vente</span></a>
            <a class="hbtn" href="#/resto/menus">${ic('report')}<span>Menus</span></a>
            <a class="hbtn" href="#/resto/stock">${ic('box')}<span>Stock</span></a>
            <a class="hbtn" href="#/resto/depenses">${ic('wallet')}<span>Dépense</span></a>
            <a class="hbtn" href="#/resto/caisse">${ic('power')}<span>Fermer la caisse</span></a>
            <button class="hbtn hbtn-out" type="button" data-out>${ic('logout')}<span>Déconnexion</span></button>
          </div>
        </section>
        <div id="r-alerts"></div>
        <div class="kpis" id="r-kpi">${'<div class="kpi sk"></div>'.repeat(4)}</div>
        <div class="card"><div class="card-title">${ic('box')} Stock du restaurant <a href="#/resto/stock" class="link-more">Gérer le stock ›</a></div><div class="res-mini" id="r-res"></div></div>
        <div class="home-grid">
          <div class="card"><div class="card-title">${ic('chart')} Ventes des 14 derniers jours <a href="#/resto/bilans" class="link-more">Bilans ›</a></div>
            <div class="chart-box"><canvas id="r-chart"></canvas></div><div id="r-chart-d"></div></div>
          <div class="card"><div class="card-title">${ic('report')} Plats les plus vendus du mois</div><div id="r-top"></div></div>
        </div>`;
      $('[data-out]').addEventListener('click', () => App.deconnexion());
      const d = await get('/resto/dashboard');
      const al = [];
      if (d.aFermer && d.aFermer.date < d.date) al.push(`<a class="alert-card red" href="#/resto/caisse?date=${d.aFermer.date}">${ic('power')}<div><b>Caisse du ${dfr(d.aFermer.date)} non fermée</b><span>Les nouvelles ventes sont bloquées tant qu'elle n'est pas fermée.</span></div><i>›</i></a>`);
      if (d.fermee) al.push(`<div class="alert-card info">${ic('lock')}<div><b>Caisse du jour fermée</b><span>Plus aucune vente ni dépense ne peut être enregistrée aujourd'hui.</span></div></div>`);
      if (d.nbPlatsJour && !d.menuJour) al.push(`<a class="alert-card warn" href="#/resto/menus?onglet=jour">${ic('report')}<div><b>Pas de menu du jour</b><span>Choisissez les plats du jour proposés aujourd'hui.</span></div><i>›</i></a>`);
      const bas = d.ressources.filter((r) => r.alerte);
      if (bas.length) al.push(`<a class="alert-card amber" href="#/resto/stock">${ic('box')}<div><b>Stock bas (${bas.length})</b><span>${bas.map((r) => `${esc(r.nom)} : ${unites(r.stock, r.unite)}`).join(' · ')}</span></div><i>›</i></a>`);
      $('#r-alerts').innerHTML = al.length ? `<div class="alerts">${al.join('')}</div>` : '';
      const kpi = (l, v, s, i, c) => `<div class="kpi"><div class="kpi-ic ${c}">${ic(i)}</div><div><small>${l}</small><b>${v}</b><span>${s}</span></div></div>`;
      $('#r-kpi').innerHTML = kpi('Ventes du jour', money(d.jour.totalVentes), `${d.jour.nbTickets} ticket(s)`, 'cart', 'c1')
        + kpi('Dépenses du jour', money(d.jour.depenses), 'Dépenses quotidiennes', 'wallet', 'c5')
        + kpi('À verser aujourd\'hui', money(d.jour.aVerser), d.fermee ? 'Caisse fermée' : 'Caisse ouverte', 'power', 'c6')
        + kpi('Ventes du mois', money(d.mois.ca), `${d.mois.tickets} ticket(s)`, 'chart', 'c4');
      $('#r-res').innerHTML = d.ressources.map((r) => `<div class="rm ${r.alerte ? 'bas' : ''}"><small>${esc(r.nom)}</small><b>${unites(r.stock, r.unite)}</b>
        <span>${r.ppu ? `≈ ${qty(r.plats)} plats` : 'Gestion manuelle'}</span></div>`).join('');
      Charts.combo($('#r-chart'), d.serie.map((x) => x.d.slice(8, 10) + '/' + x.d.slice(5, 7)), [{ label: 'Ventes', data: d.serie.map((x) => x.ca), color: Charts.C.s1 }]);
      $('#r-chart-d').innerHTML = Charts.dataTable([{ t: 'Date', f: (r) => dfr(r.d) }, { t: 'Tickets', r: 1, f: (r) => r.tickets }, { t: 'Ventes', r: 1, f: (r) => money(r.ca) }], d.serie);
      const max = Math.max(1, ...d.top.map((x) => x.qte));
      $('#r-top').innerHTML = d.top.length ? d.top.map((x, i) => `<div class="hbar"><div class="hbar-l"><span class="rank">${i + 1}</span><b>${esc(x.nom)}</b><em>${qty(x.qte)} plat(s)</em></div>
        <div class="hbar-t"><div style="width:${Math.max(3, (x.qte / max) * 100)}%"></div></div><small>${money(x.ca)}</small></div>`).join('') : '<div class="empty">Aucune vente ce mois-ci.</div>';
    },
  };

  // ================= REÇU (ticket client) =================
  async function recu(t, { nouveau = false } = {}) {
    const I = await info();
    const html = `<div class="ticket">
      <div class="tk-h"><b>${esc(I.nom)}</b>${I.adresse ? `<span>${esc(I.adresse)}</span>` : ''}${I.telephone ? `<span>Tél : ${esc(I.telephone)}</span>` : ''}</div>
      <div class="tk-sep"></div>
      <div class="tk-row"><span>Reçu N°</span><b>${esc(t.numero)}</b></div>
      <div class="tk-row"><span>Date</span><span>${dfr(t.date)} à ${hm(t.heure)}</span></div>
      <div class="tk-row"><span>Client</span><span>${esc(t.client || 'Client comptoir')}</span></div>
      <div class="tk-row"><span>Caissier</span><span>${esc(t.agent || '')}</span></div>
      <div class="tk-sep"></div>
      <table class="tk-t"><thead><tr><th>Qté</th><th>Désignation</th><th class="r">P.U.</th><th class="r">Montant</th></tr></thead>
        <tbody>${t.lignes.map((l) => (l.parent_id
          ? `<tr class="tk-acc"><td></td><td>+ ${esc(l.nom)}</td><td class="r">${l.prix ? money(l.prix) : 'inclus'}</td><td class="r">${l.total ? money(l.total) : ''}</td></tr>`
          : `<tr><td>${l.qte}</td><td>${esc(l.nom)}</td><td class="r">${money(l.prix)}</td><td class="r">${money(l.total)}</td></tr>`)).join('')}</tbody></table>
      <div class="tk-sep"></div>
      <div class="tk-row tk-tot"><span>TOTAL</span><b>${money(t.total)} F</b></div>
      <div class="tk-row"><span>Paiement</span><span>${MODES[t.mode] || t.mode}</span></div>
      ${t.mode === 'ESPECE' ? `<div class="tk-row"><span>Montant reçu</span><span>${money(t.recu)} F</span></div><div class="tk-row"><span>Monnaie rendue</span><span>${money(t.rendu)} F</span></div>` : ''}
      ${t.annulee ? `<div class="tk-annule">TICKET ANNULÉ</div>` : ''}
      <div class="tk-sep"></div>
      <div class="tk-f">${esc(I.message || 'Merci de votre visite !')}</div></div>`;
    const m = modal({ title: nouveau ? 'Vente enregistrée — reçu' : `Reçu ${t.numero}`, body: html,
      foot: `${!nouveau && adminOnly() && !t.annulee ? `<button class="btn red" data-ann>${ic('x')} Annuler le ticket</button>` : ''}
        <button class="btn sec" data-close>Fermer</button><button class="btn" data-print>${ic('print')} Imprimer le reçu</button>` });
    m.$('[data-print]').addEventListener('click', () => imprimer(html));
    const a = m.$('[data-ann]');
    if (a) a.addEventListener('click', async () => {
      if (!(await confirm(`Voulez-vous annuler le ticket <b>${esc(t.numero)}</b> (${money(t.total)}) ?<br><span class="muted">Les ressources consommées seront remises en stock.</span>`, { danger: true }))) return;
      try { await post(`/resto/ventes/${t.id}/annuler`); ok('Ticket annulé avec succès.'); m.close(); window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (x) { err(x); }
    });
  }
  function imprimer(html) {
    let z = document.getElementById('print-area');
    if (!z) { z = document.createElement('div'); z.id = 'print-area'; document.body.appendChild(z); }
    z.innerHTML = html;
    document.body.classList.add('printing');
    setTimeout(() => { try { window.print(); } catch {} setTimeout(() => document.body.classList.remove('printing'), 500); }, 50);
  }

  // ================= VENTE (caisse comptoir) =================
  Pages['/resto/vente'] = {
    title: 'Vente — caisse', back: '/resto',
    async render(el) {
      const data = await get('/resto/carte');
      if (data.aFermer) {
        el.innerHTML = `<div class="notice err">${ic('lock')}<div>La caisse du restaurant du <b>${dfr(data.aFermer.date)}</b> n'est pas fermée. Fermez-la avant de faire de nouvelles ventes.</div></div>
          <div class="btn-bar"><a class="btn red" href="#/resto/caisse?date=${data.aFermer.date}">${ic('power')} Fermer la caisse du ${dfr(data.aFermer.date)}</a></div>`;
        return;
      }
      if (data.fermee) {
        el.innerHTML = `<div class="notice ok">${ic('lock')}<div>La caisse du restaurant d'aujourd'hui est <b>fermée</b> : plus aucune vente ne peut être enregistrée aujourd'hui.</div></div>`;
        return;
      }
      let plats = data.plats;
      const panier = []; // {id, nom, prix, qte, dispo}
      let mode = 'ESPECE', cat = 'Tous';
      const cats = ['Tous', ...new Set(plats.map((p) => p.categorie))];
      el.innerHTML = `<div class="pos">
        <div class="pos-left">
          <div class="card" style="padding:12px">
            <div class="search" style="margin-bottom:10px">${ic('search')}<input class="input" id="p-q" placeholder="Rechercher un plat…"></div>
            <div class="chips" id="p-cats"></div>
          </div>
          ${plats.length ? '' : `<div class="notice">${ic('warn')}<div>Aucun plat au menu aujourd'hui. Ajoutez des plats dans <a href="#/resto/menus" style="font-weight:700;text-decoration:underline">Menus</a>.</div></div>`}
          <div class="plat-grid" id="p-grid"></div>
        </div>
        <div class="pos-right" id="p-cart-wrap"><div class="card cart" id="p-cart"></div></div>
      </div>
      <div class="pos-bar" id="p-bar"></div>`;
      const drawCats = () => {
        $('#p-cats').innerHTML = cats.map((c) => `<button type="button" class="chip ${c === cat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
        $$('#p-cats [data-c]').forEach((b) => b.addEventListener('click', () => { cat = b.dataset.c; drawCats(); drawGrid(); }));
      };
      const dansPanier = (id) => sum(panier.filter((x) => x.id === id), 'qte');
      const reste = (p) => (p.dispo === null ? null : p.dispo - dansPanier(p.id));
      const drawGrid = () => {
        const v = ($('#p-q').value || '').toLowerCase();
        const list = plats.filter((p) => (cat === 'Tous' || p.categorie === cat) && (!v || p.nom.toLowerCase().includes(v)));
        $('#p-grid').innerHTML = list.map((p) => {
          const r = reste(p); const inCart = dansPanier(p.id);
          return `<button type="button" class="plat ${r !== null && r <= 0 ? 'off' : ''}" data-id="${p.id}">
            ${p.source === 'jour' ? '<span class="badge amber">Menu du jour</span>' : ''}
            ${inCart ? `<span class="in-cart">${inCart}</span>` : ''}
            <b>${esc(p.nom)}</b><em>${money(p.prix)} F</em>
            ${p.accompagnements && p.accompagnements.length ? `<span class="acc-hint">${p.accomp_obligatoire ? 'Avec' : '+'} accompagnement</span>` : ''}
            <small>${r === null ? esc(p.categorie) : r <= 0 ? 'Stock épuisé' : `Reste ${r} plat(s)`}</small></button>`;
        }).join('') || '<div class="empty">Aucun plat trouvé.</div>';
        $$('#p-grid [data-id]').forEach((b) => b.addEventListener('click', () => ajouter(Number(b.dataset.id))));
      };
      // Ajout d'un plat : si le plat a des accompagnements, on les choisit d'abord
      function ajouter(id) {
        const p = plats.find((x) => x.id === id);
        const r = reste(p);
        if (r !== null && r < 1) return err(`Stock insuffisant pour « ${p.nom} ». Approvisionnez le stock.`);
        if (!p.accompagnements || !p.accompagnements.length) return ajouterLigne(p, []);
        choisirAccomp(p);
      }
      function choisirAccomp(p) {
        const m = modal({ title: p.nom, body: `
          <p class="muted" style="margin-top:0">${p.accomp_obligatoire ? 'Choisissez l\'accompagnement (obligatoire).' : 'Ajoutez un accompagnement si le client le souhaite.'}</p>
          <div class="acc-list">${p.accompagnements.map((a) => `<label class="acc-item ${a.dispo !== null && a.dispo <= 0 ? 'off' : ''}">
            <input type="checkbox" data-acc="${a.id}" ${a.dispo !== null && a.dispo <= 0 ? 'disabled' : ''}>
            <span><b>${esc(a.nom)}</b><small>${a.dispo !== null && a.dispo <= 0 ? 'Stock épuisé' : a.prix === 0 ? 'Inclus' : '+ ' + money(a.prix) + ' F'}</small></span></label>`).join('')}</div>
          <div class="kv" style="margin-top:10px"><span>Prix du plat</span><b id="acc-tot">${money(p.prix)} F</b></div>`,
        foot: `<button class="btn sec" data-close>Annuler</button>${p.accomp_obligatoire ? '' : `<button class="btn sec" data-sans>Sans accompagnement</button>`}<button class="btn" data-ok>${ic('plus')} Ajouter</button>` });
        const choix = () => m.$$('[data-acc]:checked').map((c) => Number(c.dataset.acc));
        m.$$('[data-acc]').forEach((c) => c.addEventListener('change', () => {
          c.closest('.acc-item').classList.toggle('on', c.checked);
          m.$('#acc-tot').textContent = money(p.prix + sum(p.accompagnements.filter((a) => choix().includes(a.id)), 'prix')) + ' F';
        }));
        if (m.$('[data-sans]')) m.$('[data-sans]').addEventListener('click', () => { m.close(); ajouterLigne(p, []); });
        m.$('[data-ok]').addEventListener('click', () => {
          const ids = choix();
          if (p.accomp_obligatoire && !ids.length) return err("Choisissez l'accompagnement.");
          m.close(); ajouterLigne(p, ids);
        });
      }
      function ajouterLigne(p, ids) {
        const accs = p.accompagnements.filter((a) => ids.includes(a.id)).map((a) => ({ id: a.id, nom: a.nom, prix: a.prix }));
        const key = p.id + ':' + ids.slice().sort((a, b) => a - b).join(',');
        let l = panier.find((x) => x.key === key);
        if (!l) { l = { key, id: p.id, nom: p.nom, prixPlat: p.prix, accs, prix: p.prix + sum(accs, 'prix'), qte: 0 }; panier.push(l); }
        l.qte += 1;
        drawGrid(); drawCart();
      }
      function changer(key, k) {
        const l = panier.find((x) => x.key === key);
        if (!l) return;
        if (k > 0) { const p = plats.find((x) => x.id === l.id); const r = reste(p); if (r !== null && r < 1) return err(`Stock insuffisant pour « ${p.nom} ».`); }
        l.qte += k;
        if (l.qte <= 0) panier.splice(panier.indexOf(l), 1);
        drawGrid(); drawCart();
      }
      const total = () => sum(panier, (l) => l.qte * l.prix);
      let recuInput = null;
      function drawCart() {
        const t = total();
        $('#p-cart').innerHTML = `<div class="card-title">${ic('cart')} Commande <span class="badge" style="margin-left:auto">${sum(panier, 'qte')} plat(s)</span></div>
          <div class="field"><label>Client</label><input class="input" id="c-client" placeholder="Client comptoir" value="${esc(($('#c-client') || {}).value || '')}"></div>
          <div class="cart-lines">${panier.map((l) => `<div class="cl"><div class="cl-n"><b>${esc(l.nom)}</b>${l.accs.map((a) => `<span class="cl-acc">+ ${esc(a.nom)}${a.prix ? ` (${money(a.prix)})` : ' (inclus)'}</span>`).join('')}<small>${money(l.prix)} F</small></div>
            <div class="qty"><button type="button" data-m="${l.key}" aria-label="Moins">−</button><span>${l.qte}</span><button type="button" data-p="${l.key}" aria-label="Plus">+</button></div>
            <b class="cl-t">${money(l.qte * l.prix)}</b></div>`).join('') || '<div class="empty" style="padding:16px">Touchez un plat pour l\'ajouter.</div>'}</div>
          <div class="cart-total"><span>TOTAL</span><b>${money(t)} F</b></div>
          <div class="field" style="margin-top:10px"><label>Mode de paiement</label><div class="seg">${Object.entries(MODES).map(([k, v]) => `<button type="button" data-mode="${k}" class="${k === mode ? 'on' : ''}">${v}</button>`).join('')}</div></div>
          ${mode === 'ESPECE' ? `<div class="grid2"><div class="field"><label>Montant reçu</label><input class="input right" id="c-recu" placeholder="${money(t)}"></div>
            <div class="field"><label>Monnaie à rendre</label><div class="date-chip"><b id="c-rendu">0</b></div></div></div>` : ''}
          <button class="btn lg block" id="c-val" ${panier.length ? '' : 'disabled'}>${ic('check')} Encaisser ${money(t)} F</button>
          ${panier.length ? `<button class="btn ghost block" id="c-vider" style="margin-top:6px">${ic('trash')} Vider la commande</button>` : ''}`;
        $$('#p-cart [data-m]').forEach((b) => b.addEventListener('click', () => changer(b.dataset.m, -1)));
        $$('#p-cart [data-p]').forEach((b) => b.addEventListener('click', () => changer(b.dataset.p, 1)));
        $$('#p-cart [data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; drawCart(); }));
        if ($('#c-recu')) recuInput = moneyInput($('#c-recu'), (v) => { $('#c-rendu').textContent = money(Math.max(0, v - t)); });
        $('#c-val').addEventListener('click', encaisser);
        if ($('#c-vider')) $('#c-vider').addEventListener('click', async () => { if (await confirm('Vider la commande en cours ?')) { panier.length = 0; drawGrid(); drawCart(); } });
        $('#p-bar').innerHTML = panier.length ? `<span>${sum(panier, 'qte')} plat(s)</span><b>${money(t)} F</b><button class="btn" id="b-go">Voir la commande ›</button>` : '';
        $('#p-bar').classList.toggle('on', panier.length > 0);
        if ($('#b-go')) $('#b-go').addEventListener('click', () => $('#p-cart-wrap').scrollIntoView({ behavior: 'smooth' }));
      }
      async function encaisser() {
        const t = total();
        const recuV = mode === 'ESPECE' ? (recuInput && recuInput.get()) || t : t;
        if (recuV < t) return err('Le montant reçu est inférieur au total.');
        const client = $('#c-client').value.trim() || 'Client comptoir';
        if (!(await confirm(`Valider la vente pour <b>${esc(client)}</b> ?<br><br>${panier.map((l) => `${l.qte} × ${esc(l.nom)}${l.accs.length ? ' + ' + l.accs.map((a) => esc(a.nom)).join(' + ') : ''}`).join('<br>')}<br><br>Total : <b>${money(t)} F</b> · ${MODES[mode]}${mode === 'ESPECE' ? ` · Reçu ${money(recuV)} · Monnaie ${money(recuV - t)}` : ''}`, { title: 'Encaisser ?' }))) return;
        try {
          const tk = await post('/resto/ventes', { lignes: panier.map((l) => ({ plat_id: l.id, qte: l.qte, accomps: l.accs.map((a) => a.id) })), client, mode, recu: recuV });
          ok(`Vente ${tk.numero} enregistrée avec succès.`);
          panier.length = 0; mode = 'ESPECE';
          if ($('#c-client')) $('#c-client').value = '';
          plats = (await get('/resto/carte')).plats;
          drawGrid(); drawCart();
          setTimeout(() => recu(tk, { nouveau: true }), 600);
        } catch (x) { err(x); }
      }
      $('#p-q').addEventListener('input', drawGrid);
      drawCats(); drawGrid(); drawCart();
    },
  };

  // ================= TICKETS =================
  Pages['/resto/tickets'] = {
    title: 'Tickets / reçus', back: '/resto',
    async render(el) {
      el.innerHTML = `<div class="toolbar">
          <div class="field"><label>Du</label><input class="input" type="date" name="du" value="${today()}"></div>
          <div class="field"><label>Au</label><input class="input" type="date" name="au" value="${today()}"></div>
          <button class="btn" data-go>${ic('search')} Afficher</button><div class="spacer"></div>
          <a class="btn sec" href="#/resto/vente">${ic('cart')} Nouvelle vente</a></div>
        <div class="tbl-wrap tall" id="t-tbl"></div><div class="stats" id="t-tot" style="margin-top:14px"></div>`;
      const load = async () => {
        const rows = await get(`/resto/ventes?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        const ok_ = rows.filter((r) => !r.annulee);
        table($('#t-tbl'), [
          { t: 'N° reçu', f: (r) => `<b>${esc(r.numero)}</b>`, first: 1 }, { t: 'Date', f: (r) => dfr(r.date) }, { t: 'Heure', f: (r) => hm(r.heure) },
          { t: 'Client', f: (r) => esc(r.client || '') }, { t: 'Détail', f: (r) => esc(r.detail || ''), cls: 'wrap' }, { t: 'Paiement', f: (r) => MODES[r.mode] || r.mode },
          { t: 'Total', r: 1, f: (r) => `<b>${money(r.total)}</b>` },
          { t: 'Statut', c: 1, f: (r) => (r.annulee ? '<span class="badge red">Annulé</span>' : '<span class="badge">Payé</span>') }, { t: 'Caissier', f: (r) => esc(r.agent || '') },
        ], rows, { green: 1, onClick: async (r) => recu(await get('/resto/ventes/' + r.id)), empty: 'Aucun ticket sur la période.', rowCls: (r) => (r.annulee ? 'annule' : '') });
        $('#t-tot').innerHTML = `<div class="stat"><small>Tickets</small><b>${ok_.length}</b></div><div class="stat"><small>Total encaissé</small><b class="g">${money(sum(ok_, 'total'))}</b></div>
          <div class="stat"><small>Plats vendus</small><b>${sum(ok_, 'nb_plats')}</b></div><div class="stat"><small>Tickets annulés</small><b class="r">${rows.length - ok_.length}</b></div>`;
      };
      $('[data-go]').addEventListener('click', () => load().catch(err));
      await load();
    },
  };

  window.RestoUtil = { recu, info, unites, MODES, resetInfo: () => { INFO = null; } };
})();
