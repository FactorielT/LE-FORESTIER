/* ========================================================================= COMMENTAIRES-DEBUTANT
   src/routes/admin.js — ADMINISTRATION (réservé aux administrateurs)
   -------------------------------------------------------------------------
   Préfixe /api/admin :
     numéros automatiques, paramètres, utilisateurs, groupes, blocage.
   Chaque application voit seulement SES utilisateurs (colonne
   T_Utilisateur.Application = MAQUIS ou RESTO).
   ========================================================================= */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q } = require('../db');
const { admin, superadmin, h, fail, formatNumero, today, roleOf } = require('../util');

router.use(admin);

// Numéros automatiques
const COLS_NUM = ['numCli', 'numCmde', 'Numappro', 'numprod', 'MATRICU', 'NumInvent'];
// GET /api/admin/numeros : derniers numéros utilisés et formats (ex. V{AA}-{N}).
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
// PUT /api/admin/numeros : enregistre les compteurs et formats de numéros.
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

// GET /api/admin/parametres : tous les paramètres (table « parametres » : clé → valeur).
router.get('/parametres', h(async (req, res) => {
  res.json((await q(`SELECT cle, valeur FROM "parametres" ORDER BY cle`)).rows);
}));
// PUT /api/admin/parametres : modifie UN paramètre { cle, valeur }.
router.put('/parametres', h(async (req, res) => {
  const { cle, valeur } = req.body || {};
  if (!cle) throw fail('Clé manquante.');
  await q(`INSERT INTO "parametres"(cle,valeur) VALUES ($1,$2) ON CONFLICT (cle) DO UPDATE SET valeur=EXCLUDED.valeur`, [cle, valeur ?? '']);
  res.json({ ok: true });
}));

// Utilisateurs : chaque application a ses propres comptes (MAQUIS, RESTO). TOUS = les deux (super administrateur).
const APPS = ['MAQUIS', 'RESTO', 'TOUS'];
const appSession = (req) => ((req.user.app || 'maquis') === 'resto' ? 'RESTO' : 'MAQUIS');
const voitTout = (req) => req.user.acces === 'TOUS';
function appCible(req, demande) {
  if (voitTout(req) && APPS.includes(demande)) return demande;
  return appSession(req);
}
// Un même login ne peut exister qu'une fois par application.
async function verifierLoginLibre(login, app, saufId = 0) {
  const ex = await q(`SELECT "Application" FROM "T_Utilisateur" WHERE LOWER(TRIM("Login"))=LOWER(TRIM($1)) AND "IDT_Utilisateur"<>$2
    AND (COALESCE("Application",'MAQUIS')=$3 OR "Application"='TOUS' OR $3='TOUS')`, [login, saufId, app]);
  if (ex.rowCount) throw fail(`Le login « ${login} » est déjà utilisé pour cette application.`);
}
// Vérifie que le compte à modifier appartient bien à l'application en cours.
async function utilisateurAccessible(req, id) {
  const cur = (await q(`SELECT * FROM "T_Utilisateur" WHERE "IDT_Utilisateur"=$1`, [id])).rows[0];
  if (!cur) throw fail('Utilisateur introuvable.', 404);
  if (!voitTout(req) && (cur.Application || 'MAQUIS') !== appSession(req)) throw fail("Cet utilisateur appartient à l'autre application.", 403);
  if (roleOf(cur.NomGroupe) === 'superadmin' && req.user.role !== 'superadmin') throw fail('Modification non autorisée.', 403);
  return cur;
}
// GET /api/admin/utilisateurs : comptes de l'application en cours.
router.get('/utilisateurs', h(async (req, res) => {
  const r = await q(`SELECT "IDT_Utilisateur" id, "Nom", "Prenom", "Login", "NomGroupe", COALESCE("Application",'MAQUIS') "Application" FROM "T_Utilisateur"
    WHERE $1 OR COALESCE("Application",'MAQUIS')=$2 ORDER BY "Application", "Nom", "Prenom"`, [voitTout(req), appSession(req)]);
  res.json(r.rows);
}));
// Empêche un simple administrateur de donner le groupe super admin.
function checkGroupe(req, groupe) {
  if (roleOf(groupe) === 'superadmin' && req.user.role !== 'superadmin') throw fail('Seul le super administrateur peut attribuer ce groupe.', 403);
}
// POST /api/admin/utilisateurs : crée un compte (le mot de passe est chiffré avec bcrypt).
router.post('/utilisateurs', h(async (req, res) => {
  const b = req.body || {};
  if (!b.Login || !b.mdp) throw fail('Login et mot de passe obligatoires.');
  checkGroupe(req, b.NomGroupe);
  const app = appCible(req, b.Application);
  await verifierLoginLibre(String(b.Login).trim(), app);
  await q(`INSERT INTO "T_Utilisateur"("Nom","Prenom","Login","mdp","NomGroupe","Application") VALUES ($1,$2,$3,$4,$5,$6)`,
    [b.Nom || '', b.Prenom || '', String(b.Login).trim(), bcrypt.hashSync(String(b.mdp), 10), b.NomGroupe || 'CAISSIER', app]);
  res.json({ ok: true });
}));
// PUT /api/admin/utilisateurs/:id : modifie un compte (mot de passe changé seulement s'il est saisi).
router.put('/utilisateurs/:id', h(async (req, res) => {
  const b = req.body || {};
  const id = Number(req.params.id);
  const cur = await utilisateurAccessible(req, id);
  checkGroupe(req, b.NomGroupe);
  const app = voitTout(req) && APPS.includes(b.Application) ? b.Application : cur.Application || 'MAQUIS';
  const login = String(b.Login || cur.Login).trim();
  await verifierLoginLibre(login, app, id);
  await q(`UPDATE "T_Utilisateur" SET "Nom"=$1,"Prenom"=$2,"Login"=$3,"NomGroupe"=$4,"Application"=$5 WHERE "IDT_Utilisateur"=$6`,
    [b.Nom || '', b.Prenom || '', login, b.NomGroupe || cur.NomGroupe, app, id]);
  if (b.mdp) await q(`UPDATE "T_Utilisateur" SET mdp=$1 WHERE "IDT_Utilisateur"=$2`, [bcrypt.hashSync(String(b.mdp), 10), id]);
  res.json({ ok: true });
}));
// DELETE /api/admin/utilisateurs/:id : supprime un compte (pas le sien).
router.delete('/utilisateurs/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw fail('Vous ne pouvez pas supprimer votre propre compte.');
  await utilisateurAccessible(req, id);
  await q(`DELETE FROM "T_Utilisateur" WHERE "IDT_Utilisateur"=$1`, [id]);
  res.json({ ok: true });
}));

// Groupes
// Groupes d'utilisateurs : le NOM du groupe donne le rôle (SUPER... = super admin, ADMIN... = administrateur, autre = caissier).
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
// Blocage : quand il est actif, seuls les super admins peuvent se connecter.
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
