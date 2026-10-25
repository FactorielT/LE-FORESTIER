const router = require('express').Router();
const { q, tx } = require('../db');
const { admin, h, fail, num, today, nowTime, moisDe, anneeDe, isDate } = require('../util');

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
  const venteExiste = (await c.query(`SELECT 1 FROM "T_Ventes" WHERE "DateVente"=$1`, [date])).rowCount > 0;
  return { caisseHier, totalVente, creditsPayes, creances, depenses, sommes: totalVente + creditsPayes - (creances + depenses), venteExiste };
}

router.get('/caisse', h(async (req, res) => {
  const date = req.query.date;
  if (!isDate(date)) throw fail('Date invalide.');
  const ex = await q(`SELECT * FROM "VERSEMENTINTERNE" WHERE "DATEVERSE"=$1 LIMIT 1`, [date]);
  res.json({ ...(await situation({ query: q }, date)), existe: ex.rows[0] || null });
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
    const r = (await c.query(`DELETE FROM "VERSEMENTINTERNE" WHERE rid=$1 RETURNING "DATEVERSE"`, [Number(req.params.id)])).rows[0];
    if (r) await c.query(`UPDATE "T_Ventes" SET "Fermer"=false WHERE "DateVente"=$1`, [r.DATEVERSE]);
  });
  res.json({ ok: true });
}));

module.exports = router;
