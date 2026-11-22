# Guide du développeur : LE REPOS DU FORESTIER et RESTO DU FORESTIER

Ce guide explique **comment le projet est construit** et **comment le modifier sans tout casser**. Il est écrit pour un développeur débutant. Chaque fichier du projet commence aussi par un bloc de commentaires qui explique son rôle.

---

## 1. Les deux applications

Un seul site contient deux applications :

| Application | Couleur | Adresses (après le `#`) | Tables de la base |
|---|---|---|---|
| **LE REPOS DU FORESTIER** (maquis / cave) | vert | `#/`, `#/ventes`, `#/caisse`… | tables de l'ancienne application WinDev (`produit`, `T_Ventes`…) |
| **RESTO DU FORESTIER** (restaurant) | bleu | `#/resto`, `#/resto/vente`… | tables `resto_…` |

Chaque compte appartient à une application. La colonne `T_Utilisateur.Application` vaut `MAQUIS` ou `RESTO`.

---

## 2. Technologies utilisées

- **Node.js + Express** : le serveur (dossier `src/`, fichier `server.js`).
- **PostgreSQL** : la base de données. En ligne, c'est **Neon**.
- **HTML + CSS + JavaScript simple** : l'interface (dossier `public/`). Il n'y a pas de React ni de framework, donc pas d'étape de compilation.
- **Chart.js** : les graphiques. **jsPDF + AutoTable** : l'export PDF. Ces bibliothèques sont dans `public/js/vendor/`.
- **Render** : l'hébergement, mis à jour automatiquement après chaque `git push`.

---

## 3. Organisation des fichiers

```
forestier/
├── server.js                ← démarre le serveur et branche les routes
├── package.json             ← liste des bibliothèques (npm install)
├── render.yaml              ← configuration Render
├── .env                     ← mots de passe de la base (JAMAIS sur GitHub)
├── src/
│   ├── db.js                ← connexion PostgreSQL + mises à jour automatiques de la base
│   ├── util.js              ← petits outils (dates, sécurité, numéros, erreurs)
│   ├── schema.sql           ← tables du maquis (reprises de WinDev)
│   ├── resto_schema.sql     ← tables du restaurant
│   └── routes/              ← l'API : une adresse /api/... = une fonction
│       ├── auth.js          ← connexion, déconnexion, mot de passe
│       ├── admin.js         ← utilisateurs, paramètres, numéros, blocage
│       ├── data.js          ← Tables de la BD, exports, import WinDev (super admin)
│       ├── stock.js         ← maquis : articles, approvisionnements, inventaire
│       ├── ventes.js        ← maquis : vente de la journée
│       ├── creances.js      ← maquis : crédits clients
│       ├── caisse.js        ← maquis : dépenses + fermeture de caisse
│       ├── stats.js         ← maquis : statistiques, bilan par produit, accueil
│       └── resto.js         ← TOUT le restaurant
└── public/                  ← ce que voit le navigateur
    ├── index.html           ← page unique (charge les fichiers JS)
    ├── css/app.css          ← toute la mise en forme
    └── js/
        ├── ui.js            ← outils de l'interface (API, messages, fenêtres, tableaux, son)
        ├── app.js           ← connexion, menus, navigation entre les pages
        ├── pages.js         ← pages du maquis
        ├── maquis2.js       ← maquis : inventaire + bilan par produit
        ├── admin.js         ← administration + Tables de la BD
        ├── resto.js         ← restaurant : accueil, caisse, reçu, tickets
        ├── resto2.js        ← restaurant : menus, stock, dépenses, caisse, bilans, paramètres, imprimante
        ├── guide.js         ← guides d'utilisation (texte facile à modifier)
        ├── charts.js        ← graphiques
        ├── pdf.js           ← bouton PDF
        └── printer.js       ← impression des reçus (navigateur, Bluetooth, RawBT)
```

---

## 4. Comment une action circule (exemple : enregistrer une dépense)

