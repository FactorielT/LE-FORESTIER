/* Pages métier : accueil, ventes, stock, approvisionnements, créances, dépenses, caisse, bilans */
const Pages = {};
(() => {
  const { $, $$, esc, ic, get, post, put, del, n, money, qty, today, addDays, dfr, dlong, hm, toast, ok, err, modal, alert, confirm, table, sum, moneyInput, firstOfMonth } = UI;
  const go = (...a) => App.go(...a);
  const adminOnly = () => App.isAdmin();

  // Petit utilitaire : sélecteur de période
  const periode = (du, au, extra = '') => `<div class="toolbar">
      <div class="field"><label>Date du</label><input class="input" type="date" name="du" value="${du}"></div>
      <div class="field"><label>Au</label><input class="input" type="date" name="au" value="${au}"></div>${extra}
      <button class="btn" data-go>${ic('search')} Afficher</button></div>`;

  // ================= ACCUEIL =================
  const TILES = [
    { r: '/ventes', t: 'Ventes', i: 'cart', c: 'c1' },
    { r: '/stock', t: 'Stock', i: 'box', c: 'c2' },
    { r: '/appro', t: 'Approvisions', i: 'truck', c: 'c3' },
    { r: '/creances', t: 'Créances', i: 'card', c: 'c4' },
    { r: '/depenses', t: 'Dépenses Quotidiennes', i: 'wallet', c: 'c5' },
    { r: '/caisse', t: 'Fermeture de caisse', i: 'power', c: 'c6' },
    { r: '/bilans/ventes', t: 'Bilans des Ventes', i: 'chart', c: 'c7' },
    { r: '/bilans/appros', t: 'Bilans Approvisions', i: 'pie', c: 'c8' },
    { r: '/bilans/caisse', t: 'Bilans Fermeture de Caisse', i: 'report', c: 'c10' },
  ];
  Pages['/'] = {
    title: 'Accueil',
    async render(el) {
      const tiles = [...TILES, { r: '/stats', t: 'Statistiques', i: 'chart', c: 'c4' }, ...(adminOnly() ? [{ r: '/admin', t: 'Administration', i: 'gear', c: 'c9' }] : [])];
      const h = new Date().getHours();
      const salut = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
      el.innerHTML = `
        <section class="hero">
          <div class="hero-in">
            <img src="/img/logo.jpg" alt="Logo" class="hero-logo">
            <div class="hero-txt">
              <div class="hero-kicker">Restaurant · Maquis · Bar</div>
              <h2>${esc(App.nom)}</h2>
              <p>${salut} <b>${esc((App.user.nom || '').split(' ')[0])}</b> — <span style="text-transform:capitalize">${dlong(today())}</span></p>
            </div>
          </div>
          <div class="hero-actions">
            <a class="hbtn" href="#/ventes">${ic('cart')}<span>Saisir une vente</span></a>
            <a class="hbtn" href="#/appro">${ic('truck')}<span>Approvisionner</span></a>
            <a class="hbtn" href="#/depenses">${ic('wallet')}<span>Dépense</span></a>
            <a class="hbtn" href="#/caisse">${ic('power')}<span>Fermer la caisse</span></a>
          </div>
        </section>
        <div id="h-alerts"></div>
        <div class="kpis" id="h-kpi">${'<div class="kpi sk"></div>'.repeat(4)}</div>
        <div class="home-grid">
          <div class="card chart-card"><div class="card-title">${ic('chart')} Ventes des 14 derniers jours <a href="#/stats" class="link-more">Statistiques ›</a></div>
            <div class="chart-box"><canvas id="h-chart"></canvas></div><div id="h-chart-data"></div></div>
          <div class="card"><div class="card-title">${ic('box')} Meilleures ventes du mois</div><div id="h-top"></div></div>
        </div>
        <div class="section-h">Modules</div>
        <div class="tiles">${tiles.map((x) => `<a class="tile" href="#${x.r}"><div class="ic ${x.c}">${ic(x.i)}</div><b>${x.t}</b></a>`).join('')}</div>`;
      let d;
      try { d = await get('/dashboard'); } catch (x) { $('#h-kpi').innerHTML = ''; return; }
      // Alertes
      const al = [];
      if (!d.derniere) al.push(`<a class="alert-card info" href="#/ventes">${ic('info')}<div><b>Aucune vente enregistrée</b><span>Commencez par enregistrer votre première vente journalière.</span></div><i>›</i></a>`);
      else if (d.joursNonSaisis > 0) al.push(`<a class="alert-card warn" href="#/ventes?date=${d.prochaine}">${ic('warn')}<div><b>${d.joursNonSaisis} jour(s) de vente non enregistré(s)</b>
        <span>Dernière vente : ${esc(d.derniere.NumVentes)} du ${dfr(d.derniere.DateVente)}. Enregistrer la vente du ${dfr(d.prochaine)}.</span></div><i>›</i></a>`);
      if (d.nonFermees.length) al.push(`<a class="alert-card red" href="#/caisse">${ic('power')}<div><b>${d.nonFermees.length} caisse(s) non fermée(s)</b>
        <span>${d.nonFermees.slice(0, 4).map((x) => dfr(x.DateVente)).join(', ')}${d.nonFermees.length > 4 ? '…' : ''}</span></div><i>›</i></a>`);
      if (d.stock.faibles.length) al.push(`<a class="alert-card amber" href="#/stock">${ic('box')}<div><b>Stock faible (${d.stock.faibles.length})</b>
        <span>${d.stock.faibles.map((x) => `${esc(x.Lib)} : ${qty(x.qte)}`).join(' · ')}</span></div><i>›</i></a>`);
      $('#h-alerts').innerHTML = al.length ? `<div class="alerts">${al.join('')}</div>` : '';
      // Indicateurs
      const kpi = (lbl, val, sub, icn, cls) => `<div class="kpi"><div class="kpi-ic ${cls}">${ic(icn)}</div><div><small>${lbl}</small><b>${val}</b><span>${sub}</span></div></div>`;
      $('#h-kpi').innerHTML =
        kpi('Ventes du mois', money(d.mois.ventes), `${d.mois.nb} jour(s) enregistré(s)`, 'cart', 'c1') +
        kpi('Bénéfice du mois', money(d.mois.benefice), d.mois.ventes ? `Marge ${Math.round((d.mois.benefice / d.mois.ventes) * 100)} %` : '—', 'chart', 'c4') +
        kpi('Dépenses du mois', money(d.mois.depenses), 'Dépenses quotidiennes', 'wallet', 'c5') +
        kpi('Créances en cours', money(d.creances.total), `${d.creances.nb} créancier(s)`, 'card', 'c6');
      // Graphique
      const lab = d.serie.map((x) => x.d.slice(8, 10) + '/' + x.d.slice(5, 7));
      Charts.combo($('#h-chart'), lab, [
        { label: 'Ventes', data: d.serie.map((x) => (x.saisie ? x.ventes : null)), color: Charts.C.s1 },
        { label: 'Bénéfice', data: d.serie.map((x) => (x.saisie ? x.benefice : null)), color: Charts.C.s2, type: 'line' },
      ]);
      $('#h-chart-data').innerHTML = Charts.dataTable([{ t: 'Date', f: (r) => dfr(r.d) }, { t: 'Ventes', r: 1, f: (r) => (r.saisie ? money(r.ventes) : '<span class="muted">non saisie</span>') }, { t: 'Bénéfice', r: 1, f: (r) => money(r.benefice) }], d.serie);
      // Top produits
      const max = Math.max(1, ...d.top.map((x) => x.ventes));
      $('#h-top').innerHTML = d.top.length ? d.top.map((x, i) => `<div class="hbar"><div class="hbar-l"><span class="rank">${i + 1}</span><b>${esc(x.produit)}</b><em>${money(x.ventes)}</em></div>
        <div class="hbar-t"><div style="width:${Math.max(3, (x.ventes / max) * 100)}%"></div></div><small>${qty(x.qte)} vendu(s)</small></div>`).join('')
        : '<div class="empty">Aucune vente ce mois-ci.</div>';
    },
  };

  // ================= VENTES =================
  Pages['/ventes'] = {
    title: 'Vente', back: '/',
    async render(el, params) {
      let date = params.date || today();
      let data = null; // {produits, creditJour, existe}
      let lignes = []; // {rid, Lib, qteInitial, qteAppro, depart, restant, vendu, pu, prixFour}
      let rep = { credit: 0, wave: 0, om: 0, espece: 0 };
      const KEY = () => 'vente-brouillon-' + date;
      const saveDraft = () => { try { localStorage.setItem(KEY(), JSON.stringify({ lignes, rep })); } catch {} };
      const loadDraft = () => { try { return JSON.parse(localStorage.getItem(KEY()) || 'null'); } catch { return null; } };

      el.innerHTML = `<div class="page-title">Ventes des Boissons</div>
        <div class="card">
          <div class="dates-box">
            <div class="field vdate" style="margin:0"><label>Date de la vente *</label><input class="input" type="date" id="v-date" value="${date}" max="${today()}"></div>
            <div class="field" style="margin:0"><label>Date d'enregistrement</label><div class="date-chip"><b>${dfr(today())}</b></div></div>
          </div>
          <div class="row" style="margin-top:10px;align-items:center;justify-content:space-between">
            <span class="date-label" id="v-dl"></span>
            <button class="btn" id="v-aff">${ic('eye')} Afficher</button></div>
          <div class="muted" id="v-info" style="margin-top:8px"></div>
        </div>
        <div id="v-zone"></div>`;
      const zone = $('#v-zone');
      $('#v-dl').textContent = 'Vente du ' + dlong(date); $('#v-dl').style.textTransform = 'none';

      async function afficher() {
        date = $('#v-date').value || today();
        $('#v-dl').textContent = 'Vente du ' + dlong(date); $('#v-dl').style.textTransform = 'none';
        UI.loading(zone);
        data = await get('/ventes/preparer?date=' + date);
        if (first && !params.date && data.prochaine && data.prochaine < date && !data.existe) {
          // Des journées passées ne sont pas encore enregistrées : on propose la plus ancienne
          first = false;
          $('#v-date').value = data.prochaine;
          toast(`Date proposée : ${dfr(data.prochaine)} (première journée non enregistrée).`);
          return afficher();
        }
        first = false;
        $('#v-info').innerHTML = data.derniere
          ? `Dernière vente enregistrée : <b>${esc(data.derniere.numero)}</b> du <b>${dfr(data.derniere.date)}</b>${data.prochaine <= today() ? ` · Prochaine date à saisir : <a href="#" id="v-next" style="color:var(--g700);font-weight:700">${dfr(data.prochaine)}</a>` : ''}`
          : 'Aucune vente enregistrée pour le moment.';
        const nx = $('#v-next');
        if (nx) nx.addEventListener('click', (e) => { e.preventDefault(); $('#v-date').value = data.prochaine; afficher().catch(err); });
        if (data.erreur) {
          zone.innerHTML = `<div class="notice err">${ic('warn')}<div>${esc(data.erreur)}</div></div>
            ${data.prochaine && data.prochaine <= today() ? `<div class="btn-bar"><button class="btn" id="v-go">${ic('cart')} Saisir la vente du ${dfr(data.prochaine)}</button></div>` : ''}`;
          const g = $('#v-go');
          if (g) g.addEventListener('click', () => { $('#v-date').value = data.prochaine; afficher().catch(err); });
          return;
        }
        if (data.existe) {
          zone.innerHTML = `<div class="notice ok">${ic('check')}<div>La vente du <b>${dfr(date)}</b> est déjà enregistrée sous le N° <b>${esc(data.existe.NumVentes)}</b>
            le ${dfr(data.existe.DATEENREG)} (Total : <b>${money(data.existe.TotalVentes)}</b>). Une seule vente est enregistrée par journée.</div></div>
            <div class="btn-bar"><button class="btn blue" id="v-det">${ic('eye')} Voir le détail</button></div>`;
          $('#v-det').addEventListener('click', () => go('/bilans/ventes/detail', { numero: data.existe.NumVentes }));
          return;
        }
        const draft = loadDraft();
        if (data.prochaine && date > data.prochaine) {
          zone.dataset.gap = `Attention : aucune vente n'est enregistrée du ${dfr(data.prochaine)} au ${dfr(addDays(date, -1))}. Si l'établissement était ouvert ces jours-là, enregistrez d'abord ces ventes (elles doivent être saisies dans l'ordre des dates).`;
        } else zone.dataset.gap = '';
        lignes = []; rep = { credit: data.creditJour || 0, wave: 0, om: 0, espece: 0 };
        if (draft && draft.lignes && draft.lignes.length) {
          // Recalcule le brouillon sur le stock actuel
          for (const l of draft.lignes) {
            const p = data.produits.find((x) => x.rid === l.rid);
            if (p && n(l.restant) <= p.depart) lignes.push(calc(p, l.restant));
          }
          rep = { ...rep, ...draft.rep, credit: draft.rep && draft.rep.credit !== undefined ? draft.rep.credit : rep.credit };
          if (lignes.length) toast('Brouillon de saisie restauré (' + lignes.length + ' boisson(s)).');
        }
        drawSaisie();
      }

      const calc = (p, restant) => {
        const r = n(restant);
        const vendu = Math.round((p.depart - r) * 1000) / 1000;
        return { rid: p.rid, Lib: p.Lib, qteInitial: p.qteInitial, qteAppro: p.qteAppro, depart: p.depart, restant: r, vendu, pu: p.pu, prixFour: p.prixFour, total: Math.round(vendu * p.pu), achat: Math.round(vendu * p.prixFour) };
      };

      function drawSaisie() {
        zone.innerHTML = `${zone.dataset.gap ? `<div class="notice">${ic('warn')}<div>${esc(zone.dataset.gap)}</div></div>` : ''}
          <div class="notice info">${ic('info')}<div>Saisie de la vente du <b>${dlong(date)}</b> — enregistrée le <b>${dfr(today())}</b>.</div></div>
          <div class="two-col">
          <div class="card"><div class="card-title">${ic('list')} Liste des boissons <span class="muted" style="margin-left:auto;font-weight:500">Touchez une boisson pour saisir</span></div>
            <div class="search" style="margin-bottom:10px">${ic('search')}<input class="input" id="v-q" placeholder="Rechercher une boisson…"></div>
            <div class="tbl-wrap" id="v-prod"></div></div>
          <div>
            <div class="card"><div class="card-title">${ic('cart')} Boissons saisies <span class="badge" id="v-nb" style="margin-left:auto">0</span></div>
              <div class="tbl-wrap" id="v-lignes"></div></div>
            <div class="card vente-form" id="v-tot"></div>
          </div></div>`;
        const drawProd = () => {
          const qv = ($('#v-q').value || '').toLowerCase();
          const rows = data.produits.filter((p) => !qv || p.Lib.toLowerCase().includes(qv));
          table($('#v-prod'), [
            { t: 'Article', f: (p) => `<b>${esc(p.Lib)}</b>`, cls: 'wrap' },
            { t: 'Qté Stock', r: 1, f: (p) => qty(p.depart) },
            { t: 'Prix Vente', r: 1, f: (p) => money(p.pu) },
            { t: 'Prix Achat', r: 1, f: (p) => money(p.prixFour) },
          ], rows, { onClick: (p) => saisir(p), rowCls: (p) => (lignes.some((l) => l.rid === p.rid) ? 'done' : ''), empty: 'Aucune boisson. Ajoutez des articles dans le Stock.' });
        };
        $('#v-q').addEventListener('input', drawProd);
        drawProd();
        drawLignes();
        zone._drawProd = drawProd;
      }

      function drawLignes() {
        $('#v-nb').textContent = lignes.length;
        table($('#v-lignes'), [
          { t: 'Boisson', f: (l) => `<b>${esc(l.Lib)}</b>`, cls: 'wrap' },
          { t: 'Qté Initial', r: 1, f: (l) => qty(l.qteInitial) },
          { t: 'Qté Appro', r: 1, f: (l) => qty(l.qteAppro) },
          { t: 'Stock Départ', r: 1, f: (l) => qty(l.depart) },
          { t: 'Qté Physique Restant', r: 1, f: (l) => qty(l.restant) },
          { t: 'Qté Vendu', r: 1, f: (l) => `<b>${qty(l.vendu)}</b>` },
          { t: 'Prix Vente', r: 1, f: (l) => money(l.pu) },
          { t: 'Total Vente', r: 1, f: (l) => `<b>${money(l.total)}</b>` },
        ], lignes, {
          onClick: (l) => saisir(data.produits.find((p) => p.rid === l.rid)),
          empty: 'Aucune boisson saisie pour le moment.',
          foot: ['Total', '', '', '', '', qty(sum(lignes, 'vendu')), '', money(sum(lignes, 'total'))],
        });
        drawTotaux();
        zone._drawProd && zone._drawProd();
      }

      function drawTotaux() {
        const tv = sum(lignes, 'total'), ta = sum(lignes, 'achat');
        $('#v-tot').innerHTML = `
          <div class="kv"><span>Total Vente</span><span class="val cyan" id="t-tv">${money(tv)}</span></div>
          <div class="kv"><span>Total Achat</span><b>${money(ta)}</b></div>
          <div class="kv"><span>Bénéfice</span><span class="val lime">${money(tv - ta)}</span></div>
          <div style="height:10px"></div>
          <div class="repartition">
            <div class="field credit"><label>Total Crédit Jour</label><input class="input" id="r-credit"></div>
            <div class="field"><label>Total Wave</label><input class="input" id="r-wave"></div>
            <div class="field"><label>Total OM</label><input class="input" id="r-om"></div>
            <div class="field"><label>Total ESPÈCE</label><input class="input" id="r-espece"></div>
          </div>
          <div class="ecart" id="r-ecart"></div>
          <div class="btn-bar"><button class="btn sec" id="r-auto" title="Mettre le reste en espèces">${ic('wallet')} Reste en espèces</button>
            <button class="btn lg" id="v-valider" ${lignes.length ? '' : 'disabled'}>${ic('check')} Valider Vente</button></div>
          <p class="muted center" style="margin:8px 0 0">La somme Crédit + Wave + OM + Espèce doit être égale au Total Vente.</p>`;
        const inputs = {};
        for (const k of ['credit', 'wave', 'om', 'espece']) {
          inputs[k] = moneyInput($('#r-' + k), (v) => { rep[k] = v; majEcart(); saveDraft(); });
          inputs[k].set(rep[k] || 0);
        }
        const majEcart = () => {
          const s = rep.credit + rep.wave + rep.om + rep.espece;
          const d = tv - s;
          const e = $('#r-ecart');
          e.className = 'ecart ' + (d === 0 ? 'ok' : 'ko');
          e.textContent = d === 0 ? '✓ Répartition correcte' : d > 0 ? `Reste à répartir : ${money(d)}` : `Excédent de ${money(-d)}`;
        };
        majEcart();
        $('#r-auto').addEventListener('click', () => {
          rep.espece = Math.max(0, tv - rep.credit - rep.wave - rep.om);
          inputs.espece.set(rep.espece); majEcart(); saveDraft();
        });
        $('#v-valider').addEventListener('click', valider);
      }

      function saisir(p) {
        if (!p) return;
        const ex = lignes.find((l) => l.rid === p.rid);
        const m = modal({
          title: 'Vente',
          body: `<div class="center" style="background:#fffde7;padding:10px;border-radius:10px;margin-bottom:10px;color:var(--navy);font-weight:800;font-size:17px">${esc(p.Lib)}</div>
            <div class="kv"><span>Quantité Initial</span><span class="val">${qty(p.qteInitial)}</span></div>
            <div class="kv"><span>Quantité Appro</span><span class="val">${qty(p.qteAppro)}</span></div>
            <div class="kv"><span>Quantité Stock Départ</span><span class="val navy">${qty(p.depart)}</span></div>
            <div class="kv"><span><b style="font-size:15px">Qté Actuel Restant</b></span><input class="input big" id="s-rest" inputmode="decimal" value="${ex ? ex.restant : ''}" placeholder="0" style="max-width:150px"></div>
            <div class="kv"><span>Quantité Vendu</span><span class="val green" id="s-vendu">0</span></div>
            <div class="kv"><span>Prix de Vente</span><span class="val">${money(p.pu)}</span></div>
            <div class="kv"><span>Total Vente</span><span class="val" id="s-total">0</span></div>
            <div class="notice err hidden" id="s-err" style="margin-top:10px"></div>`,
          foot: `${ex ? `<button class="btn red" data-rm>${ic('trash')} Retirer</button>` : ''}<button class="btn sec" data-close>Fermer</button>
            <button class="btn" data-ok>${ic('down')} ${ex ? 'Modifier' : 'Ajouter'}</button>`,
        });
        const inp = m.$('#s-rest');
        const maj = () => {
          const r = n(inp.value);
          const c = calc(p, r);
          m.$('#s-vendu').textContent = qty(c.vendu);
          m.$('#s-total').textContent = money(c.total);
          const e = m.$('#s-err');
          if (inp.value !== '' && (r > p.depart || r < 0)) { e.textContent = 'La quantité restante ne peut pas dépasser le stock de départ (' + qty(p.depart) + ').'; e.classList.remove('hidden'); }
          else e.classList.add('hidden');
        };
        inp.addEventListener('input', maj);
        maj();
        setTimeout(() => { inp.focus(); inp.select(); }, 60);
        const valider = () => {
          if (inp.value.trim() === '') return err('Saisissez la quantité restante.');
          const r = n(inp.value);
          if (r < 0 || r > p.depart) return err('Quantité restante invalide.');
          const c = calc(p, r);
          const i = lignes.findIndex((l) => l.rid === p.rid);
          if (i >= 0) lignes[i] = c; else lignes.push(c);
          saveDraft(); m.close(); drawLignes();
        };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });
        m.$('[data-ok]').addEventListener('click', valider);
        const rm = m.$('[data-rm]');
        if (rm) rm.addEventListener('click', () => { lignes = lignes.filter((l) => l.rid !== p.rid); saveDraft(); m.close(); drawLignes(); });
      }

      async function valider() {
        const tv = sum(lignes, 'total');
        const s = rep.credit + rep.wave + rep.om + rep.espece;
        if (s !== tv) return alert(`La somme des 4 champs (Crédit + Wave + OM + Espèce = <b>${money(s)}</b>) doit être égale au Total Vente (<b>${money(tv)}</b>).`, 'Répartition incorrecte');
        if (!(await confirm(`<b>Date de la vente :</b> ${dlong(date)}<br><b>Date d'enregistrement :</b> ${dlong(today())}<br><br>${lignes.length} boisson(s) · Total <b>${money(tv)}</b><br><span class="muted">La vente d'une journée ne s'enregistre qu'une seule fois.</span>`, { okText: 'Valider la vente', title: 'Valider la vente ?' }))) return;
        try {
          const r = await post('/ventes', { date, lignes: lignes.map((l) => ({ rid: l.rid, restant: l.restant })), ...rep });
          try { localStorage.removeItem(KEY()); } catch {}
          ok(`Vente ${r.numero} enregistrée.`);
          const suiv = addDays(date, 1);
          if (suiv <= today()) {
            if (await confirm(`Vente enregistrée sous le N° <b>${esc(r.numero)}</b>.<br>Date de vente : <b>${dfr(r.dateVente)}</b> · Enregistrée le : <b>${dfr(r.dateEnreg)}</b><br>Total : <b>${money(r.totalVentes)}</b> · Bénéfice : <b>${money(r.benefice)}</b><br><br>Saisir maintenant la vente du <b>${dfr(suiv)}</b> ?`, { title: 'Vente validée', okText: 'Vente suivante' })) {
              $('#v-date').value = suiv;
            }
          } else {
            await alert(`Vente enregistrée sous le N° <b>${esc(r.numero)}</b>.<br>Date de vente : <b>${dfr(r.dateVente)}</b> · Enregistrée le : <b>${dfr(r.dateEnreg)}</b><br>Total : <b>${money(r.totalVentes)}</b> · Bénéfice : <b>${money(r.benefice)}</b>`, 'Vente validée');
          }
          afficher();
        } catch (x) { err(x); }
      }

      let first = true;
      $('#v-aff').addEventListener('click', () => afficher().catch(err));
      $('#v-date').addEventListener('change', () => afficher().catch(err));
      await afficher();
    },
  };

  // ================= STOCK =================
  Pages['/stock'] = {
    title: 'Mon Stock', back: '/',
    async render(el) {
      el.innerHTML = `<div class="toolbar"><button class="btn" id="s-act">${ic('refresh')} Actualiser</button>
          <div class="search grow" style="flex:1 1 200px">${ic('search')}<input class="input" id="s-q" placeholder="Rechercher un article…"></div>
          <button class="btn blue" id="s-add">${ic('plus')} Ajouter Produit</button></div>
        <div class="stats" id="s-stats"></div>
        <div class="tbl-wrap tall" id="s-tbl"></div>`;
      let rows = [];
      const draw = () => {
        const qv = ($('#s-q').value || '').toLowerCase();
        const f = rows.filter((p) => !qv || (p.Lib || '').toLowerCase().includes(qv) || (p.ref || '').toLowerCase().includes(qv));
        const tv = sum(f, (p) => p.qte * p.pu), ta = sum(f, (p) => p.qte * p.prixFour);
        $('#s-stats').innerHTML = `<div class="stat"><small>Quantité totale</small><b>${qty(sum(f, 'qte'))}</b></div>
          <div class="stat"><small>Total stock au prix vente</small><b class="r">${money(tv)}</b></div>
          <div class="stat"><small>Total stock au prix achat</small><b class="n">${money(ta)}</b></div>
          <div class="stat"><small>Bénéfice</small><b class="b">${money(tv - ta)}</b></div>`;
        table($('#s-tbl'), [
          { t: 'Articles', f: (p) => `<b>${esc(p.Lib)}</b>`, cls: 'wrap', first: 1 },
          { t: 'Qté Stock', r: 1, f: (p) => `<b>${qty(p.qte)}</b>` },
          { t: 'Prix Vente', r: 1, f: (p) => money(p.pu) },
          { t: 'Total Vente', r: 1, f: (p) => money(p.qte * p.pu) },
          { t: 'Prix Achat', r: 1, f: (p) => money(p.prixFour) },
          { t: 'Total Achat', r: 1, f: (p) => money(p.qte * p.prixFour) },
          { t: 'Bénéfice', r: 1, f: (p) => money(p.qte * (p.pu - p.prixFour)) },
        ], f, { onClick: modif, onDbl: modif, empty: 'Aucun article', rowCls: (p) => (p.qte <= 0 ? 'rupture' : ''),
          foot: ['Total', qty(sum(f, 'qte')), '', money(tv), '', money(ta), money(tv - ta)] });
      };
      const load = async () => { UI.loading($('#s-tbl')); rows = await get('/produits'); draw(); };
      function modif(p) {
        const adm = adminOnly();
        const m = modal({ title: 'Modif Stock', body: `
          <div class="muted" style="font-size:11px;font-weight:700;margin-bottom:8px">${esc(App.user.groupe || '')}</div>
          <div class="field"><label>Référence</label><input class="input" value="${esc(p.ref || '')}" readonly></div>
          <div class="field"><label>Article</label><input class="input" name="Lib" value="${esc(p.Lib)}" ${adm ? '' : 'readonly'}></div>
          <div class="field"><label>Quantité ${adm ? '' : '<span class="badge amber">Administrateur uniquement</span>'}</label>
            <input class="input big" name="qte" inputmode="decimal" value="${p.qte}" ${adm ? '' : 'readonly'} style="background:${adm ? '#ffc98a' : ''}"></div>
          <div class="grid2"><div class="field"><label>Prix vente</label><input class="input big" name="pu" inputmode="numeric" value="${p.pu}"></div>
          <div class="field"><label>Prix achat</label><input class="input big" name="prixFour" inputmode="numeric" value="${p.prixFour}"></div></div>`,
        foot: `${adm ? `<button class="btn red" data-del>${ic('trash')}</button>` : ''}<button class="btn red" data-close>${ic('x')} Fermer</button><button class="btn" data-ok>${ic('check')} Modifier</button>` });
        m.$('[data-ok]').addEventListener('click', async () => {
          const b = { pu: n(m.$('[name=pu]').value), prixFour: n(m.$('[name=prixFour]').value) };
          if (adm) { b.qte = n(m.$('[name=qte]').value); b.Lib = m.$('[name=Lib]').value; }
          try { await put('/produits/' + p.rid, b); ok('Article modifié.'); m.close(); load(); } catch (x) { err(x); }
        });
        const d = m.$('[data-del]');
        if (d) d.addEventListener('click', async () => {
          if (!(await confirm(`Supprimer définitivement l'article <b>${esc(p.Lib)}</b> ?`, { danger: true, okText: 'Supprimer' }))) return;
          try { await del('/produits/' + p.rid); ok('Article supprimé.'); m.close(); load(); } catch (x) { err(x); }
        });
      }
      $('#s-add').addEventListener('click', () => {
        const adm = adminOnly();
        const m = modal({ title: 'Ajouter un produit', body: `
          <div class="field"><label>Désignation de l'article *</label><input class="input" name="Lib" placeholder="ex : COCA COLA BOUTEILLE 33"></div>
          <div class="grid2"><div class="field"><label>Prix vente</label><input class="input" name="pu" inputmode="numeric"></div>
          <div class="field"><label>Prix achat</label><input class="input" name="prixFour" inputmode="numeric"></div></div>
          <div class="grid2"><div class="field"><label>Quantité initiale ${adm ? '' : '(admin)'}</label><input class="input" name="qte" inputmode="decimal" value="0" ${adm ? '' : 'readonly'}></div>
          <div class="field"><label>Référence (auto si vide)</label><input class="input" name="ref"></div></div>
          <div class="grid2"><div class="field"><label>Type emballage</label><input class="input" name="typeemballage" placeholder="Casier, carton…"></div>
          <div class="field"><label>Prix emballage</label><input class="input" name="PRIXEMBALLAGE" inputmode="numeric"></div></div>`,
        foot: `<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>${ic('check')} Enregistrer</button>` });
        m.$('[data-ok]').addEventListener('click', async () => {
          const b = {}; m.$$('input').forEach((i) => (b[i.name] = i.value));
          try { await post('/produits', b); ok('Article ajouté.'); m.close(); load(); } catch (x) { err(x); }
        });
      });
      $('#s-q').addEventListener('input', draw);
      $('#s-act').addEventListener('click', () => load().catch(err));
      await load();
    },
  };

  // ================= APPROVISIONNEMENT =================
  Pages['/appro'] = {
    title: 'Approvisionnement', back: '/',
    async render(el) {
      let produits = await get('/produits');
      let lignes = []; // {rid, Lib, qte, prixFour}
      let sel = null;
      el.innerHTML = `<div class="page-title">Approvisionnement des boissons</div>
        <div class="card"><div class="toolbar" style="margin-bottom:10px">
          <button class="btn" id="a-act">${ic('refresh')} Actualiser</button><div class="spacer"></div>
          <div class="field"><label>Date achat</label><input class="input" type="date" id="a-date" value="${today()}"></div></div>
          <div class="field" style="position:relative"><label style="color:var(--navy)">Sélectionner la boisson</label>
            <div class="search">${ic('search')}<input class="input" id="a-q" placeholder="Tapez le nom de la boisson…" autocomplete="off"></div>
            <div id="a-dd" class="hidden" style="position:absolute;left:0;right:0;top:100%;z-index:20;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);max-height:300px;overflow:auto"></div></div>
          <div class="tbl-wrap" id="a-tbl"></div>
          <div class="row" style="margin-top:10px;justify-content:space-between;align-items:center">
            <button class="btn amber sm hidden" id="a-ret">${ic('trash')} Retirer ?</button><span></span></div>
          <div class="grid2" style="margin-top:12px;max-width:520px">
            <div class="field"><label>Quantité Total</label><input class="input big" id="a-qt" readonly></div>
            <div class="field"><label>Total Achat</label><input class="input big" id="a-ta" readonly style="color:var(--blue)"></div></div>
          <div class="btn-bar"><button class="btn lg" id="a-val" style="background:#a4c639">${ic('check')} Valider</button></div></div>`;
      const dd = $('#a-dd'), q = $('#a-q');
      const showDD = () => {
        const v = q.value.toLowerCase().trim();
        const list = produits.filter((p) => !v || p.Lib.toLowerCase().includes(v)).slice(0, 60);
        dd.innerHTML = list.length ? list.map((p) => `<div data-rid="${p.rid}" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--line2);display:flex;justify-content:space-between;gap:8px">
          <b>${esc(p.Lib)}</b><span class="muted">Stock ${qty(p.qte)} · PA ${money(p.prixFour)}</span></div>`).join('') : '<div class="empty">Aucune boisson</div>';
        dd.classList.remove('hidden');
        $$('[data-rid]', dd).forEach((d) => d.addEventListener('mousedown', (e) => { e.preventDefault(); ajouter(Number(d.dataset.rid)); }));
      };
      q.addEventListener('focus', showDD);
      q.addEventListener('input', showDD);
      q.addEventListener('blur', () => setTimeout(() => dd.classList.add('hidden'), 150));
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const f = dd.querySelector('[data-rid]'); if (f) ajouter(Number(f.dataset.rid)); } });
      function ajouter(rid) {
        const p = produits.find((x) => x.rid === rid);
        if (!p) return;
        let l = lignes.find((x) => x.rid === rid);
        if (!l) { l = { rid, Lib: p.Lib, qte: 1, prixFour: p.prixFour }; lignes.push(l); }
        q.value = ''; dd.classList.add('hidden'); q.blur();
        draw();
        const inp = $(`#a-tbl input[data-rid="${rid}"]`);
        if (inp) { inp.focus(); inp.select(); }
      }
      function draw() {
        table($('#a-tbl'), [
          { t: 'Désignation', f: (l) => `<b>${esc(l.Lib)}</b>`, cls: 'wrap' },
          { t: 'Quantité', r: 1, f: (l) => `<input class="input right" style="width:90px;font-weight:700" inputmode="decimal" data-rid="${l.rid}" value="${l.qte}">` },
          { t: 'PU HT', r: 1, f: (l) => money(l.prixFour) },
          { t: 'Total', r: 1, f: (l) => `<span data-tot="${l.rid}">${money(l.qte * l.prixFour)}</span>` },
        ], lignes, { selectable: true, onSelect: (l) => { sel = l; $('#a-ret').classList.remove('hidden'); }, empty: 'Sélectionnez une boisson ci-dessus pour l\'ajouter.',
          foot: ['', `<span id="f-q">${qty(sum(lignes, 'qte'))}</span>`, '', `<span id="f-t">${money(sum(lignes, (l) => l.qte * l.prixFour))}</span>`] });
        sel = null; $('#a-ret').classList.add('hidden');
        $$('#a-tbl input[data-rid]').forEach((i) => {
          i.addEventListener('focus', () => i.select());
          i.addEventListener('input', () => {
            const l = lignes.find((x) => x.rid === Number(i.dataset.rid));
            l.qte = n(i.value);
            $(`[data-tot="${l.rid}"]`).textContent = money(l.qte * l.prixFour);
            totaux();
          });
          i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { i.blur(); q.focus(); } });
        });
        totaux();
      }
      function totaux() {
        const qt = sum(lignes, 'qte'), ta = sum(lignes, (l) => l.qte * l.prixFour);
        $('#a-qt').value = qty(qt); $('#a-ta').value = money(ta);
        if ($('#f-q')) { $('#f-q').textContent = qty(qt); $('#f-t').textContent = money(ta); }
      }
      $('#a-ret').addEventListener('click', () => { if (sel) { lignes = lignes.filter((l) => l !== sel); draw(); } });
      $('#a-act').addEventListener('click', async () => { produits = await get('/produits'); lignes = []; draw(); toast('Liste actualisée.'); });
      $('#a-val').addEventListener('click', async () => {
        const items = lignes.filter((l) => l.qte > 0);
        if (!items.length) return err('Ajoutez au moins une boisson avec une quantité.');
        const date = $('#a-date').value;
        if (!(await confirm(`Valider l'approvisionnement du <b>${dfr(date)}</b> ?<br>${items.length} boisson(s) · Quantité ${qty(sum(items, 'qte'))} · Total <b>${money(sum(items, (l) => l.qte * l.prixFour))}</b>`, { okText: 'Valider' }))) return;
        try {
          const r = await post('/appros', { date, lignes: items.map((l) => ({ rid: l.rid, qte: l.qte })) });
          ok(`Approvisionnement ${r.numero} enregistré.`);
          lignes = []; produits = await get('/produits'); draw();
        } catch (x) { err(x); }
      });
      draw();
    },
  };

  // ================= CRÉANCES =================
  Pages['/creances'] = {
    title: 'Menu Créance', back: '/',
    render(el) {
      const t = [
        { r: '/creances/credit', t: 'Enregistrement de Crédit', i: 'save', c: 'c4' },
        { r: '/creances/paiement', t: 'Paiement des Arriérés de Crédits', i: 'card', c: 'c1' },
        { r: '/creances/tableau', t: 'Tableau de Bord des créances', i: 'users', c: 'c7' },
        { r: '/creances/historique', t: 'Historique des Crédits payés', i: 'pie', c: 'c6' },
        { r: '/creances/creanciers', t: 'Liste des créanciers', i: 'list', c: 'c8' },
      ];
      el.innerHTML = `<div class="tiles" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${t.map((x) => `<a class="tile" href="#${x.r}"><div class="ic ${x.c}">${ic(x.i)}</div><b>${x.t}</b></a>`).join('')}</div>`;
    },
  };

  async function creancierOptions(selected) {
    const list = await get('/creanciers');
    return { list, html: `<option value="">— Choisir —</option>` + list.map((c) => `<option value="${esc(c.nom)}" ${c.nom === selected ? 'selected' : ''}>${esc(c.nom)}</option>`).join('') };
  }
  function nouveauCreancier(onDone) {
    const m = modal({ title: 'Créancier', body: `<div class="page-sub" style="margin:0 0 12px">ENREGISTREMENT CRÉANCIER</div>
      <div class="field"><label>Nom et Prénoms</label><input class="input" name="nom"></div>
      <div class="field"><label>Contact</label><input class="input" name="contact" inputmode="tel"></div>`,
    foot: `<button class="btn sec" data-list>${ic('list')} Liste des créanciers</button><button class="btn red" data-ok>${ic('check')} Enregistrer</button>` });
    m.$('[data-list]').addEventListener('click', () => { m.close(); go('/creances/creanciers'); });
    m.$('[data-ok]').addEventListener('click', async () => {
      try {
        const r = await post('/creanciers', { nom: m.$('[name=nom]').value, contact: m.$('[name=contact]').value });
        ok('Créancier enregistré.'); m.close(); onDone && onDone(r.nom);
      } catch (x) { err(x); }
    });
  }

  Pages['/creances/credit'] = {
    title: 'Enregistrement Crédits', back: '/creances',
    async render(el) {
      el.innerHTML = `<div class="card" style="max-width:560px;margin:0 auto">
        <div class="page-sub" style="margin:0 0 10px">ENREGISTREMENT CRÉDITS CLIENTS</div>
        <div class="row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn" id="c-new">${ic('plus')} Nouveau créancier</button></div>
        <div class="field"><label>Date crédit</label><input class="input" type="date" id="c-date" value="${today()}"></div>
        <div class="field"><label>Nom créancier</label><select class="input" id="c-nom"></select></div>
        <div class="field"><label>Montant crédit</label><input class="input big" id="c-mt" placeholder="0"></div>
        <div class="field"><label>Motif</label><textarea class="input" id="c-motif"></textarea></div>
        <div class="btn-bar"><button class="btn lg" id="c-val">${ic('check')} Valider</button></div></div>`;
      const fill = async (s) => { $('#c-nom').innerHTML = (await creancierOptions(s)).html; };
      await fill();
      const mt = moneyInput($('#c-mt'));
      $('#c-new').addEventListener('click', () => nouveauCreancier(fill));
      $('#c-val').addEventListener('click', async () => {
        try {
          await post('/credits', { date: $('#c-date').value, nom: $('#c-nom').value, montant: mt.get(), motif: $('#c-motif').value });
          ok('Crédit enregistré.'); $('#c-mt').value = ''; $('#c-motif').value = ''; $('#c-nom').value = '';
        } catch (x) { err(x); }
      });
    },
  };

  Pages['/creances/creanciers'] = {
    title: 'Liste des créances', back: '/creances',
    async render(el) {
      el.innerHTML = `<div class="toolbar"><div class="search" style="flex:1 1 200px">${ic('search')}<input class="input" id="l-q" placeholder="Rechercher…"></div>
        <button class="btn" id="l-new">${ic('plus')} Nouveau créancier</button></div><div class="tbl-wrap tall" id="l-tbl"></div>`;
      let rows = [];
      const draw = () => {
        const v = ($('#l-q').value || '').toLowerCase();
        table($('#l-tbl'), [
          { t: 'N°', f: (c) => esc(c.numCli || '') },
          { t: 'Nom et prénoms', f: (c) => `<b>${esc(c.nom)}</b>`, cls: 'wrap' },
          { t: 'Contact', f: (c) => esc(c.contact || '') },
          { t: 'Solde crédit', r: 1, f: (c) => `<b style="color:${c.solde > 0 ? 'var(--red)' : 'inherit'}">${money(c.solde)}</b>` },
        ], rows.filter((c) => !v || c.nom.toLowerCase().includes(v) || (c.contact || '').includes(v)), { green: 1, onClick: (c) => go('/creances/detail', { nom: c.nom }) });
      };
      const load = async () => { rows = await get('/creanciers'); draw(); };
      $('#l-q').addEventListener('input', draw);
      $('#l-new').addEventListener('click', () => nouveauCreancier(load));
      await load();
    },
  };

  Pages['/creances/paiement'] = {
    title: 'Paiement Crédits', back: '/creances',
    async render(el, params) {
      el.innerHTML = `<div class="card" style="max-width:560px;margin:0 auto">
        <div class="page-sub" style="font-size:20px;font-style:normal;margin:0 0 14px">PAIEMENT DES CRÉDITS</div>
        <div class="field"><label>Date crédit payé</label><input class="input" type="date" id="p-date" value="${today()}"></div>
        <div class="field"><label>Nom créancier</label><select class="input" id="p-nom"></select></div>
        <div class="kv"><span>Total crédits</span><b id="p-tot" style="font-size:22px">0</b></div>
        <div class="field" style="margin-top:12px"><label>Montant versé ce jour</label><input class="input big" id="p-mt" placeholder="0"></div>
        <div class="btn-bar"><button class="btn lg" id="p-val">${ic('check')} Payer</button></div></div>`;
      let list = [];
      const fill = async (s) => { const o = await creancierOptions(s); list = o.list; $('#p-nom').innerHTML = o.html; majSolde(); };
      const majSolde = () => { const c = list.find((x) => x.nom === $('#p-nom').value); $('#p-tot').textContent = money(c ? c.solde : 0); };
      $('#p-nom').addEventListener('change', majSolde);
      await fill(params.nom);
      const mt = moneyInput($('#p-mt'));
      $('#p-val').addEventListener('click', async () => {
        const nom = $('#p-nom').value;
        if (!nom) return err('Sélectionnez le créancier.');
        if (!(await confirm(`Enregistrer un paiement de <b>${money(mt.get())}</b> pour <b>${esc(nom)}</b> ?`, { okText: 'Payer' }))) return;
        try {
          const r = await post('/paiements', { date: $('#p-date').value, nom, montant: mt.get() });
          ok('Paiement enregistré. Nouveau solde : ' + money(r.solde)); $('#p-mt').value = ''; await fill(nom);
        } catch (x) { err(x); }
      });
    },
  };

  Pages['/creances/tableau'] = {
    title: 'Tableau des créances', back: '/creances',
    async render(el) {
      el.innerHTML = `<div class="tbl-wrap tall" id="t-tbl"></div>
        <div class="kv card" style="margin-top:12px"><span>Total des créances :</span><b id="t-tot" style="color:var(--red);font-size:20px">0</b></div>
        <div class="btn-bar"><button class="btn" style="background:#2196f3" id="t-det" disabled>${ic('eye')} Détails d'un créancier</button>
          <button class="btn sec" id="t-pay" disabled>${ic('card')} Paiement</button>
          ${adminOnly() ? `<button class="btn red" id="t-del" disabled>${ic('trash')} Supprimer</button>` : ''}</div>`;
      let t;
      const load = async () => {
        const rows = await get('/creances/tableau');
        t = table($('#t-tbl'), [
          { t: 'Nom et prénoms', f: (c) => `<b>${esc(c.nom)}</b>`, cls: 'wrap' },
          { t: 'Solde crédit', r: 1, f: (c) => `<b>${money(c.solde)}</b>` },
        ], rows, { green: 1, selectable: true, onDbl: (c) => go('/creances/detail', { nom: c.nom }), empty: 'Aucune créance en cours.',
          onSelect: () => $$('#t-det,#t-pay,#t-del').forEach((b) => (b.disabled = false)) });
        $('#t-tot').textContent = money(sum(rows, 'solde'));
        $$('#t-det,#t-pay,#t-del').forEach((b) => (b.disabled = true));
      };
      $('#t-det').addEventListener('click', () => t.selected && go('/creances/detail', { nom: t.selected.nom }));
      $('#t-pay').addEventListener('click', () => t.selected && go('/creances/paiement', { nom: t.selected.nom }));
      const d = $('#t-del');
      if (d) d.addEventListener('click', async () => {
        const c = t.selected; if (!c) return;
        if (!(await confirm(`Supprimer le compte de <b>${esc(c.nom)}</b> (solde ${money(c.solde)}) ?<br><span class="muted">L'historique des crédits et paiements est conservé.</span>`, { danger: true, okText: 'Supprimer' }))) return;
        try { await del('/creanciers?nom=' + encodeURIComponent(c.nom)); ok('Créancier supprimé.'); load(); } catch (x) { err(x); }
      });
      await load();
    },
  };

  Pages['/creances/detail'] = {
    title: (p) => 'Créancier : ' + (p.nom || ''), back: '/creances/tableau',
    async render(el, params) {
      const load = async () => {
        const d = await get('/creanciers/detail?nom=' + encodeURIComponent(params.nom));
        el.innerHTML = `<div class="stats"><div class="stat"><small>Créancier</small><b>${esc(d.nom)}</b></div>
          <div class="stat"><small>Contact</small><b>${esc(d.contact || '—')}</b></div>
          <div class="stat"><small>Total crédits</small><b class="r">${money(sum(d.credits, 'montantcreance'))}</b></div>
          <div class="stat"><small>Solde restant</small><b class="b">${money(d.solde)}</b></div></div>
          <div class="btn-bar" style="justify-content:flex-start;margin:0 0 12px"><button class="btn" id="d-pay">${ic('card')} Enregistrer un paiement</button></div>
          <div class="two-col"><div class="card"><div class="card-title">Crédits accordés</div><div class="tbl-wrap" id="d-cr"></div></div>
          <div class="card"><div class="card-title">Paiements reçus</div><div class="tbl-wrap" id="d-pa"></div></div></div>`;
        const delBtn = (kind) => (r) => (adminOnly() ? `<button class="btn red sm" data-${kind}="${r.id}">${ic('trash')}</button>` : '');
        table($('#d-cr'), [{ t: 'Date', f: (r) => dfr(r.datecreance) }, { t: 'Montant', r: 1, f: (r) => `<b>${money(r.montantcreance)}</b>` },
          { t: 'Motif', f: (r) => esc(r.motifcreance || ''), cls: 'wrap' }, { t: '', f: delBtn('cr') }], d.credits, { foot: ['Total', money(sum(d.credits, 'montantcreance'))] });
        table($('#d-pa'), [{ t: 'Date', f: (r) => dfr(r.datepaiement) }, { t: 'Montant', r: 1, f: (r) => `<b>${money(r.payer)}</b>` }, { t: '', f: delBtn('pa') }],
          d.paiements, { foot: ['Total', money(sum(d.paiements, 'payer'))] });
        $('#d-pay').addEventListener('click', () => go('/creances/paiement', { nom: d.nom }));
        $$('[data-cr]').forEach((b) => b.addEventListener('click', async () => {
          if (!(await confirm('Supprimer ce crédit ? Le solde du créancier sera diminué.', { danger: true, okText: 'Supprimer' }))) return;
          try { await del('/credits/' + b.dataset.cr); ok('Crédit supprimé.'); load(); } catch (x) { err(x); }
        }));
        $$('[data-pa]').forEach((b) => b.addEventListener('click', async () => {
          if (!(await confirm('Supprimer ce paiement ? Le solde du créancier sera augmenté.', { danger: true, okText: 'Supprimer' }))) return;
          try { await del('/paiements/' + b.dataset.pa); ok('Paiement supprimé.'); load(); } catch (x) { err(x); }
        }));
      };
      await load();
    },
  };

  Pages['/creances/historique'] = {
    title: 'Historiques des crédits', back: '/creances',
    async render(el) {
      const o = await creancierOptions();
      el.innerHTML = `<div class="page-sub" style="font-style:normal">Historiques des crédits payés</div>
        ${periode(today(), today(), `<div class="field" style="flex:1 1 200px"><label>Nom créancier</label><select class="input" name="nom">${o.html.replace('— Choisir —', 'Tous')}</select></div>`)}
        <div class="tbl-wrap tall" id="h-tbl"></div>
        <div class="row" style="justify-content:flex-end;align-items:center;margin-top:12px">
          <span>Total :</span><span class="val" id="h-tot" style="background:#fff;border:1px solid var(--line)">0</span>
          ${adminOnly() ? `<button class="btn red" id="h-del" disabled>${ic('trash')} Supprimer</button>` : ''}</div>`;
      let t;
      const load = async () => {
        const p = new URLSearchParams({ du: $('[name=du]').value, au: $('[name=au]').value });
        if ($('[name=nom]').value) p.set('nom', $('[name=nom]').value);
        const rows = await get('/paiements?' + p);
        t = table($('#h-tbl'), [{ t: 'Nom créancier', f: (r) => `<b>${esc(r.client)}</b>`, cls: 'wrap' }, { t: 'Montant', r: 1, f: (r) => money(r.payer) }, { t: 'Date', f: (r) => dfr(r.datepaiement) }],
          rows, { green: 1, selectable: true, onSelect: () => { if ($('#h-del')) $('#h-del').disabled = false; }, empty: 'Aucun paiement sur la période.' });
        $('#h-tot').textContent = money(sum(rows, 'payer'));
        if ($('#h-del')) $('#h-del').disabled = true;
      };
      $('[data-go]').addEventListener('click', () => load().catch(err));
      $('[name=nom]').addEventListener('change', () => load().catch(err));
      const d = $('#h-del');
      if (d) d.addEventListener('click', async () => {
        const r = t.selected; if (!r) return;
        if (!(await confirm(`Supprimer le paiement de <b>${money(r.payer)}</b> de <b>${esc(r.client)}</b> du ${dfr(r.datepaiement)} ?`, { danger: true, okText: 'Supprimer' }))) return;
        try { await del('/paiements/' + r.id); ok('Paiement supprimé.'); load(); } catch (x) { err(x); }
      });
      await load();
    },
  };

  // ================= DÉPENSES =================
  Pages['/depenses'] = {
    title: 'Enregistrement dépenses', back: '/',
    async render(el) {
      el.innerHTML = `<div class="card" style="max-width:560px;margin:0 auto">
        <div class="page-sub" style="font-style:normal;margin:0 0 10px">ENREGISTREMENT DES DÉPENSES</div>
        <div class="row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn" id="d-new">${ic('plus')} Nouvelle Dépense</button></div>
        <div class="field"><label>Date dépense</label><input class="input" type="date" id="d-date" value="${today()}"></div>
        <div class="field"><label>Dépenses</label><select class="input" id="d-type"></select></div>
        <div class="field"><label>Montant</label><input class="input big" id="d-mt" placeholder="0"></div>
        <div class="field"><label>Motif</label><textarea class="input" id="d-motif"></textarea></div>
        <div class="btn-bar"><button class="btn lg" id="d-val">${ic('check')} Valider</button></div>
        <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn sec" id="d-hist">${ic('clock')} Historiques des Dépenses</button></div></div>`;
      const fill = async (s) => {
        const t = await get('/depenses/types');
        $('#d-type').innerHTML = '<option value="">— Choisir —</option>' + t.map((x) => `<option ${x.nom === s ? 'selected' : ''}>${esc(x.nom)}</option>`).join('');
      };
      await fill();
      const mt = moneyInput($('#d-mt'));
      $('#d-new').addEventListener('click', () => {
        const m = modal({ title: 'Nouvelle dépense', body: `<div class="field"><label>Nom de la dépense</label><input class="input" name="nom" placeholder="ex : TRANSPORT, GLACE, ÉLECTRICITÉ…"></div>`,
          foot: `<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>${ic('check')} Enregistrer</button>` });
        m.$('[data-ok]').addEventListener('click', async () => {
          try { const r = await post('/depenses/types', { nom: m.$('[name=nom]').value }); ok('Dépense ajoutée.'); m.close(); fill(r.nom); } catch (x) { err(x); }
        });
      });
      $('#d-hist').addEventListener('click', () => go('/depenses/historique'));
      $('#d-val').addEventListener('click', async () => {
        try {
          await post('/depenses', { date: $('#d-date').value, depense: $('#d-type').value, montant: mt.get(), motif: $('#d-motif').value });
          ok('Dépense enregistrée.'); $('#d-mt').value = ''; $('#d-motif').value = '';
        } catch (x) { err(x); }
      });
    },
  };

  Pages['/depenses/historique'] = {
    title: 'Historiques des dépenses', back: '/depenses',
    async render(el) {
      const types = await get('/depenses/types');
      el.innerHTML = `${periode(firstOfMonth(), today(), `<div class="field" style="flex:1 1 180px"><label>Dépense</label><select class="input" name="type"><option value="">Toutes</option>${types.map((t) => `<option>${esc(t.nom)}</option>`).join('')}</select></div>`)}
        <div class="tbl-wrap tall" id="h-tbl"></div>
        <div class="row" style="justify-content:flex-end;align-items:center;margin-top:12px"><span>Total :</span><span class="val red" id="h-tot">0</span>
        ${adminOnly() ? `<button class="btn red" id="h-del" disabled>${ic('trash')} Supprimer</button>` : ''}</div>`;
      let t;
      const load = async () => {
        const p = new URLSearchParams({ du: $('[name=du]').value, au: $('[name=au]').value });
        if ($('[name=type]').value) p.set('depense', $('[name=type]').value);
        const rows = await get('/depenses?' + p);
        t = table($('#h-tbl'), [
          { t: 'Date', f: (r) => dfr(r.DATEDEP) }, { t: 'Heure', f: (r) => hm(r.HEUREDEP) }, { t: 'Dépense', f: (r) => `<b>${esc(r.DEPENSE)}</b>` },
          { t: 'Montant', r: 1, f: (r) => `<b>${money(r.MONTANT)}</b>` }, { t: 'Motif', f: (r) => esc(r.DETAILS || ''), cls: 'wrap' }, { t: 'Agent', f: (r) => esc(r.AGENTS || '') },
        ], rows, { green: 1, selectable: true, onSelect: () => { if ($('#h-del')) $('#h-del').disabled = false; }, empty: 'Aucune dépense sur la période.' });
        $('#h-tot').textContent = money(sum(rows, 'MONTANT'));
        if ($('#h-del')) $('#h-del').disabled = true;
      };
      $('[data-go]').addEventListener('click', () => load().catch(err));
      const d = $('#h-del');
      if (d) d.addEventListener('click', async () => {
        const r = t.selected; if (!r) return;
        if (!(await confirm(`Supprimer la dépense <b>${esc(r.DEPENSE)}</b> de ${money(r.MONTANT)} du ${dfr(r.DATEDEP)} ?`, { danger: true, okText: 'Supprimer' }))) return;
        try { await del('/depenses/' + r.id); ok('Dépense supprimée.'); load(); } catch (x) { err(x); }
      });
      await load();
    },
  };

  // ================= FERMETURE DE CAISSE =================
  Pages['/caisse'] = {
    title: 'Fermeture de caisse', back: '/',
    async render(el) {
      el.innerHTML = `<div class="card" style="max-width:620px;margin:0 auto">
        <div class="date-label" id="k-dl"></div>
        <div class="toolbar" style="justify-content:flex-end;margin-top:6px"><div class="field"><label>Date de session</label><input class="input" type="date" id="k-date" value="${today()}"></div></div>
        <div id="k-body"></div></div>`;
      const load = async () => {
        const date = $('#k-date').value;
        $('#k-dl').textContent = dlong(date);
        const s = await get('/caisse?date=' + date);
        const f = s.existe;
        const line = (lbl, v, color, cls = '') => `<div class="kv"><span style="font-weight:700;font-size:12.5px;color:${color}">${lbl}</span><span class="val ${cls}" style="background:#fff;border:1px solid var(--line);color:${color}">${money(v)}</span></div>`;
        $('#k-body').innerHTML = `
          ${f ? `<div class="notice ok">${ic('lock')}<div>Caisse fermée le ${dfr(f.DATEENREG)} à ${hm(f.HEUREVERSE)} par ${esc(f.AGENTS || '')}.</div></div>` : ''}
          ${!s.venteExiste && !f ? `<div class="notice">${ic('warn')}<div>Aucune vente enregistrée pour cette date.</div></div>` : ''}
          ${line("CAISSE D'HIER", f ? f.FONDSDECAISSEHIER : s.caisseHier, '#999')}
          ${line('TOTAL VENTE', f ? f.MTJRCTN : s.totalVente, '#7b1fe0')}
          ${line('TOTAL CRÉDITS PAYÉS JOUR', f ? f.CREDITSPAYES : s.creditsPayes, '#7b1fe0')}
          ${line('TOTAL CRÉANCES DU JOUR', f ? f.CREANCES : s.creances, '#7b1fe0')}
          ${line('TOTAL DÉPENSES', f ? f.MTDEPENSES : s.depenses, '#0f8a8a')}
          ${line('CAISSE [(Vente + Crédit payé) − (Créance + Dépense)]', f ? f.SOMMES : s.sommes, 'var(--navy)')}
          <div class="kv"><span style="font-weight:700;font-size:12.5px;color:var(--red)">CAISSE DU JOUR À LA FERMETURE</span>
            ${f ? `<span class="val red">${money(f.MTVERSER)}</span>` : `<input class="input big" id="k-verse" style="max-width:190px;color:var(--red)" placeholder="0">`}</div>
          <div class="kv"><span style="font-weight:700;font-size:12.5px">ÉCART</span><b id="k-ecart">${money(f ? f.ECART : s.sommes)}</b></div>
          <div class="btn-bar">${f ? (adminOnly() ? `<button class="btn red" id="k-reo">${ic('refresh')} Rouvrir la caisse</button>` : '')
            : `<button class="btn sec" id="k-act" style="background:#2196f3;color:#fff;border:0">${ic('refresh')} Actualiser</button><button class="btn lg" id="k-val">${ic('check')} Valider</button>`}</div>`;
        if (!f) {
          const v = moneyInput($('#k-verse'), (x) => { $('#k-ecart').textContent = money(s.sommes - x); });
          $('#k-act').addEventListener('click', () => load().catch(err));
          $('#k-val').addEventListener('click', async () => {
            if ($('#k-verse').value === '') return err('Saisissez la caisse du jour à la fermeture.');
            if (!(await confirm(`Fermer la caisse du <b>${dfr(date)}</b> ?<br>Caisse calculée : <b>${money(s.sommes)}</b><br>Caisse à la fermeture : <b>${money(v.get())}</b><br>Écart : <b>${money(s.sommes - v.get())}</b>`, { okText: 'Fermer la caisse' }))) return;
            try { await post('/caisse', { date, montantVerse: v.get() }); ok('Caisse fermée.'); load(); } catch (x) { err(x); }
          });
        } else if ($('#k-reo')) {
          $('#k-reo').addEventListener('click', async () => {
            if (!(await confirm('Rouvrir la caisse de cette date ? La fermeture sera supprimée.', { danger: true, okText: 'Rouvrir' }))) return;
            try { await del('/caisse/' + f.rid); ok('Caisse rouverte.'); load(); } catch (x) { err(x); }
          });
        }
      };
      $('#k-date').addEventListener('change', () => load().catch(err));
      await load();
      alert(`${ic('info', 'style="width:18px;height:18px;vertical-align:-3px"')} Merci d'enregistrer toutes les rubriques si possible telles que : <b>Ventes, Dépenses et Crédits</b> avant de fermer la session !`, 'Fermeture de caisse');
    },
  };

  // ================= BILANS =================
  Pages['/bilans/ventes'] = {
    title: 'Bilans ventes', back: '/',
    async render(el, params) {
      el.innerHTML = `${periode(params.du || firstOfMonth(), params.au || today(), `<div class="spacer"></div><button class="btn blue" id="b-det">${ic('eye')} Voir détails d'un jour</button>`)}
        <div class="card chart-card"><div class="card-title">${ic('chart')} Ventes et bénéfice par jour de vente</div><div class="chart-box"><canvas id="b-chart"></canvas></div></div>
        <div class="tbl-wrap" id="b-tbl"></div><div class="stats" id="b-tot" style="margin-top:14px"></div>`;
      let t;
      const load = async () => {
        const rows = await get(`/ventes?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        t = table($('#b-tbl'), [
          { t: 'N° Vente', f: (r) => `<b>${esc(r.NumVentes)}</b>`, first: 1 }, { t: 'Date Vente', f: (r) => `<b>${dfr(r.DateVente)}</b>` },
          { t: 'Date Enreg', f: (r) => `<span style="color:${r.DATEENREG && r.DATEENREG !== r.DateVente ? 'var(--amber)' : 'inherit'}">${dfr(r.DATEENREG)}</span>` },
          { t: 'Total Vente', r: 1, f: (r) => money(r.TotalVentes) }, { t: 'Total Achat', r: 1, f: (r) => money(r.TotalAchat) },
          { t: 'Bénéfice', r: 1, f: (r) => `<b>${money(r.Benefice)}</b>` }, { t: 'Wave', r: 1, f: (r) => money(r.WAVE) }, { t: 'OM', r: 1, f: (r) => money(r.OM) },
          { t: 'Espèce', r: 1, f: (r) => money(r.ESPECE) }, { t: 'Crédit', r: 1, f: (r) => money(r.CREDIT) },
          { t: 'Caisse', c: 1, f: (r) => (r.Fermer ? '<span class="badge">Fermée</span>' : '<span class="badge amber">Ouverte</span>') },
        ], rows, { green: 1, selectable: true, onDbl: (r) => go('/bilans/ventes/detail', { numero: r.NumVentes }), empty: 'Aucune vente sur la période.' });
        const asc = [...rows].reverse();
        Charts.combo($('#b-chart'), asc.map((r) => dfr(r.DateVente).slice(0, 5)), [
          { label: 'Ventes', data: asc.map((r) => r.TotalVentes), color: Charts.C.s1 },
          { label: 'Bénéfice', data: asc.map((r) => r.Benefice), color: Charts.C.s2, type: 'line' },
        ]);
        const s = (k) => money(sum(rows, k));
        $('#b-tot').innerHTML = `<div class="stat"><small>Total ventes</small><b class="n">${s('TotalVentes')}</b></div><div class="stat"><small>Total achat</small><b>${s('TotalAchat')}</b></div>
          <div class="stat"><small>Total bénéfice</small><b class="g">${s('Benefice')}</b></div><div class="stat"><small>Crédits</small><b class="r">${s('CREDIT')}</b></div>
          <div class="stat"><small>Wave</small><b>${s('WAVE')}</b></div><div class="stat"><small>OM</small><b>${s('OM')}</b></div><div class="stat"><small>Espèces</small><b>${s('ESPECE')}</b></div>
          <div class="stat"><small>Nombre de jours</small><b>${rows.length}</b></div>`;
      };
      $('[data-go]').addEventListener('click', () => load().catch(err));
      $('#b-det').addEventListener('click', () => {
        if (!t || !t.selected) return alert('Veuillez sélectionner dans le tableau la date (le jour) que vous souhaitez voir ses détails de vente d\'abord svp.');
        go('/bilans/ventes/detail', { numero: t.selected.NumVentes });
      });
      await load();
    },
  };

  Pages['/bilans/ventes/detail'] = {
    title: 'Détail vente jour', back: '/bilans/ventes',
    async render(el, params) {
      const d = await get('/ventes/detail?numero=' + encodeURIComponent(params.numero));
      const v = d.vente || {};
      el.innerHTML = `<div class="toolbar" style="align-items:center"><span style="font-weight:700">N° Vente :</span><span class="val" style="background:#fff;border-bottom:2px solid var(--line);color:#8b1a1a">${esc(params.numero)}</span>
          <span class="muted">${v.DateVente ? 'du ' + dfr(v.DateVente) : ''} ${v.AGENT ? '· saisie par ' + esc(v.AGENT) : ''}</span><div class="spacer"></div>
          <button class="btn sec" onclick="window.print()">${ic('print')} Imprimer</button>
          ${adminOnly() ? `<button class="btn red" id="dv-del">${ic('x')} Supprimer Vente</button>` : ''}</div>
        <div class="tbl-wrap" id="dv-tbl"></div>
        <div class="stats" style="margin-top:14px">
          <div class="stat"><small>Total ventes</small><b class="n">${money(v.TotalVentes ?? sum(d.lignes, 'TotalPV'))}</b></div>
          <div class="stat"><small>Total achat</small><b>${money(v.TotalAchat ?? sum(d.lignes, 'TotalAchat'))}</b></div>
          <div class="stat"><small>Total bénéfice</small><b class="g">${money(v.Benefice ?? sum(d.lignes, 'Benefice'))}</b></div>
          <div class="stat" style="border:2px solid var(--red)"><small>Total crédit du jour</small><b class="r">${money(d.creditJour)}</b></div>
          <div class="stat"><small>Wave</small><b>${money(v.WAVE)}</b></div><div class="stat"><small>OM</small><b>${money(v.OM)}</b></div>
          <div class="stat"><small>Espèces</small><b>${money(v.ESPECE)}</b></div></div>`;
      table($('#dv-tbl'), [
        { t: 'N°', f: (r) => esc(r.NumInventaire) }, { t: 'Date Enreg', f: (r) => dfr(r.DATEENREG) }, { t: 'Date Vente', f: (r) => dfr(r.DateInventaire) },
        { t: 'Produit', f: (r) => `<b>${esc(r.libelle)}</b>`, cls: 'wrap', first: 1 }, { t: 'Stock Hier', r: 1, f: (r) => qty(r.StockHier) },
        { t: 'Qté Appro', r: 1, f: (r) => qty(r.StockApproHier) }, { t: 'Stock Départ', r: 1, f: (r) => qty(r.StockHierMatin) },
        { t: 'Stock Restant', r: 1, f: (r) => qty(r.StockPhysiqueActuel) }, { t: 'Qté Vendu', r: 1, f: (r) => `<b>${qty(r.StockVendu)}</b>` },
        { t: 'Prix Vente', r: 1, f: (r) => money(r.PrixUnitaire) }, { t: 'Total Vente', r: 1, f: (r) => `<b>${money(r.TotalPV)}</b>` },
        { t: 'Total Achat', r: 1, f: (r) => money(r.TotalAchat) }, { t: 'Bénéfice', r: 1, f: (r) => money(r.Benefice) },
      ], d.lignes, { green: 1, foot: ['Total', '', '', '', '', '', '', '', qty(sum(d.lignes, 'StockVendu')), '', money(sum(d.lignes, 'TotalPV')), money(sum(d.lignes, 'TotalAchat')), money(sum(d.lignes, 'Benefice'))] });
      const b = $('#dv-del');
      if (b) b.addEventListener('click', async () => {
        if (!(await confirm(`Supprimer la vente <b>${esc(params.numero)}</b> ?<br>Les quantités vendues seront remises en stock.`, { danger: true, okText: 'Supprimer' }))) return;
        try { await del('/ventes?numero=' + encodeURIComponent(params.numero)); ok('Vente supprimée.'); go('/bilans/ventes'); } catch (x) { err(x); }
      });
    },
  };

  Pages['/bilans/appros'] = {
    title: 'Bilans des Appro', back: '/',
    async render(el) {
      el.innerHTML = `${periode(firstOfMonth(), today(), `<div class="spacer"></div><button class="btn blue" id="ba-det">${ic('eye')} Voir les Détails</button>`)}
        <div class="tbl-wrap" id="ba-tbl"></div>
        <div class="grid2" style="margin-top:14px;max-width:560px"><div class="stat"><small>Total Qté</small><b>0</b></div><div class="stat"><small>Total Achat</small><b class="n">0</b></div></div>`;
      let t;
      const load = async () => {
        const rows = await get(`/appros?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        t = table($('#ba-tbl'), [
          { t: 'N°', f: (r) => `<b>${esc(r.numero)}</b>` }, { t: 'Date Appro', f: (r) => dfr(r.dateappro) },
          { t: 'Qté Appro', r: 1, f: (r) => qty(r.qte) }, { t: 'Total Appro', r: 1, f: (r) => `<b>${money(r.total)}</b>` },
          { t: 'Statut', c: 1, f: (r) => (r.consomme ? '<span class="badge">Pris en compte</span>' : '<span class="badge amber">En attente de vente</span>') },
        ], rows, { green: 1, selectable: true, onDbl: (r) => go('/bilans/appros/detail', { numero: r.numero, date: r.dateappro }), empty: 'Aucun approvisionnement.' });
        const st = $$('.stat b', el);
        st[0].textContent = qty(sum(rows, 'qte')); st[1].textContent = money(sum(rows, 'total'));
      };
      $('[data-go]').addEventListener('click', () => load().catch(err));
      $('#ba-det').addEventListener('click', () => {
        if (!t || !t.selected) return alert("Veuillez sélectionner d'abord un approvisionnement dans le tableau.");
        go('/bilans/appros/detail', { numero: t.selected.numero, date: t.selected.dateappro });
      });
      await load();
    },
  };

  Pages['/bilans/appros/detail'] = {
    title: 'Détails Appro', back: '/bilans/appros',
    async render(el, params) {
      const rows = await get(`/appros/detail?numero=${encodeURIComponent(params.numero)}&date=${params.date || ''}`);
      el.innerHTML = `<div class="toolbar" style="align-items:center"><span style="font-weight:700">N° Appro :</span><span class="val" style="background:#fff;color:#8b1a1a">${esc(params.numero)}</span>
        <span class="muted">${params.date ? 'du ' + dfr(params.date) : ''}</span><div class="spacer"></div>
        ${adminOnly() ? `<button class="btn blue" id="da-del">${ic('trash')} Supprimer Appro</button>` : ''}</div>
        <div class="tbl-wrap" id="da-tbl"></div>
        <div class="grid2" style="margin-top:14px;max-width:560px"><div class="stat"><small>Total Qté</small><b>${qty(sum(rows, 'qte'))}</b></div>
        <div class="stat"><small>Total Achat</small><b class="n">${money(sum(rows, 'totalFour'))}</b></div></div>`;
      table($('#da-tbl'), [
        { t: 'N° Appro', f: (r) => esc(r.numero) }, { t: 'Date Enreg', f: (r) => dfr(r.DATEENREG) }, { t: 'Date Appro', f: (r) => dfr(r.dateappro) },
        { t: 'Produit', f: (r) => `<b>${esc(r.Lib)}</b>`, cls: 'wrap' }, { t: 'Qté Appro', r: 1, f: (r) => qty(r.qte) },
        { t: 'Prix Achat', r: 1, f: (r) => money(r.prixFour) }, { t: 'Total Achat', r: 1, f: (r) => `<b>${money(r.totalFour)}</b>` }, { t: 'Agent', f: (r) => esc(r.agent || '') },
      ], rows, { green: 1, empty: 'Aucune ligne.' });
      const b = $('#da-del');
      if (b) b.addEventListener('click', async () => {
        if (!(await confirm(`Supprimer l'approvisionnement <b>${esc(params.numero)}</b> ?<br>Les quantités seront retirées du stock.`, { danger: true, okText: 'Supprimer' }))) return;
        try { await del(`/appros?numero=${encodeURIComponent(params.numero)}&date=${params.date}`); ok('Approvisionnement supprimé.'); go('/bilans/appros'); } catch (x) { err(x); }
      });
    },
  };

  // ================= STATISTIQUES =================
  Pages['/stats'] = {
    title: 'Statistiques', back: '/',
    async render(el) {
      const presets = [['7j', 7], ['30j', 30], ['Ce mois', 'm'], ['3 mois', 90], ['12 mois', 365]];
      el.innerHTML = `<div class="card"><div class="toolbar" style="margin:0">
          <div class="presets">${presets.map(([l, v], i) => `<button data-pr="${v}" class="${i === 1 ? 'on' : ''}">${l}</button>`).join('')}</div><div class="spacer"></div>
          <div class="field"><label>Du</label><input class="input" type="date" name="du" value="${UI.addDays(today(), -29)}"></div>
          <div class="field"><label>Au</label><input class="input" type="date" name="au" value="${today()}"></div>
          <button class="btn" data-go>${ic('search')} Afficher</button></div></div>
        <div class="kpis" id="st-kpi"></div>
        <div class="stats-grid">
          <div class="card full"><div class="card-title">${ic('chart')} Évolution journalière des ventes et du bénéfice</div><div class="chart-box tall"><canvas id="st-jour"></canvas></div><div id="st-jour-d"></div></div>
          <div class="card full"><div class="card-title">${ic('report')} Bilan mensuel (12 derniers mois)</div><div class="chart-box tall"><canvas id="st-mois"></canvas></div><div id="st-mois-d"></div></div>
          <div class="card"><div class="card-title">${ic('box')} Top 10 des boissons (chiffre d'affaires)</div><div class="chart-box tall"><canvas id="st-top"></canvas></div><div id="st-top-d"></div></div>
          <div class="card"><div class="card-title">${ic('wallet')} Répartition des encaissements</div><div class="chart-box tall"><canvas id="st-pay"></canvas></div><div id="st-pay-d"></div></div>
          <div class="card full"><div class="card-title">${ic('wallet')} Dépenses par type</div><div class="chart-box"><canvas id="st-dep"></canvas></div><div id="st-dep-d"></div></div>
        </div>`;
      const MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
      const load = async () => {
        const d = await get(`/stats?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        const p = d.paiements;
        const kpi = (lbl, val, sub, icn, cls) => `<div class="kpi"><div class="kpi-ic ${cls}">${ic(icn)}</div><div><small>${lbl}</small><b>${val}</b><span>${sub}</span></div></div>`;
        $('#st-kpi').innerHTML = kpi('Chiffre d\'affaires', money(p.ventes), `${p.nb} jour(s) de vente`, 'cart', 'c1')
          + kpi('Bénéfice', money(p.benefice), p.ventes ? `Marge ${Math.round((p.benefice / p.ventes) * 100)} %` : '—', 'chart', 'c4')
          + kpi('Dépenses', money(d.autres.depenses), `Bénéfice net ${money(p.benefice - d.autres.depenses)}`, 'wallet', 'c5')
          + kpi('Approvisionnements', money(d.autres.appro), `Crédits ${money(d.autres.credits)} · payés ${money(d.autres.payes)}`, 'truck', 'c3');
        const lab = d.jours.map((x) => x.d.slice(8, 10) + '/' + x.d.slice(5, 7));
        Charts.combo($('#st-jour'), lab, [
          { label: 'Ventes', data: d.jours.map((x) => (x.saisie ? x.ventes : null)), color: Charts.C.s1, type: 'line' },
          { label: 'Bénéfice', data: d.jours.map((x) => (x.saisie ? x.benefice : null)), color: Charts.C.s2, type: 'line' },
          { label: 'Dépenses', data: d.jours.map((x) => x.depenses), color: Charts.C.s3, type: 'line' },
        ]);
        $('#st-jour-d').innerHTML = Charts.dataTable([{ t: 'Date', f: (r) => dfr(r.d) }, { t: 'Ventes', r: 1, f: (r) => (r.saisie ? money(r.ventes) : '<span class="muted">non saisie</span>') },
          { t: 'Bénéfice', r: 1, f: (r) => money(r.benefice) }, { t: 'Dépenses', r: 1, f: (r) => money(r.depenses) }], d.jours);
        const ml = d.mois.map((x) => MOIS[Number(x.m.slice(5, 7)) - 1] + ' ' + x.m.slice(2, 4));
        Charts.combo($('#st-mois'), ml, [
          { label: 'Ventes', data: d.mois.map((x) => x.ventes), color: Charts.C.s1 },
          { label: 'Bénéfice', data: d.mois.map((x) => x.benefice), color: Charts.C.s2 },
          { label: 'Dépenses', data: d.mois.map((x) => x.depenses), color: Charts.C.s3 },
          { label: 'Approvisionnements', data: d.mois.map((x) => x.appro), color: Charts.C.s4 },
        ]);
        $('#st-mois-d').innerHTML = Charts.dataTable([{ t: 'Mois', f: (r) => r.m.slice(5, 7) + '/' + r.m.slice(0, 4) }, { t: 'Ventes', r: 1, f: (r) => money(r.ventes) },
          { t: 'Bénéfice', r: 1, f: (r) => money(r.benefice) }, { t: 'Dépenses', r: 1, f: (r) => money(r.depenses) }, { t: 'Appro', r: 1, f: (r) => money(r.appro) }], d.mois);
        Charts.combo($('#st-top'), d.top.map((x) => x.produit.length > 18 ? x.produit.slice(0, 17) + '…' : x.produit), [{ label: 'Ventes', data: d.top.map((x) => x.ventes), color: Charts.C.s1 }], { horizontal: true });
        $('#st-top-d').innerHTML = Charts.dataTable([{ t: 'Boisson', f: (r) => esc(r.produit) }, { t: 'Qté', r: 1, f: (r) => qty(r.qte) }, { t: 'Ventes', r: 1, f: (r) => money(r.ventes) }, { t: 'Bénéfice', r: 1, f: (r) => money(r.benefice) }], d.top);
        const payL = ['Wave', 'Orange Money', 'Espèces', 'Crédit'], payV = [p.wave, p.om, p.espece, p.credit];
        Charts.donut($('#st-pay'), payL, payV, [Charts.C.s1, Charts.C.s2, Charts.C.s3, Charts.C.s4]);
        $('#st-pay-d').innerHTML = Charts.dataTable([{ t: 'Mode', f: (r) => r[0] }, { t: 'Montant', r: 1, f: (r) => money(r[1]) }], payL.map((l, i) => [l, payV[i]]));
        Charts.combo($('#st-dep'), d.depTypes.map((x) => x.type), [{ label: 'Dépenses', data: d.depTypes.map((x) => x.total), color: Charts.C.s3 }], { horizontal: true });
        $('#st-dep-d').innerHTML = Charts.dataTable([{ t: 'Type', f: (r) => esc(r.type) }, { t: 'Total', r: 1, f: (r) => money(r.total) }], d.depTypes);
      };
      $$('[data-pr]').forEach((b) => b.addEventListener('click', () => {
        $$('[data-pr]').forEach((x) => x.classList.remove('on')); b.classList.add('on');
        const v = b.dataset.pr;
        $('[name=au]').value = today();
        $('[name=du]').value = v === 'm' ? firstOfMonth() : UI.addDays(today(), -(Number(v) - 1));
        load().catch(err);
      }));
      $('[data-go]').addEventListener('click', () => { $$('[data-pr]').forEach((x) => x.classList.remove('on')); load().catch(err); });
      await load();
    },
  };

  Pages['/bilans/caisse'] = {
    title: 'Bilans Fermeture Caisse', back: '/',
    async render(el) {
      el.innerHTML = `${periode(firstOfMonth(), today())}<div class="tbl-wrap" id="bc-tbl"></div><div class="stats" id="bc-tot" style="margin-top:14px"></div>`;
      const load = async () => {
        const rows = await get(`/caisse/bilan?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        table($('#bc-tbl'), [
          { t: 'Date Enreg', f: (r) => dfr(r.DATEENREG) }, { t: 'Date versé', f: (r) => `<b>${dfr(r.DATEVERSE)}</b>`, first: 1 },
          { t: 'Vente jour', r: 1, f: (r) => money(r.MTJRCTN) }, { t: 'Dépense', r: 1, f: (r) => money(r.MTDEPENSES) }, { t: 'Créances', r: 1, f: (r) => money(r.CREANCES) },
          { t: 'Crédits payés', r: 1, f: (r) => money(r.CREDITSPAYES) }, { t: 'Caisse Hier', r: 1, f: (r) => money(r.FONDSDECAISSEHIER) },
          { t: 'Sommes', r: 1, f: (r) => money(r.SOMMES) }, { t: 'Montant Versé', r: 1, f: (r) => `<b>${money(r.MTVERSER)}</b>` },
          { t: 'Écart', r: 1, f: (r) => `<b style="color:${r.ECART ? 'var(--red)' : 'inherit'}">${money(r.ECART)}</b>` }, { t: 'Heure versé', f: (r) => hm(r.HEUREVERSE) },
        ], rows, { green: 1, empty: 'Aucune fermeture sur la période.',
          foot: ['Total', '', money(sum(rows, 'MTJRCTN')), money(sum(rows, 'MTDEPENSES')), money(sum(rows, 'CREANCES')), money(sum(rows, 'CREDITSPAYES')), '', money(sum(rows, 'SOMMES')), money(sum(rows, 'MTVERSER')), money(sum(rows, 'ECART')), ''] });
        $('#bc-tot').innerHTML = `<div class="stat"><small>Total versé</small><b class="n">${money(sum(rows, 'MTVERSER'))}</b></div>
          <div class="stat"><small>Total ventes</small><b>${money(sum(rows, 'MTJRCTN'))}</b></div><div class="stat"><small>Total dépenses</small><b class="r">${money(sum(rows, 'MTDEPENSES'))}</b></div>
          <div class="stat"><small>Total écarts</small><b class="r">${money(sum(rows, 'ECART'))}</b></div>`;
      };
      $('[data-go]').addEventListener('click', () => load().catch(err));
      await load();
    },
  };
})();
