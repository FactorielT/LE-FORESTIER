/* ========================================================================= COMMENTAIRES-DEBUTANT
   src/db.js — CONNEXION À LA BASE POSTGRESQL + MISE À JOUR AUTOMATIQUE
   -------------------------------------------------------------------------
   - « pool » : la connexion à PostgreSQL. L'adresse est lue dans la variable
     d'environnement DATABASE_URL (sur Render : onglet Environment). Sans elle,
     on utilise une base locale postgres://postgres:postgres@localhost:5432/forestier.
   - q(sql, paramètres) : exécute UNE requête SQL et renvoie le résultat.
   - tx(fonction) : exécute PLUSIEURS requêtes dans une « transaction » :
     soit tout est enregistré, soit rien (en cas d'erreur, tout est annulé).
   - init() : lancé au démarrage. Il crée les tables manquantes (schema.sql,
     resto_schema.sql) et applique les « migrations » (ajout de colonnes,
     comptes par défaut...). Il peut être relancé sans risque : chaque
     instruction vérifie d'abord si c'est déjà fait (IF NOT EXISTS).

   POUR AJOUTER UNE COLONNE À UNE TABLE :
     ajoutez dans la liste « migrations » une ligne du type
       `ALTER TABLE "maTable" ADD COLUMN IF NOT EXISTS "maColonne" BIGINT DEFAULT 0`,
     puis redémarrez : la base de Neon sera mise à jour toute seule.
   ========================================================================= */
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

// Exécute une requête SQL. Exemple : await q('SELECT * FROM produit WHERE rid=$1', [5])
const q = (text, params) => pool.query(text, params);

// Transaction : tout réussit ou tout est annulé. Exemple : await tx(async (c) => { await c.query(...); await c.query(...); })
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

