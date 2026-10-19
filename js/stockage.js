/* Stockage des données en ligne, dans Cloud Firestore.
   Chaque compte a son propre espace : users/{uid}/voitures, users/{uid}/evenements…
   Les tables sont écoutées en temps réel et gardées en mémoire : les écrans les lisent sans attendre le réseau
   (et sans consommer de lectures Firestore), et une modification faite sur un autre appareil apparaît d'elle-même.
   Firestore garde aussi une copie sur l'appareil : l'application reste utilisable sans réseau
   et envoie les modifications dès que la connexion revient. */
(function (EV) {
  'use strict';

  // Un événement (un passage : date, km, société) contient ses lignes d'entretien.
  const TABLES = ['voitures', 'categories', 'evenements', 'releves'];
  const TAILLE_LOT = 400; // Firestore accepte 500 écritures par lot

  // Catégories créées une seule fois par compte ; l'utilisateur les modifie ensuite à sa guise.
  const CATEGORIES_DE_DEPART = ['Révision / vidange', 'Contrôle technique', 'Freinage', 'Pneumatiques',
    'Distribution', 'Climatisation', 'Filtres', 'Moteur', 'Batterie / électricité', 'Carrosserie / vitrage', 'Divers'];

  let db = null;
  let uid = null;
  let espace = null;        // document users/{uid}
  const donnees = {};       // nom de table → Map(id → objet), tenue à jour par l'écoute en temps réel
  const arretsEcoute = [];

  function table(nom) {
    return espace.collection(nom);
  }

  function copie(objet) {
    return structuredClone(objet);
  }

  // Les écritures partent en arrière-plan : l'écran n'attend pas le réseau.
  // En cas de refus du serveur, on prévient l'utilisateur.
  function signalerEchec(erreur) {
    console.error(erreur);
    EV.ui.toast("Une modification n'a pas pu être enregistrée en ligne. Vérifiez votre connexion, puis réessayez.");
  }

  function nouvelId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const octets = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
  }

  // Donne un identifiant et les dates de création et de modification.
  function horodater(objet) {
    const maintenant = new Date().toISOString();
    return { ...objet, id: objet.id || nouvelId(), creeLe: objet.creeLe || maintenant, modifieLe: maintenant };
  }

  // Relevé kilométrique tiré d'un événement daté avec un kilométrage ; son identifiant découle de l'événement.
  function idReleveDeLEvenement(evenementId) {
    return `evenement-${evenementId}`;
  }

  function releveDeLEvenement(evenement) {
    if (!evenement.date || evenement.km === null || evenement.km === undefined) return null;
    return horodater({
      id: idReleveDeLEvenement(evenement.id),
      voitureId: evenement.voitureId,
      evenementId: evenement.id,
      date: evenement.date,
      km: evenement.km,
      source: 'evenement'
    });
  }

  // Lot d'écritures qui met aussi à jour les données en mémoire, pour que l'écran suivant les voie aussitôt.
  function nouveauLot() {
    const operations = [];
    return {
      ecrire(nom, objet) {
        donnees[nom].set(objet.id, copie(objet));
        operations.push((lot) => lot.set(table(nom).doc(objet.id), objet));
      },
      effacer(nom, id) {
        donnees[nom].delete(id);
        operations.push((lot) => lot.delete(table(nom).doc(id)));
      },
      // Écriture d'un document hors des tables gardées en mémoire (réglages du compte).
      ecrireDocument(reference, contenu) {
        operations.push((lot) => lot.set(reference, contenu));
      },
      // Envoie par paquets de TAILLE_LOT ; la promesse se résout quand le serveur a tout reçu.
      envoyer() {
        const envois = [];
        for (let i = 0; i < operations.length; i += TAILLE_LOT) {
          const lot = db.batch();
          operations.slice(i, i + TAILLE_LOT).forEach((operation) => operation(lot));
          envois.push(lot.commit());
        }
        return Promise.all(envois);
      }
    };
  }

  /* ---------- Démarrage et écoute en temps réel ---------- */

  // Une modification arrivée d'un autre appareil : on réaffiche l'écran,
  // mais jamais pendant une saisie (fenêtre ouverte ou champ de la page en cours d'utilisation).
  let reaffichagePrevu = null;
  function saisieEnCours() {
    const actif = document.activeElement;
    return Boolean(document.querySelector('dialog[open]')
      || (actif && actif.closest('#contenu') && actif.matches('input, textarea, select')));
  }

  function reafficher(delai = 300) {
    clearTimeout(reaffichagePrevu);
    reaffichagePrevu = setTimeout(() => {
      if (saisieEnCours()) reafficher(2000);
      else EV.routeur.afficher();
    }, delai);
  }

  function ecouter(nom) {
    return new Promise((pret, echec) => {
      let premier = true;
      const arreter = table(nom).onSnapshot((cliche) => {
        const contenu = new Map();
        cliche.forEach((document) => contenu.set(document.id, document.data()));
        donnees[nom] = contenu;
        if (premier) {
          premier = false;
          pret();
        } else if (!cliche.metadata.hasPendingWrites) {
          reafficher();
        }
      }, (erreur) => {
        if (premier) {
          premier = false;
          echec(erreur);
        } else {
          signalerEchec(erreur);
        }
      });
      arretsEcoute.push(arreter);
    });
  }

  // Identifiant fixe d'une catégorie de départ (« Révision / vidange » → « depart-revision-vidange ») :
  // si la liste de départ était créée deux fois (deux appareils à la fois), les mêmes fiches seraient réécrites
  // au lieu d'être dupliquées.
  function idCategorieDeDepart(nom) {
    return `depart-${nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  }

  // Première connexion d'un compte : on crée la liste de catégories de départ, avec la mention « déjà fait »
  // dans la même écriture. On ne le fait que si le serveur confirme que c'est la première fois.
  async function initialiserCategories() {
    const reglages = espace.collection('reglages').doc('general');
    let cliche;
    try {
      cliche = await reglages.get();
    } catch (e) {
      return;
    }
    if (cliche.exists || cliche.metadata.fromCache) return;
    const lot = nouveauLot();
    CATEGORIES_DE_DEPART.forEach((nom) => lot.ecrire('categories', horodater({ id: idCategorieDeDepart(nom), nom })));
    lot.ecrireDocument(reglages, { categoriesDeDepart: true, creeLe: new Date().toISOString() });
    lot.envoyer().catch(signalerEchec);
  }

  // Renvoie true : les données sont toujours conservées (en ligne, avec une copie sur l'appareil si possible).
  async function demarrer(identifiant) {
    uid = identifiant;
    const emulateurs = EV.firebaseEmulateurs; // uniquement pour tester en local avec les émulateurs Firebase
    db = firebase.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    if (emulateurs) db.useEmulator(emulateurs.firestore.hote, emulateurs.firestore.port);
    try {
      await db.enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      // Navigation privée ou navigateur ancien : tout fonctionne, mais sans copie hors ligne.
      console.warn('Copie hors ligne indisponible :', e.code || e);
    }

    espace = db.collection('users').doc(uid);
    await Promise.all(TABLES.map(ecouter));
    await initialiserCategories();
    return true;
  }

  /* ---------- Lecture (depuis la mémoire, tenue à jour en temps réel) ---------- */

  async function tous(nom) {
    return [...donnees[nom].values()].map(copie);
  }

  async function lire(nom, id) {
    const objet = donnees[nom].get(id);
    return objet ? copie(objet) : undefined;
  }

  async function parVoiture(nom, voitureId) {
    return (await tous(nom)).filter((o) => o.voitureId === voitureId);
  }

  /* ---------- Écriture ---------- */

  // Ajoute ou met à jour un objet.
  async function enregistrer(nom, objet) {
    const complet = horodater(objet);
    const lot = nouveauLot();
    lot.ecrire(nom, complet);
    lot.envoyer().catch(signalerEchec);
    return complet;
  }

  async function supprimer(nom, id) {
    const lot = nouveauLot();
    lot.effacer(nom, id);
    lot.envoyer().catch(signalerEchec);
  }

  /* ---------- Événements, voitures : écritures groupées ---------- */

  // Enregistre un événement et son relevé kilométrique.
  async function enregistrerEvenement(evenement) {
    const complet = horodater(evenement);
    const lot = nouveauLot();
    lot.ecrire('evenements', complet);
    // Le relevé suit l'événement : créé, mis à jour, ou retiré si la date ou le kilométrage manque.
    const releve = releveDeLEvenement(complet);
    if (releve) lot.ecrire('releves', releve);
    else if (donnees.releves.has(idReleveDeLEvenement(complet.id))) lot.effacer('releves', idReleveDeLEvenement(complet.id));
    lot.envoyer().catch(signalerEchec);
    return complet;
  }

  // Supprime un événement et son relevé kilométrique.
  async function supprimerEvenement(id) {
    const lot = nouveauLot();
    lot.effacer('evenements', id);
    if (donnees.releves.has(idReleveDeLEvenement(id))) lot.effacer('releves', idReleveDeLEvenement(id));
    lot.envoyer().catch(signalerEchec);
  }

  // Remplace tous les événements d'une voiture (import d'un fichier CSV), avec leurs relevés kilométriques.
  // `categories` : catégories nouvelles à créer. Les relevés notés à la main restent.
  async function remplacerEvenements(voitureId, evenements, { categories = [] } = {}) {
    const lot = nouveauLot();
    categories.forEach((categorie) => lot.ecrire('categories', horodater(categorie)));
    [...donnees.evenements.values()].filter((e) => e.voitureId === voitureId).forEach((e) => {
      lot.effacer('evenements', e.id);
      if (donnees.releves.has(idReleveDeLEvenement(e.id))) lot.effacer('releves', idReleveDeLEvenement(e.id));
    });
    evenements.map((e) => horodater({ ...e, voitureId })).forEach((evenement) => {
      lot.ecrire('evenements', evenement);
      const releve = releveDeLEvenement(evenement);
      if (releve) lot.ecrire('releves', releve);
    });
    lot.envoyer().catch(signalerEchec);
  }

  // Supprime une voiture et tout ce qui lui est rattaché.
  async function supprimerVoiture(id) {
    const lot = nouveauLot();
    lot.effacer('voitures', id);
    ['evenements', 'releves'].forEach((nom) => {
      [...donnees[nom].values()].filter((o) => o.voitureId === id).forEach((o) => lot.effacer(nom, o.id));
    });
    lot.envoyer().catch(signalerEchec);
  }

  // Avant la déconnexion : envoie ce qui reste en attente, puis efface la copie gardée sur l'appareil.
  async function arreter() {
    if (!db) return;
    arretsEcoute.forEach((arreterEcoute) => arreterEcoute());
    try {
      await Promise.race([db.waitForPendingWrites(), new Promise((ok) => setTimeout(ok, 5000))]);
      await db.terminate();
      await db.clearPersistence();
    } catch (e) {
      console.warn("La copie locale n'a pas pu être effacée :", e);
    }
  }

  EV.stockage = {
    demarrer, nouvelId, tous, lire, parVoiture, enregistrer, supprimer,
    supprimerVoiture, enregistrerEvenement, supprimerEvenement, remplacerEvenements, arreter
  };
})(window.EV = window.EV || {});
