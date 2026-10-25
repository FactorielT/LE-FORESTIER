const router = require('express').Router();
const { q } = require('../db');
const { h, today, isDate } = require('../util');

const addDays = (iso, k) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };

// Statistiques sur une période
router.get('/stats', h(async (req, res) => {
  const au = isDate(req.query.au) ? req.query.au : today();
  const du = isDate(req.query.du) ? req.query.du : addDays(au, -29);
  const P = [du, au];

  const jours = (await q(`
    WITH d AS (SELECT generate_series($1::date, $2::date, '1 day')::date d)
    SELECT to_char(d.d,'YYYY-MM-DD') d,
      COALESCE(v.ventes,0) ventes, COALESCE(v.achat,0) achat, COALESCE(v.benefice,0) benefice,
      COALESCE(x.dep,0) depenses, (v.ventes IS NOT NULL) saisie
    FROM d
    LEFT JOIN (SELECT "DateVente" d, SUM("TotalVentes") ventes, SUM("TotalAchat") achat, SUM("Benefice") benefice FROM "T_Ventes" GROUP BY 1) v ON v.d=d.d
    LEFT JOIN (SELECT "DATEDEP" d, SUM("MONTANT") dep FROM "DEPENSEQUOTIDIEN" GROUP BY 1) x ON x.d=d.d
    ORDER BY d.d`, P)).rows.map((r) => ({ ...r, ventes: +r.ventes, achat: +r.achat, benefice: +r.benefice, depenses: +r.depenses }));

  const mois = (await q(`
    WITH m AS (SELECT generate_series(date_trunc('month',$1::date), date_trunc('month',$2::date), '1 month')::date m)
    SELECT to_char(m.m,'YYYY-MM') m,
      COALESCE((SELECT SUM("TotalVentes") FROM "T_Ventes" WHERE date_trunc('month',"DateVente")=m.m),0) ventes,
      COALESCE((SELECT SUM("Benefice") FROM "T_Ventes" WHERE date_trunc('month',"DateVente")=m.m),0) benefice,
      COALESCE((SELECT SUM("MONTANT") FROM "DEPENSEQUOTIDIEN" WHERE date_trunc('month',"DATEDEP")=m.m),0) depenses,
      COALESCE((SELECT SUM("totalFour") FROM "appro" WHERE date_trunc('month',dateappro)=m.m),0) appro
    FROM m ORDER BY m.m`, [addDays(au, -364) < du ? addDays(au, -364) : du, au])).rows.map((r) => ({ m: r.m, ventes: +r.ventes, benefice: +r.benefice, depenses: +r.depenses, appro: +r.appro }));

  // On retire les premiers mois sans aucune donnée
  while (mois.length > 1 && !mois[0].ventes && !mois[0].depenses && !mois[0].appro) mois.shift();

  const top = (await q(`SELECT UPPER(TRIM(libelle)) produit, SUM("StockVendu") qte, SUM("TotalPV") ventes, SUM("Benefice") benefice
    FROM "T_Inventaire" WHERE "DateInventaire" BETWEEN $1 AND $2 GROUP BY 1 HAVING SUM("TotalPV")>0 ORDER BY 3 DESC LIMIT 10`, P)).rows
    .map((r) => ({ produit: r.produit, qte: +r.qte, ventes: +r.ventes, benefice: +r.benefice }));

  const pay = (await q(`SELECT COALESCE(SUM("WAVE"),0) wave, COALESCE(SUM("OM"),0) om, COALESCE(SUM("ESPECE"),0) espece, COALESCE(SUM("CREDIT"),0) credit,
    COALESCE(SUM("TotalVentes"),0) ventes, COALESCE(SUM("TotalAchat"),0) achat, COALESCE(SUM("Benefice"),0) benefice, COUNT(*) nb
    FROM "T_Ventes" WHERE "DateVente" BETWEEN $1 AND $2`, P)).rows[0];

  const depTypes = (await q(`SELECT "DEPENSE" type, SUM("MONTANT") total FROM "DEPENSEQUOTIDIEN" WHERE "DATEDEP" BETWEEN $1 AND $2
    GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, P)).rows.map((r) => ({ type: r.type || '—', total: +r.total }));

  const autres = (await q(`SELECT
    (SELECT COALESCE(SUM(montantcreance),0) FROM "creancier" WHERE datecreance BETWEEN $1 AND $2) credits,
    (SELECT COALESCE(SUM(payer),0) FROM "paiement" WHERE datepaiement BETWEEN $1 AND $2) payes,
    (SELECT COALESCE(SUM("totalFour"),0) FROM "appro" WHERE dateappro BETWEEN $1 AND $2) appro,
    (SELECT COALESCE(SUM("MONTANT"),0) FROM "DEPENSEQUOTIDIEN" WHERE "DATEDEP" BETWEEN $1 AND $2) depenses`, P)).rows[0];

  const n = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v) || 0]));
  res.json({ du, au, jours, mois, top, paiements: n(pay), depTypes, autres: n(autres) });
}));

// Tableau de bord de la page d'accueil
router.get('/dashboard', h(async (req, res) => {
  const d = today();
  const der = (await q(`SELECT "NumVentes", "DateVente", "TotalVentes", "Benefice" FROM "T_Ventes" ORDER BY "DateVente" DESC, "IDT_Ventes" DESC LIMIT 1`)).rows[0] || null;
  const debutMois = d.slice(0, 8) + '01';
  const mois = (await q(`SELECT COALESCE(SUM("TotalVentes"),0) ventes, COALESCE(SUM("Benefice"),0) benefice, COUNT(*) nb FROM "T_Ventes" WHERE "DateVente" BETWEEN $1 AND $2`, [debutMois, d])).rows[0];
  const depMois = (await q(`SELECT COALESCE(SUM("MONTANT"),0) t FROM "DEPENSEQUOTIDIEN" WHERE "DATEDEP" BETWEEN $1 AND $2`, [debutMois, d])).rows[0].t;
  const cr = (await q(`SELECT COALESCE(SUM("MontantCredit"),0) t, COUNT(*) FILTER (WHERE "MontantCredit">0) n FROM "CompteCreances"`)).rows[0];
  const stock = (await q(`SELECT COUNT(*) n, COALESCE(SUM(qte*pu),0) valeur FROM "produit"`)).rows[0];
  const faibles = (await q(`SELECT "Lib", qte FROM "produit" WHERE COALESCE(qte,0) <= 5 ORDER BY qte, "Lib" LIMIT 6`)).rows;
  const nonFermees = (await q(`SELECT v."NumVentes", v."DateVente" FROM "T_Ventes" v
    WHERE NOT EXISTS (SELECT 1 FROM "VERSEMENTINTERNE" f WHERE f."DATEVERSE"=v."DateVente") ORDER BY v."DateVente" DESC LIMIT 10`)).rows;
  // Jours sans vente enregistrée depuis la dernière vente
  let joursNonSaisis = 0;
  if (der && der.DateVente < d) joursNonSaisis = Math.round((new Date(d + 'T12:00:00') - new Date(der.DateVente + 'T12:00:00')) / 86400000);
  const du14 = addDays(d, -13);
  const serie = (await q(`
    WITH s AS (SELECT generate_series($1::date, $2::date, '1 day')::date d)
    SELECT to_char(s.d,'YYYY-MM-DD') d, COALESCE(SUM(v."TotalVentes"),0) ventes, COALESCE(SUM(v."Benefice"),0) benefice, COUNT(v.*)>0 saisie
    FROM s LEFT JOIN "T_Ventes" v ON v."DateVente"=s.d GROUP BY s.d ORDER BY s.d`, [du14, d])).rows.map((r) => ({ d: r.d, ventes: +r.ventes, benefice: +r.benefice, saisie: r.saisie }));
  const top = (await q(`SELECT UPPER(TRIM(libelle)) produit, SUM("StockVendu") qte, SUM("TotalPV") ventes FROM "T_Inventaire"
    WHERE "DateInventaire" BETWEEN $1 AND $2 GROUP BY 1 HAVING SUM("TotalPV")>0 ORDER BY 3 DESC LIMIT 5`, [debutMois, d])).rows.map((r) => ({ ...r, qte: +r.qte, ventes: +r.ventes }));
  res.json({
    date: d,
    derniere: der,
    prochaine: der ? addDays(der.DateVente, 1) : d,
    joursNonSaisis,
    mois: { ventes: +mois.ventes, benefice: +mois.benefice, nb: +mois.nb, depenses: +depMois },
    creances: { total: +cr.t, nb: +cr.n },
    stock: { n: +stock.n, valeur: +stock.valeur, faibles },
    nonFermees,
    serie,
    top,
  });
}));

module.exports = router;
