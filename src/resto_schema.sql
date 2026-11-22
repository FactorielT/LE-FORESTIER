-- ===== RESTO DU FORESTIER : tables du restaurant (indépendantes du maquis) =====

-- Ressources suivies en stock (sac de riz, carton de poisson, poulets, charbon)
CREATE TABLE IF NOT EXISTS resto_ressource (
  code VARCHAR(30) PRIMARY KEY,
  nom VARCHAR(80) NOT NULL,
  unite VARCHAR(30) NOT NULL,              -- sac, carton, poulet
  portions_par_unite NUMERIC(10,2),        -- nb de plats par unité (NULL = gestion manuelle, ex : charbon)
  stock NUMERIC(14,3) NOT NULL DEFAULT 0,  -- en unités (ex : 2.5 sacs)
  seuil_alerte NUMERIC(10,2) NOT NULL DEFAULT 1,
  prix_unite BIGINT NOT NULL DEFAULT 0,
  ordre INT NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT TRUE
);

-- Plats (menu fixe = toujours proposé ; menu du jour = proposé seulement les jours choisis)
CREATE TABLE IF NOT EXISTS resto_plat (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  categorie VARCHAR(50) NOT NULL DEFAULT 'Plats',
  prix BIGINT NOT NULL DEFAULT 0,
  menu VARCHAR(10) NOT NULL DEFAULT 'fixe',  -- 'fixe' | 'jour'
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  ordre INT NOT NULL DEFAULT 0
);

-- Ressources consommées par un plat (1 plat = n portions de la ressource)
CREATE TABLE IF NOT EXISTS resto_plat_ressource (
  plat_id INT NOT NULL REFERENCES resto_plat(id) ON DELETE CASCADE,
  code VARCHAR(30) NOT NULL REFERENCES resto_ressource(code) ON DELETE CASCADE,
  portions NUMERIC(8,2) NOT NULL DEFAULT 1,
  PRIMARY KEY (plat_id, code)
);

-- Menu du jour (dynamique) : plats proposés à une date donnée, prix éventuellement différent
CREATE TABLE IF NOT EXISTS resto_menu_jour (
  date DATE NOT NULL,
  plat_id INT NOT NULL REFERENCES resto_plat(id) ON DELETE CASCADE,
  prix BIGINT,
  PRIMARY KEY (date, plat_id)
);

-- Ventes (tickets comptoir)
CREATE TABLE IF NOT EXISTS resto_vente (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(30) UNIQUE NOT NULL,
  date DATE NOT NULL,
  heure TIME NOT NULL,
  agent VARCHAR(80),
  client VARCHAR(100) DEFAULT 'Client comptoir',
  total BIGINT NOT NULL DEFAULT 0,
  mode VARCHAR(10) NOT NULL DEFAULT 'ESPECE',  -- ESPECE | WAVE | OM
  recu BIGINT NOT NULL DEFAULT 0,
  rendu BIGINT NOT NULL DEFAULT 0,
  annulee BOOLEAN NOT NULL DEFAULT FALSE,
  annulee_par VARCHAR(80),
  annulee_le TIMESTAMP
);
CREATE INDEX IF NOT EXISTS resto_vente_date ON resto_vente(date);

CREATE TABLE IF NOT EXISTS resto_vente_ligne (
  id SERIAL PRIMARY KEY,
  vente_id INT NOT NULL REFERENCES resto_vente(id) ON DELETE CASCADE,
  plat_id INT,
  nom VARCHAR(100) NOT NULL,
  categorie VARCHAR(50),
  prix BIGINT NOT NULL,
  qte INT NOT NULL,
  total BIGINT NOT NULL
);

-- Mouvements de stock : APPRO, VENTE, ANNULATION, FIN_SAC (charbon), AJUSTEMENT
CREATE TABLE IF NOT EXISTS resto_mouvement (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  heure TIME NOT NULL,
  code VARCHAR(30) NOT NULL,
  type VARCHAR(20) NOT NULL,
  unites NUMERIC(14,3) NOT NULL,     -- + entrée / - sortie
  cout BIGINT NOT NULL DEFAULT 0,
  ref VARCHAR(30),
  agent VARCHAR(80),
  motif VARCHAR(200)
);
CREATE INDEX IF NOT EXISTS resto_mouvement_date ON resto_mouvement(date);

