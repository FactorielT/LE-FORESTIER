const router = require('express').Router();
const { q, tx } = require('../db');
const { admin, h, fail, num, today, nowTime, isDate, nextNumero, estFermee } = require('../util');
const { recalcProduit } = require('./stock');

async function creditJour(c, date) {
  const r = await c.query(`SELECT COALESCE(SUM(montantcreance),0) t FROM "creancier" WHERE datecreance=$1`, [date]);
  return Number(r.rows[0].t);
}

// Approvisionnements pas encore pris en compte dans une vente.
// "jusqua" = appros datés <= date de vente (ils entrent dans la vente) ; "futur" = appros datés après (déjà dans le stock, à mettre de côté).
async function approsEnAttente(c, date, numero = null) {
  const r = await c.query(
    `SELECT ref, UPPER(TRIM("Lib")) lib, (dateappro <= $1) jusqua, SUM(qte) qte FROM "appro"
     WHERE ("NumVente" IS NULL OR "NumVente"=$2) GROUP BY ref, UPPER(TRIM("Lib")), (dateappro <= $1)`, [date, numero]);
  return { jusqua: r.rows.filter((x) => x.jusqua), futur: r.rows.filter((x) => !x.jusqua) };
}

function approPour(p, rows) {
  let t = 0;
  for (const a of rows) {
    if ((a.ref && p.ref && a.ref === p.ref) || a.lib === String(p.Lib || '').trim().toUpperCase()) t += Number(a.qte) || 0;
  }
  return t;
}

async function derniereVente(c) {
  const r = await c.query(`SELECT "NumVentes", "DateVente" FROM "T_Ventes" ORDER BY "DateVente" DESC, "IDT_Ventes" DESC LIMIT 1`);
  return r.rows[0] || null;
}
const lendemain = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const fr = (iso) => String(iso).split('-').reverse().join('/');

// Annule une vente : remet les quantités vendues en stock et libère les approvisionnements
async function annulerVente(c, numero) {
  const lignes = (await c.query(`SELECT * FROM "T_Inventaire" WHERE "NumInventaire"=$1`, [numero])).rows;
  for (const l of lignes) {
    const p = (await c.query(
      `SELECT rid FROM "produit" WHERE ($1::text IS NOT NULL AND ref=$1) OR UPPER(TRIM("Lib"))=UPPER(TRIM($2)) ORDER BY (ref=$1) DESC NULLS LAST LIMIT 1`,
      [l.ref || null, l.libelle])).rows[0];
    if (p) {
      await c.query(`UPDATE "produit" SET qte=COALESCE(qte,0)+$1 WHERE rid=$2`, [Number(l.StockVendu) || 0, p.rid]);
      await recalcProduit(c, p.rid);
    }
  }
  await c.query(`UPDATE "appro" SET "NumVente"=NULL WHERE "NumVente"=$1`, [numero]);
  await c.query(`DELETE FROM "T_Inventaire" WHERE "NumInventaire"=$1`, [numero]);
  await c.query(`DELETE FROM "T_Ventes" WHERE "NumVentes"=$1`, [numero]);
}

router.get('/ventes/preparer', h(async (req, res) => {
  const date = req.query.date;
  if (!isDate(date)) throw fail('Date invalide.');
  const ex = (await q(`SELECT * FROM "T_Ventes" WHERE "DateVente"=$1 LIMIT 1`, [date])).rows[0] || null;
  const der = await derniereVente({ query: q });
  const derFermee = der ? await estFermee({ query: q }, der.DateVente) : true;
  const info = {
    derniere: der ? { numero: der.NumVentes, date: der.DateVente, fermee: derFermee } : null,
    prochaine: der ? lendemain(der.DateVente) : null, aujourdhui: today(),
    creditJour: await creditJour({ query: q }, date),
  };
  if (date > today()) return res.json({ ...info, erreur: 'La date de vente ne peut pas être dans le futur.' });
  let modif = null;
  if (ex) {
    const fermee = await estFermee({ query: q }, date);
    if (fermee) return res.json({ ...info, existe: ex, fermee: true });
    // Vente non fermée : elle peut être modifiée
    modif = (await q(`SELECT ref, libelle, "StockVendu", "StockPhysiqueActuel" FROM "T_Inventaire" WHERE "NumInventaire"=$1`, [ex.NumVentes])).rows;
  } else {
    if (der && !derFermee) {
      return res.json({ ...info, bloque: true, erreur: `La caisse de la vente ${der.NumVentes} du ${fr(der.DateVente)} n'est pas encore fermée. Vous devez fermer cette caisse avant de faire une nouvelle vente.` });
    }
    if (der && date < der.DateVente) {
      return res.json({ ...info, erreur: `Une vente plus récente est déjà enregistrée (${der.NumVentes} du ${fr(der.DateVente)}). Les ventes doivent être enregistrées dans l'ordre des dates : saisissez une date à partir du ${fr(lendemain(der.DateVente))}.` });
    }
  }
  const prods = (await q(`SELECT rid, ref, "Lib", COALESCE(qte,0) qte, COALESCE(pu,0) pu, COALESCE("prixFour",0) "prixFour" FROM "produit" ORDER BY "Lib"`)).rows;
  const ap = await approsEnAttente({ query: q }, date, ex && ex.NumVentes);
  const lignesExistantes = [];
  const produits = prods.map((p) => {
    const old = modif ? modif.find((l) => (l.ref && l.ref === p.ref) || String(l.libelle).trim().toUpperCase() === String(p.Lib).trim().toUpperCase()) : null;
    const qteAppro = approPour(p, ap.jusqua);
    const depart = p.qte + (old ? Number(old.StockVendu) || 0 : 0) - approPour(p, ap.futur);
    if (old) lignesExistantes.push({ rid: p.rid, restant: Number(old.StockPhysiqueActuel) || 0 });
    return { rid: p.rid, ref: p.ref, Lib: p.Lib, qteInitial: depart - qteAppro, qteAppro, depart, pu: p.pu, prixFour: p.prixFour };
  });
  res.json({ ...info, existe: ex, modification: !!ex, lignesExistantes, produits });
}));

