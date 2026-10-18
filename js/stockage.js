/* Stockage des données dans le navigateur (IndexedDB).
   C'est le seul fichier à adapter le jour où les données iront dans Google Drive. */
(function (EV) {
  'use strict';

  const NOM_BASE = 'entretien-voiture';
  const VERSION = 2;
  const TABLES = ['voitures', 'categories', 'entretiens', 'documents', 'releves'];
  const TABLES_PAR_VOITURE = ['entretiens', 'documents', 'releves'];

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

  EV.stockage = { demarrer, tous, lire, parVoiture, enregistrer, supprimer, supprimerVoiture };
})(window.EV = window.EV || {});
