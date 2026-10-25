const router = require('express').Router();
const { q, tx } = require('../db');
const { admin, h, fail, num, today, moisDe, anneeDe, isDate, nextNumero, verifierJourOuvert } = require('../util');

async function compte(c, nom) {
  const r = await c.query(`SELECT * FROM "CompteCreances" WHERE UPPER(TRIM("Nomprenom"))=UPPER(TRIM($1)) ORDER BY "IDCompteCreances" LIMIT 1 FOR UPDATE`, [nom]);
  if (r.rowCount) return r.rows[0];
  return (await c.query(`INSERT INTO "CompteCreances"("Nomprenom","MontantCredit") VALUES ($1,0) RETURNING *`, [nom])).rows[0];
}

// Liste des créanciers (clients) avec solde
router.get('/creanciers', h(async (req, res) => {
  const r = await q(`
    WITH noms AS (
      SELECT TRIM("Nomprenom") nom FROM "client" WHERE COALESCE(TRIM("Nomprenom"),'')<>''
      UNION SELECT TRIM("Nomprenom") FROM "CompteCreances" WHERE COALESCE(TRIM("Nomprenom"),'')<>''
    )
    SELECT n.nom, MAX(c."numCli") "numCli", MAX(c.contact) contact,
      COALESCE((SELECT SUM("MontantCredit") FROM "CompteCreances" cc WHERE UPPER(TRIM(cc."Nomprenom"))=UPPER(n.nom)),0) solde
    FROM noms n LEFT JOIN "client" c ON UPPER(TRIM(c."Nomprenom"))=UPPER(n.nom)
    GROUP BY n.nom ORDER BY n.nom`);
  // dédoublonnage insensible à la casse
  const seen = new Set();
  res.json(r.rows.filter((x) => { const k = x.nom.toUpperCase(); if (seen.has(k)) return false; seen.add(k); return true; }));
}));

router.post('/creanciers', h(async (req, res) => {
  const nom = String((req.body || {}).nom || '').trim().toUpperCase();
  const contact = String((req.body || {}).contact || '').trim();
  if (!nom) throw fail('Le nom et prénoms sont obligatoires.');
  const out = await tx(async (c) => {
    const ex = await c.query(`SELECT 1 FROM "client" WHERE UPPER(TRIM("Nomprenom"))=$1`, [nom]);
    if (ex.rowCount) throw fail('Ce créancier existe déjà.');
    const numCli = await nextNumero(c, 'numCli', 'format_client', today(), `SELECT 1 FROM "client" WHERE "numCli"=$1`);
    await c.query(`INSERT INTO "client"("Nomprenom",contact,"numCli",utilisateur) VALUES ($1,$2,$3,$4)`, [nom, contact, numCli, req.user.nom]);
    await compte(c, nom);
    return { nom, numCli };
  });
  res.json(out);
}));

router.put('/creanciers', h(async (req, res) => {
  const { nom, contact } = req.body || {};
  await q(`UPDATE "client" SET contact=$1 WHERE UPPER(TRIM("Nomprenom"))=UPPER(TRIM($2))`, [contact || '', nom]);
  res.json({ ok: true });
}));

router.delete('/creanciers', admin, h(async (req, res) => {
  const nom = req.query.nom;
  await tx(async (c) => {
    await c.query(`DELETE FROM "CompteCreances" WHERE UPPER(TRIM("Nomprenom"))=UPPER(TRIM($1))`, [nom]);
    await c.query(`DELETE FROM "client" WHERE UPPER(TRIM("Nomprenom"))=UPPER(TRIM($1))`, [nom]);
  });
  res.json({ ok: true });
}));

router.get('/creanciers/detail', h(async (req, res) => {
  const nom = req.query.nom;
  const credits = (await q(`SELECT "IDcreancier" id, datecreance, montantcreance, motifcreance FROM "creancier"
    WHERE UPPER(TRIM(nomcreancier))=UPPER(TRIM($1)) ORDER BY datecreance DESC, "IDcreancier" DESC`, [nom])).rows;
  const paiements = (await q(`SELECT "IDpaiement" id, datepaiement, payer FROM "paiement"
    WHERE UPPER(TRIM(client))=UPPER(TRIM($1)) ORDER BY datepaiement DESC, "IDpaiement" DESC`, [nom])).rows;
  const solde = (await q(`SELECT COALESCE(SUM("MontantCredit"),0) s FROM "CompteCreances" WHERE UPPER(TRIM("Nomprenom"))=UPPER(TRIM($1))`, [nom])).rows[0].s;
  const cl = (await q(`SELECT contact, "numCli" FROM "client" WHERE UPPER(TRIM("Nomprenom"))=UPPER(TRIM($1)) LIMIT 1`, [nom])).rows[0] || {};
  res.json({ nom, contact: cl.contact, numCli: cl.numCli, solde: Number(solde), credits, paiements });
}));

// Tableau de bord des créances
router.get('/creances/tableau', h(async (req, res) => {
  const r = await q(`SELECT MIN("IDCompteCreances") id, MIN(TRIM("Nomprenom")) nom, SUM("MontantCredit") solde FROM "CompteCreances"
    GROUP BY UPPER(TRIM("Nomprenom")) HAVING SUM("MontantCredit")<>0 ORDER BY 2`);
  res.json(r.rows);
}));

