/* Démarrage : branche la barre du haut, connecte l'utilisateur, puis affiche l'écran demandé. */
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

  // Si cet appareil contient des voitures saisies avant le passage en ligne, propose de les copier.
  async function proposerReprise() {
    const anciennes = await EV.stockage.lireAnciennesDonnees();
    if (!anciennes || !(await EV.stockage.espaceVide())) return;

    const nombre = anciennes.voitures.length;
    const quoi = nombre > 0
      ? `${nombre} voiture${nombre > 1 ? 's' : ''} enregistrée${nombre > 1 ? 's' : ''}`
      : 'des données enregistrées';
    const accepte = await ui.fenetre({
      titre: 'Reprendre les données de cet appareil ?',
      contenu: `<p class="fenetre-texte">Cet appareil contient ${quoi} avant le passage en ligne. Voulez-vous les copier dans votre espace ? Vous les retrouverez ensuite sur tous vos appareils.</p>`,
      libelleValider: 'Copier mes données'
    });
    if (!accepte) return;
    await EV.stockage.importer(anciennes);
    ui.toast('Vos données ont été copiées dans votre espace en ligne.');
  }

  async function demarrer() {
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

    const utilisateur = await EV.compte.demarrer();
    const donneesConservees = await EV.stockage.demarrer(utilisateur.uid);
    document.getElementById('alerte-stockage').hidden = donneesConservees;

    await proposerReprise();
    routeur.afficher();
  }

  demarrer();
})(window.EV = window.EV || {});
