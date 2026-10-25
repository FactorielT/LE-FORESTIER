// Fenêtres réservées au SUPERADMIN : explorateur de la BD + import des données existantes
const router = require('express').Router();
const multer = require('multer');
const iconv = require('iconv-lite');
const XLSX = require('xlsx');
const { q, pool } = require('../db');
const { superadmin, h, fail } = require('../util');

router.use(superadmin);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });

// ---------- Métadonnées ----------
async function tablesMeta() {
  const r = await q(`
    SELECT c.table_name t, c.column_name col, c.data_type typ, c.ordinal_position pos, c.column_default def
    FROM information_schema.columns c JOIN information_schema.tables t ON t.table_name=c.table_name AND t.table_schema=c.table_schema
    WHERE c.table_schema='public' AND t.table_type='BASE TABLE' ORDER BY c.table_name, c.ordinal_position`);
  const pk = await q(`
    SELECT tc.table_name t, kcu.column_name col FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema
    WHERE tc.table_schema='public' AND tc.constraint_type='PRIMARY KEY'`);
  const meta = {};
  for (const x of r.rows) {
    meta[x.t] = meta[x.t] || { name: x.t, columns: [], pk: null };
    meta[x.t].columns.push({ name: x.col, type: x.typ, serial: /nextval/.test(x.def || '') });
  }
  for (const x of pk.rows) if (meta[x.t]) meta[x.t].pk = x.col;
  return meta;
}
async function getTable(name) {
  const meta = await tablesMeta();
  const t = meta[name];
  if (!t) throw fail('Table inconnue : ' + name, 404);
  return t;
}
const qi = (s) => '"' + String(s).replace(/"/g, '""') + '"';

// ---------- Conversion des valeurs ----------
function pad(n) { return String(n).padStart(2, '0'); }
function toDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/))) return `20${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return m[1] === '0000' ? null : `${m[1]}-${m[2]}-${m[3]}`;
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 1000 && Number(s) < 80000) { // numéro de série Excel
    const d = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return null;
}
function toTime(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return `${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
  const s = String(v).trim();
  let m;
  if ((m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/))) return `${pad(m[1])}:${m[2]}:${m[3] || '00'}`;
  if ((m = s.match(/^(\d{2})(\d{2})(\d{2})?/))) return `${m[1]}:${m[2]}:${m[3] || '00'}`;
  if (/^0?\.\d+$/.test(s)) { const t = Math.round(Number(s) * 86400); return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`; }
  return null;
}
function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[\s  ]/g, '').replace(/[^\d,.\-eE]/g, '');
  if (!s) return null;
  const norm = s.includes(',') && s.includes('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.');
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}
function toBool(v) {
  if (v === null || v === undefined || v === '') return null;
  return /^(1|true|vrai|oui|yes|o|t)$/i.test(String(v).trim());
}
function convert(v, type) {
  if (type === 'date') return toDate(v);
  if (/^time/.test(type)) return toTime(v);
  if (/integer|bigint|smallint|numeric|double|real/.test(type)) {
    const n = toNum(v);
    if (n === null) return null;
    return /integer|bigint|smallint/.test(type) ? Math.round(n) : n;
  }
  if (type === 'boolean') return toBool(v);
  if (type === 'bytea') return null;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return toDate(v);
  return String(v);
}

async function resetSequences(client) {
  const meta = await tablesMeta();
  for (const t of Object.values(meta)) {
    for (const c of t.columns.filter((x) => x.serial)) {
      await client.query(`SELECT setval(pg_get_serial_sequence($1,$2), GREATEST(COALESCE((SELECT MAX(${qi(c.name)}) FROM ${qi(t.name)}),0),1),
        (SELECT MAX(${qi(c.name)}) FROM ${qi(t.name)}) IS NOT NULL)`, [qi(t.name), c.name]);
    }
  }
}

// ---------- EXPLORATEUR ----------
router.get('/tables', h(async (req, res) => {
  const meta = await tablesMeta();
  const out = [];
  for (const t of Object.values(meta)) {
    const n = (await q(`SELECT COUNT(*)::int n FROM ${qi(t.name)}`)).rows[0].n;
    out.push({ name: t.name, rows: n, pk: t.pk, columns: t.columns.length });
  }
  res.json(out.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })));
}));

router.get('/table/:name', h(async (req, res) => {
  const t = await getTable(req.params.name);
  const size = Math.min(Math.max(parseInt(req.query.size, 10) || 100, 10), 1000);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const cols = t.columns;
  const sel = cols.map((c) => (c.type === 'bytea' ? `CASE WHEN ${qi(c.name)} IS NULL THEN NULL ELSE '[binaire]' END ${qi(c.name)}` : qi(c.name))).join(',');
  const params = [];
  let where = '';
  if (req.query.search) {
    params.push('%' + req.query.search + '%');
    where = 'WHERE ' + cols.filter((c) => c.type !== 'bytea').map((c) => `${qi(c.name)}::text ILIKE $1`).join(' OR ');
  }
  const sortCol = cols.find((c) => c.name === req.query.sort);
  const order = sortCol ? `${qi(sortCol.name)} ${req.query.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST` : t.pk ? qi(t.pk) : '1';
  const total = (await q(`SELECT COUNT(*)::int n FROM ${qi(t.name)} ${where}`, params)).rows[0].n;
  const rows = (await q(`SELECT ${sel} FROM ${qi(t.name)} ${where} ORDER BY ${order} LIMIT ${size} OFFSET ${(page - 1) * size}`, params)).rows;
  res.json({ table: t.name, pk: t.pk, columns: cols, rows, total, page, size });
}));

router.put('/table/:name/row', h(async (req, res) => {
  const t = await getTable(req.params.name);
  if (!t.pk) throw fail('Cette table n\'a pas de clé primaire : modification impossible.');
  const { pk, values } = req.body || {};
  const sets = [], params = [];
  for (const [k, v] of Object.entries(values || {})) {
    const c = t.columns.find((x) => x.name === k);
    if (!c || c.type === 'bytea' || k === t.pk) continue;
    params.push(v === '' || v === null ? null : convert(v, c.type));
    sets.push(`${qi(k)}=$${params.length}`);
  }
  if (!sets.length) return res.json({ ok: true });
  params.push(pk);
  const r = await q(`UPDATE ${qi(t.name)} SET ${sets.join(',')} WHERE ${qi(t.pk)}=$${params.length} RETURNING *`, params);
  if (!r.rowCount) throw fail('Ligne introuvable.', 404);
  const row = r.rows[0];
  for (const c of t.columns) if (c.type === 'bytea' && row[c.name]) row[c.name] = '[binaire]';
  res.json(row);
}));

router.post('/table/:name/row', h(async (req, res) => {
  const t = await getTable(req.params.name);
  const values = (req.body || {}).values || {};
  const cols = [], params = [];
  for (const c of t.columns) {
    if (c.type === 'bytea') continue;
    const v = values[c.name];
    if (v === undefined || v === '' || v === null) continue;
    cols.push(qi(c.name));
    params.push(convert(v, c.type));
  }
  const sql = cols.length
    ? `INSERT INTO ${qi(t.name)} (${cols.join(',')}) VALUES (${params.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`
    : `INSERT INTO ${qi(t.name)} DEFAULT VALUES RETURNING *`;
  const r = await q(sql, params);
  res.json(r.rows[0]);
}));

router.post('/table/:name/delete', h(async (req, res) => {
  const t = await getTable(req.params.name);
  if (!t.pk) throw fail('Cette table n\'a pas de clé primaire.');
  const ids = (req.body || {}).ids || [];
  if (!ids.length) return res.json({ deleted: 0 });
  const r = await q(`DELETE FROM ${qi(t.name)} WHERE ${qi(t.pk)}::text = ANY($1::text[])`, [ids.map(String)]);
  res.json({ deleted: r.rowCount });
}));

router.post('/table/:name/vider', h(async (req, res) => {
  const t = await getTable(req.params.name);
  await q(`DELETE FROM ${qi(t.name)}`);
  res.json({ ok: true });
}));

// Export : une table en CSV ou toute la base en Excel (sauvegarde)
router.get('/export/:name.csv', h(async (req, res) => {
  const t = await getTable(req.params.name);
  const cols = t.columns.filter((c) => c.type !== 'bytea');
  const rows = (await q(`SELECT ${cols.map((c) => qi(c.name)).join(',')} FROM ${qi(t.name)} ORDER BY 1`)).rows;
  const esc = (v) => (v === null || v === undefined ? '' : /[;"\n\r]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const csv = [cols.map((c) => c.name).join(';'), ...rows.map((r) => cols.map((c) => esc(r[c.name])).join(';'))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${t.name}.csv"`);
  res.send('﻿' + csv);
}));

