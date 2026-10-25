const router = require('express').Router();
const { q, tx } = require('../db');
const { admin, h, fail, num, today, nowTime, moisDe, anneeDe, isDate, verifierJourOuvert } = require('../util');

// ---------- DÉPENSES ----------
router.get('/depenses/types', h(async (req, res) => {
  const r = await q(`SELECT "IDDEPENSES" id, TRIM("NOMDEPENSE") nom FROM "DEPENSES" WHERE COALESCE(TRIM("NOMDEPENSE"),'')<>'' ORDER BY 2`);
  res.json(r.rows);
}));
router.post('/depenses/types', h(async (req, res) => {
  const nom = String((req.body || {}).nom || '').trim().toUpperCase();
  if (!nom) throw fail('Saisissez le nom de la dépense.');
  const ex = await q(`SELECT 1 FROM "DEPENSES" WHERE UPPER(TRIM("NOMDEPENSE"))=$1`, [nom]);
  if (ex.rowCount) throw fail('Cette dépense existe déjà.');
  await q(`INSERT INTO "DEPENSES"("NOMDEPENSE") VALUES ($1)`, [nom]);
  res.json({ ok: true, nom });
}));
router.delete('/depenses/types/:id', admin, h(async (req, res) => {
  await q(`DELETE FROM "DEPENSES" WHERE "IDDEPENSES"=$1`, [Number(req.params.id)]);
  res.json({ ok: true });
}));

router.post('/depenses', h(async (req, res) => {
  const { date, depense, montant, motif } = req.body || {};
  if (!isDate(date)) throw fail('Date de dépense invalide.');
  if (!depense) throw fail('Sélectionnez la dépense.');
  const m = Math.round(num(montant));
  if (m <= 0) throw fail('Le montant doit être supérieur à 0.');
  await verifierJourOuvert(null, date, 'une dépense');
  await q(`INSERT INTO "DEPENSEQUOTIDIEN"("DEPENSE","MONTANT","DETAILS","AGENTS","DATEDEP","HEUREDEP","MOISDEP","ANNEEDEP","DATEENREG")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [depense, m, motif || null, req.user.nom, date, nowTime(), moisDe(date), anneeDe(date), today()]);
  res.json({ ok: true });
}));
router.get('/depenses', h(async (req, res) => {
  const r = await q(`SELECT "IDDEPENSES" id, "DEPENSE", "MONTANT", "DETAILS", "AGENTS", "DATEDEP", "HEUREDEP" FROM "DEPENSEQUOTIDIEN"
    WHERE "DATEDEP" BETWEEN $1 AND $2 AND ($3::text IS NULL OR "DEPENSE"=$3) ORDER BY "DATEDEP" DESC, "IDDEPENSES" DESC`,
  [req.query.du || '1900-01-01', req.query.au || '2999-12-31', req.query.depense || null]);
  res.json(r.rows);
}));
router.delete('/depenses/:id', admin, h(async (req, res) => {
  const d = (await q(`SELECT "DATEDEP" FROM "DEPENSEQUOTIDIEN" WHERE "IDDEPENSES"=$1`, [Number(req.params.id)])).rows[0];
  if (d && d.DATEDEP && req.user.role !== 'superadmin') await verifierJourOuvert(null, d.DATEDEP, 'ou supprimer une dépense');
  await q(`DELETE FROM "DEPENSEQUOTIDIEN" WHERE "IDDEPENSES"=$1`, [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ---------- FERMETURE DE CAISSE ----------
async function situation(c, date) {
  const one = async (sql) => Number((await c.query(sql, [date])).rows[0].t) || 0;
  const hier = await c.query(`SELECT "MTVERSER" FROM "VERSEMENTINTERNE" WHERE "DATEVERSE" < $1 ORDER BY "DATEVERSE" DESC, rid DESC LIMIT 1`, [date]);
  const caisseHier = hier.rowCount ? Number(hier.rows[0].MTVERSER) || 0 : 0;
  const totalVente = await one(`SELECT COALESCE(SUM("TotalVentes"),0) t FROM "T_Ventes" WHERE "DateVente"=$1`);
  const creditsPayes = await one(`SELECT COALESCE(SUM(payer),0) t FROM "paiement" WHERE datepaiement=$1`);
  const creances = await one(`SELECT COALESCE(SUM(montantcreance),0) t FROM "creancier" WHERE datecreance=$1`);
  const depenses = await one(`SELECT COALESCE(SUM("MONTANT"),0) t FROM "DEPENSEQUOTIDIEN" WHERE "DATEDEP"=$1`);
  const v = (await c.query(`SELECT "NumVentes", COALESCE("CREDIT",0) credit FROM "T_Ventes" WHERE "DateVente"=$1 LIMIT 1`, [date])).rows[0];
  const venteExiste = !!v;
  const venteCredit = v ? Number(v.credit) : 0;
  return { caisseHier, totalVente, creditsPayes, creances, depenses, sommes: totalVente + creditsPayes - (creances + depenses), venteExiste,
    numeroVente: v ? v.NumVentes : null, venteCredit, ecartCredit: venteCredit - creances };
}

router.get('/caisse', h(async (req, res) => {
  const date = req.query.date;
  if (!isDate(date)) throw fail('Date invalide.');
  const ex = await q(`SELECT * FROM "VERSEMENTINTERNE" WHERE "DATEVERSE"=$1 LIMIT 1`, [date]);
  const ap = (await q(`SELECT COUNT(DISTINCT "IDapproAB") n, COALESCE(SUM("totalFour"),0) t FROM "appro" WHERE dateappro=$1`, [date])).rows[0];
  const nd = (await q(`SELECT COUNT(*) n FROM "DEPENSEQUOTIDIEN" WHERE "DATEDEP"=$1`, [date])).rows[0];
  // Plus ancienne vente dont la caisse n'est pas fermée
  const aFermer = (await q(`SELECT "NumVentes", "DateVente" FROM "T_Ventes" v WHERE COALESCE("Fermer",false)=false
    AND NOT EXISTS (SELECT 1 FROM "VERSEMENTINTERNE" f WHERE f."DATEVERSE"=v."DateVente") ORDER BY "DateVente" LIMIT 1`)).rows[0] || null;
  res.json({ ...(await situation({ query: q }, date)), existe: ex.rows[0] || null, appro: { n: +ap.n, total: +ap.t }, nbDepenses: +nd.n, aFermer });
}));

router.post('/caisse', h(async (req, res) => {
  const { date, montantVerse } = req.body || {};
  if (!isDate(date)) throw fail('Date invalide.');
  const verse = Math.round(num(montantVerse));
  const out = await tx(async (c) => {
    await c.query(`LOCK TABLE "VERSEMENTINTERNE" IN SHARE ROW EXCLUSIVE MODE`);
    const ex = await c.query(`SELECT 1 FROM "VERSEMENTINTERNE" WHERE "DATEVERSE"=$1`, [date]);
    if (ex.rowCount) throw fail('La caisse de cette date est déjà fermée.');
    const s = await situation(c, date);
    if (!s.venteExiste) throw fail("Aucune vente n'est enregistrée pour cette date. Enregistrez d'abord la vente de la journée.");
    const avant = (await c.query(`SELECT "NumVentes", "DateVente" FROM "T_Ventes" v WHERE "DateVente" < $1 AND COALESCE("Fermer",false)=false
      AND NOT EXISTS (SELECT 1 FROM "VERSEMENTINTERNE" f WHERE f."DATEVERSE"=v."DateVente") ORDER BY "DateVente" LIMIT 1`, [date])).rows[0];
    if (avant) throw fail(`La caisse de la vente ${avant.NumVentes} du ${avant.DateVente.split('-').reverse().join('/')} doit être fermée d'abord.`);
    if (s.venteCredit !== s.creances) {
      throw fail(`Le total crédit de la vente (${s.venteCredit.toLocaleString('fr-FR')}) est différent du total des créances enregistrées individuellement pour ce jour (${s.creances.toLocaleString('fr-FR')}). `
        + (s.venteCredit > s.creances ? `Enregistrez les créances restantes (${(s.venteCredit - s.creances).toLocaleString('fr-FR')}) dans la rubrique Créances avant de fermer la caisse.` : 'Corrigez les créances ou modifiez la vente avant de fermer la caisse.'));
    }
    await c.query(
      `INSERT INTO "VERSEMENTINTERNE"("AGENTS","SOMMES","MTDEPENSES","MTVERSER","DATEVERSE","HEUREVERSE","MOISVERSE","ANNEEVERSE","MTJRCTN","ECART",
        "CREANCES","FONDSDECAISSEHIER","FermeCaisse","DATEENREG","CREDITSPAYES") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$14)`,
      [req.user.nom, s.sommes, s.depenses, verse, date, nowTime(), moisDe(date), anneeDe(date), s.totalVente, s.sommes - verse,
        s.creances, s.caisseHier, today(), s.creditsPayes]
    );
    await c.query(`UPDATE "T_Ventes" SET "Fermer"=true WHERE "DateVente"=$1`, [date]);
    return { ...s, verse, ecart: s.sommes - verse };
  });
  res.json(out);
}));

