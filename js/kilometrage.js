/* Règles sur les relevés kilométriques.
   Deux origines : les relevés notés avec le bouton Km (« manuel »), et ceux créés automatiquement
   par les événements datés avec un kilométrage (« evenement », tenus à jour par le stockage). */
(function (EV) {
  'use strict';

  const { stockage, format } = EV;
  const JOUR = 24 * 60 * 60 * 1000;

  function jours(dateIso) {
    const [annee, mois, jour] = dateIso.split('-').map(Number);
    return Date.UTC(annee, mois - 1, jour) / JOUR;
  }

  // Le plus récent en premier ; à date égale, le plus grand kilométrage.
  function comparer(a, b) {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.km - a.km;
  }

  async function historique(voitureId) {
    return (await stockage.parVoiture('releves', voitureId)).sort(comparer);
  }

  // Vérifie la saisie. Renvoie les valeurs, les erreurs par champ, et un avertissement (non bloquant)
  // si le kilométrage contredit un autre relevé : plus bas qu'un relevé plus ancien, ou plus haut qu'un plus récent.
  function verifier(saisie, relevesDeLaVoiture) {
    const erreurs = {};
    if (!saisie.voitureId) erreurs.voitureId = 'Choisissez la voiture.';
    if (!saisie.date) erreurs.date = 'Indiquez la date du relevé.';
    else if (saisie.date > format.aujourdhui()) erreurs.date = 'La date ne peut pas être dans le futur.';
    const km = format.lireKm(saisie.km);
    if (km === null) erreurs.km = 'Indiquez le kilométrage affiché au compteur.';
    else if (Number.isNaN(km)) erreurs.km = 'Indiquez le kilométrage en chiffres (ex. : 158 220).';

    let avertissement = '';
    if (Object.keys(erreurs).length === 0) {
      const autres = relevesDeLaVoiture.filter((r) => r.id !== saisie.id);
      const plusAncienPlusHaut = autres.filter((r) => r.date < saisie.date && r.km > km).sort((a, b) => b.km - a.km)[0];
      const plusRecentPlusBas = autres.filter((r) => r.date > saisie.date && r.km < km).sort((a, b) => a.km - b.km)[0];
      if (plusAncienPlusHaut) {
        avertissement = `Le ${format.date(plusAncienPlusHaut.date)}, le compteur indiquait déjà ${format.km(plusAncienPlusHaut.km)}. Vérifiez le kilométrage et la date.`;
      } else if (plusRecentPlusBas) {
        avertissement = `Le ${format.date(plusRecentPlusBas.date)}, plus tard, le compteur indiquait seulement ${format.km(plusRecentPlusBas.km)}. Vérifiez le kilométrage et la date.`;
      }
    }
    return { valeurs: { voitureId: saisie.voitureId, date: saisie.date, km }, erreurs, avertissement };
  }

  // Chiffres clés d'un historique (trié du plus récent au plus ancien).
  function statistiques(releves) {
    if (releves.length === 0) return null;
    const dernier = releves[0];
    const premier = releves[releves.length - 1];
    const duree = jours(dernier.date) - jours(premier.date);
    // Une moyenne sur moins de deux mois ne veut pas dire grand-chose.
    const moyenneAnnuelle = duree >= 60 && dernier.km > premier.km
      ? Math.round(((dernier.km - premier.km) / (duree / 365.25)) / 100) * 100
      : null;
    return { dernier, premier, moyenneAnnuelle };
  }

  // Kilométrage le plus élevé connu pour chaque voiture : { idVoiture: km }.
  async function maxParVoiture() {
    const max = {};
    (await stockage.tous('releves')).forEach((r) => {
      if (max[r.voitureId] === undefined || r.km > max[r.voitureId]) max[r.voitureId] = r.km;
    });
    return max;
  }

  EV.kilometrage = {
    historique,
    verifier,
    statistiques,
    maxParVoiture,
    jours,
    enregistrer: (releve) => stockage.enregistrer('releves', { ...releve, source: 'manuel' }),
    supprimer: (id) => stockage.supprimer('releves', id)
  };
})(window.EV = window.EV || {});
