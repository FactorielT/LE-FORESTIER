-- Script généré par WINDEV Mobile le 25/10/2026 00:48:54
-- Tables de l'analyse MyColoMaq.wda
-- pour PostgreSQL

-- Création de la table appro
CREATE TABLE IF NOT EXISTS "appro" (
    "IDapproAB" VARCHAR(50) DEFAULT '0',
    "ref" VARCHAR(50) ,
    "Lib" VARCHAR(50) ,
    "qte" FLOAT8 DEFAULT 0,
    "pu" BIGINT DEFAULT 0,
    "total" BIGINT DEFAULT 0,
    "dateappro" DATE ,
    "heureappro" TIME ,
    "agent" VARCHAR(50) ,
    "mois" VARCHAR(50) ,
    "annee" VARCHAR(50) ,
    "code" VARCHAR(50) ,
    "prixFour" BIGINT DEFAULT 0,
    "totalFour" BIGINT DEFAULT 0,
    "margeB" BIGINT DEFAULT 0,
    "fourniss" VARCHAR(50) ,
    "DATEENREG" DATE );
CREATE INDEX IF NOT EXISTS "WDIDX_appro_IDapproAB" ON "appro" ("IDapproAB");
CREATE INDEX IF NOT EXISTS "WDIDX_appro_ref" ON "appro" ("ref");
CREATE INDEX IF NOT EXISTS "WDIDX_appro_Lib" ON "appro" ("Lib");
CREATE INDEX IF NOT EXISTS "WDIDX_appro_qte" ON "appro" ("qte");
CREATE INDEX IF NOT EXISTS "WDIDX_appro_pu" ON "appro" ("pu");
CREATE INDEX IF NOT EXISTS "WDIDX_appro_dateappro" ON "appro" ("dateappro");
CREATE INDEX IF NOT EXISTS "WDIDX_appro_agent" ON "appro" ("agent");
CREATE INDEX IF NOT EXISTS "WDIDX_appro_code" ON "appro" ("code");
CREATE INDEX IF NOT EXISTS "WDIDX_appro_fourniss" ON "appro" ("fourniss");
CREATE INDEX IF NOT EXISTS "WDIDX_appro_DATEENREG" ON "appro" ("DATEENREG");

-- Création de la table Bene
CREATE TABLE IF NOT EXISTS "Bene" (
    "IDBene" SERIAL8  PRIMARY KEY ,
    "ref" VARCHAR(50) ,
    "Lib" VARCHAR(50) ,
    "QteDepart" FLOAT8 DEFAULT 0,
    "QteAppro" FLOAT8 DEFAULT 0,
    "QteAppro_Depart" FLOAT8 DEFAULT 0,
    "QteActuelle" FLOAT8 DEFAULT 0,
    "QteVendu" FLOAT8 DEFAULT 0,
    "PV" BIGINT DEFAULT 0,
    "PA" BIGINT DEFAULT 0,
    "TotalPV" BIGINT DEFAULT 0,
    "totalPA" BIGINT DEFAULT 0,
    "Benefice" BIGINT DEFAULT 0,
    "date" DATE );
CREATE INDEX IF NOT EXISTS "WDIDX_Bene_ref" ON "Bene" ("ref");
CREATE INDEX IF NOT EXISTS "WDIDX_Bene_Lib" ON "Bene" ("Lib");
CREATE INDEX IF NOT EXISTS "WDIDX_Bene_QteDepart" ON "Bene" ("QteDepart");
CREATE INDEX IF NOT EXISTS "WDIDX_Bene_QteAppro" ON "Bene" ("QteAppro");
CREATE INDEX IF NOT EXISTS "WDIDX_Bene_QteAppro_Depart" ON "Bene" ("QteAppro_Depart");
CREATE INDEX IF NOT EXISTS "WDIDX_Bene_QteVendu" ON "Bene" ("QteVendu");
CREATE INDEX IF NOT EXISTS "WDIDX_Bene_Benefice" ON "Bene" ("Benefice");
CREATE INDEX IF NOT EXISTS "WDIDX_Bene_date" ON "Bene" ("date");