// Lancé une fois au démarrage du serveur : crée / met à jour la base.
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

  // Liste des mises à jour de la base. Chaque ligne est exécutée à chaque démarrage, sans danger
  // (IF NOT EXISTS). Pour ajouter une colonne : ajoutez une ligne à la fin de cette liste.
  const migrations = [
    `ALTER TABLE "T_Utilisateur" ALTER COLUMN "mdp" TYPE VARCHAR(100)`,
    `ALTER TABLE "T_Utilisateur" ADD COLUMN IF NOT EXISTS "Application" VARCHAR(10) DEFAULT 'MAQUIS'`,
    `UPDATE "T_Utilisateur" SET "Application"='MAQUIS' WHERE "Application" IS NULL`,
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
    `ALTER TABLE "VERSEMENTINTERNE" ADD COLUMN IF NOT EXISTS "WAVE" BIGINT DEFAULT 0`,
    `ALTER TABLE "VERSEMENTINTERNE" ADD COLUMN IF NOT EXISTS "OM" BIGINT DEFAULT 0`,
    `ALTER TABLE "VERSEMENTINTERNE" ADD COLUMN IF NOT EXISTS "ESPECE" BIGINT DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS "parametres" ("cle" VARCHAR(80) PRIMARY KEY, "valeur" TEXT)`,
    // v9 : bénéfice du jour + montant total versé ce jour à la fermeture, lien appro -> dépense
    `ALTER TABLE "VERSEMENTINTERNE" ADD COLUMN IF NOT EXISTS "BENEFICE" BIGINT DEFAULT 0`,
    `ALTER TABLE "VERSEMENTINTERNE" ADD COLUMN IF NOT EXISTS "TOTALVERSEJOUR" BIGINT DEFAULT 0`,
    `ALTER TABLE "DEPENSEQUOTIDIEN" ADD COLUMN IF NOT EXISTS "NUMAPPRO" VARCHAR(50)`,
    `INSERT INTO "DEPENSES"("NOMDEPENSE") SELECT 'APPROVISIONNEMENT DE PRODUIT'
       WHERE NOT EXISTS (SELECT 1 FROM "DEPENSES" WHERE UPPER(TRIM("NOMDEPENSE"))='APPROVISIONNEMENT DE PRODUIT')`,
    // v9 : inventaires physiques du maquis (comme GESTION MRPA)
    `CREATE TABLE IF NOT EXISTS "inventaire_maquis" (
       id BIGSERIAL PRIMARY KEY, num_inv VARCHAR(30), date_inv DATE, heure TIME, ref VARCHAR(50), lib VARCHAR(100),
       qte_dernier_inv FLOAT8 DEFAULT 0, qte_appro FLOAT8 DEFAULT 0, qte_depart FLOAT8 DEFAULT 0, qte_logiciel FLOAT8 DEFAULT 0,
       qte_physique FLOAT8 DEFAULT 0, qte_ecart FLOAT8 DEFAULT 0, qte_juste FLOAT8 DEFAULT 0,
       prix_achat BIGINT DEFAULT 0, prix_vente BIGINT DEFAULT 0, valeur_ecart BIGINT DEFAULT 0,
       date_debut DATE, date_fin DATE, ajuste BOOLEAN DEFAULT false, utilisateur VARCHAR(80))`,
    `CREATE INDEX IF NOT EXISTS inventaire_maquis_date ON "inventaire_maquis"(date_inv)`,
    `CREATE INDEX IF NOT EXISTS inventaire_maquis_num ON "inventaire_maquis"(num_inv)`,
    // v10 : motif obligatoire en cas d'écart à la fermeture + journal des écarts (conservé même si la caisse est rouverte)
    `ALTER TABLE "VERSEMENTINTERNE" ADD COLUMN IF NOT EXISTS "MOTIFECART" TEXT`,
    `CREATE TABLE IF NOT EXISTS "journal_ecart_caisse" (
       id BIGSERIAL PRIMARY KEY, date_caisse DATE, montant_a_verser BIGINT, wave BIGINT, om BIGINT, espece BIGINT, total_reparti BIGINT,
       ecart BIGINT, sens VARCHAR(20), motif TEXT, agent VARCHAR(80), date_enreg DATE, heure_enreg TIME, statut VARCHAR(40) DEFAULT 'VALIDE',
       annule_par VARCHAR(80), date_annulation TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS journal_ecart_date ON "journal_ecart_caisse"(date_caisse)`,
  ];
  for (const m of migrations) await q(m);

  // Application restaurant (RESTO DU FORESTIER)
  await q(fs.readFileSync(path.join(__dirname, 'resto_schema.sql'), 'utf8'));

  // Valeurs par défaut
  const num = await q(`SELECT rid FROM "numero" LIMIT 1`);
  if (!num.rowCount) {
    await q(`INSERT INTO "numero" ("numCli","numCmde","Numappro","numprod","MATRICU","NumInvent") VALUES ('0','0','0','0','0','0')`);
  }
  // Valeurs par défaut des paramètres (ajoutées seulement si elles n'existent pas encore).
  const defaults = {
    nom_etablissement: 'LE REPOS DU FORESTIER',
    resto_nom: 'RESTO DU FORESTIER',
    resto_format_ticket: 'T{AA}-{N5}',
    resto_compteur: '0',
    resto_bloquer_stock: 'oui',
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
  // Le super administrateur a accès aux deux applications
  await q(`UPDATE "T_Utilisateur" SET "Application"='TOUS' WHERE UPPER("NomGroupe") LIKE '%SUPER%' AND "Application"='MAQUIS'
    AND NOT EXISTS (SELECT 1 FROM "parametres" WHERE cle='acces_superadmin_fait')`);
  await q(`INSERT INTO "parametres"(cle,valeur) VALUES ('acces_superadmin_fait','oui') ON CONFLICT (cle) DO NOTHING`);
  // Compte administrateur du restaurant (identifiants séparés)
  const ra = await q(`SELECT 1 FROM "T_Utilisateur" WHERE "Application"='RESTO' LIMIT 1`);
  if (!ra.rowCount) {
    const pwd = process.env.RESTO_ADMIN_PASSWORD || 'resto123';
    await q(`INSERT INTO "T_Utilisateur"("Nom","Prenom","Login","mdp","NomGroupe","Application") VALUES ('Restaurant','Admin','adminresto',$1,'ADMINISTRATEUR','RESTO')`, [bcrypt.hashSync(pwd, 10)]);
    console.log(`Compte administrateur du restaurant créé (login: adminresto / mot de passe: ${process.env.RESTO_ADMIN_PASSWORD ? '***' : 'resto123'})`);
  }
  const sa = await q(`SELECT 1 FROM "T_Utilisateur" WHERE UPPER("NomGroupe") LIKE '%SUPER%' LIMIT 1`);
  if (!sa.rowCount) {
    const pwd = process.env.SUPERADMIN_PASSWORD || 'admin123';
    await q(
      `INSERT INTO "T_Utilisateur"("Nom","Prenom","Login","mdp","NomGroupe","Application") VALUES ('Super','Admin','superadmin',$1,'SUPERADMIN','MAQUIS')`,
      [bcrypt.hashSync(pwd, 10)]
    );
    console.log(`Compte superadmin créé (login: superadmin / mot de passe: ${process.env.SUPERADMIN_PASSWORD ? '***' : 'admin123'})`);
  }
  // v20 : chaque application a son propre super administrateur (plus d'accès « TOUS » par défaut)
  const sep = await q(`SELECT 1 FROM "parametres" WHERE cle='separation_superadmin_fait'`);
  if (!sep.rowCount) {
    await q(`UPDATE "T_Utilisateur" SET "Application"='MAQUIS' WHERE "Application"='TOUS' AND UPPER("NomGroupe") LIKE '%SUPER%'`);
    await q(`INSERT INTO "parametres"(cle,valeur) VALUES ('separation_superadmin_fait','oui') ON CONFLICT (cle) DO NOTHING`);
  }
  const sr = await q(`SELECT 1 FROM "T_Utilisateur" WHERE "Application"='RESTO' AND UPPER("NomGroupe") LIKE '%SUPER%' LIMIT 1`);
  if (!sr.rowCount) {
    const pwd = process.env.RESTO_SUPERADMIN_PASSWORD || 'superresto';
    await q(`INSERT INTO "T_Utilisateur"("Nom","Prenom","Login","mdp","NomGroupe","Application") VALUES ('Super','Admin Resto','superadmin',$1,'SUPERADMIN','RESTO')`, [bcrypt.hashSync(pwd, 10)]);
    console.log(`Compte super administrateur du restaurant créé (login: superadmin / mot de passe: ${process.env.RESTO_SUPERADMIN_PASSWORD ? '***' : 'superresto'})`);
  }
}

module.exports = { pool, q, tx, init, TABLES_SANS_PK };
