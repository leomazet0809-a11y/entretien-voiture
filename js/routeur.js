/* Navigation entre écrans par l'adresse (#parametres, #voiture/…) : le bouton Retour du téléphone fonctionne. */
(function (EV) {
  'use strict';

  const ecrans = {};
  let dernierAffichage = 0;

  function enregistrer(nom, afficherEcran) {
    ecrans[nom] = afficherEcran;
  }

  function routeActuelle() {
    const morceaux = location.hash.replace(/^#\/?/, '').split('/');
    const nom = ecrans[morceaux[0]] ? morceaux[0] : 'accueil';
    return { nom, parametres: morceaux.slice(1) };
  }

  // Prépare l'écran à part, puis le montre d'un coup ; si l'utilisateur a changé d'écran entre-temps, on l'abandonne.
  async function afficher() {
    const numero = ++dernierAffichage;
    const route = routeActuelle();
    const zone = document.createElement('div');
    await ecrans[route.nom](zone, route.parametres);
    if (numero !== dernierAffichage) return;
    document.getElementById('contenu').replaceChildren(zone);

    document.querySelectorAll('.actions a[href^="#"]').forEach((lien) => {
      if (lien.getAttribute('href') === '#' + route.nom) lien.setAttribute('aria-current', 'page');
      else lien.removeAttribute('aria-current');
    });
  }

  // Changer d'onglet dans la même fiche ne fait pas remonter la page ; changer d'écran, si.
  let ecranPrecedent = location.hash.split('/').slice(0, 2).join('/');
  window.addEventListener('hashchange', async () => {
    const ecran = location.hash.split('/').slice(0, 2).join('/');
    const memeEcran = ecran === ecranPrecedent;
    ecranPrecedent = ecran;
    await afficher();
    if (memeEcran) return;
    window.scrollTo(0, 0);
    document.getElementById('contenu').focus({ preventScroll: true });
  });

  EV.routeur = { enregistrer, afficher };
})(window.EV = window.EV || {});
