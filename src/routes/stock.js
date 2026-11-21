const router = require('express').Router();
const { q, tx } = require('../db');
const { admin, isAdmin, h, fail, num, today, nowTime, moisDe, anneeDe, isDate, nextNumero, verifierJourOuvert } = require('../util');

const SEL_PRODUIT = `SELECT rid, ref, "Lib", COALESCE(qte,0) qte, COALESCE(pu,0) pu, COALESCE("prixFour",0) "prixFour",
  code, typeemballage, COALESCE("PRIXEMBALLAGE",0) "PRIXEMBALLAGE" FROM "produit"`;

const DEPENSE_APPRO = 'APPROVISIONNEMENT DE PRODUIT';

async function recalcProduit(client, rid) {
  await client.query(`UPDATE "produit" SET total=ROUND(COALESCE(qte,0)*COALESCE(pu,0)), "totalFour"=ROUND(COALESCE(qte,0)*COALESCE("prixFour",0)) WHERE rid=$1`, [rid]);
}

// ---------- PRODUITS / STOCK ----------
router.get('/produits', h(async (req, res) => {
  const r = await q(`${SEL_PRODUIT} ORDER BY "Lib"`);
  res.json(r.rows);
}));

router.post('/produits', h(async (req, res) => {
  const b = req.body || {};
  const lib = String(b.Lib || '').trim().toUpperCase();
  if (!lib) throw fail("Le nom de l'article est obligatoire.");
  const out = await tx(async (c) => {
    const ex = await c.query(`SELECT 1 FROM "produit" WHERE UPPER(TRIM("Lib"))=$1`, [lib]);
    if (ex.rowCount) throw fail('Cet article existe déjà.');
    let ref = String(b.ref || '').trim();
    if (!ref) ref = await nextNumero(c, 'numprod', 'format_produit', today(), `SELECT 1 FROM "produit" WHERE ref=$1`, lib);
    const qte = isAdmin(req.user) ? num(b.qte) : 0;
    const r = await c.query(
      `INSERT INTO "produit"(ref,"Lib",qte,pu,"prixFour",code,typeemballage,"PRIXEMBALLAGE") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING rid`,
      [ref, lib, qte, Math.round(num(b.pu)), Math.round(num(b.prixFour)), b.code || null, b.typeemballage || null, Math.round(num(b.PRIXEMBALLAGE))]
    );
    await recalcProduit(c, r.rows[0].rid);
    return (await c.query(`${SEL_PRODUIT} WHERE rid=$1`, [r.rows[0].rid])).rows[0];
  });
  res.json(out);
}));

router.put('/produits/:rid', h(async (req, res) => {
  const b = req.body || {};
  const rid = Number(req.params.rid);
  const out = await tx(async (c) => {
    const cur = (await c.query(`${SEL_PRODUIT} WHERE rid=$1`, [rid])).rows[0];
    if (!cur) throw fail('Article introuvable.', 404);
    const lib = b.Lib !== undefined && isAdmin(req.user) ? String(b.Lib).trim().toUpperCase() : cur.Lib;
    const qte = b.qte !== undefined && isAdmin(req.user) ? num(b.qte) : cur.qte;
    if (b.qte !== undefined && !isAdmin(req.user) && num(b.qte) !== cur.qte) {
      throw fail("Seul l'administrateur peut modifier la quantité.", 403);
    }
    await c.query(
      `UPDATE "produit" SET "Lib"=$1, qte=$2, pu=$3, "prixFour"=$4, typeemballage=COALESCE($5,typeemballage), "PRIXEMBALLAGE"=$6 WHERE rid=$7`,
      [lib, qte, Math.round(b.pu !== undefined ? num(b.pu) : cur.pu), Math.round(b.prixFour !== undefined ? num(b.prixFour) : cur.prixFour),
        b.typeemballage ?? null, Math.round(b.PRIXEMBALLAGE !== undefined ? num(b.PRIXEMBALLAGE) : cur.PRIXEMBALLAGE), rid]
    );
    await recalcProduit(c, rid);
    return (await c.query(`${SEL_PRODUIT} WHERE rid=$1`, [rid])).rows[0];
  });
  res.json(out);
}));

