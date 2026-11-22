/* ========================================================================= COMMENTAIRES-DEBUTANT
   src/routes/resto.js — TOUTE L'API DU RESTAURANT « RESTO DU FORESTIER »
   -------------------------------------------------------------------------
   Préfixe /api/resto. Sections (dans l'ordre du fichier) :
     1. Articles du stock (ressources) : riz, poisson, poulet, charbon...
     2. Plats, menus du jour, accompagnements
     3. Carte du jour et VENTES (tickets / reçus)
     4. Dépenses
     5. Fermeture de caisse
     6. Bilans et tableau de bord

   Comment le stock baisse : chaque plat indique combien de « portions » d'un
   article il consomme (table resto_plat_ressource). Ex. sac de riz = 80 plats,
   1 plat de riz consomme 1 portion → 1/80 de sac. Tout est tracé dans
   resto_mouvement (APPRO, VENTE, ANNULATION, FIN_SAC, AJUSTEMENT).
   Moyens de paiement : voir MODES_PAIEMENT (ESPECE, WAVE, OM, MOMO, FLOOZ).
   ========================================================================= */
// ===== API de l'application RESTO DU FORESTIER (restaurant) =====
const router = require('express').Router();
const { q, tx } = require('../db');
const { admin, h, fail, num, today, nowTime, isDate, formatNumero, getParam } = require('../util');

const fr = (d) => String(d).split('-').reverse().join('/');
const addDays = (iso, k) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };
const N = (v) => Number(v) || 0;
// Moyens de paiement du restaurant
const MODES_PAIEMENT = ['ESPECE', 'WAVE', 'OM', 'MOMO', 'FLOOZ'];

