/* ========================================================================= COMMENTAIRES-DEBUTANT
   public/js/resto2.js — RESTAURANT : MENUS, STOCK, DÉPENSES, CAISSE, BILANS,
                         PARAMÈTRES ET IMPRIMANTE
   (même principe que pages.js ; API dans src/routes/resto.js)
   ========================================================================= */
/* ===== RESTO DU FORESTIER : menus, stock, dépenses, caisse, bilans, paramètres ===== */
(() => {
  const { $, $$, esc, ic, get, post, put, del, n, money, qty, today, addDays, dfr, dlong, hm, toast, ok, err, modal, alert, confirm, table, sum, moneyInput, firstOfMonth } = UI;
  const go = (...a) => App.go(...a);
  const adminOnly = () => App.isAdmin();
  const { unites, MODES } = window.RestoUtil;
  // Répartition du versement à la fermeture (ordre d'affichage)
  const PAIE = [['espece', 'Espèces'], ['wave', 'Wave'], ['om', 'Orange Money (OM)'], ['momo', 'MoMo'], ['flooz', 'Flooz']];
  const TYPES_MVT = { APPRO: 'Approvisionnement', VENTE: 'Vente', ANNULATION: 'Annulation ticket', FIN_SAC: 'Sac terminé', AJUSTEMENT: 'Ajustement inventaire' };

  // ================= MENUS =================
  // MENUS (#/resto/menus) : onglets Menu du jour / Menu fixe / Tous / Accompagnements.
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
      // Fiche d'un plat ou d'un accompagnement (prix, stock consommé, accompagnements proposés).
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
  // STOCK DU RESTAURANT (#/resto/stock) : une carte par article.
  Pages['/resto/stock'] = {
    title: 'Stock du restaurant', back: '/resto',
    async render(el) {
      const load = async () => {
        const res = await get('/resto/ressources');
        const mv = await get(`/resto/mouvements?du=${addDays(today(), -6)}&au=${today()}`);
        el.innerHTML = `<div class="notice info">${ic('info')}<div>Le stock diminue automatiquement à chaque vente selon les plats vendus (1 sac de riz ≈ ${qty((res.find((r) => r.code === 'RIZ') || {}).ppu || 80)} plats, etc.).
          Le <b>charbon</b> se gère à la main : cliquez sur « Un sac est fini » quand un sac est terminé.</div></div>
          ${adminOnly() ? `<div class="row" style="justify-content:flex-end;margin:-4px 0 12px"><a class="btn sm" href="#/resto/parametres">${ic('plus')} Ajouter / paramétrer un article</a></div>` : ''}
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
  // MOUVEMENTS DE STOCK (#/resto/stock/mouvements).
  Pages['/resto/stock/mouvements'] = {
    pdf: true,
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
  // DÉPENSES DU RESTAURANT (#/resto/depenses).
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
  // FERMETURE DE CAISSE DU RESTAURANT (#/resto/caisse).
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
          ${!f && s.totalVentes ? `<div class="muted" style="margin:-4px 0 6px 24px">dont ${PAIE.filter(([k]) => s.parMode[k.toUpperCase()]).map(([k, l]) => `${l} ${money(s.parMode[k.toUpperCase()])}`).join(' · ')}</div>` : ''}
          ${line('TOTAL DÉPENSES', V.dep, '#0f8a8a', '−')}
          <div class="a-verser"><span>MONTANT TOTAL À VERSER AUJOURD'HUI</span><b>${money(V.av)}</b></div>
          <div class="card-title" style="margin-top:14px">${ic('wallet')} Répartition du versement</div>
          <div class="repartition rep5">
            ${PAIE.map(([k, l]) => `<div class="field"><label>${l}</label>${f ? `<span class="val">${money(f[k])}</span>` : `<input class="input" id="k-${k}" ${vide ? 'disabled' : ''}>`}</div>`).join('')}
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
          const R = {};
          for (const [k] of PAIE) R[k] = k === 'espece' ? 0 : s.parMode[k.toUpperCase()] || 0;
          const autres = () => PAIE.reduce((t, [k]) => t + (k === 'espece' ? 0 : R[k]), 0);
          R.espece = Math.max(0, s.aVerser - autres());
          const tot = () => PAIE.reduce((t, [k]) => t + R[k], 0);
          const inp = {};
          const maj = () => { $('#k-verse').textContent = money(tot()); majEcart(tot()); };
          for (const [k] of PAIE) { inp[k] = moneyInput($('#k-' + k), (v) => { R[k] = v; maj(); }); inp[k].set(R[k]); }
          maj();
          $('#k-auto').addEventListener('click', () => { R.espece = Math.max(0, V.av - autres()); inp.espece.set(R.espece); maj(); });
          $('#k-act').addEventListener('click', () => load().catch(err));
          $('#k-val').addEventListener('click', async () => {
            const d = V.av - tot();
            if (!(await confirm(`Voulez-vous fermer la caisse du restaurant du <b>${dfr(date)}</b> ?<br><br>Montant à verser : <b>${money(V.av)}</b><br>${PAIE.map(([k, l]) => `${l} : <b>${money(R[k])}</b>`).join(' · ')}<br>Total versé : <b>${money(tot())}</b>
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
  // BILANS DES VENTES DU RESTAURANT (#/resto/bilans).
  Pages['/resto/bilans'] = {
    pdf: true,
    title: 'Bilans des ventes', back: '/resto',
    async render(el) {
      const presets = [["Aujourd'hui", 1], ['7 jours', 7], ['Ce mois', 'm'], ['30 jours', 30], ['12 mois', 365]];
      el.innerHTML = `<div class="card"><div class="toolbar" style="margin:0">
          <div class="presets">${presets.map(([l, v], i) => `<button data-pr="${v}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div><div class="spacer"></div>
          <div class="field"><label>Du</label><input class="input" type="date" name="du" value="${today()}"></div>
          <div class="field"><label>Au</label><input class="input" type="date" name="au" value="${today()}"></div>
          <button class="btn" data-go>${ic('search')} Afficher</button></div></div>
        <div class="kpis" id="b-kpi"></div>
        <div class="bilan-split">
          <div class="card"><div class="card-title">${ic('list')} Produits vendus <span class="muted" id="b-per" style="margin-left:auto;font-weight:500;font-size:12.5px"></span></div>
            <div class="search" style="margin-bottom:10px">${ic('search')}<input class="input" id="b-q" placeholder="Rechercher un produit…"></div>
            <div class="tbl-wrap tall" id="b-prod"></div></div>
          <div class="card"><div class="card-title">${ic('report')} Le plus vendu sur la période</div>
            <div class="presets" id="b-tri" style="margin-bottom:10px"><button data-k="qte" class="on">Quantité</button><button data-k="ca">Montant</button></div>
            <div id="b-best"></div>
            <div class="chart-box tall"><canvas id="b-top"></canvas></div><div id="b-top-d"></div></div>
        </div>
        <div class="card"><div class="card-title">${ic('wallet')} Point par moyen de règlement <span class="muted" id="b-mper" style="margin-left:auto;font-weight:500;font-size:12.5px"></span></div>
          <div class="pay-split"><div class="chart-box"><canvas id="b-mode"></canvas></div><div class="tbl-wrap auto" id="b-mode-t"></div></div>
          <div id="b-mode-j" style="margin-top:12px"></div></div>
        <div class="stats-grid">
          <div class="card full"><div class="card-title">${ic('chart')} Ventes par jour</div><div class="chart-box"><canvas id="b-jour"></canvas></div><div id="b-jour-d"></div></div>
          <div class="card"><div class="card-title">${ic('list')} Ventes par catégorie</div><div class="tbl-wrap auto" id="b-cat"></div></div>
          <div class="card"><div class="card-title">${ic('clock')} Ventes par heure</div><div class="chart-box"><canvas id="b-h"></canvas></div></div>
          <div class="card full"><div class="card-title">${ic('plus')} Accompagnements les plus vendus</div><div class="tbl-wrap auto" id="b-acc"></div></div>
          <div class="card full"><div class="card-title">${ic('box')} Consommation des ressources sur la période</div><div class="tbl-wrap auto" id="b-conso"></div></div>
        </div>`;
      const load = async () => {
        const d = await get(`/resto/bilan?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        const k = d.kpi;
        const per = d.du === d.au ? `le ${dfr(d.du)}` : `du ${dfr(d.du)} au ${dfr(d.au)}`;
        $('#b-per').textContent = per;
        // Liste de tous les produits vendus avec leurs montants
        const prods = d.produits || [];
        const drawProd = () => {
          const qv = ($('#b-q').value || '').toLowerCase();
          const rows = prods.filter((r) => !qv || r.nom.toLowerCase().includes(qv) || String(r.categorie).toLowerCase().includes(qv));
          const tq = sum(prods, 'qte'), tca = sum(prods, 'ca');
          table($('#b-prod'), [
            { t: 'Produit', f: (r) => `<b>${esc(r.nom)}</b>${r.accomp ? ' <span class="badge">accomp.</span>' : ''}`, cls: 'wrap', first: 1 },
            { t: 'Catégorie', hm: 1, f: (r) => esc(r.categorie) },
            { t: 'Qté', r: 1, f: (r) => `<b>${qty(r.qte)}</b>` },
            { t: 'Prix unitaire', r: 1, hm: 1, f: (r) => (r.prix_min === r.prix_max ? money(r.prix_max) : `${money(r.prix_min)} – ${money(r.prix_max)}`) },
            { t: 'Montant', r: 1, f: (r) => `<b>${money(r.ca)}</b>` },
            { t: 'Part', r: 1, f: (r) => (tca ? Math.round((r.ca / tca) * 1000) / 10 + ' %' : '—') },
          ], rows, { green: 1, empty: 'Aucun produit vendu sur la période.', foot: [`Total (${prods.length} produits)`, '', qty(tq), '', money(tca), tca ? '100 %' : ''] });
        };
        $('#b-q').oninput = drawProd;
        drawProd();
        // Le plus vendu (plats, hors boissons et accompagnements), par quantité ou par montant
        const drawBest = () => {
          const k = ($('#b-tri .on') || {}).dataset ? $('#b-tri .on').dataset.k : 'qte';
          const plats = d.top.filter((x) => !/boisson|accompagnement/i.test(x.categorie || ''));
          const liste = (plats.length ? plats : d.top).slice().sort((a, b) => b[k] - a[k] || b.qte - a.qte);
          const best = liste[0];
          $('#b-best').innerHTML = best ? `<div class="best"><div class="best-ic">${ic('report')}</div><div><small>Plat le plus vendu ${per}</small>
            <b>${esc(best.nom)}</b><span>${qty(best.qte)} plat(s) vendu(s) · ${money(best.ca)} F</span></div></div>` : '<div class="empty">Aucune vente sur la période.</div>';
          const top = liste.slice(0, 10);
          Charts.combo($('#b-top'), top.map((x) => (x.nom.length > 20 ? x.nom.slice(0, 19) + '…' : x.nom)), [{ label: k === 'qte' ? 'Plats vendus' : 'Montant', data: top.map((x) => x[k]), color: Charts.C.s2 }], { horizontal: true, unit: k === 'qte' ? '' : ' F' });
          $('#b-top-d').innerHTML = Charts.dataTable([{ t: 'Rang', f: (r, i) => i + 1 }, { t: 'Plat', f: (r) => esc(r.nom) }, { t: 'Qté', r: 1, f: (r) => r.qte }, { t: 'Montant', r: 1, f: (r) => money(r.ca) }], liste);
        };
        $$('#b-tri [data-k]').forEach((b) => { b.onclick = () => { $$('#b-tri [data-k]').forEach((x) => x.classList.toggle('on', x === b)); drawBest(); }; });
        drawBest();
        const kpi = (l, v, s, i, c) => `<div class="kpi"><div class="kpi-ic ${c}">${ic(i)}</div><div><small>${l}</small><b>${v}</b><span>${s}</span></div></div>`;
        $('#b-kpi').innerHTML = kpi("Chiffre d'affaires", money(k.ca), `${k.tickets} ticket(s)`, 'cart', 'c1') + kpi('Plats vendus', qty(k.plats), `Panier moyen ${money(k.panier)} F`, 'report', 'c4')
          + kpi('Dépenses', money(k.depenses), `Résultat ${money(k.net)} F`, 'wallet', 'c5') + kpi('Achats de stock', money(k.appro), 'Approvisionnements', 'truck', 'c3');
        const lab = d.jours.map((x) => x.d.slice(8, 10) + '/' + x.d.slice(5, 7));
        Charts.combo($('#b-jour'), lab, [{ label: 'Ventes', data: d.jours.map((x) => x.ca), color: Charts.C.s1 }, { label: 'Dépenses', data: d.jours.map((x) => x.depenses), color: Charts.C.s3 }]);
        $('#b-jour-d').innerHTML = Charts.dataTable([{ t: 'Date', f: (r) => dfr(r.d) }, { t: 'Tickets', r: 1, f: (r) => r.tickets }, { t: 'Ventes', r: 1, f: (r) => money(r.ca) }, { t: 'Dépenses', r: 1, f: (r) => money(r.depenses) }], d.jours);
        // Point par moyen de règlement (jour ou période)
        $('#b-mper').textContent = per;
        const md = d.modes || Object.keys(MODES).map((m) => ({ mode: m, tickets: 0, total: d.parMode[m] || 0 }));
        const COUL = [Charts.C.s3, Charts.C.s1, Charts.C.s2, Charts.C.s4, Charts.C.s7];
        Charts.donut($('#b-mode'), md.map((x) => MODES[x.mode] || x.mode), md.map((x) => x.total), COUL);
        const tT = sum(md, 'total'), tN = sum(md, 'tickets');
        table($('#b-mode-t'), [
          { t: 'Moyen de règlement', f: (r, i) => `<span class="dot" style="background:${COUL[i]}"></span><b>${esc(MODES[r.mode] || r.mode)}</b>` },
          { t: 'Tickets', r: 1, f: (r) => r.tickets }, { t: 'Montant', r: 1, f: (r) => `<b>${money(r.total)}</b>` },
          { t: 'Part', r: 1, f: (r) => (tT ? Math.round((r.total / tT) * 1000) / 10 + ' %' : '—') },
        ], md, { green: 1, foot: ['Total encaissé', tN, money(tT), tT ? '100 %' : ''] });
        const mj = d.modesJours || [];
        $('#b-mode-j').innerHTML = mj.length > 1 ? `<div class="card-title" style="font-size:14px">${ic('list')} Détail par jour</div><div class="tbl-wrap" id="b-mode-jt"></div>` : '';
        if (mj.length > 1) table($('#b-mode-jt'), [
          { t: 'Date', f: (r) => `<b>${dfr(r.d)}</b>`, first: 1 }, { t: 'Tickets', r: 1, f: (r) => r.tickets },
          ...Object.keys(MODES).map((m) => ({ t: MODES[m], r: 1, f: (r) => money(r[m] || 0) })),
          { t: 'Total', r: 1, f: (r) => `<b>${money(r.total)}</b>` },
        ], mj, { green: 1, foot: ['Total', sum(mj, 'tickets'), ...Object.keys(MODES).map((m) => money(sum(mj, (r) => r[m] || 0))), money(sum(mj, 'total'))] });
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

  // BILANS FERMETURE CAISSE DU RESTAURANT.
  Pages['/resto/bilans/caisse'] = {
    pdf: true,
    title: 'Bilans fermeture caisse', back: '/resto',
    async render(el) {
      el.innerHTML = `<div class="toolbar"><div class="field"><label>Du</label><input class="input" type="date" name="du" value="${firstOfMonth()}"></div>
        <div class="field"><label>Au</label><input class="input" type="date" name="au" value="${today()}"></div><button class="btn" data-go>${ic('search')} Afficher</button></div>
        <div class="tbl-wrap tall" id="bc"></div><div class="stats" id="bc-t" style="margin-top:14px"></div>`;
      const load = async () => {
        const rows = await get(`/resto/caisse/bilan?du=${$('[name=du]').value}&au=${$('[name=au]').value}`);
        table($('#bc'), [{ t: 'Date', f: (r) => `<b>${dfr(r.date)}</b>`, first: 1 }, { t: 'Tickets', r: 1, f: (r) => r.nb_tickets }, { t: 'Ventes', r: 1, f: (r) => money(r.total_ventes) },
          { t: 'Dépenses', r: 1, f: (r) => money(r.depenses) }, { t: 'À verser', r: 1, f: (r) => money(r.a_verser) }, { t: 'Wave', r: 1, f: (r) => money(r.wave) }, { t: 'OM', r: 1, f: (r) => money(r.om) }, { t: 'MoMo', r: 1, f: (r) => money(r.momo) }, { t: 'Flooz', r: 1, f: (r) => money(r.flooz) },
          { t: 'Espèces', r: 1, f: (r) => money(r.espece) }, { t: 'Versé', r: 1, f: (r) => `<b>${money(r.verse)}</b>` },
          { t: 'Écart', r: 1, f: (r) => `<b style="color:${r.ecart ? 'var(--red)' : 'inherit'}">${money(r.ecart)}</b>` }, { t: 'Heure', f: (r) => hm(r.heure) }, { t: 'Agent', f: (r) => esc(r.agent || '') }],
        rows, { green: 1, empty: 'Aucune fermeture sur la période.',
          foot: ['Total', sum(rows, 'nb_tickets'), money(sum(rows, 'total_ventes')), money(sum(rows, 'depenses')), money(sum(rows, 'a_verser')), money(sum(rows, 'wave')), money(sum(rows, 'om')), money(sum(rows, 'momo')), money(sum(rows, 'flooz')), money(sum(rows, 'espece')), money(sum(rows, 'verse')), money(sum(rows, 'ecart')), '', ''] });
        $('#bc-t').innerHTML = `<div class="stat"><small>Total versé</small><b class="n">${money(sum(rows, 'verse'))}</b></div><div class="stat"><small>Total ventes</small><b>${money(sum(rows, 'total_ventes'))}</b></div>
          <div class="stat"><small>Total dépenses</small><b class="r">${money(sum(rows, 'depenses'))}</b></div><div class="stat"><small>Total écarts</small><b class="r">${money(sum(rows, 'ecart'))}</b></div>`;
      };
      $('[data-go]').addEventListener('click', () => load().catch(err));
      await load();
    },
  };

  // ================= PARAMÈTRES DU RESTAURANT =================
  // PARAMÈTRES DU RESTAURANT (#/resto/parametres) : articles du stock + informations du reçu.
  Pages['/resto/parametres'] = {
    title: 'Paramètres du restaurant', back: '/resto', role: 'admin',
    async render(el) {
      const [res, I] = await Promise.all([get('/resto/ressources?tous=1'), get('/resto/info')]);
      el.innerHTML = `<div class="card"><div class="card-title">${ic('box')} Articles du stock et rendement
            <button class="btn sm" id="r-add" style="margin-left:auto">${ic('plus')} Ajouter un article</button></div>
          <p class="muted" style="margin-top:0">Indiquez combien de plats on peut servir avec une unité. Laissez vide pour une gestion manuelle (charbon, gaz…).
            Décochez « Actif » pour masquer un article sans perdre son historique.</p>
          <div class="tbl-wrap auto"><table class="tbl res-tbl"><thead><tr><th>Article</th><th>Unité</th><th class="r">Plats par unité</th><th class="r">Seuil d'alerte</th><th class="r">Prix d'achat / unité</th><th class="r">Stock</th><th class="c">Actif</th><th></th></tr></thead><tbody>
          ${res.map((r) => `<tr data-code="${esc(r.code)}" class="${r.actif ? '' : 'inactif'}"><td><input class="input" data-f="nom" value="${esc(r.nom)}" style="min-width:160px"></td><td><input class="input" data-f="unite" value="${esc(r.unite)}" style="width:90px"></td>
            <td><input class="input right" data-f="ppu" value="${r.ppu ?? ''}" placeholder="manuel" style="width:100px"></td><td><input class="input right" data-f="seuil" value="${r.seuil}" style="width:90px"></td>
            <td><input class="input right" data-f="prix_unite" value="${r.prix_unite}" style="width:120px"></td>
            <td class="r"><b>${unites(r.stock, r.unite)}</b></td>
            <td class="c"><input type="checkbox" data-f="actif" ${r.actif ? 'checked' : ''} title="Actif"></td>
            <td style="white-space:nowrap"><button class="btn sm" data-save title="Enregistrer">${ic('check')}</button> <button class="btn sm red" data-del title="Supprimer">${ic('trash')}</button></td></tr>`).join('')}</tbody></table></div></div>
        <div class="card"><div class="card-title">${ic('print')} Reçu de vente <a class="link-more" href="#/resto/imprimante" style="margin-left:auto">Imprimante de cet appareil ›</a></div>
          <div class="grid2 stack-sm">
            <div class="field"><label>Nom du restaurant</label><input class="input" data-p="resto_nom" value="${esc(I.nom)}"></div>
            <div class="field"><label>Téléphone</label><input class="input" data-p="resto_telephone" value="${esc(I.telephone)}"></div>
            <div class="field"><label>Adresse</label><input class="input" data-p="resto_adresse" value="${esc(I.adresse)}"></div>
            <div class="field"><label>Message en bas du reçu</label><input class="input" data-p="resto_message" value="${esc(I.message)}"></div>
            <div class="field"><label>Format du N° de reçu</label><input class="input" data-p="resto_format_ticket" value="${esc(I.format)}"><small class="muted">{AA} année, {N5} numéro sur 5 chiffres (ex : T26-00042)</small></div>
            <div class="field"><label>Vente si stock insuffisant</label><select class="input" data-p="resto_bloquer_stock"><option value="oui" ${I.bloquerStock ? 'selected' : ''}>Bloquer la vente</option><option value="non" ${I.bloquerStock ? '' : 'selected'}>Autoriser (stock négatif)</option></select></div>
          </div><div class="btn-bar"><button class="btn" id="p-save">${ic('check')} Enregistrer</button></div></div>`;
      const recharger = () => Pages['/resto/parametres'].render(el);
      $$('[data-save]').forEach((b) => b.addEventListener('click', async () => {
        const tr = b.closest('tr'); const v = {}; $$('[data-f]', tr).forEach((i) => (v[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value));
        if (!(await confirm(`Enregistrer les paramètres de <b>${esc(v.nom)}</b> ?${v.actif ? '' : '<br><span class="muted">Article inactif : il n\'apparaîtra plus dans le stock ni dans les plats.</span>'}`))) return;
        try { await put('/resto/ressources/' + encodeURIComponent(tr.dataset.code), { ...v, manuel: v.ppu === '' }); ok('Article enregistré avec succès.'); tr.classList.toggle('inactif', !v.actif); } catch (x) { err(x); }
      }));
      $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        const tr = b.closest('tr'); const nom = $('[data-f=nom]', tr).value;
        if (!(await confirm(`Supprimer l'article <b>${esc(nom)}</b> ?<br><span class="muted">Possible seulement s'il n'a jamais été utilisé ; sinon, désactivez-le.</span>`, { danger: true }))) return;
        try { await del('/resto/ressources/' + encodeURIComponent(tr.dataset.code)); ok('Article supprimé.'); recharger(); } catch (x) { err(x); }
      }));
      $('#r-add').addEventListener('click', () => {
        const m = modal({ title: 'Nouvel article du stock', body: `
          <div class="field"><label>Nom de l'article *</label><input class="input" name="nom" placeholder="ex : Carton de frites, Bidon d'huile, Sac d'attiéké"></div>
          <div class="grid2 stack-sm">
            <div class="field"><label>Unité *</label><input class="input" name="unite" placeholder="sac, carton, bidon, kg…" list="r-unites">
              <datalist id="r-unites"><option>sac</option><option>carton</option><option>bidon</option><option>kg</option><option>poulet</option><option>casier</option><option>bouteille</option></datalist></div>
            <div class="field"><label>Gestion du stock</label><select class="input" name="mode"><option value="auto">Calculée par les ventes (plats par unité)</option><option value="manuel">Manuelle (« unité finie », ex : charbon)</option></select></div>
            <div class="field" data-ppu><label>Plats par unité *</label><input class="input" name="ppu" inputmode="decimal" placeholder="ex : 40"></div>
            <div class="field"><label>Seuil d'alerte (unités)</label><input class="input" name="seuil" inputmode="decimal" value="1"></div>
            <div class="field"><label>Prix d'achat / unité</label><input class="input" name="prix_unite" inputmode="numeric" placeholder="0"></div>
            <div class="field"><label>Stock initial (unités)</label><input class="input" name="stock" inputmode="decimal" placeholder="0"></div>
          </div>
          <p class="muted" style="margin:4px 0 0">Ensuite, dans <b>Menus</b>, indiquez pour chaque plat combien de portions de cet article il consomme.</p>`,
          foot: `<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>${ic('check')} Ajouter</button>` });
        const mode = m.$('[name=mode]');
        mode.addEventListener('change', () => m.$('[data-ppu]').classList.toggle('hidden', mode.value === 'manuel'));
        m.$('[data-ok]').addEventListener('click', async () => {
          const v = Object.fromEntries(['nom', 'unite', 'ppu', 'seuil', 'prix_unite', 'stock'].map((k) => [k, m.$(`[name=${k}]`).value.trim()]));
          const manuel = mode.value === 'manuel';
          if (!v.nom) return err("Saisissez le nom de l'article.");
          if (!v.unite) return err("Saisissez l'unité.");
          if (!manuel && !(n(v.ppu) > 0)) return err('Indiquez le nombre de plats par unité (ou choisissez une gestion manuelle).');
          if (!(await confirm(`Ajouter l'article <b>${esc(v.nom)}</b> (${esc(v.unite)}) ?<br>${manuel ? 'Gestion manuelle' : `${esc(v.ppu)} plat(s) par ${esc(v.unite)}`}${n(v.stock) ? ` · stock initial ${esc(v.stock)}` : ''}`))) return;
          try { await post('/resto/ressources', { ...v, manuel, ppu: manuel ? '' : v.ppu }); ok('Article ajouté avec succès.'); m.close(); recharger(); } catch (x) { err(x); }
        });
      });
      $('#p-save').addEventListener('click', async () => {
        if (!(await confirm('Enregistrer les paramètres du reçu ?'))) return;
        try { for (const i of $$('[data-p]')) await put('/admin/parametres', { cle: i.dataset.p, valeur: i.value }); window.RestoUtil.resetInfo(); ok('Paramètres enregistrés avec succès.'); } catch (x) { err(x); }
      });
    },
  };
  // ================= IMPRIMANTE DES TICKETS (réglage par appareil) =================
  // IMPRIMANTE DES TICKETS (#/resto/imprimante) : réglage propre à chaque appareil.
  Pages['/resto/imprimante'] = {
    title: 'Imprimante des tickets', back: '/resto',
    async render(el) {
      const c = Imprimante.get();
      const MODES_IMP = [
        ['systeme', 'Imprimante installée (USB / WiFi)', "Utilise l'impression de l'appareil : imprimante installée sur le PC (USB ou WiFi) ou service d'impression Android."],
        ['bluetooth', 'Bluetooth direct', "Imprimante thermique Bluetooth (BLE) connectée directement depuis Google Chrome ou Edge, sur Android ou PC."],
        ['rawbt', 'Application RawBT (Android)', "Passe par l'application gratuite « RawBT » : imprimantes Bluetooth classiques et imprimantes WiFi / réseau (adresse IP)."],
      ];
      el.innerHTML = `<div class="card" style="max-width:760px;margin:0 auto">
          <div class="card-title">${ic('print')} Imprimante des tickets <span class="badge" style="margin-left:auto">Réglage de cet appareil</span></div>
          <p class="muted" style="margin-top:0">Chaque téléphone, tablette ou ordinateur garde son propre réglage : faites-le sur chaque appareil qui imprime des reçus.</p>
          <div class="imp-modes">${MODES_IMP.map(([v, t, d]) => `<label class="imp-mode"><input type="radio" name="imp-mode" value="${v}" ${c.mode === v ? 'checked' : ''}><div><b>${t}</b><small>${d}</small></div></label>`).join('')}</div>
          <div id="imp-detail"></div>
          <div class="grid2 stack-sm" style="margin-top:12px">
            <div class="field"><label>Largeur du papier</label><select class="input" id="imp-l"><option value="58" ${Number(c.largeur) === 58 ? 'selected' : ''}>58 mm (petite imprimante)</option><option value="80" ${Number(c.largeur) === 80 ? 'selected' : ''}>80 mm</option></select></div>
            <div class="field"><label>Nombre d'exemplaires</label><select class="input" id="imp-n">${[1, 2, 3].map((x) => `<option ${Number(c.copies) === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          </div>
          <label class="chk-line"><input type="checkbox" id="imp-auto" ${c.auto ? 'checked' : ''}> Imprimer automatiquement le reçu après chaque vente</label>
          <label class="chk-line"><input type="checkbox" id="imp-logo" ${c.logo ? 'checked' : ''}> Imprimer le logo en haut du reçu</label>
          <label class="chk-line imp-esc"><input type="checkbox" id="imp-acc" ${c.accents ? 'checked' : ''}> Imprimer les accents (é, è, à…) — décochez si l'imprimante affiche des caractères bizarres</label>
          <label class="chk-line imp-esc"><input type="checkbox" id="imp-cut" ${c.coupe ? 'checked' : ''}> Couper le papier à la fin du ticket (imprimantes avec massicot)</label>
          <div class="btn-bar"><button class="btn sec" id="imp-test">${ic('print')} Imprimer un ticket de test</button><button class="btn" id="imp-save">${ic('check')} Enregistrer</button></div>
        </div>`;
      const mode = () => ($('[name=imp-mode]:checked') || {}).value || 'systeme';
      const detail = () => {
        const m = mode();
        $$('.imp-esc').forEach((x) => x.classList.toggle('hidden', m === 'systeme'));
        const d = $('#imp-detail');
        if (m === 'systeme') d.innerHTML = `<div class="notice info">${ic('info')}<div>Installez d'abord l'imprimante sur l'appareil (pilote Windows, ou sur Android un service d'impression comme « Mopria » ou celui du fabricant).
          Au moment d'imprimer, choisissez-la dans la fenêtre d'impression, avec le format de papier ${$('#imp-l').value} mm et sans marges.</div></div>`;
        else if (m === 'bluetooth') d.innerHTML = Imprimante.btDispo()
          ? `<div class="notice info">${ic('info')}<div>Allumez l'imprimante, activez le Bluetooth de l'appareil, puis cliquez sur <b>Rechercher l'imprimante</b> et choisissez-la dans la liste.
              <div class="row" style="margin-top:10px;gap:8px;align-items:center"><button class="btn sm" id="imp-bt">${ic('search')} Rechercher l'imprimante</button>
              ${Imprimante.get().appareil ? `<span>Imprimante : <b>${esc(Imprimante.get().appareil)}</b> ${Imprimante.connecte() ? '<span class="badge">connectée</span>' : '<span class="badge amber">se reconnecte à l\'impression</span>'}</span>
              <button class="btn sm sec" id="imp-btx">${ic('x')} Oublier</button>` : '<span class="muted">Aucune imprimante choisie</span>'}</div></div></div>`
          : `<div class="notice err">${ic('warn')}<div>Ce navigateur ne permet pas le Bluetooth direct (cas de l'iPhone, de Firefox et de Safari). Utilisez Google Chrome sur Android ou sur PC,
              ou choisissez « Application RawBT » sur Android.</div></div>`;
        else d.innerHTML = `<div class="notice info">${ic('info')}<div>${Imprimante.estAndroid() ? '' : '<b>Ce mode fonctionne seulement sur un téléphone ou une tablette Android.</b><br>'}
          1. Installez <b>RawBT</b> depuis le Play Store.<br>2. Dans RawBT, choisissez la connexion : <b>Bluetooth</b> (imprimante appairée) ou <b>WiFi / réseau</b> (adresse IP de l'imprimante, port 9100).<br>
          3. Faites un test d'impression ici : le ticket est envoyé à RawBT qui l'imprime.</div></div>`;
        const b = $('#imp-bt');
        if (b) b.addEventListener('click', async () => {
          try { const nom = await Imprimante.choisirBluetooth(); ok(`Imprimante « ${nom} » connectée.`); detail(); }
          catch (x) { if (!(x && x.name === 'NotFoundError')) err(x.message || x); }
        });
        const bx = $('#imp-btx');
        if (bx) bx.addEventListener('click', () => { Imprimante.deconnecter(); detail(); });
      };
      const lire = () => ({ mode: mode(), largeur: Number($('#imp-l').value), copies: Number($('#imp-n').value), auto: $('#imp-auto').checked, logo: $('#imp-logo').checked, accents: $('#imp-acc').checked, coupe: $('#imp-cut').checked });
      $$('[name=imp-mode]').forEach((r) => r.addEventListener('change', detail));
      $('#imp-l').addEventListener('change', detail);
      detail();
      $('#imp-save').addEventListener('click', async () => {
        if (!(await confirm('Enregistrer le réglage de l\'imprimante pour cet appareil ?'))) return;
        Imprimante.set(lire()); ok('Réglage de l\'imprimante enregistré.');
      });
      $('#imp-test').addEventListener('click', async () => {
        const avant = Imprimante.get(); Imprimante.set(lire());
        try {
          const I = await window.RestoUtil.info();
          await Imprimante.imprimer(Imprimante.TEST, I, window.RestoUtil.recuHtml(Imprimante.TEST, I));
          if (mode() !== 'systeme') ok('Ticket de test envoyé.');
          detail();
        } catch (x) { Imprimante.set(avant); if (!(x && x.name === 'NotFoundError')) err(x.message || x); }
      });
    },
  };
})();