router.get('/caisse/bilan', h(async (req, res) => {
  const r = await q(`SELECT rid id, "DATEENREG", "DATEVERSE", "MTJRCTN", "MTDEPENSES", "CREANCES", COALESCE("CREDITSPAYES",0) "CREDITSPAYES",
      "FONDSDECAISSEHIER", "SOMMES", "MTVERSER", "ECART", "HEUREVERSE", "AGENTS"
    FROM "VERSEMENTINTERNE" WHERE "DATEVERSE" BETWEEN $1 AND $2 ORDER BY "DATEVERSE" DESC`,
  [req.query.du || '1900-01-01', req.query.au || '2999-12-31']);
  res.json(r.rows);
}));

router.delete('/caisse/:id', admin, h(async (req, res) => {
  await tx(async (c) => {
    const f = (await c.query(`SELECT "DATEVERSE" FROM "VERSEMENTINTERNE" WHERE rid=$1`, [Number(req.params.id)])).rows[0];
    if (!f) throw fail('Fermeture introuvable.', 404);
    const apres = (await c.query(`SELECT "NumVentes" FROM "T_Ventes" WHERE "DateVente" > $1 LIMIT 1`, [f.DATEVERSE])).rows[0];
    if (apres) throw fail(`Impossible de rouvrir : une vente plus récente existe déjà (${apres.NumVentes}). Seule la dernière journée peut être rouverte.`);
    const r = (await c.query(`DELETE FROM "VERSEMENTINTERNE" WHERE rid=$1 RETURNING "DATEVERSE"`, [Number(req.params.id)])).rows[0];
    if (r) await c.query(`UPDATE "T_Ventes" SET "Fermer"=false WHERE "DateVente"=$1`, [r.DATEVERSE]);
  });
  res.json({ ok: true });
}));

module.exports = router;