-- Création de la table Benef
CREATE TABLE IF NOT EXISTS "benef" (
    "ref" VARCHAR(50) ,
    "Lib" VARCHAR(50) ,
    "qte" FLOAT8 DEFAULT 0,
    "pu" BIGINT DEFAULT 0,
    "total" BIGINT DEFAULT 0,
    "code" VARCHAR(50) ,
    "date" DATE ,
    "heure" TIME ,
    "pu2" NUMERIC(20,0) DEFAULT 0,
    "prixFour" BIGINT DEFAULT 0,
    "totalFour" BIGINT DEFAULT 0,
    "QteAppro" FLOAT8 DEFAULT 0,
    "TotalQte" FLOAT8 DEFAULT 0,
    "Idbenef" SERIAL8  PRIMARY KEY );
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_ref" ON "benef" ("ref");
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_Lib" ON "benef" ("Lib");
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_qte" ON "benef" ("qte");
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_pu" ON "benef" ("pu");
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_code" ON "benef" ("code");
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_date" ON "benef" ("date");
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_heure" ON "benef" ("heure");
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_pu2" ON "benef" ("pu2");
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_prixFour" ON "benef" ("prixFour");
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_QteAppro" ON "benef" ("QteAppro");
CREATE INDEX IF NOT EXISTS "WDIDX_Benef_TotalQte" ON "benef" ("TotalQte");

-- Création de la table blocage
CREATE TABLE IF NOT EXISTS "blocage" (
    "bloc" BOOL DEFAULT false,
    "DATE" DATE ,
    "actionn" VARCHAR(52) ,
    "mdp" VARCHAR(51) );
CREATE INDEX IF NOT EXISTS "WDIDX_blocage_bloc" ON "blocage" ("bloc");
CREATE INDEX IF NOT EXISTS "WDIDX_blocage_DATE" ON "blocage" ("DATE");
CREATE INDEX IF NOT EXISTS "WDIDX_blocage_actionn" ON "blocage" ("actionn");
CREATE INDEX IF NOT EXISTS "WDIDX_blocage_mdp" ON "blocage" ("mdp");

-- Création de la table client
CREATE TABLE IF NOT EXISTS "client" (
    "Nomprenom" VARCHAR(50) ,
    "contact" VARCHAR(50) ,
    "quartier" VARCHAR(50) ,
    "email" VARCHAR(50) ,
    "numCli" VARCHAR(50)  UNIQUE ,
    "utilisateur" VARCHAR(50) );
CREATE INDEX IF NOT EXISTS "WDIDX_client_Nomprenom" ON "client" ("Nomprenom");
CREATE INDEX IF NOT EXISTS "WDIDX_client_utilisateur" ON "client" ("utilisateur");

-- Création de la table commande
CREATE TABLE IF NOT EXISTS "commande" (
    "numCmde" VARCHAR(50)  UNIQUE  DEFAULT '0',
    "qtetotal" FLOAT8 DEFAULT 0,
    "mtTotal" BIGINT DEFAULT 0,
    "datecmde" DATE ,
    "moiscmde" VARCHAR(50) ,
    "anneecmde" VARCHAR(50) ,
    "utilisateur" VARCHAR(50) ,
    "heurecmde" TIME );
CREATE INDEX IF NOT EXISTS "WDIDX_commande_qtetotal" ON "commande" ("qtetotal");
CREATE INDEX IF NOT EXISTS "WDIDX_commande_datecmde" ON "commande" ("datecmde");
CREATE INDEX IF NOT EXISTS "WDIDX_commande_utilisateur" ON "commande" ("utilisateur");

-- Création de la table CompteCreances
CREATE TABLE IF NOT EXISTS "CompteCreances" (
    "IDCompteCreances" SERIAL8  PRIMARY KEY ,
    "Nomprenom" VARCHAR(50) ,
    "MontantCredit" BIGINT DEFAULT 0);
