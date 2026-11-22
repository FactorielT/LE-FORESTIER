# LE REPOS DU FORESTIER + RESTO DU FORESTIER — Applications de gestion

> **Développeurs :** lisez d'abord [GUIDE-DEVELOPPEUR.md](GUIDE-DEVELOPPEUR.md). Il présente l'organisation du projet et les modifications courantes. Le guide des utilisateurs est dans l'application, menu **Guide d'utilisation**.

Deux applications en une : sur l'écran de connexion, on choisit d'abord **LE REPOS DU FORESTIER** (maquis / bar / cave, en vert) ou **RESTO DU FORESTIER** (restaurant, en bleu), puis on saisit les identifiants **de cette application**.

**Chaque application a ses propres comptes** (login et mot de passe) : un compte du maquis ne peut pas ouvrir le restaurant et inversement (le même login peut exister dans les deux avec des mots de passe différents). Chaque administrateur ne voit et ne crée que les utilisateurs de son application. Chaque application a son propre **super administrateur** (login `superadmin` dans les deux, avec des mots de passe différents) : il est le seul à voir les tables de la base de SON application (menu « Tables de la BD »).

Comptes créés au premier démarrage : `superadmin` / `admin123` (les deux applications, variable `SUPERADMIN_PASSWORD`) et `adminresto` / `resto123` (restaurant, variable `RESTO_ADMIN_PASSWORD`). Changez ces mots de passe dès la première connexion. Les données du restaurant sont dans des tables séparées (`resto_*`).

## RESTO DU FORESTIER (restaurant)
| Module | Contenu |
|---|---|
| **Vente (caisse)** | Écran de caisse tactile : plats du menu fixe + menu du jour, filtre par catégorie, panier (+/−), client (« Client comptoir » par défaut), paiement Espèce / Wave / Orange Money, montant reçu et monnaie. Validation Oui/Non puis **reçu client** imprimable (ticket 80 mm, N° automatique `T26-00001`). |
| **Tickets / reçus** | Liste des tickets par période, réimpression du reçu, annulation (administrateur, avant fermeture : le stock est remis). |
| **Menus** | **Menu fixe** (plats proposés tous les jours) et **Menu du jour** (plats dynamiques cochés pour une date, prix du jour possible, « reprendre le menu de la veille »). Chaque plat indique les ressources qu'il consomme. |
| **Accompagnements** | Portion de riz, frites, attiéké, alloco… chacun avec son prix (onglet *Accompagnements* des Menus). Pour chaque plat : accompagnements proposés, prix spécial possible (0 = inclus), accompagnement obligatoire ou non. À la caisse, toucher un plat ouvre le choix de l'accompagnement ; un accompagnement peut aussi être **vendu seul**. Le reçu détaille « + Frites », les bilans donnent les accompagnements les plus vendus (avec un plat / seuls). |
| **Stock** | Sac de riz, carton de poisson, poulet de chair, poulet pondeuse, sac de charbon. Rendement paramétrable (1 sac de riz = 80 plats, 1 poulet = 8 plats, 1 carton de poisson = 30 plats). Le stock baisse automatiquement à chaque vente ; vente bloquée si stock insuffisant (paramétrable). **Charbon** : bouton « Un sac est fini » + approvisionnement. Inventaire (correction), historique des mouvements. |
| **Dépenses quotidiennes** | Types de dépenses, saisie, historique ; déduites à la fermeture. |
| **Fermeture de caisse** | Dernier versement, total ventes du jour (détail par mode), − dépenses = **montant à verser**, réparti Wave / OM / Espèce (pré-rempli selon les tickets), écart. Après fermeture : plus de vente ni dépense ce jour ; une journée non fermée bloque les ventes du lendemain. |
| **Bilans** | Jour / période : chiffre d'affaires, tickets, plats vendus, panier moyen, dépenses, résultat, **plat le plus vendu**, top des plats, ventes par jour, par catégorie, par heure, par mode de paiement, consommation des ressources ; bilans des fermetures. |
| **Paramètres restaurant** | Rendement et seuil d'alerte des ressources, nom / adresse / téléphone / message du reçu, format du N° de reçu, blocage si stock insuffisant. |

