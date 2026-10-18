/* Règles sur les voitures : format de la plaque, vérification de la saisie, lecture et enregistrement. */
(function (EV) {
  'use strict';

  const { stockage } = EV;

  // « ab123cd » devient « AB-123-CD » ; l'ancien format « 1234ab75 » devient « 1234 AB 75 ».
  // Les autres formats (plaques étrangères, de collection…) restent tels quels, en majuscules.
  function normaliserPlaque(texte) {
    const propre = String(texte || '').toUpperCase().replace(/[^A-Z0-9 -]/g, '').replace(/\s+/g, ' ').trim();
    const compacte = propre.replace(/[ -]/g, '');
    let morceaux = compacte.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/);
    if (morceaux) return `${morceaux[1]}-${morceaux[2]}-${morceaux[3]}`;
    morceaux = compacte.match(/^(\d{1,4})([A-Z]{1,3})(\d{2,3}|2A|2B)$/);
    if (morceaux) return `${morceaux[1]} ${morceaux[2]} ${morceaux[3]}`;
    return propre;
  }

  // Plaque sans espaces ni tirets, pour comparer « AB 123 CD » et « AB-123-CD ».
  function plaqueCompacte(plaque) {
    return String(plaque || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function nettoyer(texte) {
    return String(texte || '').replace(/\s+/g, ' ').trim();
  }

  function nom(voiture) {
    return `${voiture.marque} ${voiture.modele}`.trim();
  }

  // Vérifie la saisie du formulaire. Renvoie les valeurs nettoyées et les erreurs par champ.
  function verifier(saisie, voituresExistantes) {
    const anneeSaisie = nettoyer(saisie.annee);
    const valeurs = {
      plaque: normaliserPlaque(saisie.plaque),
      marque: nettoyer(saisie.marque),
      modele: nettoyer(saisie.modele),
      annee: anneeSaisie === '' ? null : Number(anneeSaisie)
    };

    const erreurs = {};
    if (!plaqueCompacte(valeurs.plaque)) {
      erreurs.plaque = "Indiquez la plaque d'immatriculation.";
    } else {
      const doublon = voituresExistantes.find((v) => v.id !== saisie.id
        && plaqueCompacte(v.plaque) === plaqueCompacte(valeurs.plaque));
      if (doublon) erreurs.plaque = `Cette plaque est déjà enregistrée pour la ${nom(doublon)}.`;
    }
    if (!valeurs.marque) erreurs.marque = 'Indiquez la marque.';
    if (!valeurs.modele) erreurs.modele = 'Indiquez le modèle.';

    const anneeMax = new Date().getFullYear() + 1;
    if (valeurs.annee !== null
      && !(Number.isInteger(valeurs.annee) && valeurs.annee >= 1900 && valeurs.annee <= anneeMax)) {
      erreurs.annee = `Indiquez une année entre 1900 et ${anneeMax}, ou laissez le champ vide.`;
    }
    return { valeurs, erreurs };
  }

  // Les voitures dans l'ordre où elles ont été ajoutées.
  async function liste() {
    const voitures = await stockage.tous('voitures');
    return voitures.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  }

  EV.voitures = {
    normaliserPlaque,
    nom,
    verifier,
    liste,
    lire: (id) => stockage.lire('voitures', id),
    enregistrer: (voiture) => stockage.enregistrer('voitures', voiture),
    supprimer: (id) => stockage.supprimerVoiture(id)
  };
})(window.EV = window.EV || {});