// Enregistrement de crédit
router.post('/credits', h(async (req, res) => {
  const { date, nom, montant, motif } = req.body || {};
  if (!isDate(date)) throw fail('Date du crédit invalide.');
  if (!nom) throw fail('Sélectionnez le créancier.');
  const m = Math.round(num(montant));
  if (m <= 0) throw fail('Le montant du crédit doit être supérieur à 0.');
  await tx(async (c) => {
    await verifierJourOuvert(c, date, 'un crédit');
    const cpt = await compte(c, nom);
    await c.query(
      `INSERT INTO "creancier"(nomcreancier,montantcreance,motifcreance,datecreance,mois,annee,valeurscredits,totalverser,reste,"DATEENREG")
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9)`,
      [cpt.Nomprenom, m, motif || null, date, moisDe(date), anneeDe(date), Number(cpt.MontantCredit) + m, m, today()]
    );
    await c.query(`UPDATE "CompteCreances" SET "MontantCredit"=COALESCE("MontantCredit",0)+$1 WHERE "IDCompteCreances"=$2`, [m, cpt.IDCompteCreances]);
  });
  res.json({ ok: true });
}));

router.get('/credits', h(async (req, res) => {
  const r = await q(`SELECT "IDcreancier" id, nomcreancier, montantcreance, motifcreance, datecreance FROM "creancier"
    WHERE datecreance BETWEEN $1 AND $2 AND ($3::text IS NULL OR UPPER(TRIM(nomcreancier))=UPPER(TRIM($3)))
    ORDER BY datecreance DESC, "IDcreancier" DESC`, [req.query.du || '1900-01-01', req.query.au || '2999-12-31', req.query.nom || null]);
  res.json(r.rows);
}));

router.delete('/credits/:id', admin, h(async (req, res) => {
  await tx(async (c) => {
    const cr = (await c.query(`DELETE FROM "creancier" WHERE "IDcreancier"=$1 RETURNING *`, [Number(req.params.id)])).rows[0];
    if (!cr) throw fail('Crédit introuvable.', 404);
    if (cr.datecreance && req.user.role !== 'superadmin') await verifierJourOuvert(c, cr.datecreance, 'ou supprimer un crédit');
    const cpt = await compte(c, cr.nomcreancier);
    await c.query(`UPDATE "CompteCreances" SET "MontantCredit"=COALESCE("MontantCredit",0)-$1 WHERE "IDCompteCreances"=$2`, [Number(cr.montantcreance) || 0, cpt.IDCompteCreances]);
  });
  res.json({ ok: true });
}));

// Paiement des arriérés
router.post('/paiements', h(async (req, res) => {
  const { date, nom, montant } = req.body || {};
  if (!isDate(date)) throw fail('Date invalide.');
  if (!nom) throw fail('Sélectionnez le créancier.');
  const m = Math.round(num(montant));
  if (m <= 0) throw fail('Le montant versé doit être supérieur à 0.');
  const out = await tx(async (c) => {
    await verifierJourOuvert(c, date, 'un paiement de crédit');
    const cpt = await compte(c, nom);
    const solde = Number(cpt.MontantCredit) || 0;
    if (m > solde) throw fail(`Le montant versé (${m.toLocaleString('fr-FR')}) dépasse le total des crédits (${solde.toLocaleString('fr-FR')}).`);
    await c.query(`INSERT INTO "paiement"("numCmde",montantcmde,payer,datepaiement,annee,client,"DATEENREG") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [null, solde, m, date, anneeDe(date), cpt.Nomprenom, today()]);
    await c.query(`UPDATE "CompteCreances" SET "MontantCredit"=$1 WHERE "IDCompteCreances"=$2`, [solde - m, cpt.IDCompteCreances]);
    return { solde: solde - m };
  });
  res.json(out);
}));

router.get('/paiements', h(async (req, res) => {
  const r = await q(`SELECT "IDpaiement" id, client, payer, datepaiement FROM "paiement"
    WHERE datepaiement BETWEEN $1 AND $2 AND ($3::text IS NULL OR UPPER(TRIM(client))=UPPER(TRIM($3)))
    ORDER BY datepaiement DESC, "IDpaiement" DESC`, [req.query.du || '1900-01-01', req.query.au || '2999-12-31', req.query.nom || null]);
  res.json(r.rows);
}));

router.delete('/paiements/:id', admin, h(async (req, res) => {
  await tx(async (c) => {
    const p = (await c.query(`DELETE FROM "paiement" WHERE "IDpaiement"=$1 RETURNING *`, [Number(req.params.id)])).rows[0];
    if (!p) throw fail('Paiement introuvable.', 404);
    if (p.datepaiement && req.user.role !== 'superadmin') await verifierJourOuvert(c, p.datepaiement, 'ou supprimer un paiement');
    const cpt = await compte(c, p.client);
    await c.query(`UPDATE "CompteCreances" SET "MontantCredit"=COALESCE("MontantCredit",0)+$1 WHERE "IDCompteCreances"=$2`, [Number(p.payer) || 0, cpt.IDCompteCreances]);
  });
  res.json({ ok: true });
}));

module.exports = router;
