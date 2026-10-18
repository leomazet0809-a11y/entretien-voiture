/* Démarrage : branche la barre du haut puis affiche l'écran demandé. */
(function (EV) {
  'use strict';

  const { ui, theme, routeur } = EV;

  function brancherRecherche() {
    const champ = document.getElementById('champ-recherche');
    const panneau = document.getElementById('panneau-recherche');
    const zone = champ.closest('.recherche');

    function majPanneau() {
      const vide = champ.value.trim() === '';
      panneau.hidden = vide;
      if (!vide) panneau.textContent = "La recherche dans toutes vos données arrive à l'étape 7.";
    }

    champ.addEventListener('input', majPanneau);
    champ.addEventListener('focus', majPanneau);
    champ.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        champ.value = '';
        majPanneau();
        champ.blur();
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!zone.contains(e.target)) panneau.hidden = true;
    });
  }

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
    brancherRecherche();

    const donneesConservees = await EV.stockage.demarrer();
    document.getElementById('alerte-stockage').hidden = donneesConservees;

    routeur.afficher();
  }

  demarrer();
})(window.EV = window.EV || {});
