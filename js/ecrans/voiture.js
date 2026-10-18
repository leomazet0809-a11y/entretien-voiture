/* Fiche d'une voiture (son « dossier ») et son tableur des entretiens. */
(function (EV) {
  'use strict';

  const { ui, format, voitures, categories, evenements } = EV;
  const NOMBRE = new Intl.NumberFormat('fr-FR');

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
  function groupe(evenement, nomsCategories, documents = []) {
    const plusieurs = evenement.lignes.length > 1;
    const boutonDocuments = documents.length
      ? `<button type="button" class="bouton-documents" data-documents aria-label="${documents.length > 1 ? `Voir les ${documents.length} documents` : 'Ouvrir le document'}" title="${documents.length > 1 ? 'Voir les documents' : 'Ouvrir le document'}">${ui.icone('trombone', 16)}<span>${documents.length}</span></button>`
      : '';
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
          <td class="col-docs">${premiere ? boutonDocuments : ''}</td>
        </tr>`;
    }).join('');

    const ligneTotal = plusieurs ? `
        <tr class="ligne-total">
          <td class="col-date"></td>
          <td colspan="5" class="total-libelle">Total de l'événement</td>
          <td class="col-cout">${format.montant(total) || '—'}</td>
          <td class="col-docs"></td>
        </tr>` : '';

    const signale = EV.evenementSignale === evenement.id ? ' groupe-signale' : '';
    return `<tbody class="groupe${signale}" data-evenement="${evenement.id}">${lignes}${ligneTotal}</tbody>`;
  }

  // En-tête de l'onglet Entretiens : titre, bouton Ajouter, champ Rechercher, puis le résumé.
  function enteteEntretiens(liste) {
    const nombreEntretiens = liste.reduce((somme, ev) => somme + ev.lignes.length, 0);
    const totaux = liste.map(evenements.total).filter((t) => t !== null);
    const depense = totaux.length ? `${format.montant(totaux.reduce((a, b) => a + b, 0))} au total` : '';
    const resume = liste.length
      ? [format.pluriel(liste.length, 'événement'), format.pluriel(nombreEntretiens, 'entretien'), depense].filter(Boolean).join(' · ')
      : '';

    return `
      <div class="onglet-entete">
        <h2 id="titre-tableur">Entretiens</h2>
        <button class="bouton bouton-principal" type="button" data-ajouter-evenement title="Ajouter un événement d'entretien">
          ${ui.icone('plus')}<span>Ajouter</span>
        </button>
        ${EV.panneauRecherche.champ()}
        ${resume ? `<p class="tableur-resume">${resume}</p>` : ''}
      </div>`;
  }

  function tableur(liste, nomsCategories, documents) {
    return `
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
              <th class="col-docs" scope="col"><span class="masque">Documents</span>${ui.icone('trombone', 16)}</th>
            </tr>
          </thead>
          ${liste.map((ev) => groupe(ev, nomsCategories, documents[ev.id])).join('')}
        </table>
      </div>`;
  }

  function aucunEntretien() {
    return `
      <section class="vide vide-compact">
        <h2>Aucun entretien pour l'instant</h2>
        <p>Cliquez sur Ajouter pour saisir le premier événement : sa date, le kilométrage, le garage, puis les entretiens réalisés.</p>
      </section>`;
  }

  // ---------- Onglet Kilométrage ----------

  // En-tête de l'onglet Kilométrage : titre et bouton Km.
  function enteteKilometrage() {
    return `
      <div class="onglet-entete">
        <h2>Kilométrage</h2>
        <button class="bouton bouton-principal" type="button" data-noter-km title="Noter le kilométrage du jour">
          ${ui.icone('compteur')}<span>Km</span>
        </button>
      </div>`;
  }

  function aucunReleve() {
    return `
      <section class="vide vide-compact">
        <h2>Aucun relevé pour l'instant</h2>
        <p>Notez le kilométrage du compteur avec le bouton Km. Les entretiens qui ont une date et un kilométrage s'ajoutent aussi ici automatiquement.</p>
      </section>`;
  }

  function tuiles(historique) {
    const { dernier, premier, moyenneAnnuelle } = EV.kilometrage.statistiques(historique);
    const issusEntretiens = historique.filter((r) => r.source === 'evenement').length;
    return `
      <div class="tuiles">
        <div class="tuile">
          <p class="tuile-libelle">Kilométrage actuel</p>
          <p class="tuile-valeur">${format.km(dernier.km)}</p>
          <p class="tuile-note">le ${format.date(dernier.date)}</p>
        </div>
        <div class="tuile">
          <p class="tuile-libelle">Moyenne par an</p>
          <p class="tuile-valeur">${moyenneAnnuelle ? `≈ ${format.km(moyenneAnnuelle)}` : '—'}</p>
          <p class="tuile-note">${moyenneAnnuelle ? `depuis le ${format.date(premier.date)}` : 'il faut des relevés sur au moins deux mois'}</p>
        </div>
        <div class="tuile">
          <p class="tuile-libelle">Relevés</p>
          <p class="tuile-valeur">${historique.length}</p>
          <p class="tuile-note">dont ${issusEntretiens} issu${issusEntretiens > 1 ? 's' : ''} des entretiens</p>
        </div>
      </div>`;
  }

  // Historique du plus récent au plus ancien ; l'écart se lit par rapport au relevé précédent (plus ancien).
  function tableauReleves(historique, evenementsParId) {
    const lignes = historique.map((releve, rang) => {
      const precedent = historique[rang + 1];
      let ecart = '';
      if (precedent) {
        const difference = releve.km - precedent.km;
        const duree = EV.kilometrage.jours(releve.date) - EV.kilometrage.jours(precedent.date);
        ecart = difference < 0
          ? `<span class="ecart-incoherent">${ui.icone('alerte', 16)}<span>${NOMBRE.format(difference)} km · à vérifier</span></span>`
          : `+${format.km(difference)} <span class="ecart-duree">${duree === 0 ? 'le même jour' : `en ${format.pluriel(duree, 'jour')}`}</span>`;
      }
      const evenement = evenementsParId[releve.evenementId];
      const origine = releve.source === 'evenement'
        ? `Entretien${evenement?.garage ? ` · ${ui.echapper(evenement.garage)}` : ''}`
        : 'Relevé';
      return `
        <tr data-releve="${releve.id}">
          <td class="col-date"><button type="button" class="ouvrir-evenement" aria-label="${releve.source === 'evenement' ? "Ouvrir l'événement" : 'Modifier le relevé'} du ${format.date(releve.date)}">${format.date(releve.date)}</button></td>
          <td class="col-km">${format.km(releve.km)}</td>
          <td class="col-ecart">${ecart}</td>
          <td class="col-origine"><span class="origine origine-${releve.source}">${origine}</span></td>
        </tr>`;
    }).join('');
    return `
      <div class="tableur-zone" role="region" aria-labelledby="titre-historique" tabindex="0">
        <table class="tableur tableau-releves">
          <thead>
            <tr>
              <th class="col-date" scope="col">Date</th>
              <th class="col-km" scope="col">Kilométrage</th>
              <th scope="col">Écart</th>
              <th scope="col">Origine</th>
            </tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
      </div>`;
  }

  async function ongletKilometrage(zone, voiture, liste) {
    const historique = await EV.kilometrage.historique(voiture.id);
    const contenu = zone.querySelector('[data-onglet-contenu]');
    if (historique.length === 0) {
      contenu.innerHTML = enteteKilometrage() + aucunReleve();
      contenu.querySelector('[data-noter-km]').addEventListener('click', () => EV.fenetreReleve.nouveau(voiture.id));
      return;
    }
    const evenementsParId = Object.fromEntries(liste.map((ev) => [ev.id, ev]));
    contenu.innerHTML = `
      ${enteteKilometrage()}
      ${tuiles(historique)}
      <section class="carte-graphique" aria-labelledby="titre-courbe">
        <h2 id="titre-courbe">Évolution du kilométrage</h2>
        <div class="graphique" data-graphique></div>
        ${historique.length === 1 ? '<p class="champ-aide">La courbe se dessine à partir de deux relevés.</p>' : ''}
      </section>
      <div class="tableur-entete">
        <h2 id="titre-historique">Historique des relevés</h2>
        <p class="tableur-resume">Cliquez sur un relevé pour le modifier.</p>
      </div>
      ${tableauReleves(historique, evenementsParId)}`;

    contenu.querySelector('[data-noter-km]').addEventListener('click', () => EV.fenetreReleve.nouveau(voiture.id));

    const points = [...historique].reverse().map((r) => ({ date: r.date, km: r.km, origine: r.source === 'evenement' ? 'Entretien' : 'Relevé' }));
    EV.graphique.courbeKm(contenu.querySelector('[data-graphique]'), points);

    contenu.querySelectorAll('tr[data-releve]').forEach((ligne) => {
      const releve = historique.find((r) => r.id === ligne.dataset.releve);
      ligne.addEventListener('click', () => {
        if (releve.source === 'evenement' && evenementsParId[releve.evenementId]) EV.fenetreEvenement.modifier(evenementsParId[releve.evenementId]);
        else EV.fenetreReleve.modifier(releve);
      });
    });
  }

  // ---------- Écran ----------

  EV.routeur.enregistrer('voiture', async (zone, [id, onglet]) => {
    const voiture = id ? await voitures.lire(decodeURIComponent(id)) : undefined;
    if (!voiture) {
      zone.innerHTML = introuvable();
      return;
    }
    const [liste, listeCategories, documents, nombreReleves] = await Promise.all([
      evenements.parVoiture(voiture.id), categories.liste(), evenements.documentsParEvenement(voiture.id),
      EV.kilometrage.historique(voiture.id).then((h) => h.length)
    ]);
    const nomsCategories = Object.fromEntries(listeCategories.map((c) => [c.id, c.nom]));
    const ongletKm = onglet === 'km';
    const adresse = `#voiture/${encodeURIComponent(voiture.id)}`;

    zone.innerHTML = `
      <a class="retour" href="#">${ui.icone('retour', 18)}<span>Mes voitures</span></a>

      <div class="entete-voiture">
        <div class="entete-voiture-identite">
          ${ui.plaque(voiture.plaque)}
          <div class="entete-voiture-nom">
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

      <nav class="onglets" aria-label="Rubriques du dossier">
        <a class="onglet" href="${adresse}"${ongletKm ? '' : ' aria-current="page"'}>Entretiens <span class="onglet-compte">${liste.length}</span></a>
        <a class="onglet" href="${adresse}/km"${ongletKm ? ' aria-current="page"' : ''}>Kilométrage <span class="onglet-compte">${nombreReleves}</span></a>
      </nav>

      <div data-onglet-contenu>
        ${ongletKm ? '' : enteteEntretiens(liste) + (liste.length ? tableur(liste, nomsCategories, documents) : aucunEntretien())}
      </div>`;

    zone.querySelector('[data-modifier]').addEventListener('click', () => modifierVoiture(voiture));
    zone.querySelector('[data-supprimer]').addEventListener('click', () => supprimerVoiture(voiture));
    if (ongletKm) {
      await ongletKilometrage(zone, voiture, liste);
      return;
    }
    zone.querySelector('[data-ajouter-evenement]').addEventListener('click', () => EV.fenetreEvenement.nouveau(voiture.id));
    EV.panneauRecherche.brancher(zone);

    // Un clic n'importe où sur un événement l'ouvre ; au clavier, le bouton de la date fait de même.
    zone.querySelectorAll('tbody.groupe').forEach((corps) => {
      const evenement = liste.find((ev) => ev.id === corps.dataset.evenement);
      corps.addEventListener('click', (e) => {
        if (e.target.closest('[data-documents]')) {
          const titre = evenement.date ? `Documents du ${format.date(evenement.date)}` : 'Documents';
          EV.documents.montrer(titre, documents[evenement.id]);
          return;
        }
        EV.fenetreEvenement.modifier(evenement);
      });
    });

    // Fait défiler jusqu'à l'événement qui vient d'être enregistré, une fois l'écran affiché.
    if (EV.evenementSignale) {
      const signale = EV.evenementSignale;
      EV.evenementSignale = null;
      setTimeout(() => document.querySelector(`tbody[data-evenement="${signale}"]`)?.scrollIntoView({ block: 'nearest' }), 0);
    }
  });
})(window.EV = window.EV || {});
