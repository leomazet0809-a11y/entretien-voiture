/* Navigation entre écrans par l'adresse (#parametres, …) : le bouton Retour du téléphone fonctionne. */
(function (EV) {
  'use strict';

  const ecrans = {};

  function enregistrer(nom, afficherEcran) {
    ecrans[nom] = afficherEcran;
  }

  function routeActuelle() {
    const morceaux = location.hash.replace(/^#\/?/, '').split('/');
    const nom = ecrans[morceaux[0]] ? morceaux[0] : 'accueil';
    return { nom, parametres: morceaux.slice(1) };
  }

  function afficher() {
    const route = routeActuelle();
    const conteneur = document.getElementById('contenu');
    conteneur.innerHTML = '';
    ecrans[route.nom](conteneur, route.parametres);

    document.querySelectorAll('.actions a[href^="#"]').forEach((lien) => {
      if (lien.getAttribute('href') === '#' + route.nom) lien.setAttribute('aria-current', 'page');
      else lien.removeAttribute('aria-current');
    });
  }

  window.addEventListener('hashchange', () => {
    afficher();
    window.scrollTo(0, 0);
    document.getElementById('contenu').focus({ preventScroll: true });
  });

  EV.routeur = { enregistrer, afficher };
})(window.EV = window.EV || {});
