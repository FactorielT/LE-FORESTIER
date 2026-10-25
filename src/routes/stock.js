const router = require('express').Router();
const { q, tx } = require('../db');
const { admin, isAdmin, h, fail, num, today, nowTime, moisDe, anneeDe, isDate, nextNumero } = require('../util');

const SEL_PRODUIT = `SELECT rid, ref, "Lib", COALESCE(qte,0) qte, COALESCE(pu,0) pu, COALESCE("prixFour",0) "prixFour",
  code, typeemballage, COALESCE("PRIXEMBALLAGE",0) "PRIXEMBALLAGE" FROM "produit"`;

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
  const out = await tx(async (c) => {
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
    return { numero, qte: qteT, total: totT };
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
  });
  res.json({ ok: true });
}));

module.exports = router;
module.exports.recalcProduit = recalcProduit;
module.exports.SEL_PRODUIT = SEL_PRODUIT;
