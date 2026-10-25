/* Administration, importation des données et explorateur de la base (superadmin) */
(() => {
  const { $, $$, esc, ic, get, post, put, del, api, money, ok, err, modal, confirm, table, toast } = UI;
  const go = (...a) => App.go(...a);

  Pages['/admin'] = {
    title: 'Administration', back: '/', role: 'admin',
    async render(el) {
      const t = [
        { r: '/admin/numeros', t: 'Numéros automatiques', i: 'hash', c: 'c4' },
        { r: '/admin/utilisateurs', t: 'Utilisateurs & groupes', i: 'users', c: 'c1' },
        { r: '/admin/parametres', t: 'Paramètres', i: 'gear', c: 'c9' },
        ...(App.isSuper() ? [
          { r: '/admin/import', t: 'Importation des données', i: 'upload', c: 'c2' },
          { r: '/admin/explorer', t: 'Explorateur de la BD', i: 'db', c: 'c7' },
        ] : []),
      ];
      el.innerHTML = `<div class="tiles" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${t.map((x) => `<a class="tile" href="#${x.r}"><div class="ic ${x.c}">${ic(x.i)}</div><b>${x.t}</b></a>`).join('')}</div>
        ${App.isSuper() ? `<div class="card" style="margin-top:16px"><div class="card-title">${ic('lock')} Blocage de l'application</div>
          <p class="muted" style="margin-top:0">Lorsque l'application est bloquée, seuls les super administrateurs peuvent se connecter.</p>
          <div id="blk"></div></div>` : ''}`;
      if (App.isSuper()) {
        const draw = async () => {
          const b = await get('/admin/blocage');
          $('#blk').innerHTML = `<div class="row" style="align-items:center"><span class="badge ${b.bloc ? 'red' : ''}">${b.bloc ? 'Application BLOQUÉE' : 'Application active'}</span>
            <button class="btn ${b.bloc ? '' : 'red'} sm" id="blk-b">${b.bloc ? 'Débloquer' : 'Bloquer'}</button></div>`;
          $('#blk-b').addEventListener('click', async () => {
            if (!(await confirm(b.bloc ? "Débloquer l'application ?" : "Bloquer l'application pour tous les utilisateurs (sauf super admin) ?", { danger: !b.bloc }))) return;
            try { await put('/admin/blocage', { bloc: !b.bloc }); draw(); } catch (x) { err(x); }
          });
        };
        draw();
      }
    },
  };

  // ---------- Numéros ----------
  Pages['/admin/numeros'] = {
    title: 'Numero', back: '/admin', role: 'admin',
    async render(el) {
      const d = await get('/admin/numeros');
      const cols = [['numCli', 'Num client'], ['numCmde', 'Num Cmde'], ['Numappro', 'Num Appro'], ['numprod', 'Num Produit'], ['MATRICU', 'Num Mat'], ['NumInvent', 'Num Invent (ventes)']];
      el.innerHTML = `<div class="card"><div class="card-title">${ic('hash')} Compteurs (dernier numéro utilisé)</div>
        <div class="notice info">${ic('info')}<div>Chaque compteur contient le <b>dernier numéro utilisé</b>. Le prochain document prendra ce numéro + 1. Vous pouvez le modifier (ex : remettre à 0 en début d'année).</div></div>
        <div class="tbl-wrap auto"><table class="tbl"><thead><tr>${cols.map(([, l]) => `<th class="c">${l}</th>`).join('')}</tr></thead>
        <tbody><tr>${cols.map(([k]) => `<td><input class="input right" style="min-width:80px;font-weight:700" inputmode="numeric" data-n="${k}" value="${esc(d.numero[k] ?? '0')}"></td>`).join('')}</tr></tbody></table></div></div>
        <div class="card"><div class="card-title">${ic('edit')} Format des numéros</div>
          <p class="muted" style="margin-top:0">Variables : <b>{AA}</b> année sur 2 chiffres, <b>{AAAA}</b> année complète, <b>{N}</b> numéro, <b>{N3}</b>/<b>{N4}</b>/<b>{N6}</b> numéro sur 3, 4 ou 6 chiffres (ex : 0001), <b>{L2}</b>/<b>{L3}</b> premières lettres de l'article.</p>
          <div class="grid2 stack-sm">
            <div class="field"><label>Vente journalière (prochain : <b>${esc(d.apercu.vente)}</b>)</label><input class="input" data-f="format_vente" value="${esc(d.formats.format_vente || '')}"></div>
            <div class="field"><label>Approvisionnement (prochain : <b>${esc(d.apercu.appro)}</b>)</label><input class="input" data-f="format_appro" value="${esc(d.formats.format_appro || '')}"></div>
            <div class="field"><label>Référence produit (prochain : <b>${esc(d.apercu.produit)}</b>)</label><input class="input" data-f="format_produit" value="${esc(d.formats.format_produit || '')}"></div>
            <div class="field"><label>N° client / créancier (prochain : <b>${esc(d.apercu.client)}</b>)</label><input class="input" data-f="format_client" value="${esc(d.formats.format_client || '')}"></div>
          </div>
          <p class="muted">Exemples : <code>V{AA}-{N}</code> → V26-5 · <code>{AA}-{N4}</code> → 26-0001</p></div>
        <div class="btn-bar"><button class="btn lg" id="n-save">${ic('check')} Enregistrer</button></div>`;
      $('#n-save').addEventListener('click', async () => {
        if (!(await UI.ask('Enregistrer les numéros et formats ?'))) return;
        const numero = {}, formats = {};
        $$('[data-n]').forEach((i) => (numero[i.dataset.n] = i.value));
        $$('[data-f]').forEach((i) => (formats[i.dataset.f] = i.value));
        try { await put('/admin/numeros', { numero, formats }); ok('Numéros enregistrés.'); Pages['/admin/numeros'].render(el); } catch (x) { err(x); }
      });
    },
  };

  // ---------- Paramètres ----------
  Pages['/admin/parametres'] = {
    title: 'Paramètres', back: '/admin', role: 'admin',
    async render(el) {
      const p = (await get('/admin/parametres')).reduce((a, x) => ((a[x.cle] = x.valeur), a), {});
      el.innerHTML = `<div class="card" style="max-width:560px"><div class="field"><label>Nom de l'établissement</label><input class="input" id="p-nom" value="${esc(p.nom_etablissement || '')}"></div>
        <button class="btn" id="p-save">${ic('check')} Enregistrer</button></div>`;
      $('#p-save').addEventListener('click', async () => {
        if (!(await UI.ask('Enregistrer ce paramètre ?'))) return;
        try { await put('/admin/parametres', { cle: 'nom_etablissement', valeur: $('#p-nom').value }); ok('Paramètre enregistré (rechargez la page pour voir le changement).'); } catch (x) { err(x); }
      });
    },
  };

  // ---------- Utilisateurs ----------
  Pages['/admin/utilisateurs'] = {
    title: 'Utilisateurs', back: '/admin', role: 'admin',
    async render(el) {
      el.innerHTML = `<div class="two-col"><div class="card"><div class="card-title">${ic('users')} Utilisateurs <button class="btn sm" id="u-add" style="margin-left:auto">${ic('plus')} Ajouter</button></div><div class="tbl-wrap" id="u-tbl"></div></div>
        <div class="card"><div class="card-title">${ic('list')} Groupes <button class="btn sm" id="g-add" style="margin-left:auto">${ic('plus')} Ajouter</button></div><div class="tbl-wrap" id="g-tbl"></div>
        <p class="muted">Un groupe dont le nom contient <b>SUPER</b> donne les droits super administrateur, <b>ADMIN</b> les droits administrateur. Les autres groupes sont des utilisateurs simples (caissiers).</p></div></div>`;
      let groupes = [];
      const load = async () => {
        groupes = await get('/admin/groupes');
        const users = await get('/admin/utilisateurs');
        table($('#u-tbl'), [{ t: 'Nom', f: (u) => `<b>${esc([u.Prenom, u.Nom].filter(Boolean).join(' '))}</b>` }, { t: 'Login', f: (u) => esc(u.Login) }, { t: 'Groupe', f: (u) => `<span class="badge">${esc(u.NomGroupe || '')}</span>` }],
          users, { onClick: (u) => edit(u) });
        table($('#g-tbl'), [{ t: 'Libellé', f: (g) => `<b>${esc(g.libelle)}</b>` }, { t: '', r: 1, f: (g) => (App.isSuper() ? `<button class="btn red sm" data-g="${g.id}">${ic('trash')}</button>` : '') }], groupes);
        $$('[data-g]').forEach((b) => b.addEventListener('click', async () => {
          if (!(await confirm('Supprimer ce groupe ?', { danger: true }))) return;
          try { await del('/admin/groupes/' + b.dataset.g); load(); } catch (x) { err(x); }
        }));
      };
      function edit(u) {
        const isNew = !u;
        u = u || {};
        const m = modal({ title: isNew ? 'Nouvel utilisateur' : 'Modifier utilisateur', body: `
          <div class="grid2"><div class="field"><label>Nom</label><input class="input" name="Nom" value="${esc(u.Nom || '')}"></div>
          <div class="field"><label>Prénom</label><input class="input" name="Prenom" value="${esc(u.Prenom || '')}"></div></div>
          <div class="field"><label>Login</label><input class="input" name="Login" autocapitalize="none" value="${esc(u.Login || '')}"></div>
          <div class="field"><label>Mot de passe ${isNew ? '' : '(laisser vide pour ne pas changer)'}</label><input class="input" type="password" name="mdp" autocomplete="new-password"></div>
          <div class="field"><label>Groupe</label><select class="input" name="NomGroupe">${groupes.map((g) => `<option ${g.libelle === u.NomGroupe ? 'selected' : ''}>${esc(g.libelle)}</option>`).join('')}</select></div>`,
        foot: `${!isNew ? `<button class="btn red" data-del>${ic('trash')} Supprimer</button>` : ''}<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>${ic('check')} Enregistrer</button>` });
        m.$('[data-ok]').addEventListener('click', async () => {
          if (!(await UI.ask(isNew ? 'Créer cet utilisateur ?' : 'Enregistrer les modifications de cet utilisateur ?'))) return;
          const b = {}; m.$$('input,select').forEach((i) => (b[i.name] = i.value));
          try { if (isNew) await post('/admin/utilisateurs', b); else await put('/admin/utilisateurs/' + u.id, b); ok('Utilisateur enregistré.'); m.close(); load(); } catch (x) { err(x); }
        });
        const d = m.$('[data-del]');
        if (d) d.addEventListener('click', async () => {
          if (!(await confirm(`Supprimer l'utilisateur <b>${esc(u.Login)}</b> ?`, { danger: true, okText: 'Oui' }))) return;
          try { await del('/admin/utilisateurs/' + u.id); ok('Utilisateur supprimé.'); m.close(); load(); } catch (x) { err(x); }
        });
      }
      $('#u-add').addEventListener('click', () => edit(null));
      $('#g-add').addEventListener('click', () => {
        const m = modal({ title: 'Nouveau groupe', body: `<div class="field"><label>Libellé</label><input class="input" name="l" placeholder="ex : CAISSIER"></div>`,
          foot: `<button class="btn sec" data-close>Annuler</button><button class="btn" data-ok>Enregistrer</button>` });
        m.$('[data-ok]').addEventListener('click', async () => {
          if (!(await UI.ask('Créer ce groupe ?'))) return;
          try { await post('/admin/groupes', { libelle: m.$('[name=l]').value }); ok('Groupe créé.'); m.close(); load(); } catch (x) { err(x); }
        });
      });
      await load();
    },
  };

  // ---------- IMPORTATION ----------
  Pages['/admin/import'] = {
    title: 'Importation des données', back: '/admin', role: 'superadmin',
    async render(el) {
      el.innerHTML = `<div class="card">
        <div class="card-title">${ic('download')} 1. Fichier Excel exemple à pré-remplir</div>
        <p style="margin-top:0">Téléchargez le modèle, recopiez-y vos données (une feuille par table, sans changer les titres des colonnes), puis importez-le ci-dessous.
          La feuille <b>LISEZ-MOI</b> explique comment le remplir.</p>
        <div class="row"><a class="btn" href="/api/data/modele-import.xlsx">${ic('download')} Modèle avec exemples</a>
          <a class="btn sec" href="/api/data/modele-import.xlsx?vide=1">${ic('download')} Modèle vide</a></div>
        <div id="tpl-prev" style="margin-top:12px"></div></div>
        <div class="card">
        <div class="card-title">${ic('upload')} 2. Importer les données de l'ancienne application</div>
        <div class="notice info">${ic('info')}<div>Formats acceptés :
          <ul style="margin:6px 0 0;padding-left:18px"><li><b>Script SQL</b> (.sql) contenant des instructions <code>INSERT INTO …</code> (export WinDev / HFSQL vers SQL).</li>
          <li><b>Excel</b> (.xlsx / .xls) : une feuille par table (le nom de la feuille ou les colonnes permettent de reconnaître la table).</li>
          <li><b>CSV</b> (.csv) : une table par fichier, séparateur <code>;</code> ou <code>,</code>, la 1re ligne contient les noms de colonnes.</li></ul></div></div>
        <label class="file-drop" id="i-drop">${ic('upload')}<div style="font-weight:700;margin-top:6px">Choisir un fichier</div><div class="muted" id="i-name">.sql, .xlsx, .xls, .csv</div>
          <input type="file" id="i-file" accept=".sql,.xlsx,.xls,.csv,.txt" class="hidden"></label>
        <div class="row" style="margin-top:12px;align-items:center"><button class="btn sec sm" id="i-recalc">${ic('refresh')} Recalculer les soldes des créanciers</button>
          <span class="muted">À utiliser après l'import des crédits et paiements (solde = crédits − paiements).</span></div></div>
        <div id="i-zone"></div>`;
      // Aperçu du modèle façon Excel (onglets = feuilles)
      try {
        const modele = await get('/data/modele-import');
        let cur = 0;
        const drawTpl = () => {
          const m = modele[cur];
          const L = (i) => String.fromCharCode(65 + i);
          $('#tpl-prev').innerHTML = `<div class="muted" style="margin-bottom:4px"><b style="color:var(--ink)">${esc(m.table)}</b> — ${esc(m.titre)} : ${esc(m.desc)}</div>
            <div class="xl-prev"><table><thead><tr><th class="rn"></th>${m.cols.map((c, i) => `<th class="rn" style="background:#eef1ee;color:#777">${L(i)}</th>`).join('')}</tr></thead><tbody>
              <tr><td class="rn">1</td>${m.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>
              ${m.ex.map((r, k) => `<tr><td class="rn">${k + 2}</td>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}
              <tr><td class="rn">${m.ex.length + 2}</td>${m.cols.map(() => '<td>&nbsp;</td>').join('')}</tr></tbody></table>
            <div class="xl-tabs">${modele.map((x, i) => `<button type="button" data-tab="${i}" class="${i === cur ? 'on' : ''}">${esc(x.table)}</button>`).join('')}</div></div>`;
          $$('#tpl-prev [data-tab]').forEach((b) => b.addEventListener('click', () => { cur = Number(b.dataset.tab); drawTpl(); }));
        };
        drawTpl();
      } catch {}
      let file = null, analyse = null;
      $('#i-recalc').addEventListener('click', async () => {
        if (!(await confirm('Recalculer le solde de tous les créanciers à partir des crédits et des paiements enregistrés ?'))) return;
        try { const r = await post('/data/recalcul-creances'); ok(r.comptes + ' compte(s) créancier recalculé(s).'); } catch (x) { err(x); }
      });
      $('#i-file').addEventListener('change', async (e) => {
        file = e.target.files[0];
        if (!file) return;
        $('#i-name').textContent = file.name + ' (' + Math.round(file.size / 1024) + ' Ko)';
        const fd = new FormData(); fd.append('fichier', file);
        UI.loading($('#i-zone'));
        try { analyse = await api('/data/import/analyse', { method: 'POST', body: fd }); draw(); } catch (x) { $('#i-zone').innerHTML = ''; err(x); }
      });
      function draw() {
        const z = $('#i-zone');
        if (analyse.type === 'sql') {
          const t = Object.entries(analyse.tables);
          z.innerHTML = `<div class="card"><div class="card-title">${ic('db')} Contenu du script SQL</div>
            <p class="muted">${analyse.total} instruction(s) trouvée(s), ${analyse.ignores} ignorée(s) (CREATE, INDEX…).</p>
            <div class="tbl-wrap auto"><table class="tbl"><thead><tr><th></th><th>Table</th><th class="r">Lignes à insérer</th><th>État</th></tr></thead><tbody>
            ${t.map(([k, v]) => `<tr><td><input type="checkbox" data-t="${esc(k)}" ${v.erreur ? 'disabled' : 'checked'}></td><td><b>${esc(k)}</b></td><td class="r">${v.inserts}</td>
              <td>${v.erreur ? `<span class="badge red">${esc(v.erreur)}</span>` : '<span class="badge">OK</span>'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aucune instruction INSERT trouvée.</td></tr>'}
            </tbody></table></div>${options()}</div>`;
        } else {
          const tOpts = (sel) => `<option value="">— Ne pas importer —</option>` + analyse.tables.map((t) => `<option ${t.name === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
          z.innerHTML = analyse.feuilles.map((f, fi) => `<div class="card" data-fi="${fi}">
            <div class="card-title">${ic('list')} Feuille « ${esc(f.nom)} » <span class="badge" style="margin-left:auto">${f.nbLignes} ligne(s)</span></div>
            <div class="field" style="max-width:360px"><label>Table de destination</label><select class="input" data-table>${tOpts(f.table)}</select></div>
            <div data-map></div></div>`).join('') + `<div class="card">${options()}</div>`;
          $$('[data-fi]', z).forEach((card) => {
            const f = analyse.feuilles[Number(card.dataset.fi)];
            const sel = $('[data-table]', card);
            const drawMap = () => {
              const t = analyse.tables.find((x) => x.name === sel.value);
              if (!t) { $('[data-map]', card).innerHTML = ''; return; }
              const auto = (e) => (f.table === t.name && f.mapping[e]) || t.columns.find((c) => c.toLowerCase().replace(/[^a-z0-9]/g, '') === e.toLowerCase().replace(/[^a-z0-9]/g, '')) || '';
              $('[data-map]', card).innerHTML = `<div class="tbl-wrap"><table class="tbl map-tbl"><thead><tr><th>Colonne du fichier</th><th>Colonne de la table</th><th>Exemple</th></tr></thead><tbody>
                ${f.entetes.map((e, i) => `<tr><td><b>${esc(e)}</b></td><td><select class="input" data-e="${esc(e)}"><option value="">— ignorer —</option>${t.columns.map((c) => `<option ${c === auto(e) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></td>
                <td class="muted">${esc((f.apercu[0] || [])[i] ?? '')}</td></tr>`).join('')}</tbody></table></div>`;
            };
            sel.addEventListener('change', drawMap);
            drawMap();
          });
        }
        $('#i-run').addEventListener('click', run);
      }
      const options = () => `<label class="row" style="align-items:center;margin:12px 0 4px;gap:8px"><input type="checkbox" id="i-vider" style="width:18px;height:18px"> <span><b>Vider les tables concernées avant l'import</b> (remplace les données existantes)</span></label>
        <label class="row" style="align-items:center;margin:4px 0 12px;gap:8px"><input type="checkbox" id="i-appro" checked style="width:18px;height:18px"> <span>Considérer les approvisionnements antérieurs à la dernière vente comme déjà vendus</span></label>
        <div class="btn-bar" style="justify-content:flex-start"><button class="btn lg" id="i-run">${ic('upload')} Lancer l'importation</button></div><div id="i-res"></div>`;
      async function run() {
        const opts = { vider: $('#i-vider').checked, marquerAppros: $('#i-appro').checked };
        if (analyse.type === 'sql') opts.tables = $$('[data-t]').filter((c) => c.checked).map((c) => c.dataset.t);
        else opts.feuilles = $$('[data-fi]').map((card) => ({
          nom: analyse.feuilles[Number(card.dataset.fi)].nom,
          table: $('[data-table]', card).value,
          mapping: Object.fromEntries($$('[data-e]', card).map((s) => [s.dataset.e, s.value])),
        }));
        if (!(await confirm(opts.vider ? '<b>Attention</b> : les tables concernées seront vidées avant l\'import. Continuer ?' : 'Lancer l\'importation ?', { danger: opts.vider, okText: 'Oui' }))) return;
        const fd = new FormData(); fd.append('fichier', file); fd.append('options', JSON.stringify(opts));
        const b = $('#i-run'); b.disabled = true; b.innerHTML = 'Importation en cours…';
        try {
          const r = await api('/data/import/executer', { method: 'POST', body: fd });
          const t = Object.entries(r.tables);
          $('#i-res').innerHTML = `<div class="notice ${r.erreurs.length ? '' : 'ok'}" style="margin-top:12px">${ic(r.erreurs.length ? 'warn' : 'check')}<div><b>Importation terminée.</b><br>
            ${t.map(([k, v]) => `${esc(k)} : <b>${v.ok}</b> ligne(s) importée(s)${v.ko ? `, <span style="color:var(--red)">${v.ko} en erreur</span>` : ''}`).join('<br>') || 'Aucune ligne.'}
            ${r.erreurs.length ? `<details style="margin-top:8px"><summary>Voir les erreurs (${r.erreurs.length})</summary><pre style="white-space:pre-wrap;font-size:12px">${esc(r.erreurs.join('\n'))}</pre></details>` : ''}</div></div>`;
          ok('Importation terminée.');
        } catch (x) { err(x); } finally { b.disabled = false; b.innerHTML = `${ic('upload')} Lancer l'importation`; }
      }
    },
  };

  // ---------- EXPLORATEUR DE LA BD (grille type Excel) ----------
  Pages['/admin/explorer'] = {
    title: 'Explorateur de la BD', back: '/admin', role: 'superadmin',
    async render(el, params) {
      const tables = await get('/data/tables');
      let cur = params.t || (tables[0] && tables[0].name);
      let st = { page: 1, size: 100, search: '', sort: '', dir: 'asc' };
      let data = null;
      el.innerHTML = `<div class="toolbar"><div class="spacer"></div>
          <a class="btn sec" href="/api/data/export-complet.xlsx">${ic('download')} Sauvegarde complète (Excel)</a></div>
        <div class="xl-layout"><div class="xl-tables" id="x-list"></div><div style="min-width:0">
          <div class="field xl-select"><label>Table</label><select class="input" id="x-sel"></select></div>
          <div class="toolbar">
            <div class="search" style="flex:1 1 180px">${ic('search')}<input class="input" id="x-q" placeholder="Rechercher dans la table…"></div>
            <button class="btn sm" id="x-add">${ic('plus')} Ligne</button>
            <button class="btn red sm" id="x-del" disabled>${ic('trash')} Supprimer</button>
            <a class="btn sec sm" id="x-csv">${ic('download')} CSV</a>
            <button class="btn sec sm" id="x-ref">${ic('refresh')}</button></div>
          <div class="muted" id="x-info" style="margin-bottom:6px"></div>
          <div class="tbl-wrap tall" id="x-grid"></div>
          <div class="pager" id="x-pager"></div></div></div>`;
      const drawList = () => {
        $('#x-list').innerHTML = tables.map((t) => `<a data-t="${esc(t.name)}" class="${t.name === cur ? 'active' : ''}"><span>${esc(t.name)}</span><small>${t.rows}</small></a>`).join('');
        $('#x-sel').innerHTML = tables.map((t) => `<option ${t.name === cur ? 'selected' : ''} value="${esc(t.name)}">${esc(t.name)} (${t.rows})</option>`).join('');
        $$('#x-list a').forEach((a) => a.addEventListener('click', () => open(a.dataset.t)));
      };
      $('#x-sel').addEventListener('change', (e) => open(e.target.value));
      function open(name) { cur = name; st = { page: 1, size: 100, search: '', sort: '', dir: 'asc' }; $('#x-q').value = ''; drawList(); load(); }

      async function load() {
        if (!cur) return;
        const p = new URLSearchParams({ page: st.page, size: st.size, search: st.search, sort: st.sort, dir: st.dir });
        UI.loading($('#x-grid'));
        data = await get(`/data/table/${encodeURIComponent(cur)}?${p}`);
        $('#x-csv').href = `/api/data/export/${encodeURIComponent(cur)}.csv`;
        $('#x-info').innerHTML = `<b>${esc(cur)}</b> · ${data.total} ligne(s) · ${data.columns.length} colonne(s)${data.pk ? ` · clé : <code>${esc(data.pk)}</code>` : ' · <span style="color:var(--red)">pas de clé primaire (lecture seule)</span>'}
          · <span>Cliquez sur une cellule pour la modifier (Entrée / Tab / flèches pour naviguer, collage depuis Excel accepté).</span>`;
        grid();
        const pages = Math.max(1, Math.ceil(data.total / st.size));
        $('#x-pager').innerHTML = `<span>Page ${st.page} / ${pages}</span>
          <button class="btn sec sm" data-p="-1" ${st.page <= 1 ? 'disabled' : ''}>‹ Préc.</button><button class="btn sec sm" data-p="1" ${st.page >= pages ? 'disabled' : ''}>Suiv. ›</button>
          <select class="input" style="width:auto;height:34px" id="x-size">${[50, 100, 250, 500, 1000].map((s) => `<option ${s === st.size ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
        $$('[data-p]').forEach((b) => b.addEventListener('click', () => { st.page += Number(b.dataset.p); load(); }));
        $('#x-size').addEventListener('change', (e) => { st.size = Number(e.target.value); st.page = 1; load(); });
      }

      const selRows = new Set();
      function grid() {
        selRows.clear(); $('#x-del').disabled = true;
        const cols = data.columns;
        const ro = (c) => !data.pk || c.name === data.pk || c.type === 'bytea';
        const show = (v) => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v));
        $('#x-grid').innerHTML = `<table class="xl"><thead><tr><th class="rh">#</th>${cols.map((c) => `<th data-sort="${esc(c.name)}">${esc(c.name)} ${st.sort === c.name ? (st.dir === 'asc' ? '▲' : '▼') : ''}<small>${esc(c.type)}</small></th>`).join('')}</tr></thead>
          <tbody>${data.rows.map((r, i) => `<tr data-i="${i}"><td class="rh">${(st.page - 1) * st.size + i + 1}</td>${cols.map((c, j) => `<td class="${ro(c) ? 'ro' : ''} ${r[c.name] === null ? 'null' : ''}" data-j="${j}"><div ${ro(c) ? '' : 'contenteditable="true"'} spellcheck="false">${esc(show(r[c.name]))}</div></td>`).join('')}</tr>`).join('')
          || `<tr><td colspan="${cols.length + 1}" class="empty">Table vide</td></tr>`}</tbody></table>`;
        $$('#x-grid th[data-sort]').forEach((th) => th.addEventListener('click', () => {
          const c = th.dataset.sort; st.dir = st.sort === c && st.dir === 'asc' ? 'desc' : 'asc'; st.sort = c; load();
        }));
        $$('#x-grid td.rh').forEach((td) => td.addEventListener('click', (e) => {
          const tr = td.parentElement; const i = Number(tr.dataset.i);
          if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { selRows.clear(); $$('#x-grid tr.rsel').forEach((x) => x.classList.remove('rsel')); }
          if (selRows.has(i)) { selRows.delete(i); tr.classList.remove('rsel'); } else { selRows.add(i); tr.classList.add('rsel'); }
          $('#x-del').disabled = !selRows.size || !data.pk;
        }));
        $$('#x-grid div[contenteditable]').forEach((div) => {
          div.addEventListener('focus', () => {
            div.dataset.orig = div.textContent;
            div._fresh = true;
          });
          div.addEventListener('mouseup', () => {
            if (!div._fresh) return;
            div._fresh = false;
            const r = document.createRange(); r.selectNodeContents(div); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
          });
          div.addEventListener('blur', () => save(div));
          div.addEventListener('keydown', (e) => nav(e, div));
          div.addEventListener('paste', (e) => paste(e, div));
        });
      }
      const cellPos = (div) => { const td = div.parentElement; return { i: Number(td.parentElement.dataset.i), j: Number(td.dataset.j) }; };
      const cellAt = (i, j) => $(`#x-grid tr[data-i="${i}"] td[data-j="${j}"] div`);
      function focusCell(i, j) {
        const d = cellAt(i, j);
        if (!d) return;
        if (d.isContentEditable) { d.focus(); const r = document.createRange(); r.selectNodeContents(d); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        else { d.parentElement.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      }
      function nextEditable(i, j, di, dj) {
        for (let k = 0; k < 400; k++) {
          i += di; j += dj;
          if (j < 0 || j >= data.columns.length || i < 0 || i >= data.rows.length) return null;
          const d = cellAt(i, j);
          if (d && d.isContentEditable) return [i, j];
        }
        return null;
      }
      function nav(e, div) {
        const { i, j } = cellPos(div);
        const sel = getSelection();
        const atStart = sel.anchorOffset === 0 && sel.focusOffset === 0;
        const atEnd = sel.focusOffset >= (div.textContent || '').length && sel.isCollapsed;
        let t = null;
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); t = nextEditable(i, j, 1, 0); }
        else if (e.key === 'Tab') { e.preventDefault(); t = nextEditable(i, j, 0, e.shiftKey ? -1 : 1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); t = nextEditable(i, j, 1, 0); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); t = nextEditable(i, j, -1, 0); }
        else if (e.key === 'ArrowRight' && (atEnd || !sel.isCollapsed)) { e.preventDefault(); t = nextEditable(i, j, 0, 1); }
        else if (e.key === 'ArrowLeft' && (atStart || !sel.isCollapsed)) { e.preventDefault(); t = nextEditable(i, j, 0, -1); }
        else if (e.key === 'Escape') { div.textContent = div.dataset.orig || ''; div.blur(); return; }
        if (t) focusCell(t[0], t[1]);
      }
      async function save(div, force) {
        const v = div.textContent;
        if (!force && v === div.dataset.orig) return;
        const { i, j } = cellPos(div);
        const col = data.columns[j];
        const row = data.rows[i];
        const td = div.parentElement;
        td.className = td.className.replace(/\b(saving|saved|err)\b/g, '') + ' saving';
        try {
          const nr = await put(`/data/table/${encodeURIComponent(cur)}/row`, { pk: row[data.pk], values: { [col.name]: v } });
          data.rows[i] = nr;
          const nv = nr[col.name];
          div.textContent = nv === null || nv === undefined ? '' : String(nv);
          div.dataset.orig = div.textContent;
          td.classList.toggle('null', nv === null);
          td.classList.remove('saving'); td.classList.add('saved');
          setTimeout(() => td.classList.remove('saved'), 1200);
        } catch (x) {
          td.classList.remove('saving'); td.classList.add('err');
          err(`${col.name} : ${x.message}`);
          div.textContent = div.dataset.orig || '';
          setTimeout(() => td.classList.remove('err'), 2500);
        }
      }
      function paste(e, div) {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (!/[\t\n]/.test(text.replace(/\n$/, ''))) return; // collage simple : comportement normal
        e.preventDefault();
        const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
        const { i, j } = cellPos(div);
        let count = 0;
        lines.forEach((cells, di) => cells.forEach((val, dj) => {
          const d = cellAt(i + di, j + dj);
          if (d && d.isContentEditable) { d.dataset.orig = d.textContent; d.textContent = val; save(d); count++; }
        }));
        toast(`${count} cellule(s) collée(s).`);
      }
      $('#x-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { st.search = e.target.value; st.page = 1; load(); } });
      $('#x-q').addEventListener('change', (e) => { st.search = e.target.value; st.page = 1; load(); });
      $('#x-ref').addEventListener('click', () => load().catch(err));
      $('#x-add').addEventListener('click', async () => {
        try {
          await post(`/data/table/${encodeURIComponent(cur)}/row`, { values: {} });
          ok('Ligne ajoutée.');
          if (data.pk) { st.sort = data.pk; st.dir = 'desc'; st.page = 1; }
          await load();
          const t = tables.find((x) => x.name === cur); if (t) { t.rows++; drawList(); }
          const f = nextEditable(0, -1, 0, 1); if (f) focusCell(f[0], f[1]);
        } catch (x) { err(x); }
      });
      $('#x-del').addEventListener('click', async () => {
        const ids = [...selRows].map((i) => data.rows[i][data.pk]);
        if (!(await confirm(`Supprimer définitivement ${ids.length} ligne(s) de la table <b>${esc(cur)}</b> ?`, { danger: true, okText: 'Oui' }))) return;
        try {
          const r = await post(`/data/table/${encodeURIComponent(cur)}/delete`, { ids });
          ok(`${r.deleted} ligne(s) supprimée(s).`);
          const t = tables.find((x) => x.name === cur); if (t) { t.rows -= r.deleted; drawList(); }
          load();
        } catch (x) { err(x); }
      });
      drawList();
      await load();
    },
  };
})();
