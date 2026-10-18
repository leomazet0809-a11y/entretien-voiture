/* Règles sur les catégories d'entretien : liste triée, vérification des noms, utilisation par les entretiens. */
(function (EV) {
  'use strict';

  const { stockage } = EV;

  function nettoyer(nom) {
    return String(nom || '').replace(/\s+/g, ' ').trim();
  }

  // Forme de comparaison : « Révision » et « revision » sont considérées comme identiques.
  function cle(nom) {
    return nettoyer(nom).toLocaleLowerCase('fr').normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Les catégories par ordre alphabétique.
  async function liste() {
    const categories = await stockage.tous('categories');
    return categories.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
  }

  // Renvoie { nom } si le nom convient, sinon { erreur }.
  function verifier(nom, categoriesExistantes, idModifie = null) {
    const propre = nettoyer(nom);
    if (!propre) return { erreur: 'Indiquez le nom de la catégorie.' };
    const doublon = categoriesExistantes.find((c) => c.id !== idModifie && cle(c.nom) === cle(propre));
    if (doublon) return { erreur: `La catégorie « ${doublon.nom} » existe déjà.` };
    return { nom: propre };
  }

  // Nombre d'entretiens rattachés à chaque catégorie : { idCategorie: nombre }.
  async function utilisations() {
    const compte = {};
    (await stockage.tous('entretiens')).forEach((entretien) => {
      if (entretien.categorieId) compte[entretien.categorieId] = (compte[entretien.categorieId] || 0) + 1;
    });
    return compte;
  }

  EV.categories = {
    liste,
    verifier,
    utilisations,
    enregistrer: (categorie) => stockage.enregistrer('categories', categorie),
    // Les entretiens rattachés sont gardés ; ils s'afficheront simplement sans catégorie.
    supprimer: (id) => stockage.supprimer('categories', id)
  };
})(window.EV = window.EV || {});