CREATE INDEX IF NOT EXISTS "WDIDX_CompteCreances_Nomprenom" ON "CompteCreances" ("Nomprenom");
CREATE INDEX IF NOT EXISTS "WDIDX_CompteCreances_MontantCredit" ON "CompteCreances" ("MontantCredit");

-- Création de la table creancier
CREATE TABLE IF NOT EXISTS "creancier" (
    "IDcreancier" SERIAL8  PRIMARY KEY ,
    "nomcreancier" VARCHAR(50) ,
    "montantcreance" BIGINT DEFAULT 0,
    "motifcreance" VARCHAR(80) ,
    "datecreance" DATE ,
    "mois" VARCHAR(50) ,
    "annee" VARCHAR(50) ,
    "valeurscredits" BIGINT DEFAULT 0,
    "totalverser" NUMERIC(20,0) DEFAULT 0,
    "reste" NUMERIC(20,0) DEFAULT 0,
    "verse1" NUMERIC(20,0) DEFAULT 0,
    "dateverse1" DATE ,
    "verse2" NUMERIC(20,0) DEFAULT 0,
    "dateverse2" DATE ,
    "verse3" NUMERIC(20,0) DEFAULT 0,
    "date3" DATE ,
    "verse4" NUMERIC(20,0) DEFAULT 0,
    "dateverse4" DATE ,
    "DATEENREG" DATE );
CREATE INDEX IF NOT EXISTS "WDIDX_creancier_nomcreancier" ON "creancier" ("nomcreancier");
CREATE INDEX IF NOT EXISTS "WDIDX_creancier_montantcreance" ON "creancier" ("montantcreance");
CREATE INDEX IF NOT EXISTS "WDIDX_creancier_datecreance" ON "creancier" ("datecreance");
CREATE INDEX IF NOT EXISTS "WDIDX_creancier_valeurscredits" ON "creancier" ("valeurscredits");
CREATE INDEX IF NOT EXISTS "WDIDX_creancier_reste" ON "creancier" ("reste");
CREATE INDEX IF NOT EXISTS "WDIDX_creancier_DATEENREG" ON "creancier" ("DATEENREG");

-- Création de la table DEPENSEQUOTIDIEN
CREATE TABLE IF NOT EXISTS "DEPENSEQUOTIDIEN" (
    "DEPENSE" VARCHAR(50) ,
    "MONTANT" BIGINT DEFAULT 0,
    "DETAILS" VARCHAR(150) ,
    "AGENTS" VARCHAR(50) ,
    "DATEDEP" DATE ,
    "HEUREDEP" TIME ,
    "MOISDEP" VARCHAR(50) ,
    "ANNEEDEP" VARCHAR(50) ,
    "DATEENREG" DATE ,
    "IDDEPENSES" SERIAL4  PRIMARY KEY );
CREATE INDEX IF NOT EXISTS "WDIDX_DEPENSEQUOTIDIEN_DEPENSE" ON "DEPENSEQUOTIDIEN" ("DEPENSE");
CREATE INDEX IF NOT EXISTS "WDIDX_DEPENSEQUOTIDIEN_MONTANT" ON "DEPENSEQUOTIDIEN" ("MONTANT");
CREATE INDEX IF NOT EXISTS "WDIDX_DEPENSEQUOTIDIEN_AGENTS" ON "DEPENSEQUOTIDIEN" ("AGENTS");
CREATE INDEX IF NOT EXISTS "WDIDX_DEPENSEQUOTIDIEN_DATEDEP" ON "DEPENSEQUOTIDIEN" ("DATEDEP");
CREATE INDEX IF NOT EXISTS "WDIDX_DEPENSEQUOTIDIEN_MOISDEP" ON "DEPENSEQUOTIDIEN" ("MOISDEP");
CREATE INDEX IF NOT EXISTS "WDIDX_DEPENSEQUOTIDIEN_DATEENREG" ON "DEPENSEQUOTIDIEN" ("DATEENREG");

-- Création de la table DEPENSES
CREATE TABLE IF NOT EXISTS "DEPENSES" (
    "IDDEPENSES" SERIAL8  PRIMARY KEY ,
    "NOMDEPENSE" VARCHAR(50) ,
    "test" VARCHAR(50) );

