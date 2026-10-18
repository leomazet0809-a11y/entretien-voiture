/* Petits outils d'interface partagés : icônes, messages, plaque d'immatriculation. */
(function (EV) {
  'use strict';

  // Icônes au trait, d'après le jeu Lucide (licence ISC).
  const TRACES = {
    recherche: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    compteur: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    lune: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    reglages: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
    cle: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    retour: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    crayon: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    corbeille: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    fermer: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    alerte: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    trombone: '<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>',
    document: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    telecharger: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    ouvrir: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    photo: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'
  };

  function icone(nom, taille = 20) {
    return `<svg class="icone" width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRACES[nom] || ''}</svg>`;
  }

  // Remplace chaque <span data-icone="nom"> par le dessin correspondant.
  function remplirIcones(racine = document) {
    racine.querySelectorAll('[data-icone]').forEach((el) => {
      el.innerHTML = icone(el.dataset.icone);
    });
  }

  // Protège le texte saisi par l'utilisateur avant de l'insérer dans la page.
  function echapper(texte) {
    const remplacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(texte ?? '').replace(/[&<>"']/g, (c) => remplacements[c]);
  }

  function plaque(numero) {
    return `<span class="plaque">`
      + `<span class="plaque-bande" aria-hidden="true"><span class="plaque-etoiles"></span>F</span>`
      + `<span class="plaque-numero">${echapper(numero)}</span>`
      + `<span class="plaque-bande" aria-hidden="true"></span>`
      + `</span>`;
  }

  // Message éphémère en bas de l'écran.
  function toast(message) {
    const zone = document.getElementById('messages');
    while (zone.children.length >= 2) zone.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    zone.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-sortie');
      setTimeout(() => el.remove(), 200);
    }, 3200);
  }

  // Fenêtre par-dessus la page, pour un formulaire ou une confirmation.
  // `preparer(formulaire)` est appelé à l'ouverture ; `valider(formulaire)` renvoie true pour fermer.
  // `supprimer()`, s'il est fourni, ajoute un bouton Supprimer ; il renvoie true pour fermer la fenêtre.
  // `annuler: false` retire le bouton Annuler (fenêtre de consultation avec un seul bouton « Fermer »).
  // Renvoie une promesse : true si l'utilisateur a validé, false s'il a annulé.
  let compteurFenetres = 0;
  function fenetre({ titre, contenu, libelleValider = 'Enregistrer', danger = false, large = false, annuler = true, preparer, valider = () => true, supprimer }) {
    return new Promise((resoudre) => {
      const idTitre = `fenetre-titre-${++compteurFenetres}`;
      const boite = document.createElement('dialog');
      boite.className = large ? 'fenetre fenetre-large' : 'fenetre';
      boite.setAttribute('aria-labelledby', idTitre);
      boite.innerHTML = `
        <form class="fenetre-forme" novalidate>
          <div class="fenetre-entete">
            <h2 id="${idTitre}">${echapper(titre)}</h2>
            <button type="button" class="bouton bouton-icone" data-fermer aria-label="Fermer">${icone('fermer')}</button>
          </div>
          <div class="fenetre-corps">${contenu}</div>
          <div class="fenetre-pied">
            ${supprimer ? `<button type="button" class="bouton bouton-texte-danger fenetre-supprimer" data-supprimer-fenetre>${icone('corbeille', 18)}<span>Supprimer</span></button>` : ''}
            ${annuler ? '<button type="button" class="bouton bouton-secondaire" data-fermer>Annuler</button>' : ''}
            <button type="submit" class="bouton ${danger ? 'bouton-danger' : 'bouton-principal'}">${echapper(libelleValider)}</button>
          </div>
        </form>`;

      const formulaire = boite.querySelector('form');
      const boutonValider = formulaire.querySelector('[type="submit"]');
      let validee = false;

      boite.querySelectorAll('[data-fermer]').forEach((b) => b.addEventListener('click', () => boite.close()));
      if (supprimer) {
        boite.querySelector('[data-supprimer-fenetre]').addEventListener('click', async () => {
          if (await supprimer()) boite.close();
        });
      }
      formulaire.addEventListener('submit', async (e) => {
        e.preventDefault();
        boutonValider.disabled = true;
        try {
          if (await valider(formulaire)) {
            validee = true;
            boite.close();
          }
        } catch (erreur) {
          console.error(erreur);
          toast("L'enregistrement n'a pas fonctionné. Réessayez.");
        } finally {
          boutonValider.disabled = false;
        }
      });
      boite.addEventListener('close', () => {
        boite.remove();
        resoudre(validee);
      });

      document.body.appendChild(boite);
      formulaire.querySelectorAll('[data-saisie-date]').forEach(brancherDate);
      if (preparer) preparer(formulaire);
      boite.showModal();
    });
  }

  function confirmer({ titre, message, libelleValider }) {
    return fenetre({ titre, contenu: `<p class="fenetre-texte">${echapper(message)}</p>`, libelleValider, danger: true });
  }

  // Champ de formulaire avec son libellé, une aide facultative et la place pour un message d'erreur.
  function champ({ id, nom, libelle, valeur = '', facultatif = false, aide = '', attributs = '' }) {
    const decrit = [aide && `${id}-aide`, `${id}-erreur`].filter(Boolean).join(' ');
    return `
      <div class="champ">
        <label for="${id}">${echapper(libelle)}${facultatif ? ' <span class="facultatif">(facultatif)</span>' : ''}</label>
        <input id="${id}" name="${nom}" value="${echapper(valeur)}" aria-describedby="${decrit}" ${attributs}>
        ${aide ? `<p class="champ-aide" id="${id}-aide">${echapper(aide)}</p>` : ''}
        <p class="champ-erreur" id="${id}-erreur" hidden></p>
      </div>`;
  }

  // Champ de date tapée au clavier, au format JJ/MM/AAAA, sans calendrier. `valeur` : date ISO (« 2025-01-13 ») ou vide.
  function champDate({ valeur = '', attributs = '', ...reste }) {
    return champ({
      ...reste,
      valeur: EV.format.date(valeur),
      attributs: `data-saisie-date inputmode="numeric" autocomplete="off" maxlength="10" placeholder="JJ/MM/AAAA" ${attributs}`
    });
  }

  // « 13012025 » → « 13/01/2025 ». `barreFinale` : on ajoute déjà la barre qui suit le jour ou le mois complet (« 13/ »).
  function chiffresEnDate(chiffres, barreFinale) {
    let texte = chiffres.slice(0, 2);
    if (chiffres.length > 2 || (barreFinale && chiffres.length === 2)) texte += '/';
    texte += chiffres.slice(2, 4);
    if (chiffres.length > 4 || (barreFinale && chiffres.length === 4)) texte += '/';
    return texte + chiffres.slice(4, 8);
  }

  // Pendant la frappe, les barres s'ajoutent toutes seules : on ne tape que les chiffres.
  function brancherDate(saisie) {
    // « / », « . », « - » ou espace tapé après un seul chiffre : on complète par un zéro (« 3/ » → « 03/ »).
    saisie.addEventListener('beforeinput', (e) => {
      if (!/^[/.\- ]$/.test(e.data || '')) return;
      e.preventDefault();
      const valeur = saisie.value;
      if (saisie.selectionStart !== valeur.length) return;
      let chiffres = valeur.replace(/\D/g, '');
      if (/^\d$/.test(valeur.split('/').pop()) && chiffres.length < 4) chiffres = `${chiffres.slice(0, -1)}0${chiffres.slice(-1)}`;
      saisie.value = chiffresEnDate(chiffres, true);
      saisie.dispatchEvent(new Event('input', { bubbles: true }));
    });

    saisie.addEventListener('input', (e) => {
      const valeur = saisie.value;
      const suppression = /^delete/.test(e.inputType || '');
      // Date collée ou complétée par le navigateur : « 2025-01-13 », « 3/1/2025 ».
      const iso = valeur.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const complete = !suppression && valeur.trim().match(/^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/);
      let chiffres = valeur.replace(/\D/g, '');
      if (iso) chiffres = iso[3] + iso[2] + iso[1];
      else if (complete) chiffres = complete[1].padStart(2, '0') + complete[2].padStart(2, '0') + complete[3];
      const texte = chiffresEnDate(chiffres, !suppression);
      if (texte === valeur) return;

      // Le curseur reste après le même nombre de chiffres.
      const chiffresAvant = valeur.slice(0, saisie.selectionStart ?? valeur.length).replace(/\D/g, '').length;
      let position = 0;
      for (let vus = 0; position < texte.length && vus < chiffresAvant; position += 1) {
        if (/\d/.test(texte[position])) vus += 1;
      }
      if (iso || complete) position = texte.length;
      else if (!suppression && texte[position] === '/') position += 1;
      saisie.value = texte;
      saisie.setSelectionRange(position, position);
    });
  }

  // Affiche les erreurs sous les champs concernés et place le curseur sur la première.
  // Renvoie true s'il n'y a aucune erreur.
  function afficherErreurs(formulaire, erreurs) {
    let premier = null;
    formulaire.querySelectorAll('input[name], select[name], textarea[name]').forEach((saisie) => {
      const message = erreurs[saisie.name];
      const zone = formulaire.querySelector(`#${saisie.id}-erreur`);
      saisie.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (zone) {
        zone.hidden = !message;
        zone.textContent = message || '';
      }
      if (message && !premier) premier = saisie;
    });
    if (premier) premier.focus();
    return !premier;
  }

  EV.ui = { icone, remplirIcones, echapper, plaque, toast, fenetre, confirmer, champ, champDate, afficherErreurs };
})(window.EV = window.EV || {});