-- Dépenses quotidiennes du restaurant
CREATE TABLE IF NOT EXISTS resto_depense_type (id SERIAL PRIMARY KEY, nom VARCHAR(60) UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS resto_depense (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  heure TIME NOT NULL,
  type VARCHAR(60) NOT NULL,
  montant BIGINT NOT NULL,
  motif VARCHAR(200),
  agent VARCHAR(80)
);

-- Fermetures de caisse du restaurant
CREATE TABLE IF NOT EXISTS resto_fermeture (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  nb_tickets INT NOT NULL DEFAULT 0,
  total_ventes BIGINT NOT NULL DEFAULT 0,
  depenses BIGINT NOT NULL DEFAULT 0,
  a_verser BIGINT NOT NULL DEFAULT 0,
  wave BIGINT NOT NULL DEFAULT 0,
  om BIGINT NOT NULL DEFAULT 0,
  espece BIGINT NOT NULL DEFAULT 0,
  verse BIGINT NOT NULL DEFAULT 0,
  ecart BIGINT NOT NULL DEFAULT 0,
  dernier_versement BIGINT NOT NULL DEFAULT 0,
  agent VARCHAR(80),
  heure TIME,
  date_enreg DATE
);

INSERT INTO resto_ressource (code, nom, unite, portions_par_unite, seuil_alerte, ordre) VALUES
  ('RIZ', 'Sac de riz', 'sac', 80, 1, 1),
  ('POISSON', 'Carton de poisson', 'carton', 30, 1, 2),
  ('POULET_CHAIR', 'Poulet de chair', 'poulet', 8, 3, 3),
  ('POULET_PONDEUSE', 'Poulet pondeuse', 'poulet', 8, 3, 4),
  ('CHARBON', 'Sac de charbon', 'sac', NULL, 1, 5)
ON CONFLICT (code) DO NOTHING;

INSERT INTO resto_depense_type (nom) VALUES ('GAZ'), ('MARCHÉ / CONDIMENTS'), ('TRANSPORT'), ('SALAIRE'), ('EAU / ÉLECTRICITÉ')
ON CONFLICT (nom) DO NOTHING;

-- Précision suffisante pour 1 plat = 1/80 sac, 1/30 carton…
ALTER TABLE resto_ressource ALTER COLUMN stock TYPE NUMERIC(16,6);
ALTER TABLE resto_mouvement ALTER COLUMN unites TYPE NUMERIC(16,6);

-- ===== Accompagnements (portion de riz, frites, attiéké, alloco…) =====
-- Un accompagnement est un article du restaurant (resto_plat avec menu = 'accomp') : il a son prix, peut consommer du stock
-- et peut être vendu seul. Chaque plat indique les accompagnements proposés (avec éventuellement un prix spécial, 0 = inclus).
ALTER TABLE resto_plat ADD COLUMN IF NOT EXISTS accomp_obligatoire BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE resto_plat ADD COLUMN IF NOT EXISTS vendable_seul BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS resto_plat_accomp (
  plat_id INT NOT NULL REFERENCES resto_plat(id) ON DELETE CASCADE,
  accomp_id INT NOT NULL REFERENCES resto_plat(id) ON DELETE CASCADE,
  prix BIGINT,              -- NULL = prix normal de l'accompagnement ; 0 = inclus dans le plat
  PRIMARY KEY (plat_id, accomp_id)
);
ALTER TABLE resto_vente_ligne ADD COLUMN IF NOT EXISTS parent_id INT;
ALTER TABLE resto_vente_ligne ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'plat';  -- 'plat' | 'accomp'

INSERT INTO resto_plat (nom, categorie, prix, menu)
SELECT x.nom, 'Accompagnements', x.prix, 'accomp' FROM (VALUES ('Portion de riz', 500), ('Attiéké', 500), ('Alloco', 500), ('Frites', 1000)) x(nom, prix)
WHERE NOT EXISTS (SELECT 1 FROM resto_plat WHERE menu='accomp');
INSERT INTO resto_plat_ressource (plat_id, code, portions)
SELECT id, 'RIZ', 1 FROM resto_plat WHERE menu='accomp' AND nom='Portion de riz'
ON CONFLICT DO NOTHING;

-- v17 : moyens de paiement MoMo et Flooz
ALTER TABLE resto_fermeture ADD COLUMN IF NOT EXISTS momo BIGINT NOT NULL DEFAULT 0;
ALTER TABLE resto_fermeture ADD COLUMN IF NOT EXISTS flooz BIGINT NOT NULL DEFAULT 0;