-- Création de la table depot
CREATE TABLE IF NOT EXISTS "depot" (
    "IDdepot" SERIAL8  PRIMARY KEY ,
    "nomdepot" VARCHAR(50) ,
    "situationgeo" VARCHAR(50) ,
    "contact" VARCHAR(80) );
CREATE INDEX IF NOT EXISTS "WDIDX_depot_nomdepot" ON "depot" ("nomdepot");
CREATE INDEX IF NOT EXISTS "WDIDX_depot_situationgeo" ON "depot" ("situationgeo");

-- Création de la table Fournisseur
CREATE TABLE IF NOT EXISTS "Fournisseur" (
    "IDFournisseur" SERIAL8  PRIMARY KEY ,
    "NomFournisseur" VARCHAR(50) ,
    "Compte" BIGINT DEFAULT 0);
CREATE INDEX IF NOT EXISTS "WDIDX_Fournisseur_NomFournisseur" ON "Fournisseur" ("NomFournisseur");
CREATE INDEX IF NOT EXISTS "WDIDX_Fournisseur_Compte" ON "Fournisseur" ("Compte");

-- Création de la table histoproduit
CREATE TABLE IF NOT EXISTS "histoproduit" (
    "ref" VARCHAR(50) ,
    "Lib" VARCHAR(50) ,
    "qte" FLOAT8 DEFAULT 0,
    "pu" BIGINT DEFAULT 0,
    "total" BIGINT DEFAULT 0,
    "code" VARCHAR(50) ,
    "date" DATE ,
    "heure" TIME ,
    "pu2" NUMERIC(20,0) DEFAULT 0,
    "prixFour" BIGINT DEFAULT 0,
    "totalFour" BIGINT DEFAULT 0);
CREATE INDEX IF NOT EXISTS "WDIDX_histoproduit_ref" ON "histoproduit" ("ref");
CREATE INDEX IF NOT EXISTS "WDIDX_histoproduit_Lib" ON "histoproduit" ("Lib");
CREATE INDEX IF NOT EXISTS "WDIDX_histoproduit_qte" ON "histoproduit" ("qte");
CREATE INDEX IF NOT EXISTS "WDIDX_histoproduit_pu" ON "histoproduit" ("pu");
CREATE INDEX IF NOT EXISTS "WDIDX_histoproduit_code" ON "histoproduit" ("code");
CREATE INDEX IF NOT EXISTS "WDIDX_histoproduit_date" ON "histoproduit" ("date");
CREATE INDEX IF NOT EXISTS "WDIDX_histoproduit_heure" ON "histoproduit" ("heure");
CREATE INDEX IF NOT EXISTS "WDIDX_histoproduit_pu2" ON "histoproduit" ("pu2");
CREATE INDEX IF NOT EXISTS "WDIDX_histoproduit_prixFour" ON "histoproduit" ("prixFour");

-- Création de la table lignecmde
CREATE TABLE IF NOT EXISTS "lignecmde" (
    "IDcmde" VARCHAR(50) DEFAULT '0',
    "ref" VARCHAR(50) ,
    "Lib" VARCHAR(50) ,
    "qte" FLOAT8 DEFAULT 0,
    "total" BIGINT ,
    "pu" BIGINT DEFAULT 0,
    "datelignecmde" DATE ,
    "mois" VARCHAR(50) ,
    "annee" VARCHAR(50) );
CREATE INDEX IF NOT EXISTS "WDIDX_lignecmde_IDcmde" ON "lignecmde" ("IDcmde");
CREATE INDEX IF NOT EXISTS "WDIDX_lignecmde_ref" ON "lignecmde" ("ref");
CREATE INDEX IF NOT EXISTS "WDIDX_lignecmde_Lib" ON "lignecmde" ("Lib");
CREATE INDEX IF NOT EXISTS "WDIDX_lignecmde_qte" ON "lignecmde" ("qte");
CREATE INDEX IF NOT EXISTS "WDIDX_lignecmde_pu" ON "lignecmde" ("pu");

