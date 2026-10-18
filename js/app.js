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

  function demarrer() {
    ui.remplirIcones();
    theme.appliquer();

    document.getElementById('bouton-theme').addEventListener('click', theme.basculer);
    document.getElementById('bouton-ajouter').addEventListener('click', () => {
      ui.toast("L'ajout d'un entretien arrive à l'étape 4.");
    });
    document.getElementById('bouton-km').addEventListener('click', () => {
      ui.toast("Le relevé du kilométrage arrive à l'étape 6.");
    });
    brancherRecherche();

    routeur.afficher();
  }

  demarrer();
})(window.EV = window.EV || {});
