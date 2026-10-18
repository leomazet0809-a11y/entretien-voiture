/* Démarrage : branche la barre du haut (thème), connecte l'utilisateur, puis affiche l'écran demandé. */
(function (EV) {
  'use strict';

  const { ui, theme, routeur } = EV;

  // L'espace en ligne ne répond pas comme prévu : on explique quoi faire plutôt que de laisser un écran vide.
  function afficherProbleme(erreur) {
    const refus = erreur && erreur.code === 'permission-denied';
    const titre = refus ? 'Accès à vos données refusé' : 'Vos données ne sont pas accessibles';
    const texte = refus
      ? 'Firebase refuse l\'accès à votre espace. Vérifiez que les règles de sécurité de Firestore sont publiées (fichier firestore.rules, voir le README).'
      : 'La connexion à votre espace en ligne n\'a pas abouti. Vérifiez votre connexion Internet, puis réessayez.';
    document.getElementById('contenu').innerHTML = `
      <section class="vide">
        <h2>${ui.echapper(titre)}</h2>
        <p>${ui.echapper(texte)}</p>
        <button class="bouton bouton-principal" type="button" data-reessayer>Réessayer</button>
      </section>`;
    document.querySelector('[data-reessayer]').addEventListener('click', () => location.reload());
  }

  async function demarrer() {
    ui.remplirIcones();
    theme.appliquer();

    document.getElementById('bouton-theme').addEventListener('click', theme.basculer);

    const utilisateur = await EV.compte.demarrer();
    let donneesConservees;
    try {
      donneesConservees = await EV.stockage.demarrer(utilisateur.uid);
    } catch (erreur) {
      console.error(erreur);
      afficherProbleme(erreur);
      return;
    }
    document.getElementById('alerte-stockage').hidden = donneesConservees;

    routeur.afficher();
  }

  demarrer();
})(window.EV = window.EV || {});
