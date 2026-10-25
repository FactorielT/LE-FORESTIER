const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q } = require('../db');
const { admin, superadmin, h, fail, formatNumero, today, roleOf } = require('../util');

router.use(admin);

// Numéros automatiques
const COLS_NUM = ['numCli', 'numCmde', 'Numappro', 'numprod', 'MATRICU', 'NumInvent'];
router.get('/numeros', h(async (req, res) => {
  const r = await q(`SELECT * FROM "numero" ORDER BY rid LIMIT 1`);
  const p = (await q(`SELECT cle, valeur FROM "parametres"`)).rows.reduce((a, x) => ((a[x.cle] = x.valeur), a), {});
  const row = r.rows[0] || {};
  const d = today();
  res.json({
    numero: row,
    formats: { format_vente: p.format_vente, format_appro: p.format_appro, format_produit: p.format_produit, format_client: p.format_client },
    apercu: {
      vente: formatNumero(p.format_vente || '{N}', (parseInt(row.NumInvent, 10) || 0) + 1, d),
      appro: formatNumero(p.format_appro || '{N}', (parseInt(row.Numappro, 10) || 0) + 1, d),
      produit: formatNumero(p.format_produit || '{N}', (parseInt(row.numprod, 10) || 0) + 1, d, 'BIERE'),
      client: formatNumero(p.format_client || '{N}', (parseInt(row.numCli, 10) || 0) + 1, d),
    },
  });
}));
router.put('/numeros', h(async (req, res) => {
  const b = req.body || {};
  const r = await q(`SELECT rid FROM "numero" ORDER BY rid LIMIT 1`);
  for (const c of COLS_NUM) {
    if (b.numero && b.numero[c] !== undefined) {
      if (!/^\d+$/.test(String(b.numero[c]).trim())) throw fail(`Valeur invalide pour ${c} (nombre entier attendu).`);
      await q(`UPDATE "numero" SET "${c}"=$1 WHERE rid=$2`, [String(b.numero[c]).trim(), r.rows[0].rid]);
    }
  }
  for (const k of ['format_vente', 'format_appro', 'format_produit', 'format_client']) {
    if (b.formats && b.formats[k] !== undefined) {
      const v = String(b.formats[k]).trim();
      if (!/\{N\d?\}/.test(v)) throw fail(`Le format "${v}" doit contenir {N}, {N3}, {N4} ou {N6}.`);
      await q(`INSERT INTO "parametres"(cle,valeur) VALUES ($1,$2) ON CONFLICT (cle) DO UPDATE SET valeur=EXCLUDED.valeur`, [k, v]);
    }
  }
  res.json({ ok: true });
}));

router.get('/parametres', h(async (req, res) => {
  res.json((await q(`SELECT cle, valeur FROM "parametres" ORDER BY cle`)).rows);
}));
router.put('/parametres', h(async (req, res) => {
  const { cle, valeur } = req.body || {};
  if (!cle) throw fail('Clé manquante.');
  await q(`INSERT INTO "parametres"(cle,valeur) VALUES ($1,$2) ON CONFLICT (cle) DO UPDATE SET valeur=EXCLUDED.valeur`, [cle, valeur ?? '']);
  res.json({ ok: true });
}));

