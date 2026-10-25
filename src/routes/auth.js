const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { q } = require('../db');
const { SECRET, roleOf, auth, h, fail, getParam } = require('../util');

router.get('/info', h(async (req, res) => {
  res.json({ nom: (await getParam('nom_etablissement')) || 'LE REPOS DU FORESTIER' });
}));

router.post('/login', h(async (req, res) => {
  const { login, mdp } = req.body || {};
  if (!login || !mdp) throw fail('Veuillez saisir le login et le mot de passe.');
  const r = await q(`SELECT * FROM "T_Utilisateur" WHERE LOWER(TRIM("Login"))=LOWER(TRIM($1))`, [login]);
  let user = null;
  for (const u of r.rows) {
    const stored = u.mdp || '';
    if (stored.startsWith('$2')) {
      if (bcrypt.compareSync(mdp, stored)) user = u;
    } else if (stored === mdp) {
      // Ancien mot de passe en clair : on le sécurise
      await q(`UPDATE "T_Utilisateur" SET mdp=$1 WHERE "IDT_Utilisateur"=$2`, [bcrypt.hashSync(mdp, 10), u.IDT_Utilisateur]);
      user = u;
    }
    if (user) break;
  }
  if (!user) throw fail('Login ou mot de passe incorrect.', 401);
  const bloc = await q(`SELECT * FROM "blocage" WHERE bloc=true LIMIT 1`);
  const role = roleOf(user.NomGroupe);
  if (bloc.rowCount && role !== 'superadmin') throw fail("L'application est bloquée. Contactez l'administrateur.", 403);
  const payload = {
    id: user.IDT_Utilisateur,
    login: user.Login,
    nom: [user.Prenom, user.Nom].filter(Boolean).join(' ') || user.Login,
    groupe: user.NomGroupe,
    role,
  };
  const token = jwt.sign(payload, SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 7 * 24 * 3600 * 1000 });
  res.json(payload);
}));

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', auth, (req, res) => res.json(req.user));

router.post('/me/password', auth, h(async (req, res) => {
  const { ancien, nouveau } = req.body || {};
  if (!nouveau || String(nouveau).length < 4) throw fail('Le nouveau mot de passe doit contenir au moins 4 caractères.');
  const r = await q(`SELECT mdp FROM "T_Utilisateur" WHERE "IDT_Utilisateur"=$1`, [req.user.id]);
  const stored = r.rows[0] ? r.rows[0].mdp || '' : '';
  const ok = stored.startsWith('$2') ? bcrypt.compareSync(ancien || '', stored) : stored === ancien;
  if (!ok) throw fail('Ancien mot de passe incorrect.');
  await q(`UPDATE "T_Utilisateur" SET mdp=$1 WHERE "IDT_Utilisateur"=$2`, [bcrypt.hashSync(nouveau, 10), req.user.id]);
  res.json({ ok: true });
}));

module.exports = router;
