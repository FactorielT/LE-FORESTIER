/* ========================================================================= COMMENTAIRES-DEBUTANT
   src/routes/caisse.js — MAQUIS : DÉPENSES ET FERMETURE DE CAISSE
   -------------------------------------------------------------------------
   Montant à verser aujourd'hui = vente + crédits payés − créances − dépenses
   Versement d'hier             = montant à verser de la dernière journée fermée
   Montant total versé ce jour  = versement d'hier + montant à verser aujourd'hui
   La répartition Wave / OM / Espèce porte sur le montant à verser aujourd'hui.
   En cas d'écart, un motif est obligatoire (table journal_ecart_caisse).
   Tables : DEPENSES, DEPENSEQUOTIDIEN, VERSEMENTINTERNE, journal_ecart_caisse.
   ========================================================================= */
const router = require('express').Router();
const { q, tx } = require('../db');
const { admin, h, fail, num, today, nowTime, moisDe, anneeDe, isDate, verifierJourOuvert } = require('../util');

// ---------- DÉPENSES ----------
// Types de dépenses (table DEPENSES) : liste, ajout, suppression.
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
// DELETE /api/depenses/:id : une dépense créée par un appro ne se supprime qu'en supprimant l'appro.
router.delete('/depenses/types/:id', admin, h(async (req, res) => {
  await q(`DELETE FROM "DEPENSES" WHERE "IDDEPENSES"=$1`, [Number(req.params.id)]);
  res.json({ ok: true });
}));