router.delete('/produits/:rid', admin, h(async (req, res) => {
  await q(`DELETE FROM "produit" WHERE rid=$1`, [Number(req.params.rid)]);
  res.json({ ok: true });
}));

// ---------- APPROVISIONNEMENTS ----------
router.post('/appros', h(async (req, res) => {
  const { date, lignes, fournisseur } = req.body || {};
  if (!isDate(date)) throw fail("Date d'achat invalide.");
  const items = (lignes || []).filter((l) => num(l.qte) > 0);
  if (!items.length) throw fail('Ajoutez au moins une boisson avec une quantité.');
  if (date > today()) throw fail("La date d'achat ne peut pas être dans le futur.");
  const out = await tx(async (c) => {
    await verifierJourOuvert(c, date, 'un approvisionnement');
    const numero = await nextNumero(c, 'Numappro', 'format_appro', date, `SELECT 1 FROM "appro" WHERE "IDapproAB"=$1`);
    let qteT = 0, totT = 0;
    for (const l of items) {
      const p = (await c.query(`${SEL_PRODUIT} WHERE rid=$1 FOR UPDATE`, [Number(l.rid)])).rows[0];
      if (!p) throw fail('Article introuvable.');
      const qte = num(l.qte);
      const totalFour = Math.round(qte * p.prixFour);
      const total = Math.round(qte * p.pu);
      await c.query(
        `INSERT INTO "appro"("IDapproAB",ref,"Lib",qte,pu,total,dateappro,heureappro,agent,mois,annee,code,"prixFour","totalFour","margeB",fourniss,"DATEENREG")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [numero, p.ref, p.Lib, qte, p.pu, total, date, nowTime(), req.user.nom, moisDe(date), anneeDe(date), p.code,
          p.prixFour, totalFour, total - totalFour, fournisseur || null, today()]
      );
      await c.query(`UPDATE "produit" SET qte=COALESCE(qte,0)+$1 WHERE rid=$2`, [qte, p.rid]);
      await recalcProduit(c, p.rid);
      qteT += qte;
      totT += totalFour;
    }
    // Le montant total de l'approvisionnement est enregistré comme dépense du jour
    if (totT > 0) {
      await c.query(`INSERT INTO "DEPENSEQUOTIDIEN"("DEPENSE","MONTANT","DETAILS","AGENTS","DATEDEP","HEUREDEP","MOISDEP","ANNEEDEP","DATEENREG","NUMAPPRO")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [DEPENSE_APPRO, totT, `Approvisionnement N° ${numero}`, req.user.nom, date, nowTime(), moisDe(date), anneeDe(date), today(), numero]);
    }
    const v = (await c.query(`SELECT "NumVentes", "DateVente" FROM "T_Ventes" WHERE "DateVente" >= $1 AND COALESCE("Fermer",false)=false ORDER BY "DateVente" LIMIT 1`, [date])).rows[0];
    const avertissement = v ? `La vente ${v.NumVentes} du ${v.DateVente.split('-').reverse().join('/')} est déjà saisie : ouvrez-la dans Ventes et validez-la à nouveau (modification) pour qu'elle prenne en compte cet approvisionnement.` : null;
    return { numero, qte: qteT, total: totT, depense: totT, avertissement };
  });
  res.json(out);
}));

router.get('/appros', h(async (req, res) => {
  const { du, au } = req.query;
  const r = await q(
    `SELECT "IDapproAB" numero, dateappro, SUM(qte) qte, SUM("totalFour") total, BOOL_OR("NumVente" IS NOT NULL) consomme
     FROM "appro" WHERE dateappro BETWEEN $1 AND $2 GROUP BY "IDapproAB", dateappro ORDER BY dateappro DESC, "IDapproAB" DESC`,
    [du || '1900-01-01', au || '2999-12-31']
  );
  res.json(r.rows);
}));

