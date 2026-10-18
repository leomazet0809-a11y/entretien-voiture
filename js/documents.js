/* Documents joints aux événements (factures, devis, photos) : vérification, affichage, ouverture. */
(function (EV) {
  'use strict';

  const { ui, format } = EV;
  const TAILLE_MAXI = 25 * 1024 * 1024;

  function estPdf(document) {
    return document.type === 'application/pdf' || /\.pdf$/i.test(document.nom);
  }

  function estImage(document) {
    return /^image\//.test(document.type);
  }

  function genre(document) {
    if (estPdf(document)) return 'PDF';
    if (estImage(document)) return 'Image';
    return 'Fichier';
  }

  // Trie les fichiers choisis : ceux qu'on garde (prêts à enregistrer) et un message par fichier refusé.
  function preparer(fichiers) {
    const acceptes = [];
    const refus = [];
    [...fichiers].forEach((fichier) => {
      const description = { nom: fichier.name, type: fichier.type };
      if (!estPdf(description) && !estImage(description)) {
        refus.push(`« ${fichier.name} » n'est ni un PDF ni une image.`);
      } else if (fichier.size === 0) {
        refus.push(`« ${fichier.name} » est vide.`);
      } else if (fichier.size > TAILLE_MAXI) {
        refus.push(`« ${fichier.name} » est trop lourd (${format.taille(fichier.size)}). Maximum : 25 Mo par fichier.`);
      } else {
        // Le type est fixé pour que le navigateur sache ouvrir le fichier plus tard.
        const type = estPdf(description) ? 'application/pdf' : fichier.type;
        acceptes.push({ nom: fichier.name, type, taille: fichier.size, contenu: new Blob([fichier], { type }) });
      }
    });
    return { acceptes, refus };
  }

  // Adresses temporaires vers les fichiers (vignettes) ; à libérer quand la fenêtre se ferme.
  function adresses() {
    const creees = [];
    return {
      pour(blob) {
        const url = URL.createObjectURL(blob);
        creees.push(url);
        return url;
      },
      liberer() {
        creees.forEach((url) => URL.revokeObjectURL(url));
        creees.length = 0;
      }
    };
  }

  function cliquerLien(proprietes) {
    const lien = Object.assign(window.document.createElement('a'), proprietes);
    window.document.body.appendChild(lien);
    lien.click();
    lien.remove();
  }

  function telecharger(document) {
    const url = URL.createObjectURL(document.contenu);
    cliquerLien({ href: url, download: document.nom });
    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  }

  async function afficherImage(document) {
    const urls = adresses();
    await ui.fenetre({
      titre: document.nom,
      large: true,
      annuler: false,
      libelleValider: 'Fermer',
      contenu: `
        <img class="apercu-image" src="${urls.pour(document.contenu)}" alt="${ui.echapper(document.nom)}">
        <button type="button" class="bouton bouton-secondaire bouton-telecharger" data-telecharger>${ui.icone('telecharger', 18)}<span>Télécharger</span></button>`,
      preparer: (formulaire) => {
        formulaire.querySelector('[data-telecharger]').addEventListener('click', () => telecharger(document));
      }
    });
    urls.liberer();
  }

  // Une image s'affiche dans l'application ; un PDF s'ouvre dans un nouvel onglet, avec le lecteur du navigateur.
  function ouvrir(document) {
    if (estImage(document)) {
      afficherImage(document);
      return;
    }
    const url = URL.createObjectURL(document.contenu);
    cliquerLien({ href: url, target: '_blank', rel: 'noopener' });
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  }

  // Un document dans une liste. `retirer` : bouton pour le retirer (formulaire) ; sinon bouton Télécharger.
  function element(document, urls, { retirer = false } = {}) {
    const nom = ui.echapper(document.nom);
    const vignette = estImage(document)
      ? `<img src="${urls.pour(document.contenu)}" alt="">`
      : ui.icone('document', 22);
    const action = retirer
      ? `<button type="button" class="bouton bouton-icone bouton-texte-danger" data-retirer-document aria-label="Retirer ${nom}" title="Retirer">${ui.icone('corbeille', 18)}</button>`
      : `<button type="button" class="bouton bouton-icone" data-telecharger-document aria-label="Télécharger ${nom}" title="Télécharger">${ui.icone('telecharger', 18)}</button>`;
    return `
      <li class="document" data-document="${document.id}">
        <button type="button" class="document-ouvrir" data-ouvrir-document aria-label="Ouvrir ${nom}">
          <span class="document-vignette">${vignette}</span>
          <span class="document-infos">
            <span class="document-nom">${nom}</span>
            <span class="document-meta">${genre(document)} · ${format.taille(document.taille)}</span>
          </span>
        </button>
        ${action}
      </li>`;
  }

  // Bouton 📎 du tableur : un seul document s'ouvre directement, plusieurs s'affichent en liste.
  async function montrer(titre, documents) {
    if (documents.length === 1) {
      ouvrir(documents[0]);
      return;
    }
    const urls = adresses();
    await ui.fenetre({
      titre,
      annuler: false,
      libelleValider: 'Fermer',
      contenu: `<ul class="liste-documents">${documents.map((d) => element(d, urls)).join('')}</ul>`,
      preparer: (formulaire) => {
        formulaire.querySelectorAll('.document').forEach((ligne) => {
          const document = documents.find((d) => d.id === ligne.dataset.document);
          ligne.querySelector('[data-ouvrir-document]').addEventListener('click', () => ouvrir(document));
          ligne.querySelector('[data-telecharger-document]').addEventListener('click', () => telecharger(document));
        });
      }
    });
    urls.liberer();
  }

  EV.documents = { preparer, adresses, element, ouvrir, telecharger, montrer };
})(window.EV = window.EV || {});
