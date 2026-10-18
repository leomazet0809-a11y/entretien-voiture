/* Fiche d'une voiture (son « dossier ») et son tableur des entretiens. */
(function (EV) {
  'use strict';

  const { ui, format, voitures, categories, evenements } = EV;

  function introuvable() {
    return `
      <a class="retour" href="#">${ui.icone('retour', 18)}<span>Mes voitures</span></a>
      <section class="vide">
        <h2>Cette voiture n'existe plus</h2>
        <p>Elle a peut-être été supprimée.</p>
        <a class="bouton bouton-principal" href="#">Retour à mes voitures</a>
      </section>`;
  }

  async function modifierVoiture(voiture) {
    const miseAJour = await EV.fenetreVoiture.ouvrir(voiture);
    if (!miseAJour) return;
    ui.toast('Modifications enregistrées.');
    EV.routeur.afficher();
  }

  async function supprimerVoiture(voiture) {
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

  // ---------- Tableur ----------

  // Un événement = un groupe de lignes. Date, km et garage ne sont écrits que sur la première.
  // Coût : sur la ligne s'il n'y a qu'un entretien ; sinon par ligne (coût détaillé) puis une ligne de total.
  function groupe(evenement, nomsCategories) {
    const plusieurs = evenement.lignes.length > 1;
    const total = evenements.total(evenement);
    const libelleDate = evenement.date ? format.date(evenement.date) : 'Date inconnue';

    const lignes = evenement.lignes.map((ligne, rang) => {
      const premiere = rang === 0;
      const categorie = nomsCategories[ligne.categorieId];
      let cout = format.montant(total);
      if (plusieurs) cout = evenement.modeCout === 'detail' ? format.montant(ligne.cout) : '';
      return `
        <tr>
          <td class="col-date">${premiere ? `<button type="button" class="ouvrir-evenement${evenement.date ? '' : ' inconnu'}" aria-label="Modifier l'événement : ${libelleDate}">${libelleDate}</button>` : ''}</td>
          <td class="col-km">${premiere ? format.km(evenement.km) : ''}</td>
          <td class="col-garage">${premiere ? ui.echapper(evenement.garage) : ''}</td>
          <td class="col-categorie">${categorie ? `<span class="etiquette-categorie">${ui.echapper(categorie)}</span>` : '<span class="inconnu">—</span>'}</td>
          <td class="col-texte">${ui.echapper(ligne.detail)}</td>
          <td class="col-texte">${ui.echapper(ligne.commentaire)}</td>
          <td class="col-cout">${cout}</td>
        </tr>`;
    }).join('');

    const ligneTotal = plusieurs ? `
        <tr class="ligne-total">
          <td class="col-date"></td>
          <td colspan="5" class="total-libelle">Total de l'événement</td>
          <td class="col-cout">${format.montant(total) || '—'}</td>
        </tr>` : '';

    const signale = EV.evenementSignale === evenement.id ? ' groupe-signale' : '';
    return `<tbody class="groupe${signale}" data-evenement="${evenement.id}">${lignes}${ligneTotal}</tbody>`;
  }

  function tableur(liste, nomsCategories) {
    const nombreEntretiens = liste.reduce((somme, ev) => somme + ev.lignes.length, 0);
    const totaux = liste.map(evenements.total).filter((t) => t !== null);
    const depense = totaux.length ? `${format.montant(totaux.reduce((a, b) => a + b, 0))} au total` : '';
    const resume = [format.pluriel(liste.length, 'événement'), format.pluriel(nombreEntretiens, 'entretien'), depense].filter(Boolean).join(' · ');

    return `
      <div class="tableur-entete">
        <h2 id="titre-tableur">Entretiens</h2>
        <p class="tableur-resume">${resume}</p>
      </div>
      <div class="tableur-zone" role="region" aria-labelledby="titre-tableur" tabindex="0">
        <table class="tableur">
          <thead>
            <tr>
              <th class="col-date" scope="col">Date</th>
              <th class="col-km" scope="col">Km</th>
              <th class="col-garage" scope="col">Garage</th>
              <th class="col-categorie" scope="col">Catégorie</th>
              <th scope="col">Détail</th>
              <th scope="col">Commentaire</th>
              <th class="col-cout" scope="col">Coût</th>
            </tr>
          </thead>
          ${liste.map((ev) => groupe(ev, nomsCategories)).join('')}
        </table>
      </div>`;
  }

  function aucunEntretien() {
    return `
      <section class="vide vide-compact">
        <h2>Aucun entretien pour l'instant</h2>
        <p>Ajoutez le premier événement : sa date, le kilométrage, le garage, puis les entretiens réalisés.</p>
        <button class="bouton bouton-principal" type="button" data-ajouter-evenement>
          ${ui.icone('plus')}<span>Ajouter un événement</span>
        </button>
      </section>`;
  }

  // ---------- Écran ----------

  EV.routeur.enregistrer('voiture', async (zone, [id]) => {
    const voiture = id ? await voitures.lire(decodeURIComponent(id)) : undefined;
    if (!voiture) {
      zone.innerHTML = introuvable();
      return;
    }
    const [liste, listeCategories] = await Promise.all([evenements.parVoiture(voiture.id), categories.liste()]);
    const nomsCategories = Object.fromEntries(listeCategories.map((c) => [c.id, c.nom]));

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

      ${liste.length ? tableur(liste, nomsCategories) : aucunEntretien()}`;

    zone.querySelector('[data-modifier]').addEventListener('click', () => modifierVoiture(voiture));
    zone.querySelector('[data-supprimer]').addEventListener('click', () => supprimerVoiture(voiture));
    zone.querySelector('[data-ajouter-evenement]')?.addEventListener('click', () => EV.fenetreEvenement.nouveau(voiture.id));

    // Un clic n'importe où sur un événement l'ouvre ; au clavier, le bouton de la date fait de même.
    zone.querySelectorAll('tbody.groupe').forEach((corps) => {
      const evenement = liste.find((ev) => ev.id === corps.dataset.evenement);
      corps.addEventListener('click', () => EV.fenetreEvenement.modifier(evenement));
    });

    // Fait défiler jusqu'à l'événement qui vient d'être enregistré, une fois l'écran affiché.
    if (EV.evenementSignale) {
      const signale = EV.evenementSignale;
      EV.evenementSignale = null;
      setTimeout(() => document.querySelector(`tbody[data-evenement="${signale}"]`)?.scrollIntoView({ block: 'nearest' }), 0);
    }
  });
})(window.EV = window.EV || {});
