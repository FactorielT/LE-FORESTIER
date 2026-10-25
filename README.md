# LE REPOS DU FORESTIER — Application de gestion (maquis / cave)

Application web responsive (ordinateur + téléphone, installable comme une application) en **Node.js (Express)** et **PostgreSQL**.
Elle reprend la structure de la base de l'ancienne application WinDev (`MyColoMaq`) pour que les données existantes puissent être importées.

## Modules
| Module | Contenu |
|---|---|
| **Accueil** | Bandeau aux couleurs du Forestier, raccourcis (vente, appro, dépense, caisse), alertes (jours de vente non enregistrés, caisses non fermées, stock faible), indicateurs du mois, graphique des 14 derniers jours, meilleures ventes du mois. |
| **Ventes** | Une seule vente par journée, N° automatique (ex. `V26-5`). **Date de vente ≠ date d'enregistrement** : on peut saisir plus tard les ventes des jours passés ; les deux dates sont enregistrées (`DateVente` / `DATEENREG`) et affichées à la validation et dans les bilans. L'application propose automatiquement la première journée non enregistrée ; les journées se saisissent dans l'ordre des dates (le stock reste juste même si des approvisionnements plus récents sont déjà saisis). Choix de la date → *Afficher* → toucher une boisson → saisir la **Qté actuelle restante** → calcul auto de la quantité vendue et du total. Répartition **Crédit du jour + Wave + OM + Espèce = Total vente** obligatoire. Brouillon conservé sur l'appareil tant que la vente n'est pas validée. |
| **Stock** | Totaux (quantité, valeur au prix de vente / d'achat, bénéfice). Modification : la **quantité** est réservée à l'administrateur, les **deux prix** sont modifiables par tous. Ajout de produit. |
| **Approvisions** | Recherche de la boisson, seule la quantité est modifiable dans le tableau, bouton *Retirer ?* visible quand une ligne est sélectionnée. N° automatique (`26-3`). Le stock est augmenté. |
| **Créances** | Enregistrement de crédit (+ nouveau créancier), paiement des arriérés, tableau de bord des créances, détail d'un créancier, historique des crédits payés. |
| **Dépenses quotidiennes** | Types de dépenses, saisie, historique. |
| **Fermeture de caisse** | Caisse d'hier, total vente, crédits payés, créances du jour, dépenses, **Caisse = (Vente + Crédit payé) − (Créance + Dépense)**, caisse à la fermeture, écart. |
| **Statistiques** | Courbes journalières (ventes, bénéfice, dépenses ; jours non saisis affichés comme des trous), histogramme mensuel (ventes, bénéfice, dépenses, appro), top 10 des boissons, répartition Wave / OM / Espèces / Crédit, dépenses par type. Raccourcis 7 j / 30 j / mois / 3 mois / 12 mois. |
| **Bilans** | Ventes (+ détail d'un jour avec *Total crédit du jour*), approvisionnements (+ détails), fermetures de caisse. |
| **Administration** | Numéros automatiques paramétrables (compteurs + formats `V{AA}-{N}`, `{AA}-{N4}`…), utilisateurs & groupes, blocage de l'application. |
| **Superadmin** | **Importation des données existantes** (.sql, .xlsx, .csv) et **Explorateur de la BD** : liste de toutes les tables, données modifiables comme dans Excel (Entrée/Tab/flèches, collage depuis Excel), ajout/suppression de lignes, export CSV, sauvegarde complète en Excel. |

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