-- Création de la table numero
CREATE TABLE IF NOT EXISTS "numero" (
    "numCli" VARCHAR(50) ,
    "numCmde" VARCHAR(50) ,
    "Numappro" VARCHAR(50) ,
    "numprod" VARCHAR(50) ,
    "MATRICU" VARCHAR(50) ,
    "NumInvent" VARCHAR(50) );
CREATE INDEX IF NOT EXISTS "WDIDX_numero_numCli" ON "numero" ("numCli");
CREATE INDEX IF NOT EXISTS "WDIDX_numero_numCmde" ON "numero" ("numCmde");
CREATE INDEX IF NOT EXISTS "WDIDX_numero_Numappro" ON "numero" ("Numappro");
CREATE INDEX IF NOT EXISTS "WDIDX_numero_numprod" ON "numero" ("numprod");
CREATE INDEX IF NOT EXISTS "WDIDX_numero_MATRICU" ON "numero" ("MATRICU");
CREATE INDEX IF NOT EXISTS "WDIDX_numero_NumInvent" ON "numero" ("NumInvent");

-- Création de la table paiement
CREATE TABLE IF NOT EXISTS "paiement" (
    "IDpaiement" SERIAL8  PRIMARY KEY ,
    "numCmde" VARCHAR(50) ,
    "montantcmde" NUMERIC(20,0) DEFAULT 0,
    "payer" BIGINT DEFAULT 0,
    "datepaiement" DATE ,
    "annee" VARCHAR(50) ,
    "client" VARCHAR(50) ,
    "DATEENREG" DATE );
CREATE INDEX IF NOT EXISTS "WDIDX_paiement_numCmde" ON "paiement" ("numCmde");
CREATE INDEX IF NOT EXISTS "WDIDX_paiement_payer" ON "paiement" ("payer");
CREATE INDEX IF NOT EXISTS "WDIDX_paiement_datepaiement" ON "paiement" ("datepaiement");
CREATE INDEX IF NOT EXISTS "WDIDX_paiement_client" ON "paiement" ("client");
CREATE INDEX IF NOT EXISTS "WDIDX_paiement_DATEENREG" ON "paiement" ("DATEENREG");

-- Création de la table produit
CREATE TABLE IF NOT EXISTS "produit" (
    "ref" VARCHAR(50) ,
    "Lib" VARCHAR(50) ,
    "qte" FLOAT8 DEFAULT 0,
    "pu" BIGINT DEFAULT 0,
    "total" BIGINT DEFAULT 0,
    "code" VARCHAR(49) ,
    "pu2" NUMERIC(20,0) DEFAULT 0,
    "prixFour" BIGINT DEFAULT 0,
    "totalFour" BIGINT DEFAULT 0,
    "typeemballage" VARCHAR(50) ,
    "PRIXEMBALLAGE" BIGINT DEFAULT 0);
CREATE INDEX IF NOT EXISTS "WDIDX_produit_ref" ON "produit" ("ref");
CREATE INDEX IF NOT EXISTS "WDIDX_produit_Lib" ON "produit" ("Lib");
CREATE INDEX IF NOT EXISTS "WDIDX_produit_qte" ON "produit" ("qte");
CREATE INDEX IF NOT EXISTS "WDIDX_produit_pu" ON "produit" ("pu");
CREATE INDEX IF NOT EXISTS "WDIDX_produit_code" ON "produit" ("code");
CREATE INDEX IF NOT EXISTS "WDIDX_produit_prixFour" ON "produit" ("prixFour");
CREATE INDEX IF NOT EXISTS "WDIDX_produit_typeemballage" ON "produit" ("typeemballage");
CREATE INDEX IF NOT EXISTS "WDIDX_produit_PRIXEMBALLAGE" ON "produit" ("PRIXEMBALLAGE");