router.get('/export-complet.xlsx', h(async (req, res) => {
  const meta = await tablesMeta();
  const wb = XLSX.utils.book_new();
  for (const t of Object.values(meta)) {
    const cols = t.columns.filter((c) => c.type !== 'bytea');
    const rows = (await q(`SELECT ${cols.map((c) => qi(c.name)).join(',')} FROM ${qi(t.name)} ORDER BY 1`)).rows;
    const ws = XLSX.utils.json_to_sheet(rows, { header: cols.map((c) => c.name) });
    XLSX.utils.book_append_sheet(wb, ws, t.name.slice(0, 31));
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const d = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="sauvegarde-forestier-${d}.xlsx"`);
  res.send(buf);
}));

// ---------- IMPORT ----------
function decode(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.slice(3).toString('utf8');
  if (buf[0] === 0xff && buf[1] === 0xfe) return iconv.decode(buf.slice(2), 'utf16le');
  const s = buf.toString('utf8');
  return s.includes('�') ? iconv.decode(buf, 'win1252') : s;
}

function parseCSV(text) {
  const first = text.split(/\r?\n/)[0] || '';
  const cands = [';', ',', '\t', '|'];
  const delim = cands.map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"' && cur === '') inQ = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

function lireTableur(file) {
  const name = (file.originalname || '').toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const rows = parseCSV(decode(file.buffer));
    const base = file.originalname.replace(/\.[^.]+$/, '');
    return [{ nom: base, entetes: (rows[0] || []).map((x) => String(x).trim()), lignes: rows.slice(1) }];
  }
  const wb = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
  return wb.SheetNames.map((sn) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null, blankrows: false });
    return { nom: sn, entetes: (rows[0] || []).map((x) => String(x ?? '').trim()), lignes: rows.slice(1) };
  });
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

function suggererTable(meta, nom, entetes) {
  const n = norm(nom);
  let best = Object.values(meta).find((t) => norm(t.name) === n);
  if (best) return best.name;
  let score = 0;
  for (const t of Object.values(meta)) {
    const cs = new Set(t.columns.map((c) => norm(c.name)));
    const s = entetes.filter((e) => cs.has(norm(e))).length / Math.max(entetes.length, 1);
    if (s > score) { score = s; best = t; }
  }
  return score >= 0.5 ? best.name : '';
}
function mappingAuto(t, entetes) {
  const map = {};
  if (!t) return map;
  for (const e of entetes) {
    const c = t.columns.find((x) => norm(x.name) === norm(e));
    if (c) map[e] = c.name;
  }
  return map;
}

// Découpe d'un script SQL en instructions (en respectant les chaînes)
function splitSQL(sql) {
  const out = [];
  let cur = '', inS = false, inD = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (!inS && !inD && ch === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; cur += '\n'; continue; }
    if (!inD && ch === "'") { if (inS && sql[i + 1] === "'") { cur += "''"; i++; continue; } inS = !inS; }
    else if (!inS && ch === '"') inD = !inD;
    if (ch === ';' && !inS && !inD) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const RE_INSERT = /^INSERT\s+INTO\s+([`"\[]?[\w.]+[`"\]]?)\s*(\(([^)]*)\))?\s*VALUES\s*([\s\S]*)$/i;
