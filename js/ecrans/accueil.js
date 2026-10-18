/* Écran d'accueil : la liste des voitures (vide pour l'instant). */
(function (EV) {
  'use strict';

  const { icone, plaque, toast } = EV.ui;

  EV.routeur.enregistrer('accueil', (conteneur) => {
    conteneur.innerHTML = `
      <div class="entete-page">
        <div>
          <h1>Mes voitures</h1>
          <p class="sous-titre">Aucune voiture enregistrée pour l'instant.</p>
        </div>
      </div>

      <section class="vide" aria-labelledby="titre-vide">
        <figure class="exemple">
          ${plaque('AB-123-CD')}
          <figcaption>Exemple</figcaption>
        </figure>
        <h2 id="titre-vide">Créez le dossier de votre première voiture</h2>
        <p>Renseignez sa plaque d'immatriculation, sa marque, son modèle et son année. Vous pourrez ensuite y noter chaque entretien, son coût et ses factures.</p>
        <button class="bouton bouton-principal" type="button" id="bouton-nouvelle-voiture">
          ${icone('plus')}<span>Ajouter une voiture</span>
        </button>
      </section>`;

    conteneur.querySelector('#bouton-nouvelle-voiture').addEventListener('click', () => {
      toast("La création d'une voiture arrive à l'étape 2.");
    });
  });
})(window.EV = window.EV || {});