-- Création de la table suppression
CREATE TABLE IF NOT EXISTS "suppression" (
    "ref" VARCHAR(50) ,
    "Lib" VARCHAR(50) ,
    "qte" FLOAT8 DEFAULT 0,
    "prixvente" NUMERIC(20,0) DEFAULT 0,
    "total" BIGINT DEFAULT 0,
    "remise" BIGINT DEFAULT 0,
    "totalapayer" BIGINT DEFAULT 0,
    "utilisateur" VARCHAR(50) ,
    "datecmde" DATE ,
    "datesupprim" DATE ,
    "heuresupprim" VARCHAR(50) ,
    "mois" VARCHAR(50) ,
    "annee" VARCHAR(50) ,
    "numCmde" VARCHAR(50) ,
    "client" VARCHAR(50) );
CREATE INDEX IF NOT EXISTS "WDIDX_suppression_ref" ON "suppression" ("ref");
CREATE INDEX IF NOT EXISTS "WDIDX_suppression_Lib" ON "suppression" ("Lib");
CREATE INDEX IF NOT EXISTS "WDIDX_suppression_qte" ON "suppression" ("qte");
CREATE INDEX IF NOT EXISTS "WDIDX_suppression_utilisateur" ON "suppression" ("utilisateur");
CREATE INDEX IF NOT EXISTS "WDIDX_suppression_datecmde" ON "suppression" ("datecmde");
CREATE INDEX IF NOT EXISTS "WDIDX_suppression_numCmde" ON "suppression" ("numCmde");
CREATE INDEX IF NOT EXISTS "WDIDX_suppression_client" ON "suppression" ("client");

-- Création de la table T_Groupe
CREATE TABLE IF NOT EXISTS "T_Groupe" (
    "IDT_Groupe" SERIAL8  PRIMARY KEY ,
    "libelle" VARCHAR(200) );
CREATE INDEX IF NOT EXISTS "WDIDX_T_Groupe_libelle" ON "T_Groupe" ("libelle");

-- Création de la table T_Inventaire
CREATE TABLE IF NOT EXISTS "T_Inventaire" (
    "IDT_Inventaire" SERIAL8  PRIMARY KEY ,
    "DateInventaire" DATE ,
    "libelle" VARCHAR(200) ,
    "NumInventaire" VARCHAR(50) ,
    "StockHier" INTEGER DEFAULT 0,
    "StockApproHier" INTEGER DEFAULT 0,
    "StockHierMatin" INTEGER DEFAULT 0,
    "StockLogicielActuel" INTEGER DEFAULT 0,
    "StockPhysiqueActuel" INTEGER DEFAULT 0,
    "StockVendu" INTEGER DEFAULT 0,
    "PrixUnitaire" BIGINT DEFAULT 0,
    "TotalPV" BIGINT DEFAULT 0,
    "DATEENREG" DATE ,
    "ESPECE" BIGINT DEFAULT 0,
    "WAVE" BIGINT DEFAULT 0,
    "OM" BIGINT DEFAULT 0,
    "TotalAchat" BIGINT DEFAULT 0,
    "Benefice" BIGINT DEFAULT 0);
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_DateInventaire" ON "T_Inventaire" ("DateInventaire");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_libelle" ON "T_Inventaire" ("libelle");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_NumInventaire" ON "T_Inventaire" ("NumInventaire");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_StockVendu" ON "T_Inventaire" ("StockVendu");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_PrixUnitaire" ON "T_Inventaire" ("PrixUnitaire");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_TotalPV" ON "T_Inventaire" ("TotalPV");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_DATEENREG" ON "T_Inventaire" ("DATEENREG");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_ESPECE" ON "T_Inventaire" ("ESPECE");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_WAVE" ON "T_Inventaire" ("WAVE");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_OM" ON "T_Inventaire" ("OM");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_TotalAchat" ON "T_Inventaire" ("TotalAchat");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Inventaire_Benefice" ON "T_Inventaire" ("Benefice");

-- Création de la table T_Utilisateur
CREATE TABLE IF NOT EXISTS "T_Utilisateur" (
    "IDT_Utilisateur" SERIAL8  PRIMARY KEY ,
    "Nom" VARCHAR(50) ,
    "Prenom" VARCHAR(50) ,
    "Login" VARCHAR(50) ,
    "mdp" VARCHAR(51) ,
    "photos" BYTEA ,
    "NomGroupe" VARCHAR(50) );
