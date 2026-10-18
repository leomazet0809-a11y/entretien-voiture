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
    retour: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'
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

  EV.ui = { icone, remplirIcones, echapper, plaque, toast };
})(window.EV = window.EV || {});