---

# LE REPOS DU FORESTIER — Application de gestion (maquis / cave)

Application web responsive (ordinateur + téléphone, installable comme une application) en **Node.js (Express)** et **PostgreSQL**.
Elle reprend la structure de la base de l'ancienne application WinDev (`MyColoMaq`) pour que les données existantes puissent être importées.

## Modules
| Module | Contenu |
|---|---|
| **Accueil** | Bandeau aux couleurs du Forestier, raccourcis (vente, appro, dépense, caisse), alertes (jours de vente non enregistrés, caisses non fermées, stock faible), indicateurs du mois, graphique des 14 derniers jours, meilleures ventes du mois. |
| **Ventes** | Une seule vente par journée, N° automatique (ex. `V26-5`). **Date de vente ≠ date d'enregistrement** : on peut saisir plus tard les ventes des jours passés ; les deux dates sont enregistrées (`DateVente` / `DATEENREG`) et affichées à la validation et dans les bilans. L'application propose automatiquement la première journée non enregistrée ; les journées se saisissent dans l'ordre des dates (le stock reste juste même si des approvisionnements plus récents sont déjà saisis). Choix de la date → *Afficher* → toucher une boisson → saisir la **Qté actuelle restante** → calcul auto de la quantité vendue et du total. La vente se valide avec son seul **Total vente** (pas de répartition à ce stade). Brouillon conservé sur l'appareil tant que la vente n'est pas validée. |
| **Stock** | Totaux (quantité, valeur au prix de vente / d'achat, bénéfice). Modification : la **quantité** est réservée à l'administrateur, les **deux prix** sont modifiables par tous. Ajout de produit. |
| **Approvisions** | Recherche de la boisson, seule la quantité est modifiable dans le tableau, bouton *Retirer ?* visible quand une ligne est sélectionnée. N° automatique (`26-3`). Le stock est augmenté. |
| **Créances** | Enregistrement de crédit (+ nouveau créancier), paiement des arriérés, tableau de bord des créances, détail d'un créancier, historique des crédits payés. |
| **Dépenses quotidiennes** | Types de dépenses, saisie, historique. |
| **Fermeture de caisse** | Montant du dernier versement, total vente du jour, crédits payés du jour, total créances, total dépenses → **Montant total à verser = (Vente + Crédits payés) − (Créances + Dépenses)**, réparti en **Wave / OM / Espèce** (total versé, écart). La répartition est aussi reportée sur la vente du jour (bilans, statistiques). |
| **Statistiques** | Courbes journalières (ventes, bénéfice, dépenses ; jours non saisis affichés comme des trous), histogramme mensuel (ventes, bénéfice, dépenses, appro), top 10 des boissons, répartition Wave / OM / Espèces / Crédit, dépenses par type. Raccourcis 7 j / 30 j / mois / 3 mois / 12 mois. |
| **Bilans** | Ventes (+ détail d'un jour avec *Total crédit du jour*), approvisionnements (+ détails), fermetures de caisse. |
| **Administration** | Numéros automatiques paramétrables (compteurs + formats `V{AA}-{N}`, `{AA}-{N4}`…), utilisateurs & groupes, blocage de l'application. |
| **Superadmin** | **Importation des données existantes** (.sql, .xlsx, .csv) et **Explorateur de la BD** : liste de toutes les tables, données modifiables comme dans Excel (Entrée/Tab/flèches, collage depuis Excel), ajout/suppression de lignes, export CSV, sauvegarde complète en Excel. |

## Règles de la journée (ordre de travail)
1. **Approvisionnement** de la journée (s'il y en a eu) — l'application le demande avant chaque nouvelle vente.
2. **Vente** de la journée (une seule par date, dates saisies dans l'ordre ; la date de vente peut être antérieure à la date d'enregistrement).
3. **Dépenses** (s'il y en a).
4. **Créances** individuelles (s'il y en a).
5. **Fermeture de caisse** (refusée s'il n'y a pas de vente) : le montant total à verser est calculé puis réparti entre Wave, OM et Espèce.

- Tant que la caisse d'une vente n'est pas fermée : **aucune nouvelle vente** n'est possible, mais cette vente **peut être modifiée** (même numéro, même date d'enregistrement).
- Après la fermeture : la vente, les approvisionnements, dépenses, créances et paiements de ce jour ne peuvent plus être saisis ni modifiés (seule la dernière journée peut être rouverte par un administrateur).
- Chaque bouton de validation pose une question **Oui / Non** ; après validation, un message de confirmation s'affiche **2 secondes**.

## Droits
- Groupe contenant **SUPER** → super administrateur (tout + import + explorateur BD)
- Groupe contenant **ADMIN** → administrateur (quantités de stock, suppressions, administration)
- Autres groupes (ex. CAISSIER) → saisies courantes

Au premier démarrage, un compte **superadmin** est créé (mot de passe : variable `SUPERADMIN_PASSWORD`, sinon `admin123` — à changer tout de suite via l'icône clé en bas du menu).
Les anciens mots de passe en clair importés depuis WinDev fonctionnent et sont automatiquement chiffrés à la première connexion.

## Lancer en local
```bash
npm install
# PostgreSQL doit tourner ; base créée au préalable :  createdb forestier
DATABASE_URL=postgres://postgres:motdepasse@localhost:5432/forestier npm start
# → http://localhost:3000
```
Les tables sont créées automatiquement au démarrage (script `src/schema.sql` issu de WinDev + compléments).

## Déploiement sur Render
1. Pousser ce dossier sur GitHub (`git init && git add . && git commit -m "init" && git push`).
2. Sur Render : **New → Blueprint** et choisir le dépôt (le fichier `render.yaml` crée le service web + la base PostgreSQL),
   ou bien créer manuellement un *Web Service* (build `npm install`, start `npm start`) et définir `DATABASE_URL`, `JWT_SECRET`, `SUPERADMIN_PASSWORD`.
3. Ouvrir l'URL, se connecter en `superadmin`, puis **Administration → Importation des données**.

## Importer les données de l'ancienne application
- **Modèle Excel** : dans *Administration → Importation des données*, téléchargez le « Modèle avec exemples » ou le « Modèle vide » (une feuille par table + une feuille LISEZ-MOI), remplissez-le puis importez-le.
- **Script SQL** : exporter les tables HFSQL en SQL (instructions `INSERT INTO`). Les noms de tables/colonnes sont reconnus sans tenir compte des majuscules ; l'encodage Windows (accents) est géré.
- **Excel** : un classeur avec une feuille par table (nom de feuille = nom de table) — c'est aussi le format de la *Sauvegarde complète*.
- **CSV** : un fichier par table, 1re ligne = noms des colonnes, séparateur `;` ou `,`. Dates `JJ/MM/AAAA` ou `AAAAMMJJ` acceptées.
- Après l'import des crédits et paiements, cliquer **Recalculer les soldes des créanciers**.
- Ensuite, vérifier/ajuster les compteurs dans **Administration → Numéros automatiques**.

## Structure
```
server.js            point d'entrée Express
src/db.js            connexion PostgreSQL, création du schéma + migrations
src/schema.sql       schéma de l'ancienne application (WinDev → PostgreSQL)
src/routes/*.js      API (auth, stock/appro, ventes, créances, caisse/dépenses, admin, data=import/explorateur)
public/              interface (HTML/CSS/JS sans framework, PWA)
```

### Ajouts à la base d'origine
Colonne `rid` (clé primaire) sur les tables qui n'en avaient pas, `T_Ventes.CREDIT/AGENT/HEUREENREG`, `T_Inventaire.ref/PrixAchat`,
`appro.NumVente` (approvisionnement pris en compte par quelle vente), `VERSEMENTINTERNE.CREDITSPAYES`, table `parametres`.
