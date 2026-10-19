/* Écran d'accueil : la liste des voitures. */
(function (EV) {
  'use strict';

  const { ui, voitures } = EV;

  async function nouvelleVoiture() {
    const voiture = await EV.fenetreVoiture.ouvrir();
    if (!voiture) return;
    ui.toast(`${voitures.nom(voiture)} ajoutée.`);
    location.hash = `voiture/${voiture.id}`;
  }

  function carte(voiture, resume = {}) {
    return `
      <a class="carte-voiture" href="#voiture/${encodeURIComponent(voiture.id)}">
        ${ui.plaque(voiture.plaque)}
        <div class="carte-voiture-titre">
          <h2>${ui.echapper(voitures.nom(voiture))}</h2>
          ${voiture.annee ? `<span class="pastille">${voiture.annee}</span>` : ''}
        </div>
        <dl class="carte-voiture-infos">
          <div><dt>Dernier entretien</dt><dd>${resume.derniereDate ? EV.format.date(resume.derniereDate) : '—'}</dd></div>
          <div><dt>Kilométrage</dt><dd>${resume.kmMax !== null && resume.kmMax !== undefined ? EV.format.km(resume.kmMax) : '—'}</dd></div>
        </dl>
      </a>`;
  }

  function etatVide() {
    return `
      <div class="entete-page">
        <div>
          <h1>Mes voitures</h1>
          <p class="sous-titre">Aucune voiture enregistrée pour l'instant.</p>
        </div>
      </div>

      <section class="vide" aria-labelledby="titre-vide">
        <figure class="exemple">
          ${ui.plaque('AB-123-CD')}
          <figcaption>Exemple</figcaption>
        </figure>
        <h2 id="titre-vide">Créez le dossier de votre première voiture</h2>
        <p>Renseignez sa plaque d'immatriculation, sa marque, son modèle et son année. Vous pourrez ensuite y noter chaque entretien, son coût et ses factures.</p>
        <button class="bouton bouton-principal" type="button" data-nouvelle-voiture>
          ${ui.icone('plus')}<span>Ajouter une voiture</span>
        </button>
      </section>`;
  }

  EV.routeur.enregistrer('accueil', async (zone) => {
    const [liste, resumes, kmReleves] = await Promise.all([voitures.liste(), EV.evenements.resumes(), EV.kilometrage.maxParVoiture()]);
    // Le kilométrage le plus élevé connu : relevés (dont ceux des entretiens) et entretiens sans date.
    liste.forEach((v) => {
      const resume = resumes[v.id] || (resumes[v.id] = { derniereDate: null, kmMax: null });
      if (kmReleves[v.id] !== undefined && (resume.kmMax === null || kmReleves[v.id] > resume.kmMax)) resume.kmMax = kmReleves[v.id];
    });

    if (liste.length === 0) {
      zone.innerHTML = etatVide();
    } else {
      zone.innerHTML = `
        <div class="entete-page">
          <div>
            <h1>Mes voitures</h1>
            <p class="sous-titre">${liste.length} voiture${liste.length > 1 ? 's' : ''}</p>
          </div>
          <button class="bouton bouton-secondaire" type="button" data-nouvelle-voiture>
            ${ui.icone('plus')}<span>Nouvelle voiture</span>
          </button>
        </div>
        <div class="grille-voitures">${liste.map((v) => carte(v, resumes[v.id])).join('')}</div>`;
    }

    zone.querySelector('[data-nouvelle-voiture]').addEventListener('click', nouvelleVoiture);
  });
})(window.EV = window.EV || {});