// Vrai si la caisse du restaurant est fermée pour cette date.
async function estFermee(c, date) {
  return (await c.query(`SELECT 1 FROM resto_fermeture WHERE date=$1`, [date])).rowCount > 0;
}
// Bloque une opération si la caisse du jour est déjà fermée.
async function jourOuvert(c, date, quoi) {
  if (await estFermee(c, date)) throw fail(`La caisse du restaurant du ${fr(date)} est déjà fermée : impossible d'enregistrer ${quoi} à cette date.`);
}
// Plus ancienne journée avec des ventes dont la caisse n'est pas fermée
async function journeeAFermer(c) {
  const r = await c.query(`SELECT to_char(v.date,'YYYY-MM-DD') date, COUNT(*) n FROM resto_vente v
    WHERE NOT v.annulee AND NOT EXISTS (SELECT 1 FROM resto_fermeture f WHERE f.date=v.date) GROUP BY v.date ORDER BY v.date LIMIT 1`);
  return r.rows[0] || null;
}
// Enregistre un mouvement de stock ET met à jour le stock de l'article (unites positif = entrée, négatif = sortie).
async function mouvement(c, m) {
  await c.query(`INSERT INTO resto_mouvement(date,heure,code,type,unites,cout,ref,agent,motif) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [m.date || today(), nowTime(), m.code, m.type, m.unites, m.cout || 0, m.ref || null, m.agent || null, m.motif || null]);
  await c.query(`UPDATE resto_ressource SET stock = stock + $1 WHERE code=$2`, [m.unites, m.code]);
}
const SEL_RES = `SELECT code, nom, unite, portions_par_unite::float ppu, stock::float stock, seuil_alerte::float seuil, prix_unite, ordre, actif FROM resto_ressource`;
const platsRestants = (r) => (r.ppu ? Math.floor(r.stock * r.ppu + 1e-3) : null);

// ---------- Infos ----------
// GET /api/resto/info : informations du reçu (nom, adresse, téléphone, message...).
router.get('/info', h(async (req, res) => {
  res.json({ nom: (await getParam('resto_nom')) || 'RESTO DU FORESTIER', bloquerStock: (await getParam('resto_bloquer_stock')) !== 'non',
    adresse: (await getParam('resto_adresse')) || '', telephone: (await getParam('resto_telephone')) || '',
    message: (await getParam('resto_message')) || 'Merci de votre visite, à bientôt !', format: (await getParam('resto_format_ticket')) || 'T{AA}-{N5}' });
}));

// ---------- Ressources / stock ----------
// GET /api/resto/ressources : articles du stock (actifs ; ?tous=1 pour tous).
router.get('/ressources', h(async (req, res) => {
  // Par défaut seulement les ressources actives ; ?tous=1 pour l'écran de paramétrage
  const rows = (await q(`${SEL_RES} ${req.query.tous ? '' : 'WHERE actif'} ORDER BY ordre, nom`)).rows;
  res.json(rows.map((r) => ({ ...r, plats: platsRestants(r), alerte: r.stock <= r.seuil })));
}));
// Ajout d'un nouvel article / ressource de stock (administrateur)
router.post('/ressources', admin, h(async (req, res) => {
  const b = req.body || {};
  const nom = String(b.nom || '').trim();
  const unite = String(b.unite || '').trim().toLowerCase();
  if (!nom) throw fail("Le nom de l'article est obligatoire.");
  if (!unite) throw fail("L'unité est obligatoire (sac, carton, bidon, kg…).");
  const ppu = b.ppu === null || b.ppu === undefined || b.ppu === '' || b.manuel ? null : num(b.ppu);
  if (ppu !== null && ppu <= 0) throw fail('Le nombre de plats par unité doit être supérieur à 0.');
  const stock = num(b.stock);
  if (stock < 0) throw fail('Le stock initial ne peut pas être négatif.');
  const out = await tx(async (c) => {
    if ((await c.query(`SELECT 1 FROM resto_ressource WHERE UPPER(TRIM(nom))=UPPER($1)`, [nom])).rowCount) throw fail('Un article porte déjà ce nom.');
    const base = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'ARTICLE';
    let code = base, i = 1;
    while ((await c.query(`SELECT 1 FROM resto_ressource WHERE code=$1`, [code])).rowCount) code = `${base.slice(0, 26)}_${++i}`;
    const ordre = N((await c.query(`SELECT COALESCE(MAX(ordre),0)+1 o FROM resto_ressource`)).rows[0].o);
    await c.query(`INSERT INTO resto_ressource(code,nom,unite,portions_par_unite,seuil_alerte,prix_unite,ordre,actif) VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
      [code, nom, unite, ppu, num(b.seuil), Math.round(num(b.prix_unite)), ordre]);
    if (stock > 0) await mouvement(c, { code, type: 'AJUSTEMENT', unites: stock, agent: req.user.nom, motif: 'Stock initial' });
    return (await c.query(`${SEL_RES} WHERE code=$1`, [code])).rows[0];
  });
  res.json(out);
}));
router.put('/ressources/:code', admin, h(async (req, res) => {
  const b = req.body || {};
  const ppu = b.ppu === null || b.ppu === '' || b.manuel ? null : num(b.ppu);
  if (ppu !== null && ppu <= 0) throw fail('Le nombre de plats par unité doit être supérieur à 0.');
  const nom = b.nom ? String(b.nom).trim() : null;
  if (nom && (await q(`SELECT 1 FROM resto_ressource WHERE UPPER(TRIM(nom))=UPPER($1) AND code<>$2`, [nom, req.params.code])).rowCount) throw fail('Un autre article porte déjà ce nom.');
  const r = await q(`UPDATE resto_ressource SET nom=COALESCE($2,nom), unite=COALESCE($3,unite), portions_par_unite=$4, seuil_alerte=$5, prix_unite=$6,
      actif=COALESCE($7,actif), ordre=COALESCE($8,ordre) WHERE code=$1`,
    [req.params.code, nom, b.unite ? String(b.unite).trim().toLowerCase() : null, ppu, num(b.seuil), Math.round(num(b.prix_unite)),
      typeof b.actif === 'boolean' ? b.actif : null, b.ordre === undefined || b.ordre === '' ? null : Math.round(num(b.ordre))]);
  if (!r.rowCount) throw fail('Article introuvable.', 404);
  res.json({ ok: true });
}));
// Suppression : seulement si l'article n'a jamais servi ; sinon on le désactive
router.delete('/ressources/:code', admin, h(async (req, res) => {
  const code = req.params.code;
  const plats = (await q(`SELECT p.nom FROM resto_plat_ressource pr JOIN resto_plat p ON p.id=pr.plat_id WHERE pr.code=$1 ORDER BY p.nom`, [code])).rows;
  if (plats.length) throw fail(`Cet article est utilisé par : ${plats.map((x) => x.nom).join(', ')}. Retirez-le de ces plats ou désactivez-le.`);
  if ((await q(`SELECT 1 FROM resto_mouvement WHERE code=$1 LIMIT 1`, [code])).rowCount) throw fail("Cet article a déjà des mouvements de stock : il ne peut pas être supprimé, mais vous pouvez le désactiver (il n'apparaîtra plus).");
  await q(`DELETE FROM resto_ressource WHERE code=$1`, [code]);
  res.json({ ok: true });
}));
// POST /api/resto/ressources/:code/appro : approvisionnement d'un article { unites, cout, date }.
router.post('/ressources/:code/appro', h(async (req, res) => {
  const b = req.body || {};
  const date = isDate(b.date) ? b.date : today();
  if (date > today()) throw fail("La date de l'approvisionnement ne peut pas être dans le futur.");
  const u = num(b.unites);
  if (u <= 0) throw fail('Indiquez une quantité supérieure à 0.');
  const out = await tx(async (c) => {
    const r = (await c.query(`${SEL_RES} WHERE code=$1`, [req.params.code])).rows[0];
    if (!r) throw fail('Ressource introuvable.', 404);
    await mouvement(c, { date, code: r.code, type: 'APPRO', unites: u, cout: Math.round(num(b.cout)), agent: req.user.nom, motif: b.motif });
    if (num(b.cout) > 0) await c.query(`UPDATE resto_ressource SET prix_unite=$2 WHERE code=$1`, [r.code, Math.round(num(b.cout) / u)]);
    return (await c.query(`${SEL_RES} WHERE code=$1`, [r.code])).rows[0];
  });
  res.json(out);
}));
// Charbon (et autres) : un sac est fini
// POST /api/resto/ressources/:code/fin : « un sac est fini » (gestion manuelle, ex. charbon).
router.post('/ressources/:code/fin', h(async (req, res) => {
  const b = req.body || {};
  const u = num(b.unites) || 1;
  const out = await tx(async (c) => {
    const r = (await c.query(`${SEL_RES} WHERE code=$1`, [req.params.code])).rows[0];
    if (!r) throw fail('Ressource introuvable.', 404);
    if (r.stock - u < -1e-6) throw fail(`Stock insuffisant : il reste ${r.stock} ${r.unite}(s) de ${r.nom}.`);
    await mouvement(c, { code: r.code, type: 'FIN_SAC', unites: -u, agent: req.user.nom, motif: b.motif || `${u} ${r.unite}(s) terminé(s)` });
    return (await c.query(`${SEL_RES} WHERE code=$1`, [r.code])).rows[0];
  });
  res.json(out);
}));
// Inventaire : corriger le stock réel (administrateur)
// POST /api/resto/ressources/:code/ajuster : inventaire, nouveau stock réel (administrateur).
router.post('/ressources/:code/ajuster', admin, h(async (req, res) => {
  const b = req.body || {};
  const nouveau = num(b.stock);
  if (nouveau < 0) throw fail('Le stock ne peut pas être négatif.');
  await tx(async (c) => {
    const r = (await c.query(`${SEL_RES} WHERE code=$1`, [req.params.code])).rows[0];
    if (!r) throw fail('Ressource introuvable.', 404);
    const diff = Math.round((nouveau - r.stock) * 1e6) / 1e6;
    if (diff) await mouvement(c, { code: r.code, type: 'AJUSTEMENT', unites: diff, agent: req.user.nom, motif: b.motif || 'Inventaire' });
  });
  res.json({ ok: true });
}));
// GET /api/resto/mouvements : historique des entrées / sorties de stock.
router.get('/mouvements', h(async (req, res) => {
  const r = await q(`SELECT m.id, to_char(m.date,'YYYY-MM-DD') date, m.heure, m.code, r.nom, r.unite, m.type, m.unites::float unites, m.cout, m.ref, m.agent, m.motif
    FROM resto_mouvement m LEFT JOIN resto_ressource r ON r.code=m.code
    WHERE m.date BETWEEN $1 AND $2 AND ($3::text IS NULL OR m.code=$3) AND ($4::text IS NULL OR m.type=$4)
    ORDER BY m.date DESC, m.id DESC LIMIT 1000`,
  [req.query.du || '1900-01-01', req.query.au || '2999-12-31', req.query.code || null, req.query.type || null]);
  res.json(r.rows);
}));

