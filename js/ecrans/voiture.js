/* Fiche d'une voiture (son « dossier »). */
(function (EV) {
  'use strict';

  const { ui, voitures } = EV;

  function introuvable() {
    return `
      <a class="retour" href="#">${ui.icone('retour', 18)}<span>Mes voitures</span></a>
      <section class="vide">
        <h2>Cette voiture n'existe plus</h2>
        <p>Elle a peut-être été supprimée.</p>
        <a class="bouton bouton-principal" href="#">Retour à mes voitures</a>
      </section>`;
  }

  async function modifier(voiture) {
    const miseAJour = await EV.fenetreVoiture.ouvrir(voiture);
    if (!miseAJour) return;
    ui.toast('Modifications enregistrées.');
    EV.routeur.afficher();
  }

  async function supprimer(voiture) {
    const nom = voitures.nom(voiture);
    const confirme = await ui.confirmer({
      titre: 'Supprimer cette voiture ?',
      message: `Le dossier de la ${nom} (${voiture.plaque}) sera supprimé avec tous ses entretiens, documents et relevés kilométriques. Cette action est définitive.`,
      libelleValider: 'Supprimer la voiture'
    });
    if (!confirme) return;
    await voitures.supprimer(voiture.id);
    ui.toast(`${nom} supprimée.`);
    location.hash = '';
  }

  EV.routeur.enregistrer('voiture', async (zone, [id]) => {
    const voiture = id ? await voitures.lire(decodeURIComponent(id)) : undefined;
    if (!voiture) {
      zone.innerHTML = introuvable();
      return;
    }

    zone.innerHTML = `
      <a class="retour" href="#">${ui.icone('retour', 18)}<span>Mes voitures</span></a>

      <div class="entete-voiture">
        <div class="entete-voiture-identite">
          ${ui.plaque(voiture.plaque)}
          <div>
            <h1>${ui.echapper(voitures.nom(voiture))}</h1>
            <p class="sous-titre">${voiture.annee ? `Année ${voiture.annee}` : 'Année non renseignée'}</p>
          </div>
        </div>
        <div class="entete-voiture-actions">
          <button class="bouton bouton-secondaire" type="button" data-modifier>
            ${ui.icone('crayon', 18)}<span>Modifier</span>
          </button>
          <button class="bouton bouton-secondaire bouton-texte-danger" type="button" data-supprimer>
            ${ui.icone('corbeille', 18)}<span>Supprimer</span>
          </button>
        </div>
      </div>

      <section class="vide vide-compact">
        <h2>Entretiens et kilométrage</h2>
        <p>Le tableau des entretiens arrive à l'étape 4, l'historique du kilométrage à l'étape 6.</p>
      </section>`;

    zone.querySelector('[data-modifier]').addEventListener('click', () => modifier(voiture));
    zone.querySelector('[data-supprimer]').addEventListener('click', () => supprimer(voiture));
  });
})(window.EV = window.EV || {});
