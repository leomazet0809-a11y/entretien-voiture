/* Stockage des données dans le navigateur (IndexedDB).
   C'est le seul fichier à adapter le jour où les données iront dans Google Drive. */
(function (EV) {
  'use strict';

  const NOM_BASE = 'entretien-voiture';
  const VERSION = 3;
  // Un événement (un passage : date, km, garage, documents) contient ses lignes d'entretien.
  const TABLES = ['voitures', 'categories', 'evenements', 'documents', 'releves'];
  const TABLES_PAR_VOITURE = ['evenements', 'documents', 'releves'];

  // Catégories créées une seule fois, à la première ouverture ; l'utilisateur les modifie ensuite à sa guise.
  const CATEGORIES_DE_DEPART = ['Révision / vidange', 'Contrôle technique', 'Freinage', 'Pneumatiques',
    'Distribution', 'Climatisation', 'Filtres', 'Moteur', 'Batterie / électricité', 'Carrosserie / vitrage', 'Divers'];

  let base = null;     // base IndexedDB ouverte
  let memoire = null;  // repli en mémoire vive si le navigateur refuse IndexedDB

  function attendre(requete) {
    return new Promise((ok, ko) => {
      requete.onsuccess = () => ok(requete.result);
      requete.onerror = () => ko(requete.error);
    });
  }

  function finTransaction(transaction) {
    return new Promise((ok, ko) => {
      transaction.oncomplete = () => ok();
      transaction.onerror = () => ko(transaction.error);
      transaction.onabort = () => ko(transaction.error);
    });
  }

  function nouvelId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const octets = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
  }

  function categoriesDeDepart() {
    const maintenant = new Date().toISOString();
    return CATEGORIES_DE_DEPART.map((nom) => ({ id: nouvelId(), nom, creeLe: maintenant, modifieLe: maintenant }));
  }

  // Crée ou met à niveau la base. Chaque version ne fait que ce qui manque, les données existantes sont gardées.
  function ouvrirBase() {
    return new Promise((ok, ko) => {
      const requete = indexedDB.open(NOM_BASE, VERSION);
      requete.onupgradeneeded = (evenement) => {
        const db = requete.result;
        if (evenement.oldVersion < 1) {
          db.createObjectStore('voitures', { keyPath: 'id' });
          db.createObjectStore('categories', { keyPath: 'id' });
          db.createObjectStore('entretiens', { keyPath: 'id' }).createIndex('voitureId', 'voitureId');
          db.createObjectStore('releves', { keyPath: 'id' }).createIndex('voitureId', 'voitureId');
          const documents = db.createObjectStore('documents', { keyPath: 'id' });
          documents.createIndex('voitureId', 'voitureId');
          documents.createIndex('entretienId', 'entretienId');
        }
        if (evenement.oldVersion < 2) {
          const categories = requete.transaction.objectStore('categories');
          categoriesDeDepart().forEach((categorie) => categories.put(categorie));
        }
        if (evenement.oldVersion < 3) {
          // Les entretiens deviennent des lignes à l'intérieur d'un événement ; la table « entretiens » n'a jamais servi.
          db.createObjectStore('evenements', { keyPath: 'id' }).createIndex('voitureId', 'voitureId');
          if (db.objectStoreNames.contains('entretiens')) db.deleteObjectStore('entretiens');
          const documents = requete.transaction.objectStore('documents');
          if (documents.indexNames.contains('entretienId')) documents.deleteIndex('entretienId');
          documents.createIndex('evenementId', 'evenementId');
        }
      };
      requete.onblocked = () => {
        EV.ui.toast("Fermez les autres onglets de l'application pour terminer sa mise à jour.");
      };
      requete.onsuccess = () => {
        const db = requete.result;
        // Si une version plus récente s'ouvre dans un autre onglet, on lui laisse la place.
        db.onversionchange = () => {
          db.close();
          location.reload();
        };
        ok(db);
      };
      requete.onerror = () => ko(requete.error);
    });
  }

  // Renvoie true si les données seront conservées, false si elles ne vivent que le temps de la visite.
  async function demarrer() {
    try {
      base = await ouvrirBase();
      return true;
    } catch (e) {
      memoire = Object.fromEntries(TABLES.map((table) => [table, new Map()]));
      categoriesDeDepart().forEach((categorie) => memoire.categories.set(categorie.id, categorie));
      return false;
    }
  }

  async function tous(table) {
    if (memoire) return [...memoire[table].values()].map((o) => structuredClone(o));
    return attendre(base.transaction(table).objectStore(table).getAll());
  }

  async function lire(table, id) {
    if (memoire) {
      const objet = memoire[table].get(id);
      return objet ? structuredClone(objet) : undefined;
    }
    return attendre(base.transaction(table).objectStore(table).get(id));
  }

  async function parVoiture(table, voitureId) {
    if (memoire) return (await tous(table)).filter((o) => o.voitureId === voitureId);
    return attendre(base.transaction(table).objectStore(table).index('voitureId').getAll(voitureId));
  }

  // Ajoute ou met à jour un objet ; lui donne un identifiant et ses dates de création et de modification.
  async function enregistrer(table, objet) {
    const maintenant = new Date().toISOString();
    const complet = { ...objet, id: objet.id || nouvelId(), creeLe: objet.creeLe || maintenant, modifieLe: maintenant };
    if (memoire) {
      memoire[table].set(complet.id, structuredClone(complet));
    } else {
      const transaction = base.transaction(table, 'readwrite');
      transaction.objectStore(table).put(complet);
      await finTransaction(transaction);
    }
    return complet;
  }

  async function supprimer(table, id) {
    if (memoire) {
      memoire[table].delete(id);
      return;
    }
    const transaction = base.transaction(table, 'readwrite');
    transaction.objectStore(table).delete(id);
    await finTransaction(transaction);
  }

  // Supprime une voiture et tout ce qui lui est rattaché, en une seule opération.
  async function supprimerVoiture(id) {
    if (memoire) {
      memoire.voitures.delete(id);
      TABLES_PAR_VOITURE.forEach((table) => {
        memoire[table].forEach((objet, cle) => {
          if (objet.voitureId === id) memoire[table].delete(cle);
        });
      });
      return;
    }
    const transaction = base.transaction(['voitures', ...TABLES_PAR_VOITURE], 'readwrite');
    transaction.objectStore('voitures').delete(id);
    TABLES_PAR_VOITURE.forEach((table) => {
      const magasin = transaction.objectStore(table);
      const curseur = magasin.index('voitureId').openKeyCursor(IDBKeyRange.only(id));
      curseur.onsuccess = () => {
        if (!curseur.result) return;
        magasin.delete(curseur.result.primaryKey);
        curseur.result.continue();
      };
    });
    await finTransaction(transaction);
  }

  // Documents joints à un événement.
  async function documentsDeLEvenement(evenementId) {
    if (memoire) return (await tous('documents')).filter((d) => d.evenementId === evenementId);
    return attendre(base.transaction('documents').objectStore('documents').index('evenementId').getAll(evenementId));
  }

  // Enregistre un événement et ses changements de documents, en une seule opération.
  // `ajouts` : documents à joindre ({ nom, type, taille, contenu }) ; `suppressions` : identifiants à retirer.
  async function enregistrerEvenement(evenement, { ajouts = [], suppressions = [] } = {}) {
    const maintenant = new Date().toISOString();
    const complet = { ...evenement, id: evenement.id || nouvelId(), creeLe: evenement.creeLe || maintenant, modifieLe: maintenant };
    const nouveaux = ajouts.map((fichier) => ({
      id: nouvelId(),
      evenementId: complet.id,
      voitureId: complet.voitureId,
      nom: fichier.nom,
      type: fichier.type,
      taille: fichier.taille,
      contenu: fichier.contenu,
      creeLe: maintenant,
      modifieLe: maintenant
    }));

    if (memoire) {
      memoire.evenements.set(complet.id, structuredClone(complet));
      suppressions.forEach((id) => memoire.documents.delete(id));
      memoire.documents.forEach((document) => {
        if (document.evenementId === complet.id) document.voitureId = complet.voitureId;
      });
      nouveaux.forEach((document) => memoire.documents.set(document.id, document));
      return complet;
    }

    const transaction = base.transaction(['evenements', 'documents'], 'readwrite');
    transaction.objectStore('evenements').put(complet);
    const documents = transaction.objectStore('documents');
    suppressions.forEach((id) => documents.delete(id));
    // Si l'événement change de voiture, ses documents le suivent.
    const existants = documents.index('evenementId').getAll(complet.id);
    existants.onsuccess = () => {
      existants.result.forEach((document) => {
        if (document.voitureId !== complet.voitureId) documents.put({ ...document, voitureId: complet.voitureId });
      });
    };
    nouveaux.forEach((document) => documents.put(document));
    await finTransaction(transaction);
    return complet;
  }

  // Supprime un événement et ses documents joints, en une seule opération.
  async function supprimerEvenement(id) {
    if (memoire) {
      memoire.evenements.delete(id);
      memoire.documents.forEach((document, cle) => {
        if (document.evenementId === id) memoire.documents.delete(cle);
      });
      return;
    }
    const transaction = base.transaction(['evenements', 'documents'], 'readwrite');
    transaction.objectStore('evenements').delete(id);
    const documents = transaction.objectStore('documents');
    const curseur = documents.index('evenementId').openKeyCursor(IDBKeyRange.only(id));
    curseur.onsuccess = () => {
      if (!curseur.result) return;
      documents.delete(curseur.result.primaryKey);
      curseur.result.continue();
    };
    await finTransaction(transaction);
  }

  EV.stockage = {
    demarrer, nouvelId, tous, lire, parVoiture, enregistrer, supprimer,
    supprimerVoiture, documentsDeLEvenement, enregistrerEvenement, supprimerEvenement
  };
})(window.EV = window.EV || {});
