const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');
const bcrypt = require('bcryptjs');

// DATE -> 'YYYY-MM-DD' ; BIGINT / NUMERIC -> Number
types.setTypeParser(1082, (v) => v);
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/forestier';
const useSSL = process.env.PGSSL === 'true' || /render\.com|neon\.tech|supabase/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 10,
});

const q = (text, params) => pool.query(text, params);

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Tables de l'ancienne application sans clé primaire : on ajoute "rid"
const TABLES_SANS_PK = ['appro', 'blocage', 'client', 'commande', 'histoproduit', 'lignecmde', 'numero', 'produit', 'suppression', 'VERSEMENTINTERNE'];

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await q(schema);

  for (const t of TABLES_SANS_PK) {
    const r = await q(
      `SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name=$1 AND constraint_type='PRIMARY KEY'`,
      [t]
    );
    if (!r.rowCount) await q(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS rid BIGSERIAL PRIMARY KEY`);
  }

  const migrations = [
    `ALTER TABLE "T_Utilisateur" ALTER COLUMN "mdp" TYPE VARCHAR(100)`,
    `ALTER TABLE "T_Ventes" ADD COLUMN IF NOT EXISTS "CREDIT" BIGINT DEFAULT 0`,
    `ALTER TABLE "T_Ventes" ADD COLUMN IF NOT EXISTS "AGENT" VARCHAR(50)`,
    `ALTER TABLE "T_Ventes" ADD COLUMN IF NOT EXISTS "HEUREENREG" TIME`,
    `ALTER TABLE "T_Inventaire" ADD COLUMN IF NOT EXISTS "ref" VARCHAR(50)`,
    `ALTER TABLE "T_Inventaire" ADD COLUMN IF NOT EXISTS "PrixAchat" BIGINT DEFAULT 0`,
    `ALTER TABLE "T_Inventaire" ALTER COLUMN "StockHier" TYPE FLOAT8`,
    `ALTER TABLE "T_Inventaire" ALTER COLUMN "StockApproHier" TYPE FLOAT8`,
    `ALTER TABLE "T_Inventaire" ALTER COLUMN "StockHierMatin" TYPE FLOAT8`,
    `ALTER TABLE "T_Inventaire" ALTER COLUMN "StockLogicielActuel" TYPE FLOAT8`,
    `ALTER TABLE "T_Inventaire" ALTER COLUMN "StockPhysiqueActuel" TYPE FLOAT8`,
    `ALTER TABLE "T_Inventaire" ALTER COLUMN "StockVendu" TYPE FLOAT8`,
    `ALTER TABLE "appro" ADD COLUMN IF NOT EXISTS "NumVente" VARCHAR(50)`,
    `ALTER TABLE "VERSEMENTINTERNE" ADD COLUMN IF NOT EXISTS "CREDITSPAYES" BIGINT DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS "parametres" ("cle" VARCHAR(80) PRIMARY KEY, "valeur" TEXT)`,
  ];
  for (const m of migrations) await q(m);

  // Valeurs par défaut
  const num = await q(`SELECT rid FROM "numero" LIMIT 1`);
  if (!num.rowCount) {
    await q(`INSERT INTO "numero" ("numCli","numCmde","Numappro","numprod","MATRICU","NumInvent") VALUES ('0','0','0','0','0','0')`);
  }
  const defaults = {
    nom_etablissement: 'LE REPOS DU FORESTIER',
    format_vente: 'V{AA}-{N}',
    format_appro: '{AA}-{N}',
    format_produit: '{N4}{L2}',
    format_client: '{N}',
  };
  for (const [k, v] of Object.entries(defaults)) {
    await q(`INSERT INTO "parametres"(cle,valeur) VALUES ($1,$2) ON CONFLICT (cle) DO NOTHING`, [k, v]);
  }
  const g = await q(`SELECT COUNT(*)::int n FROM "T_Groupe"`);
  if (!g.rows[0].n) {
    await q(`INSERT INTO "T_Groupe"(libelle) VALUES ('SUPERADMIN'),('ADMINISTRATEUR'),('CAISSIER')`);
  }
  const sa = await q(`SELECT 1 FROM "T_Utilisateur" WHERE UPPER("NomGroupe") LIKE '%SUPER%' LIMIT 1`);
  if (!sa.rowCount) {
    const pwd = process.env.SUPERADMIN_PASSWORD || 'admin123';
    await q(
      `INSERT INTO "T_Utilisateur"("Nom","Prenom","Login","mdp","NomGroupe") VALUES ('Super','Admin','superadmin',$1,'SUPERADMIN')`,
      [bcrypt.hashSync(pwd, 10)]
    );
    console.log(`Compte superadmin créé (login: superadmin / mot de passe: ${process.env.SUPERADMIN_PASSWORD ? '***' : 'admin123'})`);
  }
}

module.exports = { pool, q, tx, init, TABLES_SANS_PK };
