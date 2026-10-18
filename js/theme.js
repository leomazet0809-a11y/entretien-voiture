/* Thème clair / sombre : suit l'appareil par défaut et mémorise le choix fait avec le bouton. */
(function (EV) {
  'use strict';

  const CLE = 'entretien-voiture.theme';
  const COULEUR_BARRE = { light: '#F6F6F3', dark: '#0E0F12' };
  const sombreSurAppareil = window.matchMedia('(prefers-color-scheme: dark)');

  function lireMemoire() {
    try {
      const valeur = localStorage.getItem(CLE);
      if (valeur === 'light' || valeur === 'dark') return valeur;
    } catch (e) { /* stockage indisponible */ }
    return 'auto';
  }

  // 'auto', 'light' ou 'dark'. Gardé en mémoire vive au cas où le navigateur refuse le stockage.
  let choix = lireMemoire();

  function effectif() {
    if (choix === 'auto') return sombreSurAppareil.matches ? 'dark' : 'light';
    return choix;
  }

  function appliquer() {
    const racine = document.documentElement;
    if (choix === 'auto') racine.removeAttribute('data-theme');
    else racine.setAttribute('data-theme', choix);

    const theme = effectif();
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', COULEUR_BARRE[theme]);

    const bouton = document.getElementById('bouton-theme');
    if (bouton) {
      const versSombre = theme === 'light';
      const libelle = versSombre ? 'Passer en mode sombre' : 'Passer en mode clair';
      bouton.innerHTML = EV.ui.icone(versSombre ? 'lune' : 'soleil');
      bouton.setAttribute('aria-label', libelle);
      bouton.title = libelle;
    }

    document.querySelectorAll('[data-choix-theme]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.choixTheme === choix));
    });
  }

  function definir(nouveau) {
    choix = nouveau;
    try {
      if (nouveau === 'auto') localStorage.removeItem(CLE);
      else localStorage.setItem(CLE, nouveau);
    } catch (e) { /* le choix vaut pour cette visite seulement */ }
    appliquer();
  }

  function basculer() {
    definir(effectif() === 'dark' ? 'light' : 'dark');
  }

  sombreSurAppareil.addEventListener('change', appliquer);

  EV.theme = { appliquer, definir, basculer };
})(window.EV = window.EV || {});