function rewriteInsert(stmt, meta) {
  const m = stmt.match(RE_INSERT);
  if (!m) return null;
  const rawT = m[1].replace(/[`"\[\]]/g, '').split('.').pop();
  const t = Object.values(meta).find((x) => x.name.toLowerCase() === rawT.toLowerCase());
  if (!t) return { error: 'Table inconnue : ' + rawT, table: rawT };
  let cols = '';
  if (m[3]) {
    const list = m[3].split(',').map((c) => c.trim().replace(/[`"\[\]]/g, ''));
    const mapped = list.map((c) => (t.columns.find((x) => x.name.toLowerCase() === c.toLowerCase()) || {}).name);
    const bad = list.find((c, i) => !mapped[i]);
    if (bad) return { error: `Colonne inconnue ${bad} dans ${t.name}`, table: t.name };
    cols = '(' + mapped.map(qi).join(',') + ')';
  }
  return { table: t.name, sql: `INSERT INTO ${qi(t.name)} ${cols} VALUES ${m[4]}` };
}

router.post('/import/analyse', upload.single('fichier'), h(async (req, res) => {
  if (!req.file) throw fail('Aucun fichier reçu.');
  const meta = await tablesMeta();
  const name = (req.file.originalname || '').toLowerCase();
  if (name.endsWith('.sql')) {
    const stmts = splitSQL(decode(req.file.buffer));
    const tables = {};
    let ignores = 0;
    for (const s of stmts) {
      const r = rewriteInsert(s, meta);
      if (!r) { ignores++; continue; }
      tables[r.table] = tables[r.table] || { inserts: 0, erreur: r.error || null };
      tables[r.table].inserts++;
    }
    return res.json({ type: 'sql', tables, ignores, total: stmts.length });
  }
  const feuilles = lireTableur(req.file).map((f) => {
    const table = suggererTable(meta, f.nom, f.entetes);
    return { nom: f.nom, entetes: f.entetes, nbLignes: f.lignes.length, apercu: f.lignes.slice(0, 5), table, mapping: mappingAuto(meta[table], f.entetes) };
  });
  res.json({ type: 'tableur', feuilles, tables: Object.values(meta).map((t) => ({ name: t.name, columns: t.columns.map((c) => c.name) })) });
}));

router.post('/import/executer', upload.single('fichier'), h(async (req, res) => {
  if (!req.file) throw fail('Aucun fichier reçu.');
  const opts = JSON.parse(req.body.options || '{}');
  const meta = await tablesMeta();
  const name = (req.file.originalname || '').toLowerCase();
  const client = await pool.connect();
  const rapport = { tables: {}, erreurs: [] };
  const addErr = (msg) => { if (rapport.erreurs.length < 50) rapport.erreurs.push(msg); };
  try {
    await client.query('BEGIN');
    if (name.endsWith('.sql')) {
      const stmts = splitSQL(decode(req.file.buffer)).map((s) => rewriteInsert(s, meta)).filter((x) => x && !x.error);
      const tablesVisees = [...new Set(stmts.map((s) => s.table))].filter((t) => !opts.tables || opts.tables.includes(t));
      if (opts.vider) for (const t of tablesVisees) await client.query(`DELETE FROM ${qi(t)}`);
      for (const s of stmts) {
        if (!tablesVisees.includes(s.table)) continue;
        const st = (rapport.tables[s.table] = rapport.tables[s.table] || { ok: 0, ko: 0 });
        await client.query('SAVEPOINT sp');
        try { await client.query(s.sql); st.ok++; await client.query('RELEASE SAVEPOINT sp'); }
        catch (e) { st.ko++; addErr(`${s.table} : ${e.message}`); await client.query('ROLLBACK TO SAVEPOINT sp'); }
      }
    } else {
      const feuilles = lireTableur(req.file);
      for (const cfg of opts.feuilles || []) {
        if (!cfg.table) continue;
        const f = feuilles.find((x) => x.nom === cfg.nom);
        const t = meta[cfg.table];
        if (!f || !t) continue;
        const mapping = Object.entries(cfg.mapping || {}).filter(([, col]) => col && t.columns.find((c) => c.name === col));
        if (!mapping.length) continue;
        if (opts.vider) await client.query(`DELETE FROM ${qi(t.name)}`);
        const st = (rapport.tables[t.name] = rapport.tables[t.name] || { ok: 0, ko: 0 });
        const idx = mapping.map(([e, col]) => [f.entetes.indexOf(e), t.columns.find((c) => c.name === col)]).filter(([i]) => i >= 0);
        for (let li = 0; li < f.lignes.length; li++) {
          const ligne = f.lignes[li];
          const cols = [], vals = [];
          for (const [i, c] of idx) {
            const v = convert(ligne[i], c.type);
            if (v === null && c.serial) continue;
            cols.push(qi(c.name)); vals.push(v);
          }
          if (!cols.length) continue;
          await client.query('SAVEPOINT sp');
          try {
            await client.query(`INSERT INTO ${qi(t.name)} (${cols.join(',')}) VALUES (${vals.map((_, k) => '$' + (k + 1)).join(',')})`, vals);
            st.ok++; await client.query('RELEASE SAVEPOINT sp');
          } catch (e) { st.ko++; addErr(`${t.name} ligne ${li + 2} : ${e.message}`); await client.query('ROLLBACK TO SAVEPOINT sp'); }
        }
      }
    }
    await resetSequences(client);
    // Les approvisionnements importés sont considérés comme déjà pris en compte dans les ventes passées
    if (opts.marquerAppros !== false) await client.query(`UPDATE "appro" SET "NumVente"='IMPORT' WHERE "NumVente" IS NULL AND dateappro <= (SELECT MAX("DateVente") FROM "T_Ventes")`);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  res.json(rapport);
}));

// Recalcule le solde de chaque créancier = total crédits - total paiements
router.post('/recalcul-creances', h(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM "CompteCreances"`);
    const r = await client.query(`
      WITH n AS (
        SELECT UPPER(TRIM(nomcreancier)) k, MIN(TRIM(nomcreancier)) nom, SUM(COALESCE(montantcreance,0)) cr, 0::numeric pa FROM "creancier" WHERE COALESCE(TRIM(nomcreancier),'')<>'' GROUP BY 1
        UNION ALL SELECT UPPER(TRIM(client)), MIN(TRIM(client)), 0, SUM(COALESCE(payer,0)) FROM "paiement" WHERE COALESCE(TRIM(client),'')<>'' GROUP BY 1
        UNION ALL SELECT UPPER(TRIM("Nomprenom")), MIN(TRIM("Nomprenom")), 0, 0 FROM "client" WHERE COALESCE(TRIM("Nomprenom"),'')<>'' GROUP BY 1
      )
      INSERT INTO "CompteCreances"("Nomprenom","MontantCredit") SELECT MIN(nom), SUM(cr)-SUM(pa) FROM n GROUP BY k RETURNING 1`);
    await client.query('COMMIT');
    res.json({ comptes: r.rowCount });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}));

module.exports = router;