// ---------- Plats et menus ----------
// Liste les plats avec, pour chacun, le stock consommé et les accompagnements proposés.
async function platsAvecRessources(c, where = '', params = []) {
  const plats = (await c.query(`SELECT id, nom, categorie, prix, menu, actif, ordre, accomp_obligatoire, vendable_seul FROM resto_plat ${where} ORDER BY categorie, ordre, nom`, params)).rows;
  const pr = (await c.query(`SELECT plat_id, code, portions::float portions FROM resto_plat_ressource`)).rows;
  const pa = (await c.query(`SELECT plat_id, accomp_id, prix FROM resto_plat_accomp`)).rows;
  return plats.map((p) => ({ ...p, prix: Number(p.prix),
    ressources: pr.filter((x) => x.plat_id === p.id).map(({ code, portions }) => ({ code, portions })),
    accompagnements: pa.filter((x) => x.plat_id === p.id).map((x) => ({ id: x.accomp_id, prix: x.prix === null ? null : Number(x.prix) })) }));
}
// Plats : liste, ajout, modification, suppression (administrateur pour les modifications).
router.get('/plats', h(async (req, res) => res.json(await platsAvecRessources({ query: q }))));

// Crée ou modifie un plat avec ses ressources consommées et ses accompagnements.
async function enregistrerPlat(c, id, b) {
  const nom = String(b.nom || '').trim();
  if (!nom) throw fail('Le nom du plat est obligatoire.');
  const prix = Math.round(num(b.prix));
  if (prix <= 0) throw fail('Le prix doit être supérieur à 0.');
  const menu = ['jour', 'accomp'].includes(b.menu) ? b.menu : 'fixe';
  const cat = menu === 'accomp' ? 'Accompagnements' : String(b.categorie || 'Plats').trim() || 'Plats';
  const oblig = menu !== 'accomp' && !!b.accomp_obligatoire;
  const seul = menu !== 'accomp' || b.vendable_seul !== false;
  if (id) {
    await c.query(`UPDATE resto_plat SET nom=$2, categorie=$3, prix=$4, menu=$5, actif=$6, accomp_obligatoire=$7, vendable_seul=$8 WHERE id=$1`, [id, nom, cat, prix, menu, b.actif !== false, oblig, seul]);
  } else {
    id = (await c.query(`INSERT INTO resto_plat(nom,categorie,prix,menu,actif,accomp_obligatoire,vendable_seul) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [nom, cat, prix, menu, b.actif !== false, oblig, seul])).rows[0].id;
  }
  // Accompagnements proposés avec ce plat
  await c.query(`DELETE FROM resto_plat_accomp WHERE plat_id=$1`, [id]);
  if (menu !== 'accomp') {
    for (const a of b.accompagnements || []) {
      const px = a.prix === null || a.prix === undefined || a.prix === '' ? null : Math.max(0, Math.round(num(a.prix)));
      await c.query(`INSERT INTO resto_plat_accomp(plat_id,accomp_id,prix) SELECT $1,$2,$3 WHERE EXISTS (SELECT 1 FROM resto_plat WHERE id=$2 AND menu='accomp')`, [id, Number(a.id), px]);
    }
    if (oblig && !(b.accompagnements || []).length) throw fail('Choisissez au moins un accompagnement, ou décochez « accompagnement obligatoire ».');
  }
  await c.query(`DELETE FROM resto_plat_ressource WHERE plat_id=$1`, [id]);
  for (const r of b.ressources || []) {
    const p = num(r.portions) || 1;
    if (p > 0) await c.query(`INSERT INTO resto_plat_ressource(plat_id,code,portions) VALUES ($1,$2,$3)`, [id, r.code, p]);
  }
  return id;
}
router.post('/plats', admin, h(async (req, res) => res.json({ id: await tx((c) => enregistrerPlat(c, null, req.body || {})) })));
router.put('/plats/:id', admin, h(async (req, res) => res.json({ id: await tx((c) => enregistrerPlat(c, Number(req.params.id), req.body || {})) })));
router.delete('/plats/:id', admin, h(async (req, res) => {
  await q(`DELETE FROM resto_plat WHERE id=$1`, [Number(req.params.id)]);
  res.json({ ok: true });
}));

// Menu du jour (dynamique)
// Menu du jour : plats cochés pour une date (avec prix du jour facultatif).
router.get('/menu-jour', h(async (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : today();
  const plats = await platsAvecRessources({ query: q }, `WHERE menu='jour'`);
  const sel = (await q(`SELECT plat_id, prix FROM resto_menu_jour WHERE date=$1`, [date])).rows;
  res.json({ date, plats: plats.map((p) => { const s = sel.find((x) => x.plat_id === p.id); return { ...p, choisi: !!s, prixJour: s && s.prix !== null ? Number(s.prix) : null }; }) });
}));
router.put('/menu-jour', h(async (req, res) => {
  const b = req.body || {};
  if (!isDate(b.date)) throw fail('Date invalide.');
  await tx(async (c) => {
    await c.query(`DELETE FROM resto_menu_jour WHERE date=$1`, [b.date]);
    for (const p of b.plats || []) {
      await c.query(`INSERT INTO resto_menu_jour(date,plat_id,prix) VALUES ($1,$2,$3)`, [b.date, Number(p.plat_id), p.prix ? Math.round(num(p.prix)) : null]);
    }
  });
  res.json({ ok: true });
}));
router.post('/menu-jour/copier', h(async (req, res) => {
  const { de, vers } = req.body || {};
  if (!isDate(de) || !isDate(vers)) throw fail('Dates invalides.');
  const n = await tx(async (c) => {
    await c.query(`DELETE FROM resto_menu_jour WHERE date=$1`, [vers]);
    return (await c.query(`INSERT INTO resto_menu_jour(date,plat_id,prix) SELECT $2, plat_id, prix FROM resto_menu_jour WHERE date=$1`, [de, vers])).rowCount;
  });
  res.json({ copies: n });
}));

// Carte du jour (pour la vente) : menu fixe + menu du jour, avec le nombre de plats possibles selon le stock
// La carte proposée à la caisse pour une date : menu fixe + menu du jour + accompagnements,
// avec le nombre de plats encore possibles selon le stock.
async function carte(c, date) {
  const fixe = await platsAvecRessources(c, `WHERE actif AND menu='fixe'`);
  const accs = await platsAvecRessources(c, `WHERE actif AND menu='accomp'`);
  const jour = await platsAvecRessources(c, `WHERE actif AND menu='jour' AND id IN (SELECT plat_id FROM resto_menu_jour WHERE date=$1)`, [date]);
  const px = (await c.query(`SELECT plat_id, prix FROM resto_menu_jour WHERE date=$1`, [date])).rows;
  const res = (await c.query(SEL_RES)).rows;
  const dispo = (p) => {
    let m = null;
    for (const r of p.ressources) {
      const rr = res.find((x) => x.code === r.code);
      if (!rr || !rr.ppu) continue;
      const k = Math.floor((rr.stock * rr.ppu + 1e-3) / r.portions);
      m = m === null ? k : Math.min(m, k);
    }
    return m; // null = pas de limite de stock
  };
  // Accompagnements proposés pour chaque plat (prix effectif dans ce plat)
  const avecAcc = (p) => ({ ...p, accompagnements: p.accompagnements.map((a) => { const x = accs.find((y) => y.id === a.id); return x ? { id: x.id, nom: x.nom, prix: a.prix === null ? x.prix : a.prix, prixNormal: x.prix, ressources: x.ressources, dispo: dispo(x) } : null; }).filter(Boolean) });
  return [
    ...jour.map((p) => { const o = px.find((x) => x.plat_id === p.id); return avecAcc({ ...p, prix: o && o.prix !== null ? Number(o.prix) : Number(p.prix), source: 'jour', dispo: dispo(p) }); }),
    ...fixe.map((p) => avecAcc({ ...p, source: 'fixe', dispo: dispo(p) })),
    ...accs.filter((a) => a.vendable_seul).map((a) => ({ ...a, source: 'accomp', dispo: dispo(a), accompagnements: [] })),
  ];
}
// GET /api/resto/carte?date= : la carte de la caisse.
router.get('/carte', h(async (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : today();
  const aFermer = await journeeAFermer({ query: q });
  res.json({ date, fermee: await estFermee({ query: q }, date), aFermer: aFermer && aFermer.date < date ? aFermer : null, plats: await carte({ query: q }, date) });
}));

// ---------- Ventes (tickets) ----------
// Relit un ticket complet (entête + lignes) pour l'afficher ou l'imprimer.
async function ticket(c, id) {
  const v = (await c.query(`SELECT id, numero, to_char(date,'YYYY-MM-DD') date, heure, agent, client, total, mode, recu, rendu, annulee, annulee_par FROM resto_vente WHERE id=$1`, [id])).rows[0];
  if (!v) throw fail('Ticket introuvable.', 404);
  v.lignes = (await c.query(`SELECT id, parent_id, type, nom, categorie, prix, qte, total FROM resto_vente_ligne WHERE vente_id=$1 ORDER BY id`, [id])).rows;
  return v;
}
// POST /api/resto/ventes : encaisse un client.
// Étapes : vérifications (journée ouverte, stock) → numéro de ticket → lignes (plats + accompagnements)
// → sortie de stock pour chaque ressource consommée → renvoie le ticket pour le reçu.
router.post('/ventes', h(async (req, res) => {
  const b = req.body || {};
  const date = today();
  const lignes = (b.lignes || []).filter((l) => num(l.qte) > 0);
  if (!lignes.length) throw fail('Ajoutez au moins un plat.');
  const mode = MODES_PAIEMENT.includes(b.mode) ? b.mode : 'ESPECE';
  const out = await tx(async (c) => {
    await c.query(`LOCK TABLE resto_vente IN SHARE ROW EXCLUSIVE MODE`);
    await jourOuvert(c, date, 'une vente');
    const af = await journeeAFermer(c);
    if (af && af.date < date) throw fail(`La caisse du restaurant du ${fr(af.date)} n'est pas fermée. Fermez-la avant de faire de nouvelles ventes.`);
    const dispo = await carte(c, date);
    const besoin = {};
    let total = 0;
    const det = [];
    for (const l of lignes) {
      const p = dispo.find((x) => x.id === Number(l.plat_id));
      if (!p) throw fail("Un des plats n'est pas au menu aujourd'hui.");
      const qte = Math.round(num(l.qte));
      const accs = [];
      for (const aid of l.accomps || []) {
        const a = p.accompagnements.find((x) => x.id === Number(aid));
        if (!a) throw fail(`Cet accompagnement n'est pas proposé avec « ${p.nom} ».`);
        accs.push(a);
      }
      if (p.accomp_obligatoire && !accs.length) throw fail(`Choisissez l'accompagnement de « ${p.nom} ».`);
      total += qte * (p.prix + accs.reduce((t, a) => t + a.prix, 0));
      det.push({ p, qte, accs });
      for (const r of p.ressources) besoin[r.code] = (besoin[r.code] || 0) + r.portions * qte;
      for (const a of accs) for (const r of a.ressources) besoin[r.code] = (besoin[r.code] || 0) + r.portions * qte;
    }
    const ress = (await c.query(`${SEL_RES} FOR UPDATE`)).rows;
    const bloquer = (await getParam('resto_bloquer_stock', c)) !== 'non';
    const mvts = [];
    for (const [code, portions] of Object.entries(besoin)) {
      const r = ress.find((x) => x.code === code);
      if (!r || !r.ppu) continue;
      const unites = portions / r.ppu;
      if (bloquer && r.stock - unites < -1e-6) {
        throw fail(`Stock insuffisant : ${r.nom} — il reste de quoi servir ${platsRestants(r)} plat(s), il en faut ${portions}. Approvisionnez d'abord le stock.`);
      }
      mvts.push({ code, unites: -Math.round(unites * 1e6) / 1e6 });
    }
    const recu = mode === 'ESPECE' ? Math.round(num(b.recu)) || total : total;
    if (recu < total) throw fail(`Le montant reçu (${recu.toLocaleString('fr-FR')}) est inférieur au total (${total.toLocaleString('fr-FR')}).`);
    // Numéro de ticket
    const cpt = (await c.query(`SELECT valeur FROM parametres WHERE cle='resto_compteur' FOR UPDATE`)).rows[0];
    let n = parseInt(cpt ? cpt.valeur : '0', 10) || 0, numero;
    const fmt = (await getParam('resto_format_ticket', c)) || 'T{AA}-{N5}';
    do { n++; numero = formatNumero(fmt, n, date); } while ((await c.query(`SELECT 1 FROM resto_vente WHERE numero=$1`, [numero])).rowCount);
    await c.query(`INSERT INTO parametres(cle,valeur) VALUES ('resto_compteur',$1) ON CONFLICT (cle) DO UPDATE SET valeur=EXCLUDED.valeur`, [String(n)]);
    const id = (await c.query(`INSERT INTO resto_vente(numero,date,heure,agent,client,total,mode,recu,rendu) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [numero, date, nowTime(), req.user.nom, String(b.client || '').trim() || 'Client comptoir', total, mode, recu, recu - total])).rows[0].id;
    for (const d of det) {
      const lid = (await c.query(`INSERT INTO resto_vente_ligne(vente_id,plat_id,nom,categorie,prix,qte,total,type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [id, d.p.id, d.p.nom, d.p.categorie, d.p.prix, d.qte, d.qte * d.p.prix, d.p.menu === 'accomp' ? 'accomp' : 'plat'])).rows[0].id;
      for (const a of d.accs) {
        await c.query(`INSERT INTO resto_vente_ligne(vente_id,plat_id,nom,categorie,prix,qte,total,type,parent_id) VALUES ($1,$2,$3,'Accompagnements',$4,$5,$6,'accomp',$7)`,
          [id, a.id, a.nom, a.prix, d.qte, d.qte * a.prix, lid]);
      }
    }
    for (const m of mvts) await mouvement(c, { date, code: m.code, type: 'VENTE', unites: m.unites, ref: numero, agent: req.user.nom });
    return ticket(c, id);
  });
  res.json(out);
}));
// GET /api/resto/ventes?du=&au= : liste des tickets.
router.get('/ventes', h(async (req, res) => {
  const r = await q(`SELECT v.id, v.numero, to_char(v.date,'YYYY-MM-DD') date, v.heure, v.agent, v.client, v.total, v.mode, v.annulee,
      (SELECT COALESCE(SUM(qte),0) FROM resto_vente_ligne l WHERE l.vente_id=v.id AND l.parent_id IS NULL)::int nb_plats,
      (SELECT string_agg(CASE WHEN l.parent_id IS NULL THEN l.qte || ' ' || l.nom ELSE '+ ' || l.nom END, ', ' ORDER BY l.id) FROM resto_vente_ligne l WHERE l.vente_id=v.id) detail
    FROM resto_vente v WHERE v.date BETWEEN $1 AND $2 ORDER BY v.date DESC, v.id DESC`, [req.query.du || today(), req.query.au || today()]);
  res.json(r.rows);
}));
// GET /api/resto/ventes/:id : un ticket complet.
router.get('/ventes/:id', h(async (req, res) => res.json(await ticket({ query: q }, Number(req.params.id)))));
// POST /api/resto/ventes/:id/annuler : annule un ticket et remet le stock (administrateur).
router.post('/ventes/:id/annuler', admin, h(async (req, res) => {
  await tx(async (c) => {
    const v = await ticket(c, Number(req.params.id));
    if (v.annulee) throw fail('Ce ticket est déjà annulé.');
    await jourOuvert(c, v.date, 'ou annuler un ticket');
    const mv = (await c.query(`SELECT code, SUM(unites)::float u FROM resto_mouvement WHERE ref=$1 AND type='VENTE' GROUP BY code`, [v.numero])).rows;
    for (const m of mv) await mouvement(c, { date: v.date, code: m.code, type: 'ANNULATION', unites: -m.u, ref: v.numero, agent: req.user.nom, motif: 'Annulation du ticket' });
    await c.query(`UPDATE resto_vente SET annulee=true, annulee_par=$2, annulee_le=now() WHERE id=$1`, [v.id, req.user.nom]);
  });
  res.json({ ok: true });
}));

