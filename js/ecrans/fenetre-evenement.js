/* Fenêtre « Nouvel événement d'entretien » / « Modifier l'événement ». */
(function (EV) {
  'use strict';

  const { ui, format, voitures, categories, evenements } = EV;

  let compteurLignes = 0;

  function optionsCategories(listeCategories, choisie) {
    return '<option value="">Choisir une catégorie</option>'
      + listeCategories.map((c) => `<option value="${c.id}"${c.id === choisie ? ' selected' : ''}>${ui.echapper(c.nom)}</option>`).join('');
  }

  // Un bloc de saisie pour une ligne d'entretien. Chaque bloc a son numéro, qui ne change pas quand on en retire un.
  function blocLigne(ligne, listeCategories) {
    const n = ++compteurLignes;
    const id = (champ) => `ligne-${n}-${champ}`;
    return `
      <div class="ligne-entretien" data-ligne data-n="${n}" data-id-ligne="${ligne.id || ''}">
        <div class="ligne-entretien-entete">
          <h3 class="ligne-entretien-titre">Entretien</h3>
          <button type="button" class="bouton bouton-icone" data-retirer-ligne>${ui.icone('fermer', 18)}</button>
        </div>
        <div class="champs-ligne">
          <div class="champ">
            <label for="${id('categorie')}">Catégorie</label>
            <select id="${id('categorie')}" name="${id('categorie')}" aria-describedby="${id('categorie')}-erreur">${optionsCategories(listeCategories, ligne.categorieId)}</select>
            <p class="champ-erreur" id="${id('categorie')}-erreur" hidden></p>
          </div>
          <div class="champ champ-cout-ligne">
            <label for="${id('cout')}">Coût TTC <span class="facultatif">(facultatif)</span></label>
            <input id="${id('cout')}" name="${id('cout')}" value="${format.montantSaisie(ligne.cout)}" data-saisie-montant inputmode="decimal" autocomplete="off" placeholder="Ex. : 270,00" aria-describedby="${id('cout')}-erreur">
            <p class="champ-erreur" id="${id('cout')}-erreur" hidden></p>
          </div>
        </div>
        <div class="champ">
          <label for="${id('detail')}">Détail</label>
          <textarea id="${id('detail')}" name="${id('detail')}" rows="3" placeholder="Ex. : vidange, filtre à huile, filtre à air">${ui.echapper(evenements.texteDetail(ligne))}</textarea>
        </div>
      </div>`;
  }

  // Branche les comportements du formulaire : lignes ajoutées ou retirées, choix du mode de coût, total en direct.
  function preparer(formulaire, listeCategories) {
    const conteneurLignes = formulaire.querySelector('.lignes-entretien');
    const blocs = () => [...conteneurLignes.querySelectorAll('[data-ligne]')];
    const totalAffiche = formulaire.querySelector('.cout-total');
    const champGlobal = formulaire.elements.coutGlobal;

    function sommeLignes() {
      const couts = blocs().map((b) => format.lireMontant(b.querySelector('.champ-cout-ligne input').value))
        .filter((c) => c !== null && !Number.isNaN(c));
      return couts.length ? couts.reduce((a, b) => a + b, 0) : null;
    }

    function majTotal() {
      const detaille = formulaire.dataset.modeCout === 'detail';
      totalAffiche.hidden = !detaille;
      if (detaille) totalAffiche.textContent = `Total : ${format.montant(sommeLignes()) || '—'}`;
    }

    function numeroter() {
      const tous = blocs();
      tous.forEach((bloc, rang) => {
        bloc.querySelector('.ligne-entretien-titre').textContent = `Entretien ${rang + 1}`;
        const retirer = bloc.querySelector('[data-retirer-ligne]');
        retirer.hidden = tous.length === 1;
        retirer.setAttribute('aria-label', `Retirer l'entretien ${rang + 1}`);
        retirer.title = `Retirer l'entretien ${rang + 1}`;
      });
    }

    function definirMode(mode) {
      const avant = formulaire.dataset.modeCout;
      if (avant && avant !== mode) {
        // On reporte le montant déjà saisi pour ne rien avoir à retaper.
        const lignes = blocs();
        const global = format.lireMontant(champGlobal.value);
        const premiereLigne = lignes[0].querySelector('.champ-cout-ligne input');
        if (mode === 'detail' && lignes.length === 1 && !premiereLigne.value && global !== null && !Number.isNaN(global)) {
          premiereLigne.value = format.montantSaisie(global);
        }
        if (mode === 'global' && !champGlobal.value && sommeLignes() !== null) {
          champGlobal.value = format.montantSaisie(sommeLignes());
        }
      }
      formulaire.dataset.modeCout = mode;
      formulaire.querySelectorAll('[data-choix-cout]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.choixCout === mode)));
      formulaire.querySelector('.cout-global').hidden = mode !== 'global';
      formulaire.querySelectorAll('.champ-cout-ligne').forEach((champ) => { champ.hidden = mode !== 'detail'; });
      majTotal();
    }

    formulaire.querySelector('[data-ajouter-ligne]').addEventListener('click', () => {
      conteneurLignes.insertAdjacentHTML('beforeend', blocLigne({}, listeCategories));
      const nouveau = blocs().at(-1);
      nouveau.querySelector('.champ-cout-ligne').hidden = formulaire.dataset.modeCout !== 'detail';
      numeroter();
      nouveau.querySelector('select').focus();
    });

    conteneurLignes.addEventListener('click', (e) => {
      const retirer = e.target.closest('[data-retirer-ligne]');
      if (!retirer) return;
      retirer.closest('[data-ligne]').remove();
      numeroter();
      majTotal();
      formulaire.querySelector('[data-ajouter-ligne]').focus();
    });

    conteneurLignes.addEventListener('input', (e) => {
      if (e.target.closest('.champ-cout-ligne')) majTotal();
    });

    formulaire.querySelectorAll('[data-choix-cout]').forEach((bouton) => {
      bouton.addEventListener('click', () => definirMode(bouton.dataset.choixCout));
    });

    numeroter();
    definirMode(formulaire.dataset.modeCoutInitial);
  }

  // Documents : la liste à l'écran reflète `etat` ; rien n'est enregistré avant le clic sur « Enregistrer ».
  // etat = { existants: documents déjà enregistrés, nouveaux: documents ajoutés, supprimes: identifiants retirés }.
  let compteurNouveaux = 0;
  function preparerDocuments(formulaire, etat, urls) {
    const liste = formulaire.querySelector('.liste-documents');
    const erreur = formulaire.querySelector('[data-erreur-documents]');
    const bloc = formulaire.querySelector('.bloc-documents');
    const visibles = () => [...etat.existants.filter((d) => !etat.supprimes.has(d.id)), ...etat.nouveaux];

    function afficher() {
      const documents = visibles();
      liste.innerHTML = documents.length
        ? documents.map((d) => EV.documents.element(d, urls, { retirer: true })).join('')
        : '<li class="documents-vide">Aucun document joint.</li>';
    }

    function ajouter(fichiers) {
      const { acceptes, refus } = EV.documents.preparer(fichiers);
      acceptes.forEach((document) => etat.nouveaux.push({ ...document, id: `nouveau-${++compteurNouveaux}` }));
      erreur.hidden = refus.length === 0;
      erreur.textContent = refus.join(' ');
      afficher();
    }

    formulaire.querySelectorAll('[data-joindre]').forEach((choix) => {
      choix.addEventListener('change', () => {
        ajouter(choix.files);
        choix.value = '';
      });
    });

    liste.addEventListener('click', (e) => {
      const ligne = e.target.closest('.document');
      if (!ligne) return;
      const document = visibles().find((d) => d.id === ligne.dataset.document);
      if (e.target.closest('[data-retirer-document]')) {
        if (etat.nouveaux.includes(document)) etat.nouveaux.splice(etat.nouveaux.indexOf(document), 1);
        else etat.supprimes.add(document.id);
        afficher();
      } else if (e.target.closest('[data-ouvrir-document]')) {
        EV.documents.ouvrir(document);
      }
    });

    // Sur ordinateur : on peut déposer des fichiers n'importe où sur la fenêtre.
    formulaire.addEventListener('dragover', (e) => {
      if (![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      bloc.classList.add('depot-actif');
    });
    formulaire.addEventListener('dragleave', (e) => {
      if (!formulaire.contains(e.relatedTarget)) bloc.classList.remove('depot-actif');
    });
    formulaire.addEventListener('drop', (e) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      bloc.classList.remove('depot-actif');
      ajouter(e.dataTransfer.files);
    });

    afficher();
  }

  // Message clair quand l'envoi des documents vers Firebase Storage échoue. Rien n'est alors enregistré.
  function messageEnvoi(erreur) {
    switch (erreur && erreur.code) {
      case 'hors-ligne':
      case 'storage/retry-limit-exceeded':
        return "Pas de connexion Internet : les documents n'ont pas pu être envoyés. Rien n'a été enregistré. Réessayez une fois connecté, ou retirez les nouveaux documents pour enregistrer le reste.";
      case 'storage/unauthorized':
      case 'storage/unauthenticated':
        return "Firebase Storage a refusé l'envoi. Vérifiez que Storage est activé et que ses règles de sécurité sont en place (voir le README). Rien n'a été enregistré.";
      case 'storage/quota-exceeded':
        return "L'espace de stockage des documents est plein ou le forfait Firebase ne permet pas l'envoi. Rien n'a été enregistré.";
      default:
        return "Les documents n'ont pas pu être envoyés. Rien n'a été enregistré : réessayez.";
    }
  }

  // Lit le formulaire et renvoie la saisie brute, plus le numéro de chaque bloc de ligne.
  function lireSaisie(formulaire) {
    const champs = formulaire.elements;
    const blocs = [...formulaire.querySelectorAll('[data-ligne]')];
    const valeur = (bloc, champ) => champs[`ligne-${bloc.dataset.n}-${champ}`].value;
    return {
      numeros: blocs.map((bloc) => bloc.dataset.n),
      saisie: {
        voitureId: champs.voitureId.value,
        date: champs.date.value,
        km: champs.km.value,
        garage: champs.garage.value, // la « Société »
        modeCout: formulaire.dataset.modeCout,
        coutGlobal: champs.coutGlobal.value,
        lignes: blocs.map((bloc) => ({
          id: bloc.dataset.idLigne,
          categorieId: valeur(bloc, 'categorie'),
          detail: valeur(bloc, 'detail'),
          cout: valeur(bloc, 'cout')
        }))
      }
    };
  }

  // Ouvre la fenêtre. Renvoie { action: 'enregistre', evenement }, { action: 'supprime' } ou null si l'utilisateur annule.
  async function ouvrir({ evenement = null, voitureId = null } = {}) {
    const [listeVoitures, listeCategories, garages, documentsExistants] = await Promise.all([
      voitures.liste(), categories.liste(), evenements.garages(),
      evenement ? evenements.documents(evenement.id) : []
    ]);
    const voitureChoisie = evenement?.voitureId || voitureId || (listeVoitures.length === 1 ? listeVoitures[0].id : '');
    const valeurs = evenement || { date: format.aujourdhui(), km: null, garage: '', modeCout: 'global', coutGlobal: null, lignes: [{}] };
    const etatDocuments = { existants: documentsExistants, nouveaux: [], supprimes: new Set() };
    const urls = EV.documents.adresses();
    let resultat = null;

    const contenu = `
      <div class="champ">
        <label for="ev-voiture">Voiture</label>
        <select id="ev-voiture" name="voitureId" aria-describedby="ev-voiture-erreur"${voitureChoisie ? '' : ' autofocus'}>
          <option value="">Choisir une voiture</option>
          ${listeVoitures.map((v) => `<option value="${v.id}"${v.id === voitureChoisie ? ' selected' : ''}>${ui.echapper(v.plaque)} · ${ui.echapper(voitures.nom(v))}</option>`).join('')}
        </select>
        <p class="champ-erreur" id="ev-voiture-erreur" hidden></p>
      </div>

      <div class="champs-ligne">
        ${ui.champDate({
          id: 'ev-date', nom: 'date', libelle: 'Date', valeur: valeurs.date, aide: 'Laissez vide si elle est inconnue.',
          attributs: voitureChoisie && !evenement ? 'autofocus' : ''
        })}
        ${ui.champ({
          id: 'ev-km', nom: 'km', libelle: 'Kilométrage', facultatif: true, valeur: format.kmSaisie(valeurs.km),
          attributs: 'inputmode="numeric" autocomplete="off" placeholder="Ex. : 140 000"'
        })}
        ${ui.champ({
          id: 'ev-garage', nom: 'garage', libelle: 'Société', facultatif: true, valeur: valeurs.garage,
          attributs: 'list="liste-garages" autocomplete="off" maxlength="60"'
        })}
      </div>
      <datalist id="liste-garages">${garages.map((g) => `<option value="${ui.echapper(g)}"></option>`).join('')}</datalist>

      <fieldset class="bloc">
        <legend>Entretiens réalisés</legend>
        <p class="champ-aide">Pour chaque entretien, choisissez une catégorie et/ou décrivez-le.</p>
        <div class="lignes-entretien">${valeurs.lignes.map((ligne) => blocLigne(ligne, listeCategories)).join('')}</div>
        <button type="button" class="bouton bouton-secondaire bouton-ajout-ligne" data-ajouter-ligne>${ui.icone('plus', 18)}<span>Ajouter un entretien</span></button>
      </fieldset>

      <fieldset class="bloc">
        <legend>Coût</legend>
        <div class="segments" role="radiogroup" aria-label="Façon de saisir le coût">
          <button type="button" role="radio" aria-checked="false" data-choix-cout="global">Coût global</button>
          <button type="button" role="radio" aria-checked="false" data-choix-cout="detail">Coût par entretien</button>
        </div>
        <div class="cout-global">
          ${ui.champ({
            id: 'ev-cout', nom: 'coutGlobal', libelle: 'Coût total TTC', facultatif: true, valeur: format.montantSaisie(valeurs.coutGlobal),
            attributs: 'class="saisie-courte" data-saisie-montant inputmode="decimal" autocomplete="off" placeholder="Ex. : 580,00"'
          })}
        </div>
        <p class="cout-total" aria-live="polite" hidden></p>
      </fieldset>

      <fieldset class="bloc bloc-documents">
        <legend>Documents</legend>
        <p class="champ-aide">Factures, devis, photos : PDF ou images, 25 Mo maximum par fichier.</p>
        <ul class="liste-documents" aria-live="polite"></ul>
        <div class="documents-actions">
          <label class="bouton bouton-secondaire">
            ${ui.icone('trombone', 18)}<span>Joindre des fichiers</span>
            <input type="file" class="masque" multiple accept="application/pdf,image/*" data-joindre>
          </label>
          <label class="bouton bouton-secondaire bouton-photo">
            ${ui.icone('photo', 18)}<span>Prendre une photo</span>
            <input type="file" class="masque" accept="image/*" capture="environment" data-joindre>
          </label>
        </div>
        <p class="envoi-documents" data-envoi-documents aria-live="polite" hidden></p>
        <p class="champ-erreur" data-erreur-documents role="alert" hidden></p>
      </fieldset>`;

    const dateAffichee = evenement?.date ? `du ${format.date(evenement.date)}` : 'sans date';
    const nombreDocuments = documentsExistants.length;

    await ui.fenetre({
      titre: evenement ? "Modifier l'événement" : "Nouvel événement d'entretien",
      contenu,
      large: true,
      libelleValider: evenement ? 'Enregistrer' : "Ajouter l'événement",
      preparer: (formulaire) => {
        formulaire.dataset.modeCoutInitial = valeurs.modeCout;
        preparer(formulaire, listeCategories);
        preparerDocuments(formulaire, etatDocuments, urls);
      },
      valider: async (formulaire) => {
        const { saisie, numeros } = lireSaisie(formulaire);
        const verification = evenements.verifier(saisie);
        const erreurs = { ...verification.erreurs };
        verification.erreursLignes.forEach((erreursLigne, rang) => {
          if (erreursLigne.categorie) erreurs[`ligne-${numeros[rang]}-categorie`] = erreursLigne.categorie;
          if (erreursLigne.cout) erreurs[`ligne-${numeros[rang]}-cout`] = erreursLigne.cout;
        });
        if (!ui.afficherErreurs(formulaire, erreurs)) return false;

        // Les nouveaux documents partent vers Firebase Storage avant l'enregistrement de l'événement.
        const ajouts = etatDocuments.nouveaux.map(({ nom, type, taille, contenu }) => ({ nom, type, taille, contenu }));
        const zoneErreur = formulaire.querySelector('[data-erreur-documents]');
        const zoneEnvoi = formulaire.querySelector('[data-envoi-documents]');
        zoneErreur.hidden = true;
        if (ajouts.length && !navigator.onLine) {
          zoneErreur.textContent = messageEnvoi({ code: 'hors-ligne' });
          zoneErreur.hidden = false;
          zoneErreur.scrollIntoView({ block: 'nearest' });
          return false;
        }
        try {
          if (ajouts.length) {
            zoneEnvoi.textContent = 'Envoi des documents…';
            zoneEnvoi.hidden = false;
          }
          const enregistre = await evenements.enregistrer({ ...evenement, ...verification.valeurs }, {
            ajouts,
            suppressions: [...etatDocuments.supprimes],
            progression: (fraction) => { zoneEnvoi.textContent = `Envoi des documents… ${Math.round(fraction * 100)} %`; }
          });
          resultat = { action: 'enregistre', evenement: enregistre };
          return true;
        } catch (erreur) {
          console.error(erreur);
          zoneErreur.textContent = messageEnvoi(erreur);
          zoneErreur.hidden = false;
          zoneErreur.scrollIntoView({ block: 'nearest' });
          return false;
        } finally {
          zoneEnvoi.hidden = true;
        }
      },
      supprimer: evenement && (async () => {
        const nombre = evenement.lignes.length;
        const entretiens = nombre > 1 ? `ses ${nombre} entretiens` : 'son entretien';
        const documents = nombreDocuments > 1 ? `, avec ses ${nombreDocuments} documents joints` : nombreDocuments === 1 ? ', avec son document joint' : '';
        const confirme = await ui.confirmer({
          titre: 'Supprimer cet événement ?',
          message: `L'événement ${dateAffichee} et ${entretiens} seront supprimés${documents}. Cette action est définitive.`,
          libelleValider: "Supprimer l'événement"
        });
        if (!confirme) return false;
        await evenements.supprimer(evenement.id);
        resultat = { action: 'supprime' };
        return true;
      })
    });

    urls.liberer();
    return resultat;
  }

  // Affiche la fiche de la voiture concernée, en signalant l'événement qui vient d'être enregistré.
  // Si l'on est déjà sur la fiche de cette voiture (n'importe quel onglet), on y reste.
  function montrer(voitureId, evenementId = null) {
    EV.evenementSignale = evenementId;
    const cible = `voiture/${voitureId}`;
    const actuelle = location.hash.replace(/^#/, '');
    if (actuelle === cible || actuelle.startsWith(`${cible}/`)) EV.routeur.afficher();
    else location.hash = cible;
  }

  // Bouton « Ajouter » de l'onglet Entretiens : nouvel événement pour la voiture affichée.
  async function nouveau(voitureId) {
    const resultat = await ouvrir({ voitureId });
    if (!resultat) return;
    ui.toast('Événement enregistré.');
    montrer(resultat.evenement.voitureId, resultat.evenement.id);
  }

  async function modifier(evenement) {
    const resultat = await ouvrir({ evenement });
    if (!resultat) return;
    if (resultat.action === 'supprime') {
      ui.toast('Événement supprimé.');
      montrer(evenement.voitureId);
    } else {
      ui.toast('Modifications enregistrées.');
      montrer(resultat.evenement.voitureId, resultat.evenement.id);
    }
  }

  EV.fenetreEvenement = { nouveau, modifier };
})(window.EV = window.EV || {});
