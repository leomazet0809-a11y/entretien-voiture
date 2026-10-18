/* Compte : connexion avec Google avant d'accéder aux données, et déconnexion. */
(function (EV) {
  'use strict';

  const { ui } = EV;
  let auth = null;
  let utilisateur = null;
  let deconnexionEnCours = false;

  function configurationRemplie(config) {
    return Boolean(config && config.apiKey && config.appId
      && !config.apiKey.startsWith('A_REMPLIR') && !config.appId.startsWith('A_REMPLIR'));
  }

  function afficherDansContenu(html) {
    const zone = document.getElementById('contenu');
    zone.innerHTML = html;
    return zone;
  }

  // Écran bloquant quand l'application ne peut pas démarrer.
  function ecranProbleme(titre, texte) {
    afficherDansContenu(`
      <section class="vide">
        <h2>${ui.echapper(titre)}</h2>
        <p>${ui.echapper(texte)}</p>
        <button class="bouton bouton-principal" type="button" onclick="location.reload()">Réessayer</button>
      </section>`);
    return new Promise(() => {}); // l'application s'arrête là
  }

  function messageErreur(erreur) {
    switch (erreur && erreur.code) {
      case 'auth/popup-blocked':
        return 'Le navigateur a bloqué la fenêtre de connexion. Autorisez les fenêtres pour ce site, puis réessayez.';
      case 'auth/unauthorized-domain':
        return "Cette adresse n'est pas autorisée dans Firebase (Authentication → Paramètres → Domaines autorisés).";
      case 'auth/operation-not-supported-in-this-environment':
        return "La connexion ne fonctionne pas en ouvrant le fichier directement : passez par l'adresse en ligne ou par un serveur local.";
      case 'auth/network-request-failed':
        return 'Pas de connexion Internet. Vérifiez votre réseau, puis réessayez.';
      default:
        return "La connexion n'a pas abouti. Réessayez.";
    }
  }

  // Affiche l'écran de connexion ; se résout avec l'utilisateur une fois connecté.
  function ecranConnexion() {
    return new Promise((resoudre) => {
      const zone = afficherDansContenu(`
        <div class="entete-page">
          <div>
            <h1>Mes voitures</h1>
            <p class="sous-titre">Connexion nécessaire</p>
          </div>
        </div>
        <section class="vide" aria-labelledby="titre-connexion">
          <h2 id="titre-connexion">Connectez-vous pour retrouver vos voitures</h2>
          <p>Vos données sont enregistrées dans votre espace en ligne. Connectez-vous avec le même compte Google sur l'ordinateur et sur le téléphone pour retrouver les mêmes voitures partout.</p>
          <button class="bouton bouton-principal" type="button" data-connexion>Se connecter avec Google</button>
          <p class="champ-erreur" data-erreur-connexion role="alert" hidden></p>
        </section>`);

      const bouton = zone.querySelector('[data-connexion]');
      const zoneErreur = zone.querySelector('[data-erreur-connexion]');

      bouton.addEventListener('click', async () => {
        bouton.disabled = true;
        zoneErreur.hidden = true;
        try {
          const fournisseur = new firebase.auth.GoogleAuthProvider();
          fournisseur.setCustomParameters({ prompt: 'select_account' });
          const resultat = await auth.signInWithPopup(fournisseur);
          resoudre(resultat.user);
        } catch (erreur) {
          if (erreur.code !== 'auth/popup-closed-by-user' && erreur.code !== 'auth/cancelled-popup-request') {
            console.error(erreur);
            zoneErreur.textContent = messageErreur(erreur);
            zoneErreur.hidden = false;
          }
        } finally {
          bouton.disabled = false;
        }
      });
    });
  }

  // Renvoie l'utilisateur connecté ; affiche l'écran de connexion si besoin.
  async function demarrer() {
    document.body.classList.add('non-connecte');

    if (!window.firebase) {
      return ecranProbleme('Connexion impossible',
        "Les outils de connexion n'ont pas pu être chargés. Vérifiez votre connexion Internet.");
    }
    if (!configurationRemplie(EV.firebaseConfig)) {
      return ecranProbleme('Configuration à compléter',
        'Collez la configuration Firebase de votre projet dans le fichier js/firebase-config.js.');
    }

    firebase.initializeApp(EV.firebaseConfig);
    auth = firebase.auth();

    const dejaConnecte = await new Promise((ok) => {
      const arreter = auth.onAuthStateChanged((u) => { arreter(); ok(u); });
    });
    utilisateur = dejaConnecte || await ecranConnexion();

    // Si la session se termine ailleurs (déconnexion dans un autre onglet), on revient à l'écran de connexion.
    auth.onAuthStateChanged((u) => {
      if (!u && !deconnexionEnCours) location.reload();
    });

    document.body.classList.remove('non-connecte');
    return utilisateur;
  }

  async function deconnecter() {
    const confirme = await ui.fenetre({
      titre: 'Se déconnecter ?',
      contenu: `<p class="fenetre-texte">Vos données restent enregistrées en ligne. Elles seront effacées de cet appareil, et vous les retrouverez en vous reconnectant.</p>`,
      libelleValider: 'Se déconnecter'
    });
    if (!confirme) return;
    deconnexionEnCours = true;
    await EV.stockage.arreter();
    await auth.signOut();
    location.hash = '';
    location.reload();
  }

  EV.compte = {
    demarrer,
    deconnecter,
    email: () => (utilisateur ? utilisateur.email : '')
  };
})(window.EV = window.EV || {});
