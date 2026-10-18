/* Stockage des données dans le navigateur (IndexedDB).
   C'est le seul fichier à adapter le jour où les données iront dans Google Drive. */
(function (EV) {
  'use strict';

  const NOM_BASE = 'entretien-voiture';
  const VERSION = 1;
  const TABLES = ['voitures', 'categories', 'entretiens', 'documents', 'releves'];
  const TABLES_PAR_VOITURE = ['entretiens', 'documents', 'releves'];

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

  function ouvrirBase() {
    return new Promise((ok, ko) => {
      const requete = indexedDB.open(NOM_BASE, VERSION);
      requete.onupgradeneeded = () => {
        const db = requete.result;
        db.createObjectStore('voitures', { keyPath: 'id' });
        db.createObjectStore('categories', { keyPath: 'id' });
        db.createObjectStore('entretiens', { keyPath: 'id' }).createIndex('voitureId', 'voitureId');
        db.createObjectStore('releves', { keyPath: 'id' }).createIndex('voitureId', 'voitureId');
        const documents = db.createObjectStore('documents', { keyPath: 'id' });
        documents.createIndex('voitureId', 'voitureId');
        documents.createIndex('entretienId', 'entretienId');
      };
      requete.onsuccess = () => ok(requete.result);
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
      return false;
    }
  }

  function nouvelId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const octets = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
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