router.post('/ventes', h(async (req, res) => {
  const b = req.body || {};
  const date = b.date;
  if (!isDate(date)) throw fail('Date de vente invalide.');
  const lignes = b.lignes || [];
  if (!lignes.length) throw fail('Aucune boisson saisie.');
  const out = await tx(async (c) => {
    await c.query(`LOCK TABLE "T_Ventes" IN SHARE ROW EXCLUSIVE MODE`);
    if (date > today()) throw fail('La date de vente ne peut pas être dans le futur.');
    let numero = null, dateEnreg = today(), heureEnreg = nowTime();
    const ex = (await c.query(`SELECT * FROM "T_Ventes" WHERE "DateVente"=$1`, [date])).rows[0];
    if (b.numero) {
      // MODIFICATION d'une vente non fermée
      if (!ex || ex.NumVentes !== b.numero) throw fail('Vente à modifier introuvable pour cette date.');
      if (await estFermee(c, date)) throw fail('La caisse de cette journée est fermée : la vente ne peut plus être modifiée.');
      numero = ex.NumVentes; dateEnreg = ex.DATEENREG || today(); heureEnreg = ex.HEUREENREG || nowTime();
      await annulerVente(c, numero);
    } else {
      if (ex) throw fail(`La vente du ${fr(date)} est déjà enregistrée (${ex.NumVentes}).`);
      const der = await derniereVente(c);
      if (der && !(await estFermee(c, der.DateVente))) throw fail(`La caisse de la vente ${der.NumVentes} du ${fr(der.DateVente)} n'est pas fermée. Fermez-la avant de faire une nouvelle vente.`);
      if (der && date < der.DateVente) throw fail(`Une vente plus récente est déjà enregistrée (${der.NumVentes} du ${fr(der.DateVente)}). Enregistrez les ventes dans l'ordre des dates.`);
    }
    const ap = await approsEnAttente(c, date);
    const calc = [];
    let totalV = 0, totalA = 0;
    for (const l of lignes) {
      const p = (await c.query(`SELECT * FROM "produit" WHERE rid=$1 FOR UPDATE`, [Number(l.rid)])).rows[0];
      if (!p) throw fail('Article introuvable.');
      const futur = approPour(p, ap.futur);
      const depart = (Number(p.qte) || 0) - futur;
      const restant = num(l.restant);
      if (restant < 0) throw fail(`Quantité restante invalide pour ${p.Lib}.`);
      if (restant > depart + 1e-9) throw fail(`${p.Lib} : la quantité restante (${restant}) dépasse le stock de départ (${depart}).`);
      const qteAppro = approPour(p, ap.jusqua);
      const vendu = Math.round((depart - restant) * 1000) / 1000;
      const pu = Number(p.pu) || 0, pa = Number(p.prixFour) || 0;
      const tv = Math.round(vendu * pu), ta = Math.round(vendu * pa);
      totalV += tv; totalA += ta;
      calc.push({ p, depart, restant, qteAppro, futur, vendu, pu, pa, tv, ta });
    }
    const credit = Math.round(num(b.credit)), wave = Math.round(num(b.wave)), om = Math.round(num(b.om)), espece = Math.round(num(b.espece));
    if (credit + wave + om + espece !== totalV) {
      throw fail(`La somme Crédit + Wave + OM + Espèce (${(credit + wave + om + espece).toLocaleString('fr-FR')}) doit être égale au Total Vente (${totalV.toLocaleString('fr-FR')}).`);
    }
    if (!numero) numero = await nextNumero(c, 'NumInvent', 'format_vente', date, `SELECT 1 FROM "T_Ventes" WHERE "NumVentes"=$1`);
    await c.query(
      `INSERT INTO "T_Ventes"("NumVentes","TotalVentes","TotalAchat","Benefice","WAVE","OM","ESPECE","CREDIT","DateVente","DATEENREG","HEUREENREG","AGENT","Fermer")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false)`,
      [numero, totalV, totalA, totalV - totalA, wave, om, espece, credit, date, dateEnreg, heureEnreg, req.user.nom]
    );
    for (const x of calc) {
      await c.query(
        `INSERT INTO "T_Inventaire"("DateInventaire",libelle,"NumInventaire","StockHier","StockApproHier","StockHierMatin","StockLogicielActuel",
          "StockPhysiqueActuel","StockVendu","PrixUnitaire","TotalPV","DATEENREG","TotalAchat","Benefice",ref,"PrixAchat")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [date, x.p.Lib, numero, x.depart - x.qteAppro, x.qteAppro, x.depart, x.depart, x.restant, x.vendu, x.pu, x.tv, dateEnreg, x.ta, x.tv - x.ta, x.p.ref, x.pa]
      );
      await c.query(`UPDATE "produit" SET qte=$1 WHERE rid=$2`, [x.restant + x.futur, x.p.rid]);
      await recalcProduit(c, x.p.rid);
      await c.query(
        `UPDATE "appro" SET "NumVente"=$1 WHERE "NumVente" IS NULL AND dateappro <= $2
         AND (ref=$3 OR UPPER(TRIM("Lib"))=UPPER(TRIM($4)))`,
        [numero, date, x.p.ref, x.p.Lib]
      );
    }
    const cj = await creditJour(c, date);
    return { numero, modification: !!b.numero, dateVente: date, dateEnreg, totalVentes: totalV, totalAchat: totalA, benefice: totalV - totalA, credit, creancesSaisies: cj };
  });
  res.json(out);
}));

router.get('/ventes', h(async (req, res) => {
  const r = await q(
    `SELECT "IDT_Ventes" id, "NumVentes", "DateVente", "DATEENREG", "TotalVentes", "TotalAchat", "Benefice", "WAVE", "OM", "ESPECE",
       COALESCE("CREDIT",0) "CREDIT", "Fermer", "AGENT"
     FROM "T_Ventes" WHERE "DateVente" BETWEEN $1 AND $2 ORDER BY "DateVente" DESC`,
    [req.query.du || '1900-01-01', req.query.au || '2999-12-31']
  );
  res.json(r.rows);
}));

router.get('/ventes/detail', h(async (req, res) => {
  const numero = req.query.numero;
  const v = (await q(`SELECT * FROM "T_Ventes" WHERE "NumVentes"=$1 ORDER BY "IDT_Ventes" LIMIT 1`, [numero])).rows[0];
  const lignes = (await q(
    `SELECT "IDT_Inventaire" id, "NumInventaire", "DATEENREG", "DateInventaire", libelle, "StockHier", "StockApproHier", "StockHierMatin",
       "StockPhysiqueActuel", "StockVendu", "PrixUnitaire", "TotalPV", "TotalAchat", "Benefice"
     FROM "T_Inventaire" WHERE "NumInventaire"=$1 ORDER BY libelle`, [numero])).rows;
  if (!v && !lignes.length) throw fail('Vente introuvable.', 404);
  let credit = v ? Number(v.CREDIT) || 0 : 0;
  if (v && !credit) credit = await creditJour({ query: q }, v.DateVente);
  res.json({ vente: v || null, lignes, creditJour: credit });
}));

router.delete('/ventes', admin, h(async (req, res) => {
  const numero = req.query.numero;
  await tx(async (c) => {
    const v = (await c.query(`SELECT * FROM "T_Ventes" WHERE "NumVentes"=$1`, [numero])).rows[0];
    if (!v) throw fail('Vente introuvable.', 404);
    const der = await derniereVente(c);
    if (der && der.DateVente > v.DateVente) {
      throw fail(`Seule la dernière vente (${der.NumVentes} du ${fr(der.DateVente)}) peut être supprimée, afin de garder le stock cohérent. Supprimez d'abord les ventes plus récentes.`);
    }
    if ((await estFermee(c, v.DateVente)) && req.user.role !== 'superadmin') {
      throw fail('La caisse de ce jour est déjà fermée. Seul le super administrateur peut supprimer cette vente.');
    }
    await annulerVente(c, numero);
  });
  res.json({ ok: true });
}));

module.exports = router;
module.exports.creditJour = creditJour;
module.exports.estFermee = estFermee;