1. L'utilisateur clique sur **Valider** dans la page `#/depenses` (`public/js/pages.js`).
2. La page appelle `post('/depenses', { date, depense, montant, motif })` (fonction de `ui.js`).
3. Le navigateur envoie la requête `POST /api/depenses` au serveur.
4. `server.js` la transmet à `src/routes/caisse.js`, à la ligne `router.post('/depenses', ...)`.
5. La route vérifie les données, puis écrit dans la table `DEPENSEQUOTIDIEN` avec `q('INSERT ...')`.
6. Elle répond `{ ok: true }`. La page affiche alors le message vert, avec le son.

**À retenir :** une page dans `public/js/` appelle une route dans `src/routes/`, qui lit ou écrit dans une table.

---

## 5. Travailler sur son ordinateur

1. Installer **Node.js** (version 18 ou plus) et **Git**.
2. Dans le dossier du projet : `npm install`.
3. Indiquer l'adresse de la base dans un fichier `.env`. Vous pouvez utiliser celle de Neon, ou une base PostgreSQL installée sur le PC :
   ```
   DATABASE_URL=postgres://utilisateur:motdepasse@hote/base?sslmode=require
   ```
4. Lancer `node --env-file=.env server.js` (Node 20 ou plus : cette option lit le fichier `.env`), puis ouvrir `http://localhost:3000`. `npm start` fonctionne aussi, mais il ne lit pas le `.env` : il faut alors définir `DATABASE_URL` autrement. Sans adresse, l'application utilise une base locale `forestier`.
5. Après une modification d'un fichier de `src/`, arrêter le serveur (Ctrl + C) et le relancer. Après une modification d'un fichier de `public/`, il suffit de recharger la page (Ctrl + F5).

### Mettre en ligne

```
git add -A
git commit -m "Ce que j'ai changé"
git push origin main
```

Render redéploie tout seul. La base Neon se met à jour au démarrage, grâce à `init()` dans `src/db.js`.

### Variables d'environnement (Render › Environment)

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | adresse de la base Neon |
| `JWT_SECRET` | clé secrète des sessions (mettre une longue phrase au hasard) |
| `SUPERADMIN_PASSWORD` | mot de passe du super admin du maquis lors de sa création |
| `RESTO_SUPERADMIN_PASSWORD` | mot de passe du super admin du restaurant lors de sa création |
| `RESTO_ADMIN_PASSWORD` | mot de passe du compte `adminresto` lors de sa création |

### Comptes créés automatiquement (s'ils n'existent pas)

| Application | Login | Mot de passe par défaut |
|---|---|---|
| Maquis | `superadmin` | `admin123` |
| Restaurant | `superadmin` | `superresto` |
| Restaurant | `adminresto` | `resto123` |

Changez ces mots de passe après la première connexion.

---

## 6. Recettes : les modifications les plus courantes

### 6.1 Changer un texte affiché

Cherchez le texte dans `public/js/` (dans VS Code : Ctrl + Shift + F), modifiez-le, puis rechargez la page.

### 6.2 Modifier le guide d'utilisation

Ouvrez `public/js/guide.js`. Le texte se trouve dans les tableaux `GUIDE_MAQUIS` et `GUIDE_RESTO`, rubrique par rubrique.

### 6.3 Changer une couleur

Ouvrez `public/css/app.css` :
- pour le maquis, modifiez les variables `--g700`, `--g600`… au début du fichier ;
- pour le restaurant, modifiez les variables dans le bloc `body.espace-resto { ... }`.

### 6.4 Ajouter une colonne dans une table

Dans `src/db.js`, ajoutez une ligne à la fin de la liste `migrations` :

```js
`ALTER TABLE "produit" ADD COLUMN IF NOT EXISTS "categorie" VARCHAR(50)`,
```

Pour une table du restaurant, ajoutez la ligne en bas de `src/resto_schema.sql`. La colonne sera créée sur Neon au prochain démarrage.

### 6.5 Ajouter une route API

Dans le bon fichier de `src/routes/`, copiez une route existante, par exemple :

```js
// GET /api/ma-liste : renvoie la liste des fournisseurs
router.get('/ma-liste', h(async (req, res) => {
  const r = await q(`SELECT * FROM "Fournisseur" ORDER BY 1`);
  res.json(r.rows);
}));
```

