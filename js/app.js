/* Démarrage : branche la barre du haut puis affiche l'écran demandé. */
(function (EV) {
  'use strict';

  const { ui, theme, routeur } = EV;

  function voitureAffichee() {
    const [ecran, id] = location.hash.replace(/^#/, '').split('/');
    return ecran === 'voiture' && id ? decodeURIComponent(id) : null;
  }

  async function demarrer() {
    ui.remplirIcones();
    theme.appliquer();

    document.getElementById('bouton-theme').addEventListener('click', theme.basculer);
    // Sur la fiche d'une voiture, le nouvel événement ou relevé lui est rattaché d'office.
    document.getElementById('bouton-ajouter').addEventListener('click', () => {
      EV.fenetreEvenement.nouveau(voitureAffichee());
    });
    document.getElementById('bouton-km').addEventListener('click', () => {
      EV.fenetreReleve.nouveau(voitureAffichee());
    });
    const donneesConservees = await EV.stockage.demarrer();
    document.getElementById('alerte-stockage').hidden = donneesConservees;
    EV.panneauRecherche.brancher();

    routeur.afficher();
  }

  demarrer();
})(window.EV = window.EV || {});
