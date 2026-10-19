/* Écran Paramètres : compte, apparence, installation de l'application, catégories d'entretien et sauvegarde. */
(function (EV) {
  'use strict';

  const { ui, categories } = EV;
  const CHOIX_THEME = [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']];

  // ---------- Catégories d'entretien ----------

  function ligneCategorie(categorie, nombreEntretiens) {
    const nom = ui.echapper(categorie.nom);
    const usage = nombreEntretiens
      ? `<span class="categorie-usage">${nombreEntretiens} entretien${nombreEntretiens > 1 ? 's' : ''}</span>`
      : '';
    return `
      <li class="categorie">
        <span class="categorie-nom">${nom}</span>
        ${usage}
        <button class="bouton bouton-icone" type="button" data-renommer="${categorie.id}" aria-label="Renommer « ${nom} »" title="Renommer">${ui.icone('crayon', 18)}</button>
        <button class="bouton bouton-icone bouton-texte-danger" type="button" data-supprimer="${categorie.id}" aria-label="Supprimer « ${nom} »" title="Supprimer">${ui.icone('corbeille', 18)}</button>
      </li>`;
  }

  async function afficherCategories(liste) {
    const [toutes, usages] = await Promise.all([categories.liste(), categories.utilisations()]);
    liste.innerHTML = toutes.length
      ? toutes.map((c) => ligneCategorie(c, usages[c.id] || 0)).join('')
      : '<li class="categorie-vide">Aucune catégorie. Ajoutez-en une ci-dessus.</li>';

    liste.querySelectorAll('[data-renommer]').forEach((bouton) => {
      const categorie = toutes.find((c) => c.id === bouton.dataset.renommer);
      bouton.addEventListener('click', () => renommer(categorie, liste));
    });
    liste.querySelectorAll('[data-supprimer]').forEach((bouton) => {
      const categorie = toutes.find((c) => c.id === bouton.dataset.supprimer);
      bouton.addEventListener('click', () => supprimer(categorie, usages[categorie.id] || 0, liste));
    });
  }

  async function ajouter(formulaire, liste) {
    const saisie = formulaire.elements.nom;
    const resultat = categories.verifier(saisie.value, await categories.liste());
    if (!ui.afficherErreurs(formulaire, { nom: resultat.erreur })) return;
    await categories.enregistrer({ nom: resultat.nom });
    saisie.value = '';
    saisie.focus();
    ui.toast(`Catégorie « ${resultat.nom} » ajoutée.`);
    await afficherCategories(liste);
  }

  async function renommer(categorie, liste) {
    const renommee = await ui.fenetre({
      titre: 'Renommer la catégorie',
      contenu: ui.champ({
        id: 'categorie-nom', nom: 'nom', libelle: 'Nom de la catégorie', valeur: categorie.nom,
        aide: 'Les entretiens déjà classés dans cette catégorie prendront le nouveau nom.',
        attributs: 'autocomplete="off" maxlength="40" autofocus'
      }),
      valider: async (formulaire) => {
        const resultat = categories.verifier(formulaire.elements.nom.value, await categories.liste(), categorie.id);
        if (!ui.afficherErreurs(formulaire, { nom: resultat.erreur })) return false;
        await categories.enregistrer({ ...categorie, nom: resultat.nom });
        return true;
      }
    });
    if (!renommee) return;
    ui.toast('Catégorie renommée.');
    await afficherCategories(liste);
  }

  async function supprimer(categorie, nombreEntretiens, liste) {
    const message = nombreEntretiens
      ? `« ${categorie.nom} » est utilisée par ${nombreEntretiens} entretien${nombreEntretiens > 1 ? 's' : ''}. Ils resteront enregistrés, mais sans catégorie.`
      : `« ${categorie.nom} » ne sera plus proposée quand vous ajoutez un entretien.`;
    const confirme = await ui.confirmer({ titre: 'Supprimer cette catégorie ?', message, libelleValider: 'Supprimer' });
    if (!confirme) return;
    await categories.supprimer(categorie.id);
    ui.toast(`Catégorie « ${categorie.nom} » supprimée.`);
    await afficherCategories(liste);
  }

  // ---------- Installation de l'application ----------

  const TEXTES_INSTALLATION = {
    installee: "L'application est installée sur cet appareil. Elle s'ouvre aussi sans réseau.",
    possible: "Installez-la : elle aura son icône sur l'écran d'accueil et s'ouvrira en plein écran, même sans réseau.",
    iphone: "Sur iPhone ou iPad : dans Safari, touchez le bouton Partager, puis « Sur l'écran d'accueil ».",
    menu: "Ouvrez le menu du navigateur (⋮), puis « Installer l'application » ou « Ajouter à l'écran d'accueil »."
  };

  function afficherInstallation(section) {
    const etat = EV.installation.etat();
    section.querySelector('[data-texte-installation]').textContent = TEXTES_INSTALLATION[etat];
    const bouton = section.querySelector('[data-installer]');
    bouton.hidden = etat !== 'possible';
  }

  // ---------- Écran ----------

  EV.routeur.enregistrer('parametres', async (zone) => {
    zone.innerHTML = `
      <a class="retour" href="#">${ui.icone('retour', 18)}<span>Mes voitures</span></a>
      <div class="entete-page">
        <div>
          <h1>Paramètres</h1>
          <p class="sous-titre">Réglages de l'application sur cet appareil.</p>
        </div>
      </div>

      <div class="sections">
        <section class="section" aria-labelledby="titre-compte">
          <div class="ligne-reglage">
            <div class="reglage-texte">
              <h2 id="titre-compte">Compte</h2>
              <p>Connecté avec ${EV.ui.echapper(EV.compte.email())}. Vos données sont enregistrées en ligne et identiques sur tous vos appareils.</p>
            </div>
            <button class="bouton bouton-secondaire" type="button" data-deconnexion>Se déconnecter</button>
          </div>
        </section>

        <section class="section" aria-labelledby="titre-apparence">
          <div class="ligne-reglage">
            <div class="reglage-texte">
              <h2 id="titre-apparence">Apparence</h2>
              <p>« Automatique » suit le réglage clair ou sombre de votre appareil.</p>
            </div>
            <div class="segments" role="radiogroup" aria-labelledby="titre-apparence">
              ${CHOIX_THEME.map(([valeur, libelle]) => `
                <button type="button" role="radio" aria-checked="${valeur === EV.theme.choixActuel()}" data-choix-theme="${valeur}">${libelle}</button>`).join('')}
            </div>
          </div>
        </section>

        <section class="section" aria-labelledby="titre-application" data-installation>
          <div class="ligne-reglage">
            <div class="reglage-texte">
              <h2 id="titre-application">Application</h2>
              <p data-texte-installation></p>
            </div>
            <button class="bouton bouton-principal" type="button" data-installer hidden>${ui.icone('telecharger', 18)}<span>Installer</span></button>
          </div>
        </section>

        <section class="section" aria-labelledby="titre-categories">
          <div class="ligne-reglage ligne-reglage-titre">
            <div class="reglage-texte">
              <h2 id="titre-categories">Catégories d'entretien</h2>
              <p>La liste proposée quand vous ajoutez un entretien, classée par ordre alphabétique.</p>
            </div>
          </div>
          <form class="ajout-categorie" novalidate>
            <div class="champ">
              <label class="masque" for="nouvelle-categorie">Nouvelle catégorie</label>
              <div class="ajout-categorie-ligne">
                <input id="nouvelle-categorie" name="nom" placeholder="Nouvelle catégorie" maxlength="40" autocomplete="off" aria-describedby="nouvelle-categorie-erreur">
                <button class="bouton bouton-principal" type="submit">${ui.icone('plus')}<span>Ajouter</span></button>
              </div>
              <p class="champ-erreur" id="nouvelle-categorie-erreur" hidden></p>
            </div>
          </form>
          <ul class="liste-categories" aria-labelledby="titre-categories"></ul>
        </section>

        <section class="section" aria-labelledby="titre-sauvegarde">
          <div class="ligne-reglage">
            <div class="reglage-texte">
              <h2 id="titre-sauvegarde">Sauvegarde</h2>
              <p>Les entretiens de chaque voiture s'exportent et s'importent en fichier CSV, depuis son onglet Entretiens (icônes à droite de Rechercher).</p>
            </div>
          </div>
        </section>
      </div>`;

    zone.querySelector('[data-deconnexion]').addEventListener('click', EV.compte.deconnecter);
    const sectionInstallation = zone.querySelector('[data-installation]');
    afficherInstallation(sectionInstallation);
    EV.installation.quandChange(() => afficherInstallation(sectionInstallation));
    sectionInstallation.querySelector('[data-installer]').addEventListener('click', () => EV.installation.installer());
    zone.querySelectorAll('[data-choix-theme]').forEach((bouton) => {
      bouton.addEventListener('click', () => EV.theme.definir(bouton.dataset.choixTheme));
    });

    const liste = zone.querySelector('.liste-categories');
    const formulaire = zone.querySelector('.ajout-categorie');
    formulaire.addEventListener('submit', (e) => {
      e.preventDefault();
      ajouter(formulaire, liste);
    });
    await afficherCategories(liste);
  });
})(window.EV = window.EV || {});