router.get('/appros/detail', h(async (req, res) => {
  const r = await q(
    `SELECT rid, "IDapproAB" numero, "DATEENREG", dateappro, heureappro, ref, "Lib", qte, "prixFour", "totalFour", pu, agent, "NumVente"
     FROM "appro" WHERE "IDapproAB"=$1 AND ($2::date IS NULL OR dateappro=$2::date) ORDER BY "Lib"`,
    [req.query.numero, isDate(req.query.date) ? req.query.date : null]
  );
  res.json(r.rows);
}));

router.delete('/appros', admin, h(async (req, res) => {
  const { numero, date } = req.query;
  await tx(async (c) => {
    const rows = (await c.query(`SELECT * FROM "appro" WHERE "IDapproAB"=$1 AND dateappro=$2 FOR UPDATE`, [numero, date])).rows;
    if (!rows.length) throw fail('Approvisionnement introuvable.', 404);
    if (req.user.role !== 'superadmin') await verifierJourOuvert(c, date, 'ou supprimer un approvisionnement');
    if (rows.some((r) => r.NumVente)) {
      throw fail(`Cet approvisionnement est déjà pris en compte dans la vente ${rows.find((r) => r.NumVente).NumVente}. Supprimez d'abord la vente.`);
    }
    for (const a of rows) {
      const p = (await c.query(`SELECT rid FROM "produit" WHERE ref=$1 OR UPPER("Lib")=UPPER($2) ORDER BY (ref=$1) DESC LIMIT 1`, [a.ref, a.Lib])).rows[0];
      if (p) {
        await c.query(`UPDATE "produit" SET qte=COALESCE(qte,0)-$1 WHERE rid=$2`, [a.qte || 0, p.rid]);
        await recalcProduit(c, p.rid);
      }
    }
    await c.query(`DELETE FROM "appro" WHERE "IDapproAB"=$1 AND dateappro=$2`, [numero, date]);
    await c.query(`DELETE FROM "DEPENSEQUOTIDIEN" WHERE "NUMAPPRO"=$1 AND "DATEDEP"=$2`, [numero, date]);
  });
  res.json({ ok: true });
}));

// ---------- INVENTAIRE PHYSIQUE (comme GESTION MRPA) ----------
// Pour chaque boisson : stock du dernier inventaire + appro de la période = stock de départ ;
// stock actuel du logiciel comparé à la quantité physique comptée -> écart.
async function lignesInventaire(c, di, au) {
  const prods = (await c.query(`${SEL_PRODUIT} ORDER BY "Lib"`)).rows;
  const derniers = (await c.query(`SELECT DISTINCT ON (COALESCE(ref, UPPER(TRIM(lib)))) ref, UPPER(TRIM(lib)) lib, qte_juste, date_inv
    FROM "inventaire_maquis" ORDER BY COALESCE(ref, UPPER(TRIM(lib))), date_inv DESC, id DESC`)).rows;
  const ap = (await c.query(`SELECT ref, UPPER(TRIM("Lib")) lib, SUM(qte) qte FROM "appro" WHERE dateappro BETWEEN $1 AND $2 GROUP BY 1, 2`, [di, au])).rows;
  return prods.map((p) => {
    const L = String(p.Lib).trim().toUpperCase();
    const d = derniers.find((x) => (x.ref && x.ref === p.ref)) || derniers.find((x) => x.lib === L);
    const appro = ap.filter((x) => (x.ref && x.ref === p.ref) || x.lib === L).reduce((t, x) => t + (Number(x.qte) || 0), 0);
    const prev = d ? Number(d.qte_juste) || 0 : 0;
    return { rid: p.rid, ref: p.ref, Lib: p.Lib, dernier: prev, dateDernier: d ? d.date_inv : null, appro, depart: prev + appro,
      logiciel: Number(p.qte) || 0, prixFour: p.prixFour, pu: p.pu };
  });
}

router.get('/inventaire/preparer', h(async (req, res) => {
  const last = (await q(`SELECT MAX(date_inv) d FROM "inventaire_maquis"`)).rows[0].d;
  const di = isDate(req.query.di) ? req.query.di : (last || today().slice(0, 8) + '01');
  const au = isDate(req.query.au) ? req.query.au : today();
  res.json({ di, au, dernier: last, lignes: await lignesInventaire({ query: q }, di, au) });
}));