- `h(...)` gère les erreurs à votre place.
- Pour refuser une demande avec un message clair, utilisez `throw fail('Mon message')`.
- Utilisez toujours `$1, $2...` pour les valeurs saisies, jamais de concaténation de texte. C'est ce qui protège contre l'injection SQL.

### 6.6 Ajouter une page

1. Dans `public/js/pages.js` (maquis) ou `resto2.js` (restaurant) :
   ```js
   Pages['/ma-page'] = {
     title: 'Ma page', back: '/', pdf: true,
     async render(el) {
       const lignes = await get('/ma-liste');
       el.innerHTML = '<div class="tbl-wrap" id="t"></div>';
       table($('#t'), [{ t: 'Nom', f: (r) => esc(r.Nom) }], lignes);
     },
   };
   ```
2. Dans `public/js/app.js`, ajoutez au menu (`NAV` ou `NAV_RESTO`) : `{ r: '/ma-page', t: 'Ma page', i: 'list' },`.
3. Dans `public/index.html`, augmentez le numéro `?v=NN` pour forcer le rechargement.

### 6.7 Ajouter un moyen de paiement au restaurant

Il faut modifier trois endroits :
- `src/routes/resto.js` : la liste `MODES_PAIEMENT`, et les sommes `FILTER (WHERE mode='...')` dans `situation` et `/bilan` ;
- `public/js/resto.js` : l'objet `MODES` ;
- `public/js/resto2.js` : la liste `PAIE` (fermeture). Ajoutez aussi la colonne à `resto_fermeture` dans `resto_schema.sql`.

### 6.8 Ajouter une page au bouton PDF

Ajoutez `pdf: true` dans la déclaration `Pages['/...']`. Le PDF reprend automatiquement les chiffres clés, les graphiques et les tableaux affichés.

### 6.9 Le son après validation

Il est géré dans `public/js/ui.js`, fonctions `sonSucces` et `sonErreur`. Les notes sont données en Hertz : `[fréquence, début, durée]`.

---

## 7. Règles métier importantes (à ne pas casser)

**Maquis :**
- L'ordre de la journée est : appro, puis vente, puis dépenses, puis créances, puis fermeture.
- Il y a une vente par date, saisie dans l'ordre des dates.
- On ne peut pas saisir de nouvelle vente tant que la caisse précédente n'est pas fermée.
- Une journée fermée est verrouillée : vente, appro, dépenses et créances ne sont plus modifiables (voir `verifierJourOuvert`).
- Chaque appro crée une dépense « APPROVISIONNEMENT DE PRODUIT » liée par la colonne `NUMAPPRO`.
- Fermeture :
  - montant à verser = vente + crédits payés − créances − dépenses ;
  - versement d'hier = montant à verser de la dernière journée fermée ;
  - en cas d'écart, le motif est obligatoire.

**Restaurant :**
- Le stock baisse selon `resto_plat_ressource` (portions consommées par plat) et le rendement (`portions_par_unite`).
- Une journée fermée bloque les ventes et les dépenses de cette date.

**Sécurité :**
- Chaque route vérifie le rôle (`admin`, `superadmin`) et l'application (`appSeule`).
- Le super admin du maquis ne voit que les tables du maquis, celui du restaurant que les tables `resto_*`.

---

## 8. En cas de problème

| Problème | Où regarder |
|---|---|
| Message « Erreur serveur : … » | les **logs Render** (onglet Logs) donnent le détail |
| Une page reste blanche | dans Chrome : F12, onglet **Console** (erreur JavaScript en rouge) |
| Une modification n'apparaît pas | augmenter `?v=NN` dans `index.html`, puis Ctrl + F5 |
| Impossible de se connecter | réinitialiser le mot de passe dans Neon : `UPDATE "T_Utilisateur" SET "mdp"='NouveauMdp' WHERE "Login"='superadmin' AND "Application"='MAQUIS';` (un mot de passe en clair est accepté puis chiffré à la connexion) |
| Corriger une donnée | super admin : **Tables de la BD** (grille façon Excel) |

**Sauvegarde :** dans Tables de la BD, le bouton **« Sauvegarde complète (Excel) »** télécharge toutes les tables de l'application. Faites-la régulièrement.
