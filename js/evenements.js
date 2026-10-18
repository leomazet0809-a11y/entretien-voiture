/* Règles sur les événements d'entretien.
   Un événement = un passage : une date, un kilométrage, un garage, des documents,
   et une ou plusieurs lignes d'entretien (catégorie, détail, commentaire, coût). */
(function (EV) {
  'use strict';

  const { stockage, format } = EV;

  // Texte sur une ligne : espaces superflus retirés.
  function nettoyer(texte) {
    return String(texte ?? '').replace(/\s+/g, ' ').trim();
  }

  // Texte sur plusieurs lignes (le détail) : on garde les retours à la ligne.
  function nettoyerParagraphe(texte) {
    return String(texte ?? '').split('\n').map((ligne) => ligne.replace(/[ \t]+/g, ' ').trim())
      .join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function estRenseigne(valeur) {
    return valeur !== null && valeur !== undefined;
  }

  // Coût total : le coût global, ou la somme des coûts des lignes. null si aucun coût n'est renseigné.
  function total(evenement) {
    if (evenement.modeCout === 'global') return evenement.coutGlobal ?? null;
    const couts = evenement.lignes.map((ligne) => ligne.cout).filter(estRenseigne);
    return couts.length ? couts.reduce((somme, cout) => somme + cout, 0) : null;
  }

  // Le plus récent en premier ; les événements sans date à la fin.
  function comparer(a, b) {
    if (a.date && b.date && a.date !== b.date) return b.date.localeCompare(a.date);
    if (!a.date !== !b.date) return a.date ? -1 : 1;
    if ((a.km ?? -1) !== (b.km ?? -1)) return (b.km ?? -1) - (a.km ?? -1);
    return b.creeLe.localeCompare(a.creeLe);
  }

  async function parVoiture(voitureId) {
    return (await stockage.parVoiture('evenements', voitureId)).sort(comparer);
  }

  // Vérifie la saisie du formulaire.
  // Renvoie les valeurs nettoyées, les erreurs des champs de l'événement ({ km: '…' })
  // et celles des lignes, dans l'ordre de saisie ([{ categorie: '…', cout: '…' }, …]).
  function verifier(saisie) {
    const erreurs = {};
    const erreursLignes = saisie.lignes.map(() => ({}));

    if (!saisie.voitureId) erreurs.voitureId = 'Choisissez la voiture.';
    const date = format.lireDate(saisie.date);
    if (Number.isNaN(date)) erreurs.date = 'Indiquez une date réelle au format JJ/MM/AAAA (ex. : 13/01/2025), ou laissez vide.';
    const km = format.lireKm(saisie.km);
    if (Number.isNaN(km)) erreurs.km = 'Indiquez le kilométrage en chiffres (ex. : 140 000), ou laissez vide.';
    const coutGlobal = saisie.modeCout === 'global' ? format.lireMontant(saisie.coutGlobal) : null;
    if (Number.isNaN(coutGlobal)) erreurs.coutGlobal = 'Indiquez un montant, par exemple 84,90.';

    const lignes = [];
    saisie.lignes.forEach((brute, rang) => {
      const ligne = {
        id: brute.id || stockage.nouvelId(),
        categorieId: brute.categorieId || null,
        detail: nettoyerParagraphe(brute.detail),
        commentaire: nettoyer(brute.commentaire),
        cout: saisie.modeCout === 'detail' ? format.lireMontant(brute.cout) : null
      };
      const vide = !ligne.categorieId && !ligne.detail && !ligne.commentaire && ligne.cout === null;
      if (vide) return; // ligne laissée vide : ignorée
      if (!ligne.categorieId && !ligne.detail) erreursLignes[rang].categorie = "Choisissez une catégorie ou décrivez l'entretien.";
      if (Number.isNaN(ligne.cout)) erreursLignes[rang].cout = 'Indiquez un montant, par exemple 84,90.';
      lignes.push(ligne);
    });
    if (lignes.length === 0 && saisie.lignes.length) {
      erreursLignes[0].categorie = "Indiquez au moins un entretien : choisissez une catégorie ou décrivez-le.";
    }

    const valeurs = {
      voitureId: saisie.voitureId,
      date: Number.isNaN(date) ? null : date,
      km,
      garage: nettoyer(saisie.garage),
      modeCout: saisie.modeCout === 'detail' ? 'detail' : 'global',
      coutGlobal,
      lignes
    };
    const valide = Object.keys(erreurs).length === 0 && erreursLignes.every((e) => Object.keys(e).length === 0);
    return { valeurs, erreurs, erreursLignes, valide };
  }

  // Pour l'accueil : date du dernier événement, kilométrage le plus élevé et nombre d'événements, par voiture.
  async function resumes() {
    const parId = {};
    (await stockage.tous('evenements')).forEach((evenement) => {
      const resume = parId[evenement.voitureId] || (parId[evenement.voitureId] = { derniereDate: null, kmMax: null, nombre: 0 });
      resume.nombre += 1;
      if (evenement.date && (!resume.derniereDate || evenement.date > resume.derniereDate)) resume.derniereDate = evenement.date;
      if (estRenseigne(evenement.km) && (resume.kmMax === null || evenement.km > resume.kmMax)) resume.kmMax = evenement.km;
    });
    return parId;
  }

  // Les garages déjà saisis, proposés pendant la frappe.
  async function garages() {
    const noms = new Map();
    (await stockage.tous('evenements')).forEach((evenement) => {
      if (evenement.garage) noms.set(evenement.garage.toLocaleLowerCase('fr'), evenement.garage);
    });
    return [...noms.values()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }

  EV.evenements = {
    total,
    parVoiture,
    verifier,
    resumes,
    garages,
    lire: (id) => stockage.lire('evenements', id),
    documents: (id) => stockage.documentsDeLEvenement(id),
    // Documents d'une voiture, rangés par événement : { idEvenement: [documents] }.
    documentsParEvenement: async (voitureId) => {
      const parEvenement = {};
      (await stockage.parVoiture('documents', voitureId)).forEach((document) => {
        (parEvenement[document.evenementId] || (parEvenement[document.evenementId] = [])).push(document);
      });
      Object.values(parEvenement).forEach((liste) => liste.sort((a, b) => a.creeLe.localeCompare(b.creeLe)));
      return parEvenement;
    },
    // `documents` : { ajouts, suppressions } (voir stockage.enregistrerEvenement).
    enregistrer: (evenement, documents) => stockage.enregistrerEvenement(evenement, documents),
    supprimer: (id) => stockage.supprimerEvenement(id)
  };
})(window.EV = window.EV || {});