// POST /api/depenses : enregistre une dépense du jour (refusé si la caisse de ce jour est fermée).
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
// GET /api/depenses?du=&au=&depense= : historique des dépenses.
router.get('/depenses', h(async (req, res) => {
  const r = await q(`SELECT "IDDEPENSES" id, "DEPENSE", "MONTANT", "DETAILS", "AGENTS", "DATEDEP", "HEUREDEP", "NUMAPPRO" FROM "DEPENSEQUOTIDIEN"
    WHERE "DATEDEP" BETWEEN $1 AND $2 AND ($3::text IS NULL OR "DEPENSE"=$3) ORDER BY "DATEDEP" DESC, "IDDEPENSES" DESC`,
  [req.query.du || '1900-01-01', req.query.au || '2999-12-31', req.query.depense || null]);
  res.json(r.rows);
}));
router.delete('/depenses/:id', admin, h(async (req, res) => {
  const d = (await q(`SELECT "DATEDEP", "NUMAPPRO" FROM "DEPENSEQUOTIDIEN" WHERE "IDDEPENSES"=$1`, [Number(req.params.id)])).rows[0];
  if (d && d.NUMAPPRO) throw fail(`Cette dépense vient de l'approvisionnement N° ${d.NUMAPPRO}. Pour l'enlever, supprimez cet approvisionnement (Bilans approvisions).`);
  if (d && d.DATEDEP && req.user.role !== 'superadmin') await verifierJourOuvert(null, d.DATEDEP, 'ou supprimer une dépense');
  await q(`DELETE FROM "DEPENSEQUOTIDIEN" WHERE "IDDEPENSES"=$1`, [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ---------- FERMETURE DE CAISSE ----------
// Calcule tous les montants de la fermeture pour une date (voir la formule en haut du fichier).
async function situation(c, date) {
  const one = async (sql) => Number((await c.query(sql, [date])).rows[0].t) || 0;
  // Versement d'hier = montant total à verser de la journée précédente (fermée)
  const hier = await c.query(`SELECT "SOMMES", "DATEVERSE" FROM "VERSEMENTINTERNE" WHERE "DATEVERSE" < $1 ORDER BY "DATEVERSE" DESC, rid DESC LIMIT 1`, [date]);
  const caisseHier = hier.rowCount ? Number(hier.rows[0].SOMMES) || 0 : 0;
  const dateHier = hier.rowCount ? hier.rows[0].DATEVERSE : null;
  const totalVente = await one(`SELECT COALESCE(SUM("TotalVentes"),0) t FROM "T_Ventes" WHERE "DateVente"=$1`);
  const creditsPayes = await one(`SELECT COALESCE(SUM(payer),0) t FROM "paiement" WHERE datepaiement=$1`);
  const creances = await one(`SELECT COALESCE(SUM(montantcreance),0) t FROM "creancier" WHERE datecreance=$1`);
  const depenses = await one(`SELECT COALESCE(SUM("MONTANT"),0) t FROM "DEPENSEQUOTIDIEN" WHERE "DATEDEP"=$1`);
  const v = (await c.query(`SELECT "NumVentes", COALESCE("CREDIT",0) credit, COALESCE("Benefice",0) benefice FROM "T_Ventes" WHERE "DateVente"=$1 LIMIT 1`, [date])).rows[0];
  const depensesAppro = await one(`SELECT COALESCE(SUM("MONTANT"),0) t FROM "DEPENSEQUOTIDIEN" WHERE "DATEDEP"=$1 AND "NUMAPPRO" IS NOT NULL`);
  const venteExiste = !!v;
  const venteCredit = v ? Number(v.credit) : 0;
  const sommes = totalVente + creditsPayes - (creances + depenses);
  return { caisseHier, dateHier, totalVente, benefice: v ? Number(v.benefice) : 0, creditsPayes, creances, depenses, depensesAppro, sommes,
    totalVerseJour: caisseHier + sommes, venteExiste, numeroVente: v ? v.NumVentes : null, venteCredit, ecartCredit: venteCredit - creances };
}

// GET /api/caisse?date= : situation de la journée + fermeture déjà faite (si elle existe).
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

// POST /api/caisse : ferme la caisse { date, wave, om, espece, motif }.
// Vérifie : pas déjà fermée, vente enregistrée, journées précédentes fermées, motif si écart.
router.post('/caisse', h(async (req, res) => {
  const { date } = req.body || {};
  if (!isDate(date)) throw fail('Date invalide.');
  const wave = Math.round(num(req.body.wave)), om = Math.round(num(req.body.om)), espece = Math.round(num(req.body.espece));
  if (wave < 0 || om < 0 || espece < 0) throw fail('Les montants Wave, OM et Espèce ne peuvent pas être négatifs.');
  const verse = wave + om + espece;
  const motif = String(req.body.motif || '').trim();
  const out = await tx(async (c) => {
    await c.query(`LOCK TABLE "VERSEMENTINTERNE" IN SHARE ROW EXCLUSIVE MODE`);
    const ex = await c.query(`SELECT 1 FROM "VERSEMENTINTERNE" WHERE "DATEVERSE"=$1`, [date]);
    if (ex.rowCount) throw fail('La caisse de cette date est déjà fermée.');
    const s = await situation(c, date);
    if (!s.venteExiste) throw fail("Aucune vente n'est enregistrée pour cette date. Enregistrez d'abord la vente de la journée.");
    const avant = (await c.query(`SELECT "NumVentes", "DateVente" FROM "T_Ventes" v WHERE "DateVente" < $1 AND COALESCE("Fermer",false)=false
      AND NOT EXISTS (SELECT 1 FROM "VERSEMENTINTERNE" f WHERE f."DATEVERSE"=v."DateVente") ORDER BY "DateVente" LIMIT 1`, [date])).rows[0];
    if (avant) throw fail(`La caisse de la vente ${avant.NumVentes} du ${avant.DateVente.split('-').reverse().join('/')} doit être fermée d'abord.`);
    const ecart = s.sommes - verse;
    if (ecart !== 0 && motif.length < 3) throw fail(`Il y a un écart de ${Math.abs(ecart).toLocaleString('fr-FR')} (${ecart > 0 ? 'manquant' : 'excédent'}) : saisissez le motif de l'écart.`);
    await c.query(
      `INSERT INTO "VERSEMENTINTERNE"("AGENTS","SOMMES","MTDEPENSES","MTVERSER","DATEVERSE","HEUREVERSE","MOISVERSE","ANNEEVERSE","MTJRCTN","ECART",
        "CREANCES","FONDSDECAISSEHIER","FermeCaisse","DATEENREG","CREDITSPAYES","WAVE","OM","ESPECE","BENEFICE","TOTALVERSEJOUR","MOTIFECART")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [req.user.nom, s.sommes, s.depenses, verse, date, nowTime(), moisDe(date), anneeDe(date), s.totalVente, s.sommes - verse,
        s.creances, s.caisseHier, today(), s.creditsPayes, wave, om, espece, s.benefice, s.totalVerseJour, ecart ? motif : null]
    );
    // La répartition est aussi reportée sur la vente du jour (bilans / statistiques)
    await c.query(`UPDATE "T_Ventes" SET "Fermer"=true, "WAVE"=$2, "OM"=$3, "ESPECE"=$4, "CREDIT"=$5 WHERE "DateVente"=$1`, [date, wave, om, espece, s.creances]);
    if (ecart !== 0) {
      await c.query(`INSERT INTO "journal_ecart_caisse"(date_caisse,montant_a_verser,wave,om,espece,total_reparti,ecart,sens,motif,agent,date_enreg,heure_enreg)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [date, s.sommes, wave, om, espece, verse, ecart, ecart > 0 ? 'MANQUANT' : 'EXCEDENT', motif, req.user.nom, today(), nowTime()]);
    }
    return { ...s, verse, wave, om, espece, ecart };
  });
  res.json(out);
}));

// GET /api/caisse/bilan?du=&au= : liste des fermetures (Bilans fermeture caisse).
router.get('/caisse/bilan', h(async (req, res) => {
  const r = await q(`SELECT rid id, "DATEENREG", "DATEVERSE", "MTJRCTN", "MTDEPENSES", "CREANCES", COALESCE("CREDITSPAYES",0) "CREDITSPAYES",
      "FONDSDECAISSEHIER", "SOMMES", "MTVERSER", COALESCE("BENEFICE",0) "BENEFICE",
      COALESCE(NULLIF("TOTALVERSEJOUR",0), COALESCE("FONDSDECAISSEHIER",0)+COALESCE("SOMMES",0)) "TOTALVERSEJOUR", COALESCE("WAVE",0) "WAVE", COALESCE("OM",0) "OM", COALESCE("ESPECE",0) "ESPECE", "ECART", "MOTIFECART", "HEUREVERSE", "AGENTS"
    FROM "VERSEMENTINTERNE" WHERE "DATEVERSE" BETWEEN $1 AND $2 ORDER BY "DATEVERSE" DESC`,
  [req.query.du || '1900-01-01', req.query.au || '2999-12-31']);
  res.json(r.rows);
}));

// DELETE /api/caisse/:id : rouvre la caisse (seulement la dernière journée). L'écart éventuel reste dans le journal, marqué « ANNULÉ ».
router.delete('/caisse/:id', admin, h(async (req, res) => {
  await tx(async (c) => {
    const f = (await c.query(`SELECT "DATEVERSE" FROM "VERSEMENTINTERNE" WHERE rid=$1`, [Number(req.params.id)])).rows[0];
    if (!f) throw fail('Fermeture introuvable.', 404);
    const apres = (await c.query(`SELECT "NumVentes" FROM "T_Ventes" WHERE "DateVente" > $1 LIMIT 1`, [f.DATEVERSE])).rows[0];
    if (apres) throw fail(`Impossible de rouvrir : une vente plus récente existe déjà (${apres.NumVentes}). Seule la dernière journée peut être rouverte.`);
    const r = (await c.query(`DELETE FROM "VERSEMENTINTERNE" WHERE rid=$1 RETURNING "DATEVERSE"`, [Number(req.params.id)])).rows[0];
    if (r) await c.query(`UPDATE "journal_ecart_caisse" SET statut='ANNULÉ (caisse rouverte)', annule_par=$2, date_annulation=NOW()
      WHERE date_caisse=$1 AND statut='VALIDE'`, [r.DATEVERSE, req.user.nom]);
    if (r) await c.query(`UPDATE "T_Ventes" SET "Fermer"=false, "WAVE"=0, "OM"=0, "ESPECE"=0, "CREDIT"=0 WHERE "DateVente"=$1`, [r.DATEVERSE]);
  });
  res.json({ ok: true });
}));

// Journal des écarts de caisse (motifs)
// GET /api/caisse/ecarts : journal des écarts de caisse et de leurs motifs.
router.get('/caisse/ecarts', h(async (req, res) => {
  const r = await q(`SELECT * FROM "journal_ecart_caisse" WHERE date_caisse BETWEEN $1 AND $2 ORDER BY date_caisse DESC, id DESC`,
    [req.query.du || '1900-01-01', req.query.au || '2999-12-31']);
  res.json(r.rows);
}));

module.exports = router;