// Utilisateurs
router.get('/utilisateurs', h(async (req, res) => {
  const r = await q(`SELECT "IDT_Utilisateur" id, "Nom", "Prenom", "Login", "NomGroupe" FROM "T_Utilisateur" ORDER BY "Nom", "Prenom"`);
  res.json(r.rows);
}));
function checkGroupe(req, groupe) {
  if (roleOf(groupe) === 'superadmin' && req.user.role !== 'superadmin') throw fail('Seul le super administrateur peut attribuer ce groupe.', 403);
}
router.post('/utilisateurs', h(async (req, res) => {
  const b = req.body || {};
  if (!b.Login || !b.mdp) throw fail('Login et mot de passe obligatoires.');
  checkGroupe(req, b.NomGroupe);
  const ex = await q(`SELECT 1 FROM "T_Utilisateur" WHERE LOWER(TRIM("Login"))=LOWER(TRIM($1))`, [b.Login]);
  if (ex.rowCount) throw fail('Ce login existe déjà.');
  await q(`INSERT INTO "T_Utilisateur"("Nom","Prenom","Login","mdp","NomGroupe") VALUES ($1,$2,$3,$4,$5)`,
    [b.Nom || '', b.Prenom || '', String(b.Login).trim(), bcrypt.hashSync(String(b.mdp), 10), b.NomGroupe || 'CAISSIER']);
  res.json({ ok: true });
}));
router.put('/utilisateurs/:id', h(async (req, res) => {
  const b = req.body || {};
  const id = Number(req.params.id);
  const cur = (await q(`SELECT * FROM "T_Utilisateur" WHERE "IDT_Utilisateur"=$1`, [id])).rows[0];
  if (!cur) throw fail('Utilisateur introuvable.', 404);
  if (roleOf(cur.NomGroupe) === 'superadmin' && req.user.role !== 'superadmin') throw fail('Modification non autorisée.', 403);
  checkGroupe(req, b.NomGroupe);
  await q(`UPDATE "T_Utilisateur" SET "Nom"=$1,"Prenom"=$2,"Login"=$3,"NomGroupe"=$4 WHERE "IDT_Utilisateur"=$5`,
    [b.Nom || '', b.Prenom || '', String(b.Login || cur.Login).trim(), b.NomGroupe || cur.NomGroupe, id]);
  if (b.mdp) await q(`UPDATE "T_Utilisateur" SET mdp=$1 WHERE "IDT_Utilisateur"=$2`, [bcrypt.hashSync(String(b.mdp), 10), id]);
  res.json({ ok: true });
}));
router.delete('/utilisateurs/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw fail('Vous ne pouvez pas supprimer votre propre compte.');
  const cur = (await q(`SELECT "NomGroupe" FROM "T_Utilisateur" WHERE "IDT_Utilisateur"=$1`, [id])).rows[0];
  if (cur && roleOf(cur.NomGroupe) === 'superadmin' && req.user.role !== 'superadmin') throw fail('Suppression non autorisée.', 403);
  await q(`DELETE FROM "T_Utilisateur" WHERE "IDT_Utilisateur"=$1`, [id]);
  res.json({ ok: true });
}));

// Groupes
router.get('/groupes', h(async (req, res) => {
  res.json((await q(`SELECT "IDT_Groupe" id, libelle FROM "T_Groupe" ORDER BY libelle`)).rows);
}));
router.post('/groupes', h(async (req, res) => {
  const l = String((req.body || {}).libelle || '').trim().toUpperCase();
  if (!l) throw fail('Libellé obligatoire.');
  await q(`INSERT INTO "T_Groupe"(libelle) VALUES ($1)`, [l]);
  res.json({ ok: true });
}));
router.delete('/groupes/:id', superadmin, h(async (req, res) => {
  await q(`DELETE FROM "T_Groupe" WHERE "IDT_Groupe"=$1`, [Number(req.params.id)]);
  res.json({ ok: true });
}));

// Blocage de l'application (superadmin)
router.get('/blocage', h(async (req, res) => {
  const r = await q(`SELECT bloc FROM "blocage" WHERE bloc=true LIMIT 1`);
  res.json({ bloc: r.rowCount > 0 });
}));
router.put('/blocage', superadmin, h(async (req, res) => {
  const bloc = !!(req.body || {}).bloc;
  await q(`DELETE FROM "blocage"`);
  await q(`INSERT INTO "blocage"(bloc,"DATE",actionn) VALUES ($1,$2,$3)`, [bloc, today(), bloc ? 'BLOQUE par ' + req.user.login : 'DEBLOQUE par ' + req.user.login]);
  res.json({ bloc });
}));

module.exports = router;