router.post('/inventaire', h(async (req, res) => {
  const b = req.body || {};
  const di = isDate(b.di) ? b.di : today(), au = isDate(b.au) ? b.au : today();
  const ajuster = !!b.ajuster;
  if (ajuster && !isAdmin(req.user)) throw fail("Seul l'administrateur peut ajuster le stock du logiciel.", 403);
  const saisies = (b.lignes || []).filter((l) => l.physique !== '' && l.physique !== null && l.physique !== undefined);
  if (!saisies.length) throw fail('Saisissez la quantité physique d\'au moins une boisson.');
  const out = await tx(async (c) => {
    const lignes = await lignesInventaire(c, di, au);
    const d = today(), hr = nowTime();
    const numInv = 'INV' + d.replace(/-/g, '').slice(2) + '-' + hr.replace(/:/g, '');
    let nb = 0, ecartValeur = 0;
    for (const s of saisies) {
      const l = lignes.find((x) => x.rid === Number(s.rid));
      if (!l) continue;
      const ph = num(s.physique);
      if (ph < 0) throw fail(`Quantité physique invalide pour ${l.Lib}.`);
      const ecart = Math.round((l.logiciel - ph) * 1000) / 1000;
      const ve = Math.round(ecart * l.prixFour);
      ecartValeur += ve;
      await c.query(`INSERT INTO "inventaire_maquis"(num_inv,date_inv,heure,ref,lib,qte_dernier_inv,qte_appro,qte_depart,qte_logiciel,qte_physique,qte_ecart,qte_juste,
          prix_achat,prix_vente,valeur_ecart,date_debut,date_fin,ajuste,utilisateur) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [numInv, d, hr, l.ref, l.Lib, l.dernier, l.appro, l.depart, l.logiciel, ph, ecart, ph, l.prixFour, l.pu, ve, di, au, ajuster, req.user.nom]);
      if (ajuster) {
        await c.query(`UPDATE "produit" SET qte=$1 WHERE rid=$2`, [ph, l.rid]);
        await recalcProduit(c, l.rid);
      }
      nb++;
    }
    return { numero: numInv, nb, ajuste: ajuster, ecartValeur };
  });
  res.json(out);
}));

router.get('/inventaire/liste', h(async (req, res) => {
  const r = await q(`SELECT num_inv, date_inv, MIN(heure) heure, COUNT(*) nb, SUM(ABS(qte_ecart)) ecarts, SUM(valeur_ecart) valeur_ecart,
      BOOL_OR(ajuste) ajuste, MIN(date_debut) date_debut, MAX(date_fin) date_fin, MAX(utilisateur) utilisateur
    FROM "inventaire_maquis" GROUP BY num_inv, date_inv ORDER BY date_inv DESC, MIN(id) DESC`);
  res.json(r.rows.map((x) => ({ ...x, nb: +x.nb, ecarts: +x.ecarts, valeur_ecart: +x.valeur_ecart })));
}));

router.get('/inventaire/detail', h(async (req, res) => {
  const r = await q(`SELECT * FROM "inventaire_maquis" WHERE num_inv=$1 ORDER BY lib`, [req.query.numero]);
  res.json(r.rows);
}));

router.delete('/inventaire', admin, h(async (req, res) => {
  const r = await q(`SELECT BOOL_OR(ajuste) a FROM "inventaire_maquis" WHERE num_inv=$1`, [req.query.numero]);
  if (r.rows[0].a && req.user.role !== 'superadmin') throw fail('Cet inventaire a ajusté le stock : seul le super administrateur peut le supprimer (le stock ne sera pas remis comme avant).');
  await q(`DELETE FROM "inventaire_maquis" WHERE num_inv=$1`, [req.query.numero]);
  res.json({ ok: true });
}));

module.exports = router;
module.exports.recalcProduit = recalcProduit;
module.exports.SEL_PRODUIT = SEL_PRODUIT;
module.exports.DEPENSE_APPRO = DEPENSE_APPRO;
