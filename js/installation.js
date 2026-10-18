/* Installation comme une application (écran d'accueil du téléphone, ordinateur) et ouverture sans réseau. */
(function (EV) {
  'use strict';

  let proposition = null; // l'invitation à installer de Chrome ou Edge, gardée pour le bouton des Paramètres
  let auChangement = null;

  function installee() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function signalerChangement() {
    if (auChangement) auChangement();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    proposition = e;
    signalerChangement();
  });

  window.addEventListener('appinstalled', () => {
    proposition = null;
    EV.ui.toast("Application installée : elle est sur l'écran d'accueil.");
    signalerChangement();
  });

  // 'installee', 'possible' (bouton Installer), 'iphone' (par Safari) ou 'menu' (par le menu du navigateur).
  function etat() {
    if (installee()) return 'installee';
    if (proposition) return 'possible';
    const appareilApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return appareilApple ? 'iphone' : 'menu';
  }

  // Ouvre la fenêtre d'installation du navigateur. Renvoie true si l'utilisateur accepte.
  async function installer() {
    if (!proposition) return false;
    const invitation = proposition;
    proposition = null;
    invitation.prompt();
    const { outcome } = await invitation.userChoice;
    signalerChangement();
    return outcome === 'accepted';
  }

  // Le service worker garde l'application sur l'appareil : elle s'ouvre même sans réseau.
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((erreur) => console.warn('Ouverture sans réseau indisponible :', erreur));
    });
  }

  // Application installée : on demande au navigateur de ne jamais effacer sa copie des données pour faire de la place.
  if (installee() && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  EV.installation = {
    etat,
    installer,
    // Une seule fonction à la fois : celle de l'écran Paramètres affiché.
    quandChange: (fonction) => { auChangement = fonction; }
  };
})(window.EV = window.EV || {});
