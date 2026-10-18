/* Écran Paramètres : apparence, catégories d'entretien et sauvegarde. */
(function (EV) {
  'use strict';

  const { icone } = EV.ui;
  const CHOIX_THEME = [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']];

  EV.routeur.enregistrer('parametres', (conteneur) => {
    conteneur.innerHTML = `
      <a class="retour" href="#">${icone('retour', 18)}<span>Mes voitures</span></a>
      <div class="entete-page">
        <div>
          <h1>Paramètres</h1>
          <p class="sous-titre">Réglages de l'application sur cet appareil.</p>
        </div>
      </div>

      <div class="sections">
        <section class="section" aria-labelledby="titre-apparence">
          <div class="ligne-reglage">
            <div class="reglage-texte">
              <h2 id="titre-apparence">Apparence</h2>
              <p>« Automatique » suit le réglage clair ou sombre de votre appareil.</p>
            </div>
            <div class="segments" role="radiogroup" aria-labelledby="titre-apparence">
              ${CHOIX_THEME.map(([valeur, libelle]) => `
                <button type="button" role="radio" aria-checked="false" data-choix-theme="${valeur}">${libelle}</button>`).join('')}
            </div>
          </div>
        </section>

        <section class="section" aria-labelledby="titre-categories">
          <div class="ligne-reglage">
            <div class="reglage-texte">
              <h2 id="titre-categories">Catégories d'entretien</h2>
              <p>La liste proposée quand vous ajoutez un entretien : révision, freinage, pneus, contrôle technique…</p>
            </div>
            <span class="pastille">À venir · étape 3</span>
          </div>
        </section>

        <section class="section" aria-labelledby="titre-sauvegarde">
          <div class="ligne-reglage">
            <div class="reglage-texte">
              <h2 id="titre-sauvegarde">Sauvegarde</h2>
              <p>Exporter toutes vos données dans un fichier, ou importer une sauvegarde depuis un autre appareil.</p>
            </div>
            <span class="pastille">À venir · étape 8</span>
          </div>
        </section>
      </div>`;

    conteneur.querySelectorAll('[data-choix-theme]').forEach((bouton) => {
      bouton.addEventListener('click', () => EV.theme.definir(bouton.dataset.choixTheme));
    });
    EV.theme.appliquer();
  });
})(window.EV = window.EV || {});
