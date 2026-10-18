/* Stockage des données en ligne, dans Cloud Firestore (Firebase).
   Chaque utilisateur a son propre espace : users/{uid}/voitures, users/{uid}/entretiens…
   Une copie est gardée sur l'appareil : l'application reste utilisable sans réseau
   et envoie les modifications dès que la connexion revient.
   Les écrans utilisent toujours les mêmes fonctions qu'avec l'ancien stockage local. */
(function (EV) {
  'use strict';

  const TABLES = ['voitures', 'categories', 'entretiens', 'documents', 'releves'];
  const TABLES_PAR_VOITURE = ['entretiens', 'documents', 'releves'];
  const NOM_ANCIENNE_BASE = 'entretien-voiture'; // base IndexedDB d'avant le passage en ligne
  const TAILLE_LOT = 400;                        // Firestore accepte 500 écritures par lot

  let db = null;
  let espace = null; // document users/{uid}

  // Les écrans peuvent appeler le stockage avant la fin de la connexion : ils attendent qu'il soit prêt.
  let signalerPret;
  const pret = new Promise((ok) => { signalerPret = ok; });

  function table(nom) {
    return espace.collection(nom);
  }

  // Les écritures partent en arrière-plan : l'écran n'attend pas le réseau.
  // En cas de refus du serveur, on prévient l'utilisateur.
  function signalerEchec(erreur) {
    console.error(erreur);
    EV.ui.toast("Une modification n'a pas pu être enregistrée en ligne. Vérifiez votre connexion, puis réessayez.");
  }

  async function demarrer(uid) {
    db = firebase.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    try {
      await db.enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      // Navigation privée ou navigateur ancien : tout fonctionne, mais sans copie hors ligne.
      console.warn('Copie hors ligne indisponible :', e.code || e);
    }
    espace = db.collection('users').doc(uid);
    signalerPret();
    return true;
  }

  function nouvelId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const octets = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
  }

  function contenus(cliche) {
    return cliche.docs.map((d) => d.data());
  }

  async function tous(nom) {
    await pret;
    return contenus(await table(nom).get());
  }

  async function lire(nom, id) {
    await pret;
    const doc = await table(nom).doc(id).get();
    return doc.exists ? doc.data() : undefined;
  }

  async function parVoiture(nom, voitureId) {
    await pret;
    return contenus(await table(nom).where('voitureId', '==', voitureId).get());
  }

  // Ajoute ou met à jour un objet ; lui donne un identifiant et ses dates de création et de modification.
  async function enregistrer(nom, objet) {
    await pret;
    const maintenant = new Date().toISOString();
    const complet = { ...objet, id: objet.id || nouvelId(), creeLe: objet.creeLe || maintenant, modifieLe: maintenant };
    table(nom).doc(complet.id).set(complet).catch(signalerEchec);
    return complet;
  }

  async function supprimer(nom, id) {
    await pret;
    table(nom).doc(id).delete().catch(signalerEchec);
  }

  // Applique une liste d'opérations ({ lot } => …) par lots de TAILLE_LOT.
  function ecrireParLots(operations) {
    const envois = [];
    for (let i = 0; i < operations.length; i += TAILLE_LOT) {
      const lot = db.batch();
      operations.slice(i, i + TAILLE_LOT).forEach((operation) => operation(lot));
      envois.push(lot.commit());
    }
    return Promise.all(envois);
  }

  // Supprime une voiture et tout ce qui lui est rattaché.
  async function supprimerVoiture(id) {
    await pret;
    const references = [table('voitures').doc(id)];
    for (const nom of TABLES_PAR_VOITURE) {
      const cliche = await table(nom).where('voitureId', '==', id).get();
      cliche.forEach((doc) => references.push(doc.ref));
    }
    ecrireParLots(references.map((ref) => (lot) => lot.delete(ref))).catch(signalerEchec);
  }

  // Avant la déconnexion : envoie ce qui reste en attente, puis efface la copie gardée sur l'appareil.
  async function arreter() {
    if (!db) return;
    try {
      await Promise.race([db.waitForPendingWrites(), new Promise((ok) => setTimeout(ok, 5000))]);
      await db.terminate();
      await db.clearPersistence();
    } catch (e) {
      console.warn("La copie locale n'a pas pu être effacée :", e);
    }
  }

  /* ---------- Reprise des données enregistrées sur l'appareil avant le passage en ligne ---------- */

  // Ouvre l'ancienne base sans la créer si elle n'existe pas.
  function ouvrirAncienneBase() {
    return new Promise((ok) => {
      let requete;
      try {
        requete = indexedDB.open(NOM_ANCIENNE_BASE);
      } catch (e) {
        ok(null);
        return;
      }
      requete.onupgradeneeded = () => requete.transaction.abort(); // n'existait pas : on annule sa création
      requete.onsuccess = () => ok(requete.result);
      requete.onerror = (e) => { e.preventDefault(); ok(null); };
      requete.onblocked = () => ok(null);
    });
  }

  function attendre(requete) {
    return new Promise((ok, ko) => {
      requete.onsuccess = () => ok(requete.result);
      requete.onerror = () => ko(requete.error);
    });
  }

  // Renvoie { voitures: [...], ... } ou null s'il n'y a rien à reprendre.
  async function lireAnciennesDonnees() {
    const ancienne = await ouvrirAncienneBase();
    if (!ancienne) return null;
    try {
      const donnees = {};
      let total = 0;
      for (const nom of TABLES) {
        donnees[nom] = ancienne.objectStoreNames.contains(nom)
          ? await attendre(ancienne.transaction(nom).objectStore(nom).getAll())
          : [];
        total += donnees[nom].length;
      }
      return total > 0 ? donnees : null;
    } catch (e) {
      console.warn("L'ancienne base n'a pas pu être lue :", e);
      return null;
    } finally {
      ancienne.close();
    }
  }

  // true si l'espace en ligne ne contient encore aucune voiture.
  async function espaceVide() {
    await pret;
    return (await table('voitures').limit(1).get()).empty;
  }

  // Copie les anciennes données en gardant leurs identifiants (relancer l'import ne crée pas de doublons).
  async function importer(donnees) {
    await pret;
    const operations = [];
    Object.entries(donnees).forEach(([nom, objets]) => {
      objets.forEach((objet) => operations.push((lot) => lot.set(table(nom).doc(objet.id), objet)));
    });
    ecrireParLots(operations).catch(signalerEchec);
    return operations.length;
  }

  EV.stockage = {
    demarrer, tous, lire, parVoiture, enregistrer, supprimer, supprimerVoiture, arreter,
    lireAnciennesDonnees, espaceVide, importer
  };
})(window.EV = window.EV || {});