CREATE INDEX IF NOT EXISTS "WDIDX_T_Utilisateur_Login" ON "T_Utilisateur" ("Login");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Utilisateur_mdp" ON "T_Utilisateur" ("mdp");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Utilisateur_NomGroupe" ON "T_Utilisateur" ("NomGroupe");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Utilisateur_NomPrenom1" ON "T_Utilisateur" ("Nom","Prenom");

-- Création de la table T_Ventes
CREATE TABLE IF NOT EXISTS "T_Ventes" (
    "IDT_Ventes" SERIAL8  PRIMARY KEY ,
    "NumVentes" VARCHAR(50) ,
    "TotalVentes" BIGINT DEFAULT 0,
    "TotalAchat" BIGINT DEFAULT 0,
    "Benefice" BIGINT DEFAULT 0,
    "WAVE" BIGINT DEFAULT 0,
    "OM" BIGINT DEFAULT 0,
    "ESPECE" BIGINT DEFAULT 0,
    "DateVente" DATE ,
    "DATEENREG" DATE ,
    "Fermer" BOOL DEFAULT false);
CREATE INDEX IF NOT EXISTS "WDIDX_T_Ventes_NumVentes" ON "T_Ventes" ("NumVentes");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Ventes_TotalVentes" ON "T_Ventes" ("TotalVentes");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Ventes_TotalAchat" ON "T_Ventes" ("TotalAchat");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Ventes_Benefice" ON "T_Ventes" ("Benefice");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Ventes_WAVE" ON "T_Ventes" ("WAVE");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Ventes_OM" ON "T_Ventes" ("OM");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Ventes_ESPECE" ON "T_Ventes" ("ESPECE");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Ventes_DateVente" ON "T_Ventes" ("DateVente");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Ventes_DATEENREG" ON "T_Ventes" ("DATEENREG");
CREATE INDEX IF NOT EXISTS "WDIDX_T_Ventes_Fermer" ON "T_Ventes" ("Fermer");

-- Création de la table VERSEMENTINTERNE
CREATE TABLE IF NOT EXISTS "VERSEMENTINTERNE" (
    "AGENTS" VARCHAR(50) ,
    "SOMMES" BIGINT DEFAULT 0,
    "MTDEPENSES" BIGINT DEFAULT 0,
    "MTVERSER" BIGINT DEFAULT 0,
    "DATEVERSE" DATE ,
    "HEUREVERSE" TIME ,
    "MOISVERSE" VARCHAR(50) ,
    "ANNEEVERSE" VARCHAR(50) ,
    "MTJRCTN" BIGINT DEFAULT 0,
    "ECART" BIGINT DEFAULT 0,
    "CREANCES" BIGINT DEFAULT 0,
    "FONDSDECAISSEHIER" BIGINT DEFAULT 0,
    "FermeCaisse" BOOL DEFAULT false,
    "DATEENREG" DATE );
CREATE INDEX IF NOT EXISTS "WDIDX_VERSEMENTINTERNE_AGENTS" ON "VERSEMENTINTERNE" ("AGENTS");
CREATE INDEX IF NOT EXISTS "WDIDX_VERSEMENTINTERNE_DATEVERSE" ON "VERSEMENTINTERNE" ("DATEVERSE");
CREATE INDEX IF NOT EXISTS "WDIDX_VERSEMENTINTERNE_CREANCES" ON "VERSEMENTINTERNE" ("CREANCES");
CREATE INDEX IF NOT EXISTS "WDIDX_VERSEMENTINTERNE_FONDSDECAISSEHIER" ON "VERSEMENTINTERNE" ("FONDSDECAISSEHIER");
CREATE INDEX IF NOT EXISTS "WDIDX_VERSEMENTINTERNE_FermeCaisse" ON "VERSEMENTINTERNE" ("FermeCaisse");
CREATE INDEX IF NOT EXISTS "WDIDX_VERSEMENTINTERNE_DATEENREG" ON "VERSEMENTINTERNE" ("DATEENREG");
