/* Maquis : inventaire physique (comme GESTION MRPA) et bilan des ventes par produit */
(() => {
  const { $, $$, esc, ic, get, post, del, n, money, qty, today, dfr, ok, err, alert, confirm, table, sum, loading, firstOfMonth } = UI;
  const go = (...a) => App.go(...a);
  const adminOnly = () => App.isAdmin();
  const fq = (v) => qty(Math.round(v * 1000) / 1000);

  // ================= INVENTAIRE =================
  Pages['/inventaire'] = {
    title: 'Inventaire', back: '/',
    async render(el, params) {
      let onglet = params.tab === 'bilan' ? 'bilan' : 'saisie';
      el.innerHTML = `<div class="tabs" id="i-tabs"><button data-t="saisie">${ic('list')} Inventaire</button><button data-t="bilan">${ic('report')} Bilans des inventaires</button></div><div id="i-zone"></div>`;
      const zone = $('#i-zone');
      const draw = async () => {
        $$('#i-tabs [data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === onglet));
        if (onglet === 'saisie') await saisie(); else await bilan();
      };
      $$('#i-tabs [data-t]').forEach((b) => b.addEventListener('click', () => { onglet = b.dataset.t; draw().catch(err); }));

      // ---- Saisie de l'inventaire ----
      async function saisie(di, au) {
        loading(zone);
        const d = await get(`/inventaire/preparer${di ? `?di=${di}&au=${au}` : ''}`);
        const phys = {}; // rid -> quantité physique saisie
        zone.innerHTML = `<div class="card">
            <div class="toolbar" style="margin:0">
              <div class="field"><label>Date initiale</label><input class="input" type="date" id="i-di" value="${d.di}"></div>
              <div class="field"><label>Au</label><input class="input" type="date" id="i-au" value="${d.au}" max="${today()}"></div>
              <button class="btn" id="i-aff">${ic('search')} Afficher</button><div class="spacer"></div>
              <div class="search" style="flex:1 1 200px;max-width:260px">${ic('search')}<input class="input" id="i-q" placeholder="Filtrer…"></div>
            </div>
            <div class="muted" style="margin-top:8px">${d.dernier ? `Dernier inventaire : <b>${dfr(d.dernier)}</b>.` : 'Aucun inventaire enregistré : le stock du dernier inventaire est compté à 0.'}
              Saisissez la quantité physique comptée pour chaque boisson (laisser vide = non comptée).</div>
          </div>
          <div class="tbl-wrap tall" id="i-tbl"></div>
          <div class="stats" id="i-tot" style="margin-top:12px"></div>
          <div class="card" style="margin-top:12px"><div class="row" style="align-items:center;justify-content:space-between;gap:12px">
            <label class="chk" style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="i-aj" ${adminOnly() ? 'checked' : 'disabled'}>
              Ajuster le stock du logiciel à la quantité physique${adminOnly() ? '' : ' <span class="muted">(administrateur)</span>'}</label>
            <button class="btn lg" id="i-val">${ic('check')} Valider l'inventaire</button></div></div>`;
        const lignes = d.lignes;
        const majTot = () => {
          const s = lignes.filter((l) => phys[l.rid] !== undefined);
          const ec = sum(s, (l) => l.logiciel - phys[l.rid]);
          const ve = sum(s, (l) => Math.round((l.logiciel - phys[l.rid]) * l.prixFour));
          $('#i-tot').innerHTML = `<div class="stat"><small>Boissons comptées</small><b>${s.length} / ${lignes.length}</b></div>
            <div class="stat"><small>Écart total (qté)</small><b class="${ec ? 'r' : ''}">${fq(ec)}</b></div>
            <div class="stat"><small>Valeur de l'écart (prix d'achat)</small><b class="${ve > 0 ? 'r' : ''}">${money(ve)}</b></div>`;
        };
        const drawTbl = () => {
          const qv = ($('#i-q').value || '').toLowerCase();
          const rows = lignes.filter((l) => !qv || l.Lib.toLowerCase().includes(qv));
          table($('#i-tbl'), [
            { t: 'Libellé', f: (l) => `<b>${esc(l.Lib)}</b>`, cls: 'wrap', first: 1 },
            { t: 'Stock dernier inventaire', r: 1, hm: 1, f: (l) => `<span style="color:#7b1fa2">${fq(l.dernier)}</span>` },
            { t: 'Stock appro sur période', r: 1, hm: 1, f: (l) => fq(l.appro) },
            { t: 'Stock départ', r: 1, hm: 1, f: (l) => `<span style="color:#7b1fa2">${fq(l.depart)}</span>` },
            { t: 'Stock logiciel', r: 1, f: (l) => `<b>${fq(l.logiciel)}</b>` },
            { t: 'Qté physique', r: 1, f: (l) => `<input class="input inv-in" inputmode="decimal" data-rid="${l.rid}" value="${phys[l.rid] ?? ''}" placeholder="—">` },
            { t: 'Écart stock', r: 1, f: (l) => `<span class="i-ec" data-rid="${l.rid}"></span>` },
            { t: 'Qté réelle', r: 1, hm: 1, f: (l) => `<span class="i-re" data-rid="${l.rid}"></span>` },
          ], rows, { green: 1, empty: 'Aucune boisson dans le stock.' });
          const majLigne = (rid) => {
            const l = lignes.find((x) => x.rid === rid);
            const e = $(`.i-ec[data-rid="${rid}"]`), r = $(`.i-re[data-rid="${rid}"]`);
            if (phys[rid] === undefined) { e.textContent = '—'; r.textContent = '—'; e.style.color = ''; return; }
            const ec = l.logiciel - phys[rid];
            e.textContent = fq(ec); e.style.color = ec ? 'var(--red)' : 'var(--g700)'; e.style.fontWeight = '700';
            r.textContent = fq(phys[rid]);
          };
          $$('.inv-in', $('#i-tbl')).forEach((inp) => {
            const rid = Number(inp.dataset.rid);
            majLigne(rid);
            inp.addEventListener('input', () => {
              const v = inp.value.trim();
              if (v === '') delete phys[rid]; else phys[rid] = Math.max(0, n(v));
              majLigne(rid); majTot();
            });
            inp.addEventListener('keydown', (e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const all = $$('.inv-in', $('#i-tbl')); const i = all.indexOf(inp);
              if (all[i + 1]) all[i + 1].focus();
            });
          });
        };
        $('#i-q').addEventListener('input', drawTbl);
        $('#i-aff').addEventListener('click', () => saisie($('#i-di').value, $('#i-au').value).catch(err));
        drawTbl(); majTot();
        $('#i-val').addEventListener('click', async () => {
          const s = lignes.filter((l) => phys[l.rid] !== undefined);
          if (!s.length) return err("Saisissez la quantité physique d'au moins une boisson.");
          const aj = $('#i-aj').checked;
          const ecarts = s.filter((l) => l.logiciel !== phys[l.rid]).length;
          if (!(await confirm(`Valider l'inventaire du <b>${dfr(today())}</b> ?<br><br>${s.length} boisson(s) comptée(s) · ${ecarts} écart(s)<br>Période : du ${dfr($('#i-di').value)} au ${dfr($('#i-au').value)}<br><br>${aj ? '<b>Le stock du logiciel sera ajusté à la quantité physique.</b>' : '<span class="muted">Le stock du logiciel ne sera pas modifié.</span>'}`, { title: 'Inventaire' }))) return;
          try {
            const r = await post('/inventaire', { di: $('#i-di').value, au: $('#i-au').value, ajuster: aj, lignes: s.map((l) => ({ rid: l.rid, physique: phys[l.rid] })) });
            ok(`Inventaire ${r.numero} enregistré (${r.nb} article(s))${r.ajuste ? ', stock ajusté au physique.' : '.'}`);
            onglet = 'bilan'; await draw();
          } catch (x) { err(x); }
        });
      }

      // ---- Bilans des inventaires ----
      async function bilan(numero) {
        loading(zone);
        const liste = await get('/inventaire/liste');
        if (!liste.length) { zone.innerHTML = `<div class="card"><div class="empty">Aucun inventaire enregistré pour le moment.</div></div>`; return; }
        const cur = liste.find((x) => x.num_inv === numero) || liste[0];
        const rows = await get('/inventaire/detail?numero=' + encodeURIComponent(cur.num_inv));
        zone.innerHTML = `<div class="card"><div class="toolbar" style="margin:0;align-items:flex-end">
            <div class="field" style="flex:1 1 260px"><label>Inventaire</label><select class="input" id="ib-sel">${liste.map((x) => `<option value="${esc(x.num_inv)}" ${x.num_inv === cur.num_inv ? 'selected' : ''}>${dfr(x.date_inv)} · ${esc(x.num_inv)} · ${x.nb} article(s)${x.ajuste ? ' · stock ajusté' : ''}</option>`).join('')}</select></div>
            <div class="spacer"></div><button class="btn sec" onclick="window.print()">${ic('print')} Imprimer</button>
            ${adminOnly() ? `<button class="btn red" id="ib-del">${ic('trash')} Supprimer</button>` : ''}</div>
            <div class="muted" style="margin-top:8px">Fait le <b>${dfr(cur.date_inv)}</b> à ${String(cur.heure || '').slice(0, 5)} par ${esc(cur.utilisateur || '')} · période du ${dfr(cur.date_debut)} au ${dfr(cur.date_fin)} · ${cur.ajuste ? '<b>stock ajusté</b>' : 'stock non ajusté'}</div></div>
          <div class="tbl-wrap tall" id="ib-tbl"></div>
          <div class="stats" style="margin-top:12px"><div class="stat"><small>Articles</small><b>${rows.length}</b></div>
            <div class="stat"><small>Articles avec écart</small><b class="r">${rows.filter((r) => n(r.qte_ecart)).length}</b></div>
            <div class="stat"><small>Écart total (qté)</small><b>${fq(sum(rows, 'qte_ecart'))}</b></div>
            <div class="stat"><small>Valeur de l'écart</small><b class="r">${money(sum(rows, 'valeur_ecart'))}</b></div></div>`;
        table($('#ib-tbl'), [
          { t: 'Libellé articles', f: (r) => `<b>${esc(r.lib)}</b>`, cls: 'wrap', first: 1 },
          { t: 'Qté inventaire', r: 1, f: (r) => fq(r.qte_dernier_inv) }, { t: 'Qté appro', r: 1, f: (r) => fq(r.qte_appro) },
          { t: 'Qté départ', r: 1, f: (r) => fq(r.qte_depart) }, { t: 'Qté stock', r: 1, f: (r) => fq(r.qte_logiciel) },
          { t: 'Qté physique', r: 1, f: (r) => `<b>${fq(r.qte_physique)}</b>` },
          { t: 'Qté écart', r: 1, f: (r) => `<b style="color:${n(r.qte_ecart) ? 'var(--red)' : 'inherit'}">${fq(r.qte_ecart)}</b>` },
          { t: 'Qté juste', r: 1, f: (r) => fq(r.qte_juste) }, { t: 'Valeur écart', r: 1, f: (r) => money(r.valeur_ecart) },
        ], rows, { green: 1, foot: ['Total', '', '', '', '', '', fq(sum(rows, 'qte_ecart')), '', money(sum(rows, 'valeur_ecart'))] });
        $('#ib-sel').addEventListener('change', (e) => bilan(e.target.value).catch(err));
        const b = $('#ib-del');
        if (b) b.addEventListener('click', async () => {
          if (!(await confirm(`Supprimer l'inventaire <b>${esc(cur.num_inv)}</b> du ${dfr(cur.date_inv)} ?${cur.ajuste ? '<br><br><span class="muted">Le stock déjà ajusté ne sera pas remis comme avant.</span>' : ''}`, { danger: true, okText: 'Oui' }))) return;
          try { await del('/inventaire?numero=' + encodeURIComponent(cur.num_inv)); ok('Inventaire supprimé.'); bilan().catch(err); } catch (x) { err(x); }
        });
      }

      await draw();
    },
  };

  // ================= BILAN DES VENTES PAR PRODUIT =================
  Pages['/bilans/produits'] = {
    title: 'Bilan par produit', back: '/',
    async render(el, params) {
      let tri = 'qte';
      el.innerHTML = `<div class="toolbar">
          <div class="field"><label>Date du</label><input class="input" type="date" name="du" value="${params.du || firstOfMonth()}"></div>
          <div class="field"><label>Au</label><input class="input" type="date" name="au" value="${params.au || today()}"></div>
          <button class="btn" data-go>${ic('search')} Afficher</button><div class="spacer"></div>
          <div class="presets" id="bp-tri"><button data-k="qte" class="on">Quantité</button><button data-k="ventes">Chiffre d'affaires</button><button data-k="benefice">Bénéfice</button></div></div>
        <div id="bp-best"></div>
        <div class="card chart-card"><div class="card-title">${ic('chart')} Top 10 des produits les plus vendus</div><div class="chart-box tall"><canvas id="bp-chart"></canvas></div></div>
        <div class="tbl-wrap" id="bp-tbl"></div><div class="stats" id="bp-tot" style="margin-top:14px"></div>`;
      let data = null;
      const LBL = { qte: 'Quantité vendue', ventes: "Chiffre d'affaires", benefice: 'Bénéfice' };
      const draw = () => {
        const rows = [...data.produits].filter((r) => r.qte > 0 || r.ventes > 0).sort((a, b) => b[tri] - a[tri] || b.ventes - a.ventes);
        const tv = sum(rows, 'ventes'), tq = sum(rows, 'qte');
        const best = rows[0];
        $('#bp-best').innerHTML = best ? `<div class="kpis">
            <div class="kpi wide"><div class="kpi-ic c4">${ic('box')}</div><div><small>Produit le plus vendu (${LBL[tri].toLowerCase()})</small><b>${esc(best.produit)}</b><span>${fq(best.qte)} vendu(s) · ${money(best.ventes)}</span></div></div>
            <div class="kpi"><div class="kpi-ic c1">${ic('cart')}</div><div><small>Chiffre d'affaires</small><b>${money(tv)}</b><span>${data.nbJours} jour(s) de vente</span></div></div>
            <div class="kpi"><div class="kpi-ic c3">${ic('chart')}</div><div><small>Bénéfice</small><b>${money(sum(rows, 'benefice'))}</b><span>${tv ? 'Marge ' + Math.round((sum(rows, 'benefice') / tv) * 100) + ' %' : '—'}</span></div></div>
            <div class="kpi"><div class="kpi-ic c5">${ic('list')}</div><div><small>Quantité totale vendue</small><b>${fq(tq)}</b><span>${rows.length} produit(s) vendu(s)</span></div></div></div>`
          : '<div class="notice">' + ic('info') + '<div>Aucune vente sur la période.</div></div>';
        const top = rows.slice(0, 10);
        Charts.combo($('#bp-chart'), top.map((x) => (x.produit.length > 18 ? x.produit.slice(0, 17) + '…' : x.produit)),
          [{ label: LBL[tri], data: top.map((x) => x[tri]), color: Charts.C.s1 }], { horizontal: true, unit: tri === 'qte' ? '' : ' F' });
        table($('#bp-tbl'), [
          { t: 'Rang', c: 1, f: (r, i) => (i < 3 ? `<span class="badge">${i + 1}</span>` : i + 1) },
          { t: 'Produit', f: (r) => `<b>${esc(r.produit)}</b>`, cls: 'wrap', first: 1 },
          { t: 'Qté vendue', r: 1, f: (r) => `<b>${fq(r.qte)}</b>` },
          { t: 'Part qté', r: 1, f: (r) => (tq ? Math.round((r.qte / tq) * 1000) / 10 + ' %' : '—') },
          { t: 'Prix vente', r: 1, f: (r) => money(r.pu) },
          { t: 'Total vente', r: 1, f: (r) => money(r.ventes) },
          { t: 'Part CA', r: 1, f: (r) => (tv ? Math.round((r.ventes / tv) * 1000) / 10 + ' %' : '—') },
          { t: 'Total achat', r: 1, f: (r) => money(r.achat) },
          { t: 'Bénéfice', r: 1, f: (r) => `<b>${money(r.benefice)}</b>` },
          { t: 'Jours vendus', r: 1, f: (r) => r.jours },
          { t: 'Moy./jour', r: 1, f: (r) => (data.nbJours ? qty(Math.round((r.qte / data.nbJours) * 10) / 10) : '—') },
        ], rows, { green: 1, empty: 'Aucune vente sur la période.',
          foot: ['', 'Total', fq(tq), '', '', money(tv), '', money(sum(rows, 'achat')), money(sum(rows, 'benefice')), '', ''] });
        const flop = rows.length > 3 ? rows.slice(-3).reverse() : [];
        $('#bp-tot').innerHTML = flop.length ? `<div class="card" style="grid-column:1/-1"><div class="card-title">${ic('warn')} Produits les moins vendus</div>
          ${flop.map((r) => `<div class="kv"><span>${esc(r.produit)}</span><b>${fq(r.qte)} · ${money(r.ventes)}</b></div>`).join('')}</div>` : '';
      };
      const load = async () => {
        data = await get(`/bilans/produits?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        draw();
      };
      $$('#bp-tri [data-k]').forEach((b) => b.addEventListener('click', () => {
        $$('#bp-tri [data-k]').forEach((x) => x.classList.toggle('on', x === b)); tri = b.dataset.k; if (data) draw();
      }));
      $('[data-go]').addEventListener('click', () => load().catch(err));
      await load();
    },
  };
})();