// ---------- Dépenses ----------
router.get('/depenses/types', h(async (req, res) => res.json((await q(`SELECT id, nom FROM resto_depense_type ORDER BY nom`)).rows)));
router.post('/depenses/types', h(async (req, res) => {
  const nom = String((req.body || {}).nom || '').trim().toUpperCase();
  if (!nom) throw fail('Saisissez le nom de la dépense.');
  if ((await q(`SELECT 1 FROM resto_depense_type WHERE UPPER(nom)=$1`, [nom])).rowCount) throw fail('Cette dépense existe déjà.');
  await q(`INSERT INTO resto_depense_type(nom) VALUES ($1)`, [nom]);
  res.json({ ok: true, nom });
}));
// Dépenses du restaurant : ajout (journée ouverte seulement), liste, suppression.
router.post('/depenses', h(async (req, res) => {
  const b = req.body || {};
  if (!isDate(b.date)) throw fail('Date invalide.');
  if (b.date > today()) throw fail('La date ne peut pas être dans le futur.');
  if (!b.type) throw fail('Sélectionnez la dépense.');
  const m = Math.round(num(b.montant));
  if (m <= 0) throw fail('Le montant doit être supérieur à 0.');
  await jourOuvert(null || { query: q }, b.date, 'une dépense');
  await q(`INSERT INTO resto_depense(date,heure,type,montant,motif,agent) VALUES ($1,$2,$3,$4,$5,$6)`, [b.date, nowTime(), b.type, m, b.motif || null, req.user.nom]);
  res.json({ ok: true });
}));
router.get('/depenses', h(async (req, res) => {
  const r = await q(`SELECT id, to_char(date,'YYYY-MM-DD') date, heure, type, montant, motif, agent FROM resto_depense
    WHERE date BETWEEN $1 AND $2 AND ($3::text IS NULL OR type=$3) ORDER BY date DESC, id DESC`,
  [req.query.du || '1900-01-01', req.query.au || '2999-12-31', req.query.type || null]);
  res.json(r.rows);
}));
router.delete('/depenses/:id', admin, h(async (req, res) => {
  const d = (await q(`SELECT to_char(date,'YYYY-MM-DD') date FROM resto_depense WHERE id=$1`, [Number(req.params.id)])).rows[0];
  if (d) await jourOuvert({ query: q }, d.date, 'ou supprimer une dépense');
  await q(`DELETE FROM resto_depense WHERE id=$1`, [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ---------- Fermeture de caisse ----------
// Montants de la fermeture : ventes par mode de paiement, dépenses, montant à verser = ventes − dépenses.
async function situation(c, date) {
  const v = (await c.query(`SELECT COUNT(*)::int n, COALESCE(SUM(total),0) t,
      COALESCE(SUM(total) FILTER (WHERE mode='ESPECE'),0) espece, COALESCE(SUM(total) FILTER (WHERE mode='WAVE'),0) wave, COALESCE(SUM(total) FILTER (WHERE mode='OM'),0) om,
      COALESCE(SUM(total) FILTER (WHERE mode='MOMO'),0) momo, COALESCE(SUM(total) FILTER (WHERE mode='FLOOZ'),0) flooz
    FROM resto_vente WHERE date=$1 AND NOT annulee`, [date])).rows[0];
  const dep = N((await c.query(`SELECT COALESCE(SUM(montant),0) t FROM resto_depense WHERE date=$1`, [date])).rows[0].t);
  const nbDep = N((await c.query(`SELECT COUNT(*) n FROM resto_depense WHERE date=$1`, [date])).rows[0].n);
  const der = (await c.query(`SELECT verse FROM resto_fermeture WHERE date < $1 ORDER BY date DESC LIMIT 1`, [date])).rows[0];
  const totalVentes = N(v.t);
  return { nbTickets: v.n, totalVentes, parMode: { ESPECE: N(v.espece), WAVE: N(v.wave), OM: N(v.om), MOMO: N(v.momo), FLOOZ: N(v.flooz) }, depenses: dep, nbDepenses: nbDep,
    dernierVersement: der ? N(der.verse) : 0, aVerser: totalVentes - dep };
}
// GET /api/resto/caisse?date= : situation de la journée.
router.get('/caisse', h(async (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : today();
  const f = (await q(`SELECT *, to_char(date,'YYYY-MM-DD') date, to_char(date_enreg,'YYYY-MM-DD') date_enreg FROM resto_fermeture WHERE date=$1`, [date])).rows[0] || null;
  res.json({ date, ...(await situation({ query: q }, date)), existe: f, aFermer: await journeeAFermer({ query: q }) });
}));
// POST /api/resto/caisse : ferme la caisse { date, espece, wave, om, momo, flooz }.
router.post('/caisse', h(async (req, res) => {
  const b = req.body || {};
  if (!isDate(b.date)) throw fail('Date invalide.');
  const wave = Math.round(num(b.wave)), om = Math.round(num(b.om)), espece = Math.round(num(b.espece));
  const momo = Math.round(num(b.momo)), flooz = Math.round(num(b.flooz));
  if (wave < 0 || om < 0 || espece < 0 || momo < 0 || flooz < 0) throw fail('Les montants ne peuvent pas être négatifs.');
  const out = await tx(async (c) => {
    await c.query(`LOCK TABLE resto_fermeture IN SHARE ROW EXCLUSIVE MODE`);
    if (await estFermee(c, b.date)) throw fail('La caisse de cette date est déjà fermée.');
    const af = await journeeAFermer(c);
    if (af && af.date < b.date) throw fail(`Fermez d'abord la caisse du ${fr(af.date)}.`);
    const s = await situation(c, b.date);
    if (!s.nbTickets && !s.nbDepenses) throw fail("Aucune vente ni dépense pour cette date : rien à fermer.");
    const verse = wave + om + espece + momo + flooz;
    await c.query(`INSERT INTO resto_fermeture(date,nb_tickets,total_ventes,depenses,a_verser,wave,om,espece,momo,flooz,verse,ecart,dernier_versement,agent,heure,date_enreg)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [b.date, s.nbTickets, s.totalVentes, s.depenses, s.aVerser, wave, om, espece, momo, flooz, verse, s.aVerser - verse, s.dernierVersement, req.user.nom, nowTime(), today()]);
    return { ...s, verse, ecart: s.aVerser - verse };
  });
  res.json(out);
}));
// DELETE /api/resto/caisse/:id : rouvre la dernière journée fermée (administrateur).
router.delete('/caisse/:id', admin, h(async (req, res) => {
  const f = (await q(`SELECT to_char(date,'YYYY-MM-DD') date FROM resto_fermeture WHERE id=$1`, [Number(req.params.id)])).rows[0];
  if (!f) throw fail('Fermeture introuvable.', 404);
  const apres = (await q(`SELECT 1 FROM resto_fermeture WHERE date > $1`, [f.date])).rowCount;
  if (apres) throw fail('Seule la dernière journée fermée peut être rouverte.');
  await q(`DELETE FROM resto_fermeture WHERE id=$1`, [Number(req.params.id)]);
  res.json({ ok: true });
}));
// GET /api/resto/caisse/bilan : liste des fermetures.
router.get('/caisse/bilan', h(async (req, res) => {
  const r = await q(`SELECT id, to_char(date,'YYYY-MM-DD') date, to_char(date_enreg,'YYYY-MM-DD') date_enreg, nb_tickets, total_ventes, depenses, a_verser,
      wave, om, espece, momo, flooz, verse, ecart, dernier_versement, agent, heure FROM resto_fermeture WHERE date BETWEEN $1 AND $2 ORDER BY date DESC`,
  [req.query.du || '1900-01-01', req.query.au || '2999-12-31']);
  res.json(r.rows);
}));

// ---------- Bilans / statistiques ----------
// GET /api/resto/bilan?du=&au= : tout le contenu de la page Bilans (chiffres clés, produits vendus,
// plus vendus, point par moyen de règlement, catégories, heures, consommation du stock).
router.get('/bilan', h(async (req, res) => {
  const au = isDate(req.query.au) ? req.query.au : today();
  const du = isDate(req.query.du) ? req.query.du : au;
  const P = [du, au];
  const k = (await q(`SELECT COUNT(*)::int tickets, COALESCE(SUM(total),0) ca,
      COALESCE(SUM(total) FILTER (WHERE mode='ESPECE'),0) espece, COALESCE(SUM(total) FILTER (WHERE mode='WAVE'),0) wave, COALESCE(SUM(total) FILTER (WHERE mode='OM'),0) om,
      COALESCE(SUM(total) FILTER (WHERE mode='MOMO'),0) momo, COALESCE(SUM(total) FILTER (WHERE mode='FLOOZ'),0) flooz
    FROM resto_vente WHERE date BETWEEN $1 AND $2 AND NOT annulee`, P)).rows[0];
  const plats = N((await q(`SELECT COALESCE(SUM(l.qte),0) n FROM resto_vente_ligne l JOIN resto_vente v ON v.id=l.vente_id WHERE v.date BETWEEN $1 AND $2 AND NOT v.annulee AND l.parent_id IS NULL`, P)).rows[0].n);
  // Point par moyen de règlement : totaux de la période et détail par jour
  const parModeT = (await q(`SELECT mode, COUNT(*)::int tickets, COALESCE(SUM(total),0) total FROM resto_vente
    WHERE date BETWEEN $1 AND $2 AND NOT annulee GROUP BY mode`, P)).rows;
  const modes = MODES_PAIEMENT.map((m) => { const r = parModeT.find((x) => x.mode === m) || {}; return { mode: m, tickets: N(r.tickets), total: N(r.total) }; });
  const modesJours = (await q(`SELECT to_char(date,'YYYY-MM-DD') d, mode, COUNT(*)::int tickets, SUM(total) total FROM resto_vente
    WHERE date BETWEEN $1 AND $2 AND NOT annulee GROUP BY 1, 2 ORDER BY 1 DESC`, P)).rows;
  const pmj = {};
  for (const r of modesJours) { const x = pmj[r.d] = pmj[r.d] || { d: r.d, tickets: 0, total: 0 }; x[r.mode] = N(r.total); x.tickets += N(r.tickets); x.total += N(r.total); }
  const dep = N((await q(`SELECT COALESCE(SUM(montant),0) t FROM resto_depense WHERE date BETWEEN $1 AND $2`, P)).rows[0].t);
  const appro = N((await q(`SELECT COALESCE(SUM(cout),0) t FROM resto_mouvement WHERE type='APPRO' AND date BETWEEN $1 AND $2`, P)).rows[0].t);
  const jours = (await q(`WITH d AS (SELECT generate_series($1::date,$2::date,'1 day')::date d)
    SELECT to_char(d.d,'YYYY-MM-DD') d,
      COALESCE((SELECT SUM(total) FROM resto_vente v WHERE v.date=d.d AND NOT annulee),0) ca,
      COALESCE((SELECT COUNT(*) FROM resto_vente v WHERE v.date=d.d AND NOT annulee),0) tickets,
      COALESCE((SELECT SUM(montant) FROM resto_depense x WHERE x.date=d.d),0) depenses
    FROM d ORDER BY d.d`, P)).rows.map((r) => ({ d: r.d, ca: N(r.ca), tickets: N(r.tickets), depenses: N(r.depenses) }));
  const top = (await q(`SELECT l.nom, l.categorie, SUM(l.qte)::int qte, SUM(l.total) ca FROM resto_vente_ligne l JOIN resto_vente v ON v.id=l.vente_id
    WHERE v.date BETWEEN $1 AND $2 AND NOT v.annulee AND l.type <> 'accomp' GROUP BY l.nom, l.categorie ORDER BY 3 DESC, 4 DESC`, P)).rows.map((r) => ({ ...r, ca: N(r.ca) }));
  // Liste complète des produits vendus (plats, boissons et accompagnements)
  const produits = (await q(`SELECT l.nom, COALESCE(l.categorie,'—') categorie, BOOL_OR(l.type = 'accomp') accomp, SUM(l.qte)::int qte, SUM(l.total) ca,
      COUNT(DISTINCT v.id)::int tickets, MIN(l.prix) prix_min, MAX(l.prix) prix_max
    FROM resto_vente_ligne l JOIN resto_vente v ON v.id=l.vente_id
    WHERE v.date BETWEEN $1 AND $2 AND NOT v.annulee GROUP BY l.nom, COALESCE(l.categorie,'—') ORDER BY 5 DESC, 4 DESC`, P)).rows
    .map((r) => ({ ...r, ca: N(r.ca), prix_min: N(r.prix_min), prix_max: N(r.prix_max) }));
  const accomps = (await q(`SELECT l.nom, SUM(l.qte)::int qte, SUM(l.total) ca,
      COALESCE(SUM(l.qte) FILTER (WHERE l.parent_id IS NULL),0)::int seul, COALESCE(SUM(l.qte) FILTER (WHERE l.parent_id IS NOT NULL),0)::int avec
    FROM resto_vente_ligne l JOIN resto_vente v ON v.id=l.vente_id
    WHERE v.date BETWEEN $1 AND $2 AND NOT v.annulee AND l.type='accomp' GROUP BY l.nom ORDER BY 2 DESC`, P)).rows.map((r) => ({ ...r, ca: N(r.ca) }));
  const cat = (await q(`SELECT COALESCE(l.categorie,'—') categorie, SUM(l.qte)::int qte, SUM(l.total) ca FROM resto_vente_ligne l JOIN resto_vente v ON v.id=l.vente_id
    WHERE v.date BETWEEN $1 AND $2 AND NOT v.annulee GROUP BY 1 ORDER BY 3 DESC`, P)).rows.map((r) => ({ ...r, ca: N(r.ca) }));
  const heures = (await q(`SELECT EXTRACT(HOUR FROM heure)::int h, COUNT(*)::int tickets, SUM(total) ca FROM resto_vente
    WHERE date BETWEEN $1 AND $2 AND NOT annulee GROUP BY 1 ORDER BY 1`, P)).rows.map((r) => ({ ...r, ca: N(r.ca) }));
  const conso = (await q(`SELECT r.code, r.nom, r.unite, r.portions_par_unite::float ppu,
      COALESCE(-SUM(m.unites) FILTER (WHERE m.type IN ('VENTE','ANNULATION','FIN_SAC')),0)::float sortie,
      COALESCE(SUM(m.unites) FILTER (WHERE m.type='APPRO'),0)::float entree,
      COALESCE(SUM(m.cout) FILTER (WHERE m.type='APPRO'),0) cout
    FROM resto_ressource r LEFT JOIN resto_mouvement m ON m.code=r.code AND m.date BETWEEN $1 AND $2 GROUP BY r.code, r.nom, r.unite, r.portions_par_unite, r.ordre ORDER BY r.ordre`, P)).rows
    .map((r) => ({ ...r, cout: N(r.cout) }));
  res.json({ du, au, kpi: { tickets: k.tickets, ca: N(k.ca), plats, panier: k.tickets ? Math.round(N(k.ca) / k.tickets) : 0, depenses: dep, appro, net: N(k.ca) - dep },
    parMode: { ESPECE: N(k.espece), WAVE: N(k.wave), OM: N(k.om), MOMO: N(k.momo), FLOOZ: N(k.flooz) }, jours, top, produits, modes, modesJours: Object.values(pmj), accomps, categories: cat, heures, conso });
}));

// GET /api/resto/dashboard : chiffres de la page d'accueil du restaurant.
router.get('/dashboard', h(async (req, res) => {
  const d = today();
  const s = await situation({ query: q }, d);
  const res14 = (await q(`WITH x AS (SELECT generate_series($1::date,$2::date,'1 day')::date d)
    SELECT to_char(x.d,'YYYY-MM-DD') d, COALESCE((SELECT SUM(total) FROM resto_vente v WHERE v.date=x.d AND NOT annulee),0) ca,
      COALESCE((SELECT COUNT(*) FROM resto_vente v WHERE v.date=x.d AND NOT annulee),0) tickets FROM x ORDER BY x.d`, [addDays(d, -13), d])).rows
    .map((r) => ({ d: r.d, ca: N(r.ca), tickets: N(r.tickets) }));
  const dm = d.slice(0, 8) + '01';
  const mois = (await q(`SELECT COALESCE(SUM(total),0) ca, COUNT(*)::int tickets FROM resto_vente WHERE date BETWEEN $1 AND $2 AND NOT annulee`, [dm, d])).rows[0];
  const top = (await q(`SELECT l.nom, SUM(l.qte)::int qte, SUM(l.total) ca FROM resto_vente_ligne l JOIN resto_vente v ON v.id=l.vente_id
    WHERE v.date BETWEEN $1 AND $2 AND NOT v.annulee AND l.type <> 'accomp' GROUP BY l.nom ORDER BY 2 DESC LIMIT 5`, [dm, d])).rows.map((r) => ({ ...r, ca: N(r.ca) }));
  const ress = (await q(`${SEL_RES} WHERE actif ORDER BY ordre`)).rows.map((r) => ({ ...r, plats: platsRestants(r), alerte: r.stock <= r.seuil }));
  const menuJour = N((await q(`SELECT COUNT(*) n FROM resto_menu_jour WHERE date=$1`, [d])).rows[0].n);
  const nbJour = N((await q(`SELECT COUNT(*) n FROM resto_plat WHERE menu='jour' AND actif`)).rows[0].n);
  res.json({ date: d, jour: s, fermee: await estFermee({ query: q }, d), aFermer: await journeeAFermer({ query: q }),
    mois: { ca: N(mois.ca), tickets: mois.tickets }, serie: res14, top, ressources: ress, menuJour, nbPlatsJour: nbJour });
}));

module.exports = router;
