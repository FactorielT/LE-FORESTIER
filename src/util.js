const jwt = require('jsonwebtoken');
const { q } = require('./db');

const SECRET = process.env.JWT_SECRET || 'forestier-secret-a-changer';
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const pad = (n, l = 2) => String(n).padStart(l, '0');
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
const moisDe = (iso) => MOIS[Number(String(iso).slice(5, 7)) - 1] || '';
const anneeDe = (iso) => String(iso).slice(0, 4);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

function roleOf(groupe) {
  const g = String(groupe || '').toUpperCase();
  if (g.includes('SUPER')) return 'superadmin';
  if (g.includes('ADMIN')) return 'admin';
  return 'user';
}

function auth(req, res, next) {
  const token = req.cookies.token || (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter.' });
  }
}
const isAdmin = (u) => u && (u.role === 'admin' || u.role === 'superadmin');
function admin(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: "Action réservée à l'administrateur." });
  next();
}
function superadmin(req, res, next) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Action réservée au super administrateur.' });
  next();
}

// Gestion des numéros automatiques (table "numero" + format paramétrable)
async function getParam(cle, client) {
  const r = await (client || { query: q }).query(`SELECT valeur FROM "parametres" WHERE cle=$1`, [cle]);
  return r.rows[0] ? r.rows[0].valeur : null;
}
function formatNumero(fmt, n, dateIso, lib = '') {
  const lettres = String(lib).replace(/[^A-Za-z]/g, '').toUpperCase();
  return fmt
    .replace('{AAAA}', anneeDe(dateIso))
    .replace('{AA}', anneeDe(dateIso).slice(2))
    .replace('{N6}', pad(n, 6))
    .replace('{N4}', pad(n, 4))
    .replace('{N3}', pad(n, 3))
    .replace('{N}', String(n))
    .replace('{L2}', lettres.slice(0, 2))
    .replace('{L3}', lettres.slice(0, 3));
}
/**
 * Prend le prochain numéro : colonne = colonne de la table numero (ex: "NumInvent"),
 * existsSql = requête qui vérifie si le numéro existe déjà ($1).
 */
async function nextNumero(client, colonne, cleFormat, dateIso, existsSql, lib) {
  const r = await client.query(`SELECT rid, "${colonne}" v FROM "numero" ORDER BY rid LIMIT 1 FOR UPDATE`);
  const row = r.rows[0];
  let n = parseInt(row.v, 10) || 0;
  const fmt = (await getParam(cleFormat, client)) || '{N}';
  let numero;
  for (let i = 0; i < 10000; i++) {
    n += 1;
    numero = formatNumero(fmt, n, dateIso, lib);
    if (!existsSql) break;
    const e = await client.query(existsSql, [numero]);
    if (!e.rowCount) break;
  }
  await client.query(`UPDATE "numero" SET "${colonne}"=$1 WHERE rid=$2`, [String(n), row.rid]);
  return numero;
}

// Wrapper async pour Express
const h = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e);
    res.status(e.status || 500).json({ error: e.expose ? e.message : 'Erreur serveur : ' + e.message });
  });
function fail(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}

module.exports = {
  SECRET, today, nowTime, moisDe, anneeDe, isDate, num, roleOf, auth, admin, superadmin, isAdmin,
  getParam, formatNumero, nextNumero, h, fail,
};
