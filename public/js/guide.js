/* =====================================================================
   GUIDE D'UTILISATION (une page par application)
   ---------------------------------------------------------------------
   - #/guide        : guide du maquis « LE REPOS DU FORESTIER »
   - #/resto/guide  : guide du restaurant « RESTO DU FORESTIER »

   POUR MODIFIER LE GUIDE : changez simplement le texte dans les tableaux
   GUIDE_MAQUIS et GUIDE_RESTO ci-dessous. Chaque rubrique est un objet :
     { id: 'identifiant-sans-espace', titre: 'Titre affiché', icone: 'nom',
       intro: 'phrase d'introduction (facultative)',
       etapes: ['étape 1', 'étape 2', ...],        // liste numérotée (facultative)
       points: ['astuce', 'remarque', ...],         // liste à puces (facultative)
       attention: 'message important (facultatif)' }
   Le texte peut contenir des balises simples : <b>gras</b>, <i>italique</i>.
   Les icônes disponibles sont celles de UI.ic (ui.js) : cart, box, truck, card,
   wallet, power, chart, list, report, gear, users, print, help...
   ===================================================================== */
(() => {
  const { $, $$, esc, ic } = UI;

  // ---------------------------------------------------------------
  // 1) CONTENU DU GUIDE DU MAQUIS
  // ---------------------------------------------------------------
  const GUIDE_MAQUIS = [
    {
      id: 'demarrer', titre: 'Se connecter et se repérer', icone: 'home',
      etapes: [
        "Sur l'écran d'accueil, touchez la carte <b>LE REPOS DU FORESTIER</b> (en vert).",
        'Saisissez votre <b>login</b> et votre <b>mot de passe</b>, puis <b>Se connecter</b>.',
        "Le <b>menu</b> est à gauche (sur téléphone : bouton ☰ en haut à gauche).",
        'La flèche ← en haut revient à la page précédente ; la maison revient à l\'accueil.',
      ],
      points: [
        '<b>Changer son mot de passe</b> : icône clé en bas du menu.',
        '<b>Son après validation</b> : icône haut-parleur en haut ; touchez-la pour couper ou remettre le son.',
        '<b>PDF</b> : sur les pages de bilans, le bouton <b>PDF</b> en haut télécharge la page.',
        "<b>Déconnexion</b> : bouton en haut à droite (ou en bas du menu).",
        'Chaque validation demande une confirmation <b>Oui / Non</b>, puis un message vert confirme l\'enregistrement.',
      ],
    },
    {
      id: 'journee', titre: 'La journée type (ordre à respecter)', icone: 'list',
      intro: 'Pour chaque journée de vente, faites les opérations <b>dans cet ordre</b> :',
      etapes: [
        "<b>Approvisionnement</b> (s'il y a eu des achats de boissons ce jour-là).",
        '<b>Vente</b> de la journée (une seule vente par date).',
        "<b>Dépenses</b> du jour (s'il y en a).",
        "<b>Créances</b> : les crédits accordés aux clients (s'il y en a).",
        '<b>Fermeture de caisse</b> : elle clôt la journée.',
      ],
      attention: "Tant que la caisse d'une journée n'est pas fermée, on ne peut pas saisir la vente du jour suivant. Une fois fermée, la journée ne peut plus être modifiée.",
    },
    {
      id: 'appro', titre: 'Enregistrer un approvisionnement', icone: 'truck',
      etapes: [
        'Menu <b>Approvisions</b>.',
        "Choisissez la <b>date d'achat</b>.",
        'Touchez chaque boisson achetée et saisissez la <b>quantité</b>.',
        'Vérifiez le total puis <b>Valider</b> → <b>Oui</b>.',
      ],
      points: [
        "Le stock augmente automatiquement.",
        'Le montant total est ajouté tout seul dans les <b>dépenses du jour</b> (motif « APPROVISIONNEMENT DE PRODUIT »).',
        "Pour annuler un approvisionnement : <b>Bilans approvisions</b> → sélectionnez-le → <b>Voir les détails</b> → <b>Supprimer</b> (administrateur).",
      ],
    },
    {
      id: 'vente', titre: 'Saisir la vente de la journée', icone: 'cart',
      etapes: [
        'Menu <b>Ventes</b>. La date proposée est la prochaine journée à saisir.',
        "Choisissez la <b>date de la vente</b> (elle peut être antérieure à aujourd'hui) puis <b>Afficher</b>.",
        "Répondez à la question sur l'approvisionnement (Oui = aller l'enregistrer d'abord).",
        'Touchez chaque boisson et saisissez la <b>quantité restante</b> (ce qui reste en stock le soir).',
        "L'application calcule la quantité vendue, le total et le bénéfice.",
        '<b>Valider la vente</b> → <b>Oui</b>.',
      ],
      points: [
        "La date d'enregistrement (aujourd'hui) et la date de vente sont gardées toutes les deux.",
        '<b>Corriger une vente</b> : tant que la caisse du jour n\'est pas fermée, rouvrez la même date dans Ventes, corrigez et validez à nouveau.',
        'Les ventes doivent être saisies dans l\'ordre des dates.',
      ],
    },
    {
      id: 'depenses', titre: 'Enregistrer une dépense', icone: 'wallet',
      etapes: [
        'Menu <b>Dépenses quotidiennes</b>.',
        'Choisissez la date, le type de dépense, le montant et le motif.',
        '<b>Valider</b> → <b>Oui</b>.',
      ],
      points: [
        'Nouveau type de dépense : bouton <b>Nouvelle Dépense</b>.',
        'Voir ou supprimer : <b>Historiques des Dépenses</b>.',
      ],
    },
    {
      id: 'creances', titre: 'Crédits clients (créances)', icone: 'card',
      points: [
        '<b>Enregistrement de Crédit</b> : un client prend à crédit → choisissez le client, la date et le montant.',
        '<b>Paiement des Arriérés</b> : un client rembourse → choisissez le client et le montant payé.',
        '<b>Tableau de bord des créances</b> : ce que chaque client doit encore.',
        '<b>Liste des créanciers</b> : ajouter ou supprimer un client.',
      ],
    },
    {
      id: 'fermeture', titre: 'Fermer la caisse', icone: 'power',
      etapes: [
        'Menu <b>Fermeture de caisse</b>. La date proposée est la journée à fermer.',
        'Vérifiez les 4 étapes (appro, vente, dépenses, créances).',
        'Lisez la situation : <b>versement d\'hier</b>, vente du jour, <b>bénéfice du jour</b>, créances, dépenses.',
        "Le <b>montant total à verser aujourd'hui</b> = vente + crédits payés − créances − dépenses.",
        'Répartissez ce montant entre <b>Wave</b>, <b>OM</b> et <b>Espèce</b> (bouton « Reste en espèces » pour compléter).',
        '<b>Valider la fermeture</b> → <b>Oui</b>.',
      ],
      points: [
        "<b>Montant total versé ce jour</b> = versement d'hier + montant à verser aujourd'hui.",
        "Le versement d'hier reprend le dernier versement, même s'il date de plusieurs jours.",
        "S'il y a un <b>écart</b> (manquant ou excédent), un <b>motif est obligatoire</b> ; il est conservé dans le Journal des écarts (Bilans fermeture caisse).",
        "Rouvrir une caisse : administrateur seulement, et seulement la dernière journée.",
      ],
    },
    {
      id: 'stock', titre: 'Stock et articles', icone: 'box',
      points: [
        'Menu <b>Stock</b> : liste des boissons, quantités, prix de vente et d\'achat.',
        '<b>Ajouter un article</b> : bouton Nouvel article (nom, prix de vente, prix d\'achat).',
        'Toucher un article permet de modifier ses prix (la quantité : administrateur seulement).',
      ],
    },
    {
      id: 'inventaire', titre: "Faire l'inventaire", icone: 'list',
      etapes: [
        'Menu <b>Inventaire</b>, onglet <b>Inventaire</b>.',
        'Choisissez la période (date initiale → au) puis <b>Afficher</b>.',
        'Pour chaque boisson comptée, saisissez la <b>Qté physique</b>. La <b>Qté réelle</b> se remplit toute seule ; vous pouvez la modifier.',
        "Cochez <b>Ajuster le stock</b> pour remplacer le stock du logiciel par la quantité réelle (administrateur).",
        "<b>Valider l'inventaire</b> → <b>Oui</b>.",
      ],
      points: ["L'onglet <b>Bilans des inventaires</b> affiche chaque inventaire passé (écarts, valeur des écarts), imprimable et en PDF."],
    },
    {
      id: 'bilans', titre: 'Bilans et statistiques', icone: 'chart',
      points: [
        '<b>Bilans des ventes</b> : les ventes par jour ; double-cliquez une ligne pour le détail.',
        '<b>Bilan par produit</b> : le produit le plus vendu, classé par quantité, chiffre d\'affaires ou bénéfice.',
        '<b>Bilans approvisions</b> et <b>Bilans fermeture caisse</b> (avec le journal des écarts).',
        '<b>Statistiques</b> : courbes et graphiques sur 7 jours, 30 jours, le mois, 12 mois.',
        'Sur toutes ces pages : choisissez les dates puis <b>Afficher</b> ; bouton <b>PDF</b> pour télécharger.',
      ],
    },
    {
      id: 'admin', titre: 'Administration (administrateur et super admin)', icone: 'gear',
      points: [
        '<b>Utilisateurs & groupes</b> : créer un compte (login, mot de passe, groupe : CAISSIER, ADMINISTRATEUR...).',
        '<b>Numéros automatiques</b> et <b>Paramètres</b> : format des numéros, nom de l\'établissement.',
        '<b>Importation des données</b> (super admin) : reprendre les données de l\'ancienne application.',
        '<b>Tables de la BD</b> (super admin) : voir et corriger les données comme dans Excel (cliquer une cellule pour la modifier, poubelle pour supprimer une ligne). À utiliser avec prudence.',
        '<b>Blocage</b> (super admin) : empêche les autres utilisateurs de se connecter.',
      ],
    },
    {
      id: 'faq', titre: 'Questions fréquentes', icone: 'help',
      points: [
        "<b>« La caisse n'est pas fermée, impossible de faire une nouvelle vente »</b> : fermez d'abord la caisse de la journée indiquée.",
        '<b>« La vente ne peut plus être modifiée »</b> : sa caisse est fermée ; un administrateur peut rouvrir la dernière journée.',
        "<b>Un mot anglais apparaît (« Vague » au lieu de Wave)</b> : désactivez la traduction automatique du navigateur (« Afficher l'original »).",
        "<b>La page ne se met pas à jour après une nouvelle version</b> : appuyez sur Ctrl + F5 (ordinateur) ou fermez et rouvrez l'application (téléphone).",
        '<b>Mot de passe oublié</b> : demandez à l\'administrateur de le changer dans Utilisateurs.',
      ],
    },
  ];

  // ---------------------------------------------------------------
  // 2) CONTENU DU GUIDE DU RESTAURANT
  // ---------------------------------------------------------------
  const GUIDE_RESTO = [
    {
      id: 'demarrer', titre: 'Se connecter et se repérer', icone: 'home',
      etapes: [
        "Sur l'écran d'accueil, touchez la carte <b>RESTO DU FORESTIER</b> (en bleu).",
        'Saisissez le <b>login</b> et le <b>mot de passe</b> du restaurant (différents de ceux du maquis).',
        'Le menu est à gauche (sur téléphone : bouton ☰).',
      ],
      points: [
        'Icône <b>clé</b> en bas du menu : changer son mot de passe.',
        'Icône <b>haut-parleur</b> en haut : couper / remettre le son après chaque validation.',
        'Bouton <b>PDF</b> en haut des bilans : télécharger la page.',
      ],
    },
    {
      id: 'journee', titre: 'La journée type', icone: 'list',
      etapes: [
        'Le matin : préparer le <b>menu du jour</b> (Menus → Menu du jour).',
        'Pendant le service : encaisser chaque client avec <b>Vente (caisse)</b> et lui remettre son reçu.',
        "Noter les <b>dépenses</b> (gaz, marché, transport...).",
        'Le soir : <b>Fermeture de caisse</b>.',
      ],
      attention: "Une fois la caisse d'un jour fermée, plus aucune vente ni dépense ne peut être enregistrée à cette date. Si une journée précédente n'est pas fermée, les ventes sont bloquées jusqu'à sa fermeture.",
    },
    {
      id: 'menus', titre: 'Menus, plats et accompagnements', icone: 'report',
      points: [
        '<b>Menu fixe</b> : plats proposés tous les jours.',
        '<b>Menu du jour</b> : cochez les plats proposés aujourd\'hui (et éventuellement un prix du jour) ; « Copier » reprend le menu d\'une autre date.',
        "<b>Accompagnements</b> (portion de riz, frites, attiéké, alloco...) : prix, et s'ils peuvent être vendus seuls.",
        "Fiche d'un plat (administrateur) : nom, catégorie, prix, <b>accompagnements proposés</b> (inclus ou avec supplément) et <b>stock consommé</b> (ex. 1 portion de riz).",
      ],
    },
    {
      id: 'vente', titre: 'Encaisser un client (vente)', icone: 'cart',
      etapes: [
        'Menu <b>Vente (caisse)</b>.',
        "Touchez les plats commandés (choisissez l'accompagnement si demandé). Utilisez + / − pour la quantité.",
        'Indiquez le nom du client (sinon « Client comptoir »).',
        'Choisissez le <b>mode de paiement</b> : Espèces, Wave, OM, MoMo ou Flooz.',
        'En espèces : saisissez le <b>montant reçu</b> → la monnaie à rendre s\'affiche.',
        '<b>Encaisser</b> → <b>Oui</b>. Le reçu s\'affiche : <b>Imprimer le reçu</b>.',
      ],
      points: ['Le stock (riz, poisson, poulet...) diminue automatiquement selon les plats vendus.'],
    },
    {
      id: 'tickets', titre: 'Tickets et reçus', icone: 'list',
      points: [
        'Menu <b>Tickets / reçus</b> : tous les tickets par date.',
        'Touchez un ticket pour revoir ou <b>réimprimer</b> le reçu.',
        "<b>Annuler un ticket</b> (administrateur) : le stock consommé est remis en place.",
      ],
    },
    {
      id: 'stock', titre: 'Stock du restaurant', icone: 'box',
      points: [
        '<b>Approvisionner</b> : ajoutez les sacs, cartons, poulets achetés (avec le coût).',
        '<b>Un sac est fini</b> : pour le charbon (gestion manuelle).',
        '<b>Inventaire</b> : corrigez le stock réel compté.',
        '<b>Plats par sac / carton / poulet</b> (administrateur) : combien de plats une unité permet de servir.',
        "<b>Ajouter / paramétrer un article</b> (administrateur) : nouvel article (bidon d'huile, carton de frites...), désactiver un article.",
        '<b>Mouvements de stock</b> : historique de toutes les entrées et sorties.',
      ],
    },
    {
      id: 'depenses', titre: 'Dépenses quotidiennes', icone: 'wallet',
      etapes: ['Menu <b>Dépenses quotidiennes</b>.', 'Choisissez le type, le montant et le motif.', '<b>Valider</b> → <b>Oui</b>.'],
      points: ['Les dépenses du jour sont déduites du montant à verser à la fermeture.'],
    },
    {
      id: 'fermeture', titre: 'Fermer la caisse', icone: 'power',
      etapes: [
        'Menu <b>Fermeture de caisse</b>.',
        'Vérifiez les ventes (nombre de tickets) et les dépenses.',
        "Le <b>montant à verser</b> = ventes − dépenses.",
        'La répartition (Espèces, Wave, OM, MoMo, Flooz) est pré-remplie d\'après les tickets : vérifiez l\'argent réellement en caisse.',
        '<b>Valider la fermeture</b> → <b>Oui</b>.',
      ],
    },
    {
      id: 'bilans', titre: 'Bilans des ventes', icone: 'chart',
      points: [
        "Choisissez <b>Aujourd'hui</b>, 7 jours, le mois... ou des dates précises.",
        '<b>Produits vendus</b> : la liste de tout ce qui a été vendu avec les quantités et montants.',
        '<b>Le plus vendu sur la période</b> : classement par quantité ou par montant.',
        "<b>Point par moyen de règlement</b> : total encaissé en Espèces, Wave, OM, MoMo, Flooz (et détail par jour).",
        '<b>Bilans fermeture caisse</b> : toutes les fermetures et les écarts.',
        'Bouton <b>PDF</b> pour télécharger le bilan.',
      ],
    },
    {
      id: 'imprimante', titre: "Régler l'imprimante des tickets", icone: 'print',
      etapes: [
        'Menu <b>Imprimante tickets</b> (à faire sur chaque téléphone ou PC qui imprime).',
        "Choisissez : <b>Imprimante installée (USB / WiFi)</b>, <b>Bluetooth direct</b> (Chrome) ou <b>Application RawBT</b> (Android).",
        'Choisissez la largeur du papier : <b>80 mm</b> (ex. EPSON TM-T20II) ou 58 mm.',
        '<b>Imprimer un ticket de test</b>, puis <b>Enregistrer</b>.',
      ],
      points: [
        "Imprimante installée : dans la fenêtre d'impression de Chrome, mettez <b>Marges : Aucune</b>.",
        'Options : logo sur le reçu, impression automatique après chaque vente, nombre d\'exemplaires.',
      ],
    },
    {
      id: 'admin', titre: 'Administration', icone: 'gear',
      points: [
        '<b>Utilisateurs du restaurant</b> : créer les comptes des caissiers et administrateurs.',
        '<b>Paramètres restaurant</b> : articles du stock, informations du reçu (nom, téléphone, adresse, message), format du numéro de reçu.',
        '<b>Tables de la BD</b> (super admin du restaurant uniquement) : voir et corriger les données du restaurant comme dans Excel.',
      ],
    },
    {
      id: 'faq', titre: 'Questions fréquentes', icone: 'help',
      points: [
        "<b>« Stock insuffisant »</b> : approvisionnez l'article concerné (ou demandez à l'administrateur d'autoriser la vente sans stock).",
        "<b>Les ventes sont bloquées</b> : une journée précédente n'est pas fermée → Fermeture de caisse.",
        "<b>Le reçu est coupé ou décalé</b> : Imprimante tickets → largeur 80 mm, et marges « Aucune » dans la fenêtre d'impression.",
        "<b>« Vague » au lieu de Wave</b> : désactivez la traduction automatique du navigateur.",
      ],
    },
  ];

  // ---------------------------------------------------------------
  // 3) AFFICHAGE (le même code sert pour les deux guides)
  // ---------------------------------------------------------------
  function afficherGuide(el, rubriques, nomApp) {
    el.innerHTML = `
      <div class="card guide-top">
        <div class="card-title">${ic('guide')} Guide d'utilisation — ${esc(nomApp)}</div>
        <p class="muted" style="margin-top:0">Touchez un titre pour aller à la rubrique. Tapez un mot pour filtrer le guide.</p>
        <div class="search">${ic('search')}<input class="input" id="g-q" placeholder="Rechercher (ex : fermeture, wave, inventaire)…"></div>
        <div class="guide-sommaire">${rubriques.map((r, i) => `<a href="#" data-aller="${r.id}"><span>${i + 1}</span>${esc(r.titre)}</a>`).join('')}</div>
      </div>
      <div id="g-liste">${rubriques.map((r, i) => `
        <section class="card guide-sec" id="g-${r.id}">
          <div class="card-title">${ic(r.icone || 'info')} ${i + 1}. ${esc(r.titre)}</div>
          ${r.intro ? `<p>${r.intro}</p>` : ''}
          ${r.etapes ? `<ol class="guide-etapes">${r.etapes.map((e) => `<li>${e}</li>`).join('')}</ol>` : ''}
          ${r.points ? `<ul class="guide-points">${r.points.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
          ${r.attention ? `<div class="notice">${ic('warn')}<div>${r.attention}</div></div>` : ''}
        </section>`).join('')}</div>`;
    // Aller à une rubrique sans changer l'adresse de la page
    $$('[data-aller]', el).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const s = $('#g-' + a.dataset.aller);
      if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    // Filtre : on cache les rubriques qui ne contiennent pas le mot tapé
    $('#g-q', el).addEventListener('input', (e) => {
      const mot = e.target.value.trim().toLowerCase();
      $$('.guide-sec', el).forEach((s) => s.classList.toggle('hidden', !!mot && !s.textContent.toLowerCase().includes(mot)));
    });
  }

  // 4) Déclaration des deux pages (le bouton PDF de la barre du haut fonctionne aussi ici)
  Pages['/guide'] = { pdf: true, title: "Guide d'utilisation", back: '/', render: (el) => afficherGuide(el, GUIDE_MAQUIS, App.nom) };
  Pages['/resto/guide'] = { pdf: true, title: "Guide d'utilisation", back: '/resto', render: (el) => afficherGuide(el, GUIDE_RESTO, App.nomResto) };
})();
