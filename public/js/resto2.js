/* ===== RESTO DU FORESTIER : menus, stock, dépenses, caisse, bilans, paramètres ===== */
(() => {
  const { $, $$, esc, ic, get, post, put, del, n, money, qty, today, addDays, dfr, dlong, hm, toast, ok, err, modal, alert, confirm, table, sum, moneyInput, firstOfMonth } = UI;
  const go = (...a) => App.go(...a);
  const adminOnly = () => App.isAdmin();
  const { unites, MODES } = window.RestoUtil;
  const TYPES_MVT = { APPRO: 'Approvisionnement', VENTE: 'Vente', ANNULATION: 'Annulation ticket', FIN_SAC: 'Sac terminé', AJUSTEMENT: 'Ajustement inventaire' };

  // ================= MENUS =================
  Pages['/resto/menus'] = {
    title: 'Menus', back: '/resto',
    async render(el, params) {
      let onglet = params.onglet || 'fixe';
      let accompagnements = [];
      el.innerHTML = `<div class="tabs" id="m-tabs">
          <button data-t="fixe">${ic('list')} Menu fixe</button><button data-t="jour">${ic('clock')} Menu du jour</button><button data-t="tous">${ic('report')} Tous les plats</button><button data-t="accomp">${ic('plus')} Accompagnements</button></div>
        <div id="m-zone"></div>`;
      const res = await get('/resto/ressources');
      const draw = async () => {
        $$('#m-tabs [data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === onglet));
        const z = $('#m-zone');
        UI.loading(z);
        if (onglet === 'jour') return drawJour(z);
        const tout = await get('/resto/plats');
        accompagnements = tout.filter((p) => p.menu === 'accomp');
        const nomAcc = (id) => (accompagnements.find((a) => a.id === id) || {}).nom || '?';
        const resNom = (code) => (res.find((r) => r.code === code) || {}).nom || code;
        if (onglet === 'accomp') {
          z.innerHTML = `<div class="notice info">${ic('info')}<div>Les <b>accompagnements</b> (portion de riz, frites, attiéké, alloco…) ont leur propre prix. Ils peuvent être <b>ajoutés à un plat</b> (à configurer dans chaque plat) ou <b>vendus seuls</b>.</div></div>
            <div class="toolbar"><div class="spacer"></div>${adminOnly() ? `<button class="btn" id="m-new">${ic('plus')} Nouvel accompagnement</button>` : ''}</div><div class="tbl-wrap tall" id="m-tbl"></div>`;
          table($('#m-tbl'), [
            { t: 'Accompagnement', f: (p) => `<b>${esc(p.nom)}</b>${p.actif ? '' : ' <span class="badge red">Inactif</span>'}`, cls: 'wrap', first: 1 },
            { t: 'Prix', r: 1, f: (p) => `<b>${money(p.prix)}</b>` },
            { t: 'Vendu seul', c: 1, f: (p) => (p.vendable_seul ? '<span class="badge">Oui</span>' : '<span class="badge amber">Non</span>') },
            { t: 'Proposé avec', f: (p) => esc(tout.filter((x) => x.accompagnements.some((a) => a.id === p.id)).map((x) => x.nom).join(', ')) || '<span class="muted">—</span>', cls: 'wrap' },
            { t: 'Consomme', f: (p) => p.ressources.map((r) => `${r.portions !== 1 ? r.portions + ' × ' : ''}${esc(resNom(r.code))}`).join(', ') || '<span class="muted">—</span>', cls: 'wrap' },
          ], accompagnements, { green: 1, onClick: adminOnly() ? (p) => editer(p, true) : null, empty: 'Aucun accompagnement.' });
          if ($('#m-new')) $('#m-new').addEventListener('click', () => editer(null, true));
          return;
        }
        const plats = tout.filter((p) => p.menu !== 'accomp' && (onglet === 'tous' || p.menu === 'fixe'));
        const intro = onglet === 'fixe'
          ? `<div class="notice info">${ic('info')}<div>Le <b>menu fixe</b> est proposé tous les jours à la vente. Les plats « menu du jour » ne sont proposés que les jours où ils sont choisis dans l'onglet Menu du jour.</div></div>`
          : '';
        z.innerHTML = `${intro}<div class="toolbar"><div class="spacer"></div>${adminOnly() ? `<button class="btn" id="m-new">${ic('plus')} Nouveau plat</button>` : ''}</div><div class="tbl-wrap tall" id="m-tbl"></div>`;
        table($('#m-tbl'), [
          { t: 'Plat', f: (p) => `<b>${esc(p.nom)}</b>${p.actif ? '' : ' <span class="badge red">Inactif</span>'}`, cls: 'wrap', first: 1 },
          { t: 'Catégorie', f: (p) => esc(p.categorie) }, { t: 'Prix', r: 1, f: (p) => `<b>${money(p.prix)}</b>` },
          { t: 'Menu', f: (p) => (p.menu === 'fixe' ? '<span class="badge">Fixe</span>' : '<span class="badge amber">Du jour</span>') },
          { t: 'Accompagnements', f: (p) => (p.accompagnements.length ? `${p.accomp_obligatoire ? '<span class="badge amber">Obligatoire</span> ' : ''}${esc(p.accompagnements.map((a) => nomAcc(a.id) + (a.prix === 0 ? ' (inclus)' : a.prix ? ` (${money(a.prix)})` : '')).join(', '))}` : '<span class="muted">—</span>'), cls: 'wrap' },
          { t: 'Consomme', f: (p) => p.ressources.map((r) => `${r.portions !== 1 ? r.portions + ' × ' : ''}${esc(resNom(r.code))}`).join(', ') || '<span class="muted">—</span>', cls: 'wrap' },
        ], plats, { green: 1, onClick: adminOnly() ? (p) => editer(p) : null, empty: 'Aucun plat. Ajoutez votre premier plat.' });
        if ($('#m-new')) $('#m-new').addEventListener('click', () => editer(null));
      };
      async function drawJour(z) {
        let date = params.date || today();
        const load = async () => {
          const d = await get('/resto/menu-jour?date=' + date);
          z.innerHTML = `<div class="card"><div class="toolbar" style="margin:0">
              <div class="field"><label>Date du menu</label><input class="input" type="date" id="j-date" value="${date}"></div>
              <span class="date-label" style="text-transform:none">${dlong(date)}</span><div class="spacer"></div>
              <button class="btn sec" id="j-copy">${ic('refresh')} Reprendre le menu de la veille</button></div></div>
            ${d.plats.length ? '' : `<div class="notice">${ic('info')}<div>Aucun plat de type « menu du jour ». Créez-les dans l'onglet <b>Tous les plats</b> en choisissant « Menu du jour ».</div></div>`}
            <div class="jour-list">${d.plats.map((p) => `<label class="jour-item ${p.choisi ? 'on' : ''}">
              <input type="checkbox" data-pid="${p.id}" ${p.choisi ? 'checked' : ''} ${p.actif ? '' : 'disabled'}>
              <div><b>${esc(p.nom)}</b><small>${esc(p.categorie)} · prix habituel ${money(p.prix)} F${p.actif ? '' : ' · inactif'}</small></div>
              <input class="input right" data-prix="${p.id}" placeholder="Prix du jour" value="${p.prixJour !== null ? p.prixJour : ''}" inputmode="numeric"></label>`).join('')}</div>
            <div class="btn-bar"><button class="btn lg" id="j-save">${ic('check')} Enregistrer le menu du jour</button></div>`;
          $$('.jour-item input[type=checkbox]').forEach((c) => c.addEventListener('change', () => c.closest('.jour-item').classList.toggle('on', c.checked)));
          $('#j-date').addEventListener('change', (e) => { date = e.target.value; load().catch(err); });
          $('#j-copy').addEventListener('click', async () => {
            if (!(await confirm(`Remplacer le menu du <b>${dfr(date)}</b> par celui du <b>${dfr(addDays(date, -1))}</b> ?`))) return;
            try { const r = await post('/resto/menu-jour/copier', { de: addDays(date, -1), vers: date }); ok(`${r.copies} plat(s) repris de la veille.`); load(); } catch (x) { err(x); }
          });
          $('#j-save').addEventListener('click', async () => {
            const plats = $$('.jour-item input[type=checkbox]:checked').map((c) => ({ plat_id: Number(c.dataset.pid), prix: n($(`[data-prix="${c.dataset.pid}"]`).value) || null }));
            if (!(await confirm(`Enregistrer le menu du jour du <b>${dfr(date)}</b> avec <b>${plats.length}</b> plat(s) ?`))) return;
            try { await put('/resto/menu-jour', { date, plats }); ok('Menu du jour enregistré avec succès.'); } catch (x) { err(x); }
          });
        };
        await load();
      }
      function editer(p, estAcc = false) {
        const isNew = !p;
        p = p || { nom: '', categorie: estAcc ? 'Accompagnements' : 'Plats', prix: '', menu: estAcc ? 'accomp' : 'fixe', actif: true, ressources: [], accompagnements: [], accomp_obligatoire: false, vendable_seul: true };
        estAcc = p.menu === 'accomp';
        const avec = res.filter((r) => r.ppu);
        const mot = estAcc ? "l'accompagnement" : 'le plat';
        const m = modal({ title: isNew ? (estAcc ? 'Nouvel accompagnement' : 'Nouveau plat') : (estAcc ? "Modifier l'accompagnement" : 'Modifier le plat'), wide: true, body: `${estAcc ? `
          <div class="grid2"><div class="field"><label>Nom de l'accompagnement *</label><input class="input" name="nom" value="${esc(p.nom)}" placeholder="ex : Frites, Attiéké, Alloco"></div>
          <div class="field"><label>Prix *</label><input class="input big" name="prix" value="${p.prix}" inputmode="numeric"></div></div>
          <label class="row" style="align-items:center;gap:8px;margin-bottom:12px"><input type="checkbox" name="seul" ${p.vendable_seul ? 'checked' : ''} style="width:18px;height:18px"> Peut être vendu seul (apparaît dans la caisse)</label>` : `
          <div class="grid2"><div class="field"><label>Nom du plat *</label><input class="input" name="nom" value="${esc(p.nom)}" placeholder="ex : Poisson braisé, Poulet braisé"></div>
          <div class="field"><label>Catégorie</label><input class="input" name="categorie" list="cats" value="${esc(p.categorie)}">
            <datalist id="cats"><option>Plats</option><option>Grillades</option><option>Boissons</option><option>Desserts</option></datalist></div></div>
          <div class="grid2"><div class="field"><label>Prix de vente *</label><input class="input big" name="prix" value="${p.prix}" inputmode="numeric"></div>
          <div class="field"><label>Type de menu</label><div class="seg">
            <button type="button" data-menu="fixe" class="${p.menu === 'fixe' ? 'on' : ''}">Menu fixe (tous les jours)</button>
            <button type="button" data-menu="jour" class="${p.menu === 'jour' ? 'on' : ''}">Menu du jour</button></div></div></div>
          <div class="field"><label>Accompagnements proposés avec ce plat</label>
            ${accompagnements.length ? `<div class="res-pick">${accompagnements.map((a) => { const x = p.accompagnements.find((y) => y.id === a.id); return `<label class="rp ${x ? 'on' : ''}">
              <input type="checkbox" data-accomp="${a.id}" ${x ? 'checked' : ''}><div><b>${esc(a.nom)}</b><small>Prix normal : ${money(a.prix)} F</small></div>
              <span class="rp-n">Prix dans ce plat <input class="input right" data-accprix="${a.id}" value="${x && x.prix !== null ? x.prix : ''}" placeholder="${a.prix}" inputmode="numeric" style="width:90px"></span></label>`; }).join('')}</div>
              <small class="muted">Laissez le prix vide pour le prix normal, mettez 0 si l'accompagnement est inclus dans le prix du plat.</small>
              <label class="row" style="align-items:center;gap:8px;margin-top:8px"><input type="checkbox" name="oblig" ${p.accomp_obligatoire ? 'checked' : ''} style="width:18px;height:18px"> Accompagnement obligatoire (le caissier doit en choisir un)</label>`
              : '<div class="muted">Aucun accompagnement : créez-les dans l\'onglet Accompagnements.</div>'}</div>`}
          <div class="field"><label>Ressources consommées par plat vendu</label>
            <div class="res-pick">${avec.map((r) => { const x = p.ressources.find((y) => y.code === r.code); return `<label class="rp ${x ? 'on' : ''}">
              <input type="checkbox" data-code="${r.code}" ${x ? 'checked' : ''}><div><b>${esc(r.nom)}</b><small>1 ${esc(r.unite)} = ${qty(r.ppu)} plats</small></div>
              <span class="rp-n"><input class="input right" data-portions="${r.code}" value="${x ? x.portions : 1}" inputmode="decimal"> portion(s)</span></label>`; }).join('')}</div>
            <small class="muted">${estAcc ? 'Exemple : « Portion de riz » consomme 1 portion de riz (1/80 de sac). Laissez vide si l\'accompagnement ne touche pas le stock suivi.' : 'Exemple : « Riz + poulet » consomme 1 portion de riz (1/80 de sac) et 1 portion de poulet (1/8 de poulet).'}</small></div>
          <label class="row" style="align-items:center;gap:8px"><input type="checkbox" name="actif" ${p.actif ? 'checked' : ''} style="width:18px;height:18px"> ${estAcc ? 'Accompagnement actif' : 'Plat actif (proposé à la vente)'}</label>`,
        foot: `${!isNew ? `<button class="btn red" data-del>${ic('trash')} Supprimer</button>` : ''}<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>${ic('check')} Enregistrer</button>` });
        let menu = p.menu;
        m.$$('[data-menu]').forEach((b) => b.addEventListener('click', () => { menu = b.dataset.menu; m.$$('[data-menu]').forEach((x) => x.classList.toggle('on', x === b)); }));
        m.$$('.rp input[type=checkbox]').forEach((c) => c.addEventListener('change', () => c.closest('.rp').classList.toggle('on', c.checked)));
        m.$('[data-ok]').addEventListener('click', async () => {
          const b = { nom: m.$('[name=nom]').value, categorie: estAcc ? 'Accompagnements' : m.$('[name=categorie]').value, prix: n(m.$('[name=prix]').value), menu: estAcc ? 'accomp' : menu, actif: m.$('[name=actif]').checked,
            ressources: m.$$('.rp input[data-code]:checked').map((c) => ({ code: c.dataset.code, portions: n(m.$(`[data-portions="${c.dataset.code}"]`).value) || 1 })),
            accompagnements: m.$$('input[data-accomp]:checked').map((c) => { const v = m.$(`[data-accprix="${c.dataset.accomp}"]`).value.trim(); return { id: Number(c.dataset.accomp), prix: v === '' ? null : n(v) }; }),
            accomp_obligatoire: !!(m.$('[name=oblig]') && m.$('[name=oblig]').checked), vendable_seul: estAcc ? m.$('[name=seul]').checked : true };
          if (!(await confirm(`${isNew ? 'Créer' : 'Enregistrer'} ${mot} <b>${esc(b.nom)}</b> à <b>${money(b.prix)} F</b> ?`))) return;
          try { if (isNew) await post('/resto/plats', b); else await put('/resto/plats/' + p.id, b); ok(estAcc ? 'Accompagnement enregistré avec succès.' : 'Plat enregistré avec succès.'); m.close(); draw(); } catch (x) { err(x); }
        });
        const d = m.$('[data-del]');
        if (d) d.addEventListener('click', async () => {
          if (!(await confirm(`Supprimer ${mot} <b>${esc(p.nom)}</b> ?<br><span class="muted">Les ventes déjà enregistrées sont conservées.</span>`, { danger: true }))) return;
          try { await del('/resto/plats/' + p.id); ok('Plat supprimé.'); m.close(); draw(); } catch (x) { err(x); }
        });
      }
      $$('#m-tabs [data-t]').forEach((b) => b.addEventListener('click', () => { onglet = b.dataset.t; draw().catch(err); }));
      await draw();
    },
  };

  // ================= STOCK =================
  Pages['/resto/stock'] = {
    title: 'Stock du restaurant', back: '/resto',
    async render(el) {
      const load = async () => {
        const res = await get('/resto/ressources');
        const mv = await get(`/resto/mouvements?du=${addDays(today(), -6)}&au=${today()}`);
        el.innerHTML = `<div class="notice info">${ic('info')}<div>Le stock diminue automatiquement à chaque vente selon les plats vendus (1 sac de riz ≈ ${qty((res.find((r) => r.code === 'RIZ') || {}).ppu || 80)} plats, etc.).
          Le <b>charbon</b> se gère à la main : cliquez sur « Un sac est fini » quand un sac est terminé.</div></div>
          <div class="res-grid">${res.map((r) => `<div class="res-card ${r.alerte ? 'bas' : ''}">
            <div class="rc-h"><b>${esc(r.nom)}</b>${r.alerte ? '<span class="badge red">Stock bas</span>' : '<span class="badge">OK</span>'}</div>
            <div class="rc-v">${qty(Math.round(r.stock * 100) / 100)} <small>${esc(r.unite)}(s)</small></div>
            <div class="rc-s">${r.ppu ? `≈ <b>${qty(r.plats)}</b> plats possibles · 1 ${esc(r.unite)} = ${qty(r.ppu)} plats` : 'Gestion manuelle (pas lié aux plats)'}</div>
            <div class="rc-s">Seuil d'alerte : ${qty(r.seuil)} ${esc(r.unite)}(s)${r.prix_unite ? ` · dernier prix ${money(r.prix_unite)} F / ${esc(r.unite)}` : ''}</div>
            <div class="rc-b"><button class="btn sm" data-appro="${r.code}">${ic('plus')} Approvisionner</button>
              ${!r.ppu ? `<button class="btn amber sm" data-fin="${r.code}">${ic('check')} Un ${esc(r.unite)} est fini</button>` : ''}
              ${adminOnly() ? `<button class="btn sec sm" data-adj="${r.code}">${ic('edit')} Inventaire</button>` : ''}
              ${adminOnly() && r.ppu ? `<button class="btn sec sm" data-rdt="${r.code}">${ic('gear')} Plats par ${esc(r.unite)}</button>` : ''}</div></div>`).join('')}</div>
          <div class="card"><div class="card-title">${ic('truck')} Mouvements des 7 derniers jours <a class="link-more" href="#/resto/stock/mouvements">Tout l'historique ›</a></div><div class="tbl-wrap" id="s-mv"></div></div>`;
        tableMvt($('#s-mv'), mv.slice(0, 40));
        const R = (code) => res.find((r) => r.code === code);
        $$('[data-appro]').forEach((b) => b.addEventListener('click', () => appro(R(b.dataset.appro))));
        $$('[data-fin]').forEach((b) => b.addEventListener('click', async () => {
          const r = R(b.dataset.fin);
          if (!(await confirm(`Confirmer qu'<b>un ${esc(r.unite)}</b> de <b>${esc(r.nom)}</b> est terminé ?<br>Stock actuel : ${unites(r.stock, r.unite)} → ${unites(r.stock - 1, r.unite)}`))) return;
          try { await post(`/resto/ressources/${r.code}/fin`, {}); ok('Enregistré avec succès.'); load(); } catch (x) { err(x); }
        }));
        $$('[data-adj]').forEach((b) => b.addEventListener('click', () => ajuster(R(b.dataset.adj))));
        $$('[data-rdt]').forEach((b) => b.addEventListener('click', () => rendement(R(b.dataset.rdt))));
      };
      function appro(r) {
        const m = modal({ title: `Approvisionner : ${r.nom}`, body: `
          <div class="field"><label>Date</label><input class="input" type="date" name="date" value="${today()}" max="${today()}"></div>
          <div class="grid2"><div class="field"><label>Quantité (${esc(r.unite)}s)</label><input class="input big" name="u" inputmode="decimal" placeholder="0"></div>
          <div class="field"><label>Coût total d'achat (F)</label><input class="input big" name="cout" inputmode="numeric" placeholder="0"></div></div>
          <div class="muted" id="a-info"></div>
          <div class="field" style="margin-top:10px"><label>Fournisseur / motif</label><input class="input" name="motif"></div>`,
        foot: `<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>${ic('check')} Enregistrer</button>` });
        const maj = () => { const u = n(m.$('[name=u]').value); m.$('#a-info').textContent = r.ppu && u ? `= environ ${qty(Math.floor(u * r.ppu))} plats supplémentaires` : ''; };
        m.$('[name=u]').addEventListener('input', maj);
        m.$('[data-ok]').addEventListener('click', async () => {
          const u = n(m.$('[name=u]').value);
          if (!(await confirm(`Enregistrer l'approvisionnement de <b>${qty(u)} ${esc(r.unite)}(s)</b> de <b>${esc(r.nom)}</b>${n(m.$('[name=cout]').value) ? ` pour <b>${money(n(m.$('[name=cout]').value))} F</b>` : ''} ?`))) return;
          try { await post(`/resto/ressources/${r.code}/appro`, { date: m.$('[name=date]').value, unites: u, cout: n(m.$('[name=cout]').value), motif: m.$('[name=motif]').value }); ok('Approvisionnement enregistré avec succès.'); m.close(); load(); } catch (x) { err(x); }
        });
      }
      // Paramétrer le nombre de plats par unité (sac de riz, carton de poisson, poulet…)
      function rendement(r) {
        const m = modal({ title: `Nombre de plats par ${r.unite}`, body: `
          <p class="muted" style="margin-top:0">Combien de plats peut-on servir avec <b>1 ${esc(r.unite)}</b> de <b>${esc(r.nom)}</b> ?</p>
          <div class="field"><label>Plats par ${esc(r.unite)}</label><input class="input big" name="ppu" value="${r.ppu}" inputmode="decimal"></div>
          <div class="field"><label>Seuil d'alerte (${esc(r.unite)}s)</label><input class="input" name="seuil" value="${r.seuil}" inputmode="decimal"></div>
          <div class="notice info">${ic('info')}<div id="rd-info"></div></div>`,
        foot: `<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>${ic('check')} Enregistrer</button>` });
        const maj = () => { const v = n(m.$('[name=ppu]').value); m.$('#rd-info').innerHTML = v > 0 ? `Le stock actuel (${qty(Math.round(r.stock * 100) / 100)} ${esc(r.unite)}s) permettra de servir environ <b>${qty(Math.floor(r.stock * v + 1e-3))} plats</b>. Chaque plat vendu retirera 1/${qty(v)} de ${esc(r.unite)}.` : 'Indiquez un nombre supérieur à 0.'; };
        m.$('[name=ppu]').addEventListener('input', maj); maj();
        m.$('[data-ok]').addEventListener('click', async () => {
          const v = n(m.$('[name=ppu]').value);
          if (v <= 0) return err('Le nombre de plats doit être supérieur à 0.');
          if (!(await confirm(`Enregistrer <b>1 ${esc(r.unite)} = ${qty(v)} plats</b> pour <b>${esc(r.nom)}</b> ?`))) return;
          try { await put('/resto/ressources/' + r.code, { nom: r.nom, unite: r.unite, ppu: v, seuil: n(m.$('[name=seuil]').value), prix_unite: r.prix_unite }); ok('Nombre de plats enregistré avec succès.'); m.close(); load(); } catch (x) { err(x); }
        });
      }
      function ajuster(r) {
        const m = modal({ title: `Inventaire : ${r.nom}`, body: `<p class="muted" style="margin-top:0">Saisissez la quantité réellement présente. L'écart est enregistré comme ajustement.</p>
          <div class="field"><label>Stock réel (${esc(r.unite)}s)</label><input class="input big" name="s" value="${Math.round(r.stock * 100) / 100}" inputmode="decimal"></div>
          <div class="field"><label>Motif</label><input class="input" name="motif" value="Inventaire"></div>`,
        foot: `<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>${ic('check')} Enregistrer</button>` });
        m.$('[data-ok]').addEventListener('click', async () => {
          if (!(await confirm(`Corriger le stock de <b>${esc(r.nom)}</b> à <b>${qty(n(m.$('[name=s]').value))} ${esc(r.unite)}(s)</b> ?`))) return;
          try { await post(`/resto/ressources/${r.code}/ajuster`, { stock: n(m.$('[name=s]').value), motif: m.$('[name=motif]').value }); ok('Stock corrigé avec succès.'); m.close(); load(); } catch (x) { err(x); }
        });
      }
      await load();
    },
  };
  function tableMvt(elt, rows) {
    table(elt, [
      { t: 'Date', f: (r) => `${dfr(r.date)} ${hm(r.heure)}` }, { t: 'Ressource', f: (r) => `<b>${esc(r.nom || r.code)}</b>` },
      { t: 'Mouvement', f: (r) => `<span class="badge ${r.unites > 0 ? '' : 'amber'}">${TYPES_MVT[r.type] || r.type}</span>` },
      { t: 'Quantité', r: 1, f: (r) => `<b style="color:${r.unites > 0 ? 'var(--g700)' : 'var(--red)'}">${r.unites > 0 ? '+' : ''}${qty(Math.round(r.unites * 1000) / 1000)}</b> ${esc(r.unite || '')}` },
      { t: 'Coût', r: 1, f: (r) => (r.cout ? money(r.cout) : '') }, { t: 'Réf.', f: (r) => esc(r.ref || '') },
      { t: 'Détail', f: (r) => esc(r.motif || ''), cls: 'wrap' }, { t: 'Agent', f: (r) => esc(r.agent || '') },
    ], rows, { empty: 'Aucun mouvement.' });
  }
  Pages['/resto/stock/mouvements'] = {
    title: 'Mouvements de stock', back: '/resto/stock',
    async render(el) {
      const res = await get('/resto/ressources');
      el.innerHTML = `<div class="toolbar">
          <div class="field"><label>Du</label><input class="input" type="date" name="du" value="${firstOfMonth()}"></div>
          <div class="field"><label>Au</label><input class="input" type="date" name="au" value="${today()}"></div>
          <div class="field"><label>Ressource</label><select class="input" name="code"><option value="">Toutes</option>${res.map((r) => `<option value="${r.code}">${esc(r.nom)}</option>`).join('')}</select></div>
          <div class="field"><label>Type</label><select class="input" name="type"><option value="">Tous</option>${Object.entries(TYPES_MVT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <button class="btn" data-go>${ic('search')} Afficher</button></div><div class="tbl-wrap tall" id="mv"></div>`;
      const load = async () => {
        const p = new URLSearchParams({ du: $('[name=du]').value, au: $('[name=au]').value });
        if ($('[name=code]').value) p.set('code', $('[name=code]').value);
        if ($('[name=type]').value) p.set('type', $('[name=type]').value);
        tableMvt($('#mv'), await get('/resto/mouvements?' + p));
      };
      $('[data-go]').addEventListener('click', () => load().catch(err));
      await load();
    },
  };

  // ================= DÉPENSES =================
  Pages['/resto/depenses'] = {
    title: 'Dépenses du restaurant', back: '/resto',
    async render(el, params) {
      el.innerHTML = `<div class="two-col">
        <div class="card"><div class="page-sub" style="font-style:normal;margin:0 0 10px">ENREGISTREMENT DES DÉPENSES</div>
          <div class="row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn sm" id="d-new">${ic('plus')} Nouvelle dépense</button></div>
          <div class="field"><label>Date</label><input class="input" type="date" id="d-date" value="${params.date || today()}" max="${today()}"></div>
          <div class="field"><label>Dépense</label><select class="input" id="d-type"></select></div>
          <div class="field"><label>Montant</label><input class="input big" id="d-mt" placeholder="0"></div>
          <div class="field"><label>Motif</label><textarea class="input" id="d-motif"></textarea></div>
          <div class="btn-bar"><button class="btn lg" id="d-val">${ic('check')} Valider</button></div>
          <p class="muted center">Les dépenses du jour sont déduites du montant à verser à la fermeture de caisse.</p></div>
        <div class="card"><div class="card-title">${ic('clock')} Historique</div>
          <div class="toolbar"><div class="field"><label>Du</label><input class="input" type="date" name="du" value="${firstOfMonth()}"></div>
            <div class="field"><label>Au</label><input class="input" type="date" name="au" value="${today()}"></div><button class="btn sm" data-go>${ic('search')}</button></div>
          <div class="tbl-wrap" id="d-tbl"></div><div class="kv"><span>Total de la période</span><b id="d-tot" style="color:var(--red)">0</b></div></div></div>`;
      const fill = async (s) => { const t = await get('/resto/depenses/types'); $('#d-type').innerHTML = '<option value="">— Choisir —</option>' + t.map((x) => `<option ${x.nom === s ? 'selected' : ''}>${esc(x.nom)}</option>`).join(''); };
      const load = async () => {
        const rows = await get(`/resto/depenses?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        table($('#d-tbl'), [{ t: 'Date', f: (r) => dfr(r.date) }, { t: 'Dépense', f: (r) => `<b>${esc(r.type)}</b>` }, { t: 'Montant', r: 1, f: (r) => money(r.montant) },
          { t: 'Motif', f: (r) => esc(r.motif || ''), cls: 'wrap' }, { t: '', f: (r) => (adminOnly() ? `<button class="btn red sm" data-del="${r.id}">${ic('trash')}</button>` : '') }], rows, { empty: 'Aucune dépense.' });
        $('#d-tot').textContent = money(sum(rows, 'montant'));
        $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
          if (!(await confirm('Supprimer cette dépense ?', { danger: true }))) return;
          try { await del('/resto/depenses/' + b.dataset.del); ok('Dépense supprimée.'); load(); } catch (x) { err(x); }
        }));
      };
      await fill();
      const mt = moneyInput($('#d-mt'));
      $('#d-new').addEventListener('click', () => {
        const m = modal({ title: 'Nouvelle dépense', body: `<div class="field"><label>Nom de la dépense</label><input class="input" name="nom" placeholder="ex : GAZ, MARCHÉ…"></div>`,
          foot: `<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>${ic('check')} Enregistrer</button>` });
        m.$('[data-ok]').addEventListener('click', async () => {
          if (!(await confirm(`Ajouter la dépense <b>${esc(m.$('[name=nom]').value)}</b> ?`))) return;
          try { const r = await post('/resto/depenses/types', { nom: m.$('[name=nom]').value }); ok('Dépense ajoutée.'); m.close(); fill(r.nom); } catch (x) { err(x); }
        });
      });
      $('#d-val').addEventListener('click', async () => {
        if (!$('#d-type').value) return err('Sélectionnez la dépense.');
        if (!(await confirm(`Enregistrer la dépense <b>${esc($('#d-type').value)}</b> de <b>${money(mt.get())}</b> à la date du <b>${dfr($('#d-date').value)}</b> ?`))) return;
        try { await post('/resto/depenses', { date: $('#d-date').value, type: $('#d-type').value, montant: mt.get(), motif: $('#d-motif').value }); ok('Dépense enregistrée avec succès.'); $('#d-mt').value = ''; $('#d-motif').value = ''; load(); } catch (x) { err(x); }
      });
      $('[data-go]').addEventListener('click', () => load().catch(err));
      await load();
    },
  };

  // ================= FERMETURE DE CAISSE =================
  Pages['/resto/caisse'] = {
    title: 'Fermeture de caisse', back: '/resto',
    async render(el, params) {
      el.innerHTML = `<div class="card" style="max-width:660px;margin:0 auto">
        <div class="date-label" id="k-dl" style="text-transform:none"></div>
        <div class="toolbar" style="justify-content:flex-end;margin-top:6px"><div class="field"><label>Date de session</label><input class="input" type="date" id="k-date" value="${params.date || today()}" max="${today()}"></div></div>
        <div id="k-body"></div></div>`;
      let premier = !params.date;
      const line = (lbl, v, color, signe = '') => `<div class="kv"><span style="font-weight:700;font-size:12.5px;color:${color}">${signe ? `<span class="sg">${signe}</span>` : ''}${lbl}</span><span class="val" style="background:#fff;border:1px solid var(--line);color:${color}">${money(v)}</span></div>`;
      const load = async () => {
        const date = $('#k-date').value;
        $('#k-dl').textContent = 'Session du ' + dlong(date);
        const s = await get('/resto/caisse?date=' + date);
        if (premier && s.aFermer && s.aFermer.date < date && !s.existe) { premier = false; $('#k-date').value = s.aFermer.date; toast(`Caisse à fermer : ${dfr(s.aFermer.date)}.`); return load(); }
        premier = false;
        const f = s.existe;
        const V = f ? { dv: f.dernier_versement, ventes: f.total_ventes, nb: f.nb_tickets, dep: f.depenses, av: f.a_verser } : { dv: s.dernierVersement, ventes: s.totalVentes, nb: s.nbTickets, dep: s.depenses, av: s.aVerser };
        const vide = !s.nbTickets && !s.nbDepenses;
        $('#k-body').innerHTML = `
          ${f ? `<div class="notice ok">${ic('lock')}<div>Caisse fermée le ${dfr(f.date_enreg)} à ${hm(f.heure)} par ${esc(f.agent || '')}.</div></div>` : `
          <div class="card-title">${ic('list')} Avant de fermer la caisse :</div>
          <div class="steps">
            <div class="step ${s.nbTickets ? 'ok' : 'opt'}"><span class="st-ic">${s.nbTickets ? '✓' : '•'}</span><div><b>1. Les ventes de la journée</b><small>${s.nbTickets} ticket(s) · ${money(s.totalVentes)} F</small></div><a class="btn sec sm" href="#/resto/tickets">Tickets</a></div>
            <div class="step opt"><span class="st-ic">•</span><div><b>2. Les dépenses (s'il y en a)</b><small>${s.nbDepenses ? `${s.nbDepenses} dépense(s) · ${money(s.depenses)} F` : 'Aucune dépense ce jour'}</small></div><a class="btn sec sm" href="#/resto/depenses?date=${date}">Dépenses</a></div>
          </div>`}
          <div class="card-title">${ic('report')} Situation de la journée</div>
          ${line('MONTANT DU DERNIER VERSEMENT', V.dv, '#888')}
          ${line(`MONTANT TOTAL VENTES DU JOUR (${V.nb} ticket${V.nb > 1 ? 's' : ''})`, V.ventes, '#7b1fe0', '+')}
          ${!f && s.totalVentes ? `<div class="muted" style="margin:-4px 0 6px 24px">dont Espèce ${money(s.parMode.ESPECE)} · Wave ${money(s.parMode.WAVE)} · OM ${money(s.parMode.OM)}</div>` : ''}
          ${line('TOTAL DÉPENSES', V.dep, '#0f8a8a', '−')}
          <div class="a-verser"><span>MONTANT TOTAL À VERSER AUJOURD'HUI</span><b>${money(V.av)}</b></div>
          <div class="card-title" style="margin-top:14px">${ic('wallet')} Répartition du versement</div>
          <div class="repartition rep3">
            ${['wave', 'om', 'espece'].map((k) => `<div class="field"><label>${{ wave: 'Wave', om: 'Orange Money (OM)', espece: 'Espèce' }[k]}</label>${f ? `<span class="val">${money(f[k])}</span>` : `<input class="input" id="k-${k}" ${vide ? 'disabled' : ''}>`}</div>`).join('')}
          </div>
          ${f ? '' : `<div class="row" style="justify-content:flex-end;margin:-4px 0 8px"><button class="btn sec sm" id="k-auto" ${vide ? 'disabled' : ''}>${ic('wallet')} Reste en espèces</button></div>`}
          <div class="kv"><span style="font-weight:700">TOTAL VERSÉ</span><b id="k-verse">${money(f ? f.verse : 0)}</b></div>
          <div class="ecart" id="k-ecart"></div>
          ${!f && vide ? `<div class="notice" style="margin-top:12px">${ic('info')}<div>Aucune vente ni dépense pour cette date : rien à fermer.</div></div>` : ''}
          <div class="btn-bar">${f ? (adminOnly() ? `<button class="btn red" id="k-reo">${ic('refresh')} Rouvrir la caisse</button>` : '')
            : `<button class="btn sec" id="k-act">${ic('refresh')} Actualiser</button><button class="btn lg" id="k-val" ${vide ? 'disabled' : ''}>${ic('check')} Valider la fermeture</button>`}</div>`;
        const majEcart = (verse) => { const d = V.av - verse; const e = $('#k-ecart'); e.className = 'ecart ' + (d === 0 ? 'ok' : 'ko'); e.textContent = d === 0 ? '✓ Le versement correspond au montant à verser' : d > 0 ? `Écart : il manque ${money(d)}` : `Écart : excédent de ${money(-d)}`; };
        if (!f) {
          // Pré-remplissage selon les modes de paiement des tickets
          const R = { wave: s.parMode.WAVE, om: s.parMode.OM, espece: Math.max(0, s.aVerser - s.parMode.WAVE - s.parMode.OM) };
          const tot = () => R.wave + R.om + R.espece;
          const inp = {};
          const maj = () => { $('#k-verse').textContent = money(tot()); majEcart(tot()); };
          for (const k of ['wave', 'om', 'espece']) { inp[k] = moneyInput($('#k-' + k), (v) => { R[k] = v; maj(); }); inp[k].set(R[k]); }
          maj();
          $('#k-auto').addEventListener('click', () => { R.espece = Math.max(0, V.av - R.wave - R.om); inp.espece.set(R.espece); maj(); });
          $('#k-act').addEventListener('click', () => load().catch(err));
          $('#k-val').addEventListener('click', async () => {
            const d = V.av - tot();
            if (!(await confirm(`Voulez-vous fermer la caisse du restaurant du <b>${dfr(date)}</b> ?<br><br>Montant à verser : <b>${money(V.av)}</b><br>Wave : <b>${money(R.wave)}</b> · OM : <b>${money(R.om)}</b> · Espèce : <b>${money(R.espece)}</b><br>Total versé : <b>${money(tot())}</b>
              ${d ? `<br><span style="color:var(--red);font-weight:700">Écart de ${money(Math.abs(d))} (${d > 0 ? 'manquant' : 'excédent'})</span>` : ''}<br><br><span class="muted">Après la fermeture, aucune vente ni dépense ne pourra être enregistrée à cette date.</span>`))) return;
            try { await post('/resto/caisse', { date, ...R }); ok('Caisse fermée avec succès.'); load(); } catch (x) { err(x); }
          });
        } else {
          majEcart(f.verse);
          if ($('#k-reo')) $('#k-reo').addEventListener('click', async () => {
            if (!(await confirm('Voulez-vous rouvrir la caisse de cette date ?', { danger: true }))) return;
            try { await del('/resto/caisse/' + f.id); ok('Caisse rouverte avec succès.'); load(); } catch (x) { err(x); }
          });
        }
      };
      $('#k-date').addEventListener('change', () => load().catch(err));
      await load();
    },
  };

  // ================= BILANS =================
  Pages['/resto/bilans'] = {
    title: 'Bilans des ventes', back: '/resto',
    async render(el) {
      const presets = [["Aujourd'hui", 1], ['7 jours', 7], ['Ce mois', 'm'], ['30 jours', 30], ['12 mois', 365]];
      el.innerHTML = `<div class="card"><div class="toolbar" style="margin:0">
          <div class="presets">${presets.map(([l, v], i) => `<button data-pr="${v}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div><div class="spacer"></div>
          <div class="field"><label>Du</label><input class="input" type="date" name="du" value="${today()}"></div>
          <div class="field"><label>Au</label><input class="input" type="date" name="au" value="${today()}"></div>
          <button class="btn" data-go>${ic('search')} Afficher</button></div></div>
        <div id="b-best"></div>
        <div class="kpis" id="b-kpi"></div>
        <div class="stats-grid">
          <div class="card full"><div class="card-title">${ic('chart')} Ventes par jour</div><div class="chart-box"><canvas id="b-jour"></canvas></div><div id="b-jour-d"></div></div>
          <div class="card"><div class="card-title">${ic('report')} Plats les plus vendus (quantité)</div><div class="chart-box tall"><canvas id="b-top"></canvas></div><div id="b-top-d"></div></div>
          <div class="card"><div class="card-title">${ic('wallet')} Encaissements par mode de paiement</div><div class="chart-box tall"><canvas id="b-mode"></canvas></div><div id="b-mode-d"></div></div>
          <div class="card"><div class="card-title">${ic('list')} Ventes par catégorie</div><div class="tbl-wrap auto" id="b-cat"></div></div>
          <div class="card"><div class="card-title">${ic('clock')} Ventes par heure</div><div class="chart-box"><canvas id="b-h"></canvas></div></div>
          <div class="card full"><div class="card-title">${ic('plus')} Accompagnements les plus vendus</div><div class="tbl-wrap auto" id="b-acc"></div></div>
          <div class="card full"><div class="card-title">${ic('box')} Consommation des ressources sur la période</div><div class="tbl-wrap auto" id="b-conso"></div></div>
        </div>`;
      const load = async () => {
        const d = await get(`/resto/bilan?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        const k = d.kpi;
        const best = d.top.find((x) => !/boisson|accompagnement/i.test(x.categorie || '')) || d.top[0];
        $('#b-best').innerHTML = best ? `<div class="best"><div class="best-ic">${ic('report')}</div><div><small>Plat le plus vendu ${d.du === d.au ? `le ${dfr(d.du)}` : `du ${dfr(d.du)} au ${dfr(d.au)}`}</small>
          <b>${esc(best.nom)}</b><span>${qty(best.qte)} plat(s) vendu(s) · ${money(best.ca)} F</span></div></div>` : '';
        const kpi = (l, v, s, i, c) => `<div class="kpi"><div class="kpi-ic ${c}">${ic(i)}</div><div><small>${l}</small><b>${v}</b><span>${s}</span></div></div>`;
        $('#b-kpi').innerHTML = kpi("Chiffre d'affaires", money(k.ca), `${k.tickets} ticket(s)`, 'cart', 'c1') + kpi('Plats vendus', qty(k.plats), `Panier moyen ${money(k.panier)} F`, 'report', 'c4')
          + kpi('Dépenses', money(k.depenses), `Résultat ${money(k.net)} F`, 'wallet', 'c5') + kpi('Achats de stock', money(k.appro), 'Approvisionnements', 'truck', 'c3');
        const lab = d.jours.map((x) => x.d.slice(8, 10) + '/' + x.d.slice(5, 7));
        Charts.combo($('#b-jour'), lab, [{ label: 'Ventes', data: d.jours.map((x) => x.ca), color: Charts.C.s1 }, { label: 'Dépenses', data: d.jours.map((x) => x.depenses), color: Charts.C.s3 }]);
        $('#b-jour-d').innerHTML = Charts.dataTable([{ t: 'Date', f: (r) => dfr(r.d) }, { t: 'Tickets', r: 1, f: (r) => r.tickets }, { t: 'Ventes', r: 1, f: (r) => money(r.ca) }, { t: 'Dépenses', r: 1, f: (r) => money(r.depenses) }], d.jours);
        const top = d.top.slice(0, 10);
        Charts.combo($('#b-top'), top.map((x) => (x.nom.length > 20 ? x.nom.slice(0, 19) + '…' : x.nom)), [{ label: 'Plats vendus', data: top.map((x) => x.qte), color: Charts.C.s2 }], { horizontal: true, unit: '' });
        $('#b-top-d').innerHTML = Charts.dataTable([{ t: 'Plat', f: (r) => esc(r.nom) }, { t: 'Qté', r: 1, f: (r) => r.qte }, { t: 'Montant', r: 1, f: (r) => money(r.ca) }], d.top);
        const ml = Object.keys(MODES).map((x) => MODES[x]), mv = Object.keys(MODES).map((x) => d.parMode[x]);
        Charts.donut($('#b-mode'), ml, mv, [Charts.C.s3, Charts.C.s1, Charts.C.s2]);
        $('#b-mode-d').innerHTML = Charts.dataTable([{ t: 'Mode', f: (r) => r[0] }, { t: 'Montant', r: 1, f: (r) => money(r[1]) }], ml.map((l, i) => [l, mv[i]]));
        table($('#b-cat'), [{ t: 'Catégorie', f: (r) => `<b>${esc(r.categorie)}</b>` }, { t: 'Plats', r: 1, f: (r) => r.qte }, { t: 'Montant', r: 1, f: (r) => money(r.ca) },
          { t: '%', r: 1, f: (r) => (k.ca ? Math.round((r.ca / k.ca) * 100) + ' %' : '') }], d.categories, { empty: 'Aucune vente.' });
        table($('#b-acc'), [{ t: 'Accompagnement', f: (r) => `<b>${esc(r.nom)}</b>` }, { t: 'Avec un plat', r: 1, f: (r) => r.avec }, { t: 'Vendu seul', r: 1, f: (r) => r.seul },
          { t: 'Total', r: 1, f: (r) => `<b>${r.qte}</b>` }, { t: 'Montant', r: 1, f: (r) => money(r.ca) }], d.accomps || [], { empty: 'Aucun accompagnement vendu sur la période.' });
        const hs = d.heures;
        Charts.combo($('#b-h'), hs.map((x) => x.h + 'h'), [{ label: 'Ventes', data: hs.map((x) => x.ca), color: Charts.C.s7 }]);
        table($('#b-conso'), [{ t: 'Ressource', f: (r) => `<b>${esc(r.nom)}</b>` }, { t: 'Sorties', r: 1, f: (r) => unites(r.sortie, r.unite) },
          { t: 'Plats correspondants', r: 1, f: (r) => (r.ppu ? qty(Math.round(r.sortie * r.ppu)) : '—') }, { t: 'Entrées (appro)', r: 1, f: (r) => unites(r.entree, r.unite) },
          { t: 'Coût des achats', r: 1, f: (r) => money(r.cout) }], d.conso);
      };
      $$('[data-pr]').forEach((b) => b.addEventListener('click', () => {
        $$('[data-pr]').forEach((x) => x.classList.remove('on')); b.classList.add('on');
        const v = b.dataset.pr; $('[name=au]').value = today();
        $('[name=du]').value = v === 'm' ? firstOfMonth() : addDays(today(), -(Number(v) - 1));
        load().catch(err);
      }));
      $('[data-go]').addEventListener('click', () => { $$('[data-pr]').forEach((x) => x.classList.remove('on')); load().catch(err); });
      await load();
    },
  };

  Pages['/resto/bilans/caisse'] = {
    title: 'Bilans fermeture caisse', back: '/resto',
    async render(el) {
      el.innerHTML = `<div class="toolbar"><div class="field"><label>Du</label><input class="input" type="date" name="du" value="${firstOfMonth()}"></div>
        <div class="field"><label>Au</label><input class="input" type="date" name="au" value="${today()}"></div><button class="btn" data-go>${ic('search')} Afficher</button></div>
        <div class="tbl-wrap tall" id="bc"></div><div class="stats" id="bc-t" style="margin-top:14px"></div>`;
      const load = async () => {
        const rows = await get(`/resto/caisse/bilan?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        table($('#bc'), [{ t: 'Date', f: (r) => `<b>${dfr(r.date)}</b>`, first: 1 }, { t: 'Tickets', r: 1, f: (r) => r.nb_tickets }, { t: 'Ventes', r: 1, f: (r) => money(r.total_ventes) },
          { t: 'Dépenses', r: 1, f: (r) => money(r.depenses) }, { t: 'À verser', r: 1, f: (r) => money(r.a_verser) }, { t: 'Wave', r: 1, f: (r) => money(r.wave) }, { t: 'OM', r: 1, f: (r) => money(r.om) },
          { t: 'Espèce', r: 1, f: (r) => money(r.espece) }, { t: 'Versé', r: 1, f: (r) => `<b>${money(r.verse)}</b>` },
          { t: 'Écart', r: 1, f: (r) => `<b style="color:${r.ecart ? 'var(--red)' : 'inherit'}">${money(r.ecart)}</b>` }, { t: 'Heure', f: (r) => hm(r.heure) }, { t: 'Agent', f: (r) => esc(r.agent || '') }],
        rows, { green: 1, empty: 'Aucune fermeture sur la période.',
          foot: ['Total', sum(rows, 'nb_tickets'), money(sum(rows, 'total_ventes')), money(sum(rows, 'depenses')), money(sum(rows, 'a_verser')), money(sum(rows, 'wave')), money(sum(rows, 'om')), money(sum(rows, 'espece')), money(sum(rows, 'verse')), money(sum(rows, 'ecart')), '', ''] });
        $('#bc-t').innerHTML = `<div class="stat"><small>Total versé</small><b class="n">${money(sum(rows, 'verse'))}</b></div><div class="stat"><small>Total ventes</small><b>${money(sum(rows, 'total_ventes'))}</b></div>
          <div class="stat"><small>Total dépenses</small><b class="r">${money(sum(rows, 'depenses'))}</b></div><div class="stat"><small>Total écarts</small><b class="r">${money(sum(rows, 'ecart'))}</b></div>`;
      };
      $('[data-go]').addEventListener('click', () => load().catch(err));
      await load();
    },
  };

  // ================= PARAMÈTRES DU RESTAURANT =================
  Pages['/resto/parametres'] = {
    title: 'Paramètres du restaurant', back: '/resto', role: 'admin',
    async render(el) {
      const [res, I] = await Promise.all([get('/resto/ressources'), get('/resto/info')]);
      el.innerHTML = `<div class="card"><div class="card-title">${ic('box')} Ressources du stock et rendement</div>
          <p class="muted" style="margin-top:0">Indiquez combien de plats on peut servir avec une unité. Laissez vide pour une gestion manuelle (charbon).</p>
          <div class="tbl-wrap auto"><table class="tbl"><thead><tr><th>Ressource</th><th>Unité</th><th class="r">Plats par unité</th><th class="r">Seuil d'alerte</th><th class="r">Prix d'achat / unité</th><th></th></tr></thead><tbody>
          ${res.map((r) => `<tr data-code="${r.code}"><td><input class="input" data-f="nom" value="${esc(r.nom)}"></td><td><input class="input" data-f="unite" value="${esc(r.unite)}" style="width:90px"></td>
            <td><input class="input right" data-f="ppu" value="${r.ppu ?? ''}" placeholder="manuel" style="width:100px"></td><td><input class="input right" data-f="seuil" value="${r.seuil}" style="width:90px"></td>
            <td><input class="input right" data-f="prix_unite" value="${r.prix_unite}" style="width:120px"></td><td><button class="btn sm" data-save>${ic('check')}</button></td></tr>`).join('')}</tbody></table></div></div>
        <div class="card"><div class="card-title">${ic('print')} Reçu de vente</div>
          <div class="grid2 stack-sm">
            <div class="field"><label>Nom du restaurant</label><input class="input" data-p="resto_nom" value="${esc(I.nom)}"></div>
            <div class="field"><label>Téléphone</label><input class="input" data-p="resto_telephone" value="${esc(I.telephone)}"></div>
            <div class="field"><label>Adresse</label><input class="input" data-p="resto_adresse" value="${esc(I.adresse)}"></div>
            <div class="field"><label>Message en bas du reçu</label><input class="input" data-p="resto_message" value="${esc(I.message)}"></div>
            <div class="field"><label>Format du N° de reçu</label><input class="input" data-p="resto_format_ticket" value="${esc(I.format)}"><small class="muted">{AA} année, {N5} numéro sur 5 chiffres (ex : T26-00042)</small></div>
            <div class="field"><label>Vente si stock insuffisant</label><select class="input" data-p="resto_bloquer_stock"><option value="oui" ${I.bloquerStock ? 'selected' : ''}>Bloquer la vente</option><option value="non" ${I.bloquerStock ? '' : 'selected'}>Autoriser (stock négatif)</option></select></div>
          </div><div class="btn-bar"><button class="btn" id="p-save">${ic('check')} Enregistrer</button></div></div>`;
      $$('[data-save]').forEach((b) => b.addEventListener('click', async () => {
        const tr = b.closest('tr'); const v = {}; $$('[data-f]', tr).forEach((i) => (v[i.dataset.f] = i.value));
        if (!(await confirm(`Enregistrer les paramètres de <b>${esc(v.nom)}</b> ?`))) return;
        try { await put('/resto/ressources/' + tr.dataset.code, { ...v, manuel: v.ppu === '' }); ok('Ressource enregistrée avec succès.'); } catch (x) { err(x); }
      }));
      $('#p-save').addEventListener('click', async () => {
        if (!(await confirm('Enregistrer les paramètres du reçu ?'))) return;
        try { for (const i of $$('[data-p]')) await put('/admin/parametres', { cle: i.dataset.p, valeur: i.value }); window.RestoUtil.resetInfo(); ok('Paramètres enregistrés avec succès.'); } catch (x) { err(x); }
      });
    },
  };
})();
