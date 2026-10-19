/* Service worker : garde l'application sur l'appareil, pour qu'elle s'installe comme une appli et s'ouvre sans réseau.
   - Fichiers de l'application : pris sur le réseau quand il répond (toujours la dernière version publiée),
     sinon dans la copie gardée sur l'appareil.
   - Outils Firebase (adresse avec numéro de version, donc figés) : copie de l'appareil d'abord.
   - Polices : copie de l'appareil, mise à jour en arrière-plan.
   Les données (Firestore) ont leur propre copie hors ligne, et la connexion Google passe directement : on n'y touche pas. */
'use strict';

const CACHE = 'entretien-voiture-v2';
const ATTENTE_RESEAU = 4000; // au-delà de 4 secondes sans réponse, la copie de l'appareil prend le relais

const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'icones/favicon.svg',
  'icones/favicon-32.png',
  'icones/apple-touch-icon.png',
  'icones/icone-192.png',
  'icones/icone-512.png',
  'icones/icone-masquable-512.png',
  'js/firebase-config.js',
  'js/installation.js',
  'js/ui.js',
  'js/format.js',
  'js/theme.js',
  'js/routeur.js',
  'js/compte.js',
  'js/stockage.js',
  'js/voitures.js',
  'js/categories.js',
  'js/evenements.js',
  'js/kilometrage.js',
  'js/graphique.js',
  'js/recherche.js',
  'js/csv.js',
  'js/echange.js',
  'js/ecrans/fenetre-voiture.js',
  'js/ecrans/fenetre-evenement.js',
  'js/ecrans/fenetre-releve.js',
  'js/ecrans/accueil.js',
  'js/ecrans/voiture.js',
  'js/ecrans/parametres.js',
  'js/ecrans/recherche.js',
  'js/ecrans/echange-csv.js',
  'js/app.js'
];

const OUTILS_FIREBASE = ['app', 'auth', 'firestore']
  .map((nom) => `https://www.gstatic.com/firebasejs/10.12.2/firebase-${nom}-compat.js`);

const POLICES = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', (evenement) => {
  evenement.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FICHIERS.map((fichier) => new Request(fichier, { cache: 'reload' })));
    // Scripts d'un autre site : réponse « opaque », que le navigateur sait réutiliser pour une balise <script>.
    await Promise.all(OUTILS_FIREBASE.map(async (adresse) => cache.put(adresse, await fetch(adresse, { mode: 'no-cors' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom !== CACHE) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

// Réseau d'abord ; s'il ne répond pas (hors ligne, ou trop lent), la copie de l'appareil.
async function reseauDabord(evenement) {
  const requete = evenement.request;
  const cache = await caches.open(CACHE);
  const reseau = fetch(requete).then((reponse) => {
    if (reponse.ok && reponse.type === 'basic') cache.put(requete, reponse.clone());
    return reponse;
  });
  evenement.waitUntil(reseau.catch(() => {}));
  try {
    return await Promise.race([reseau, new Promise((_, refus) => setTimeout(() => refus(new Error('trop lent')), ATTENTE_RESEAU))]);
  } catch (erreur) {
    // L'application n'a qu'une page : toute ouverture revient à index.html.
    const copie = await cache.match(requete, { ignoreSearch: true })
      || (requete.mode === 'navigate' ? await cache.match('index.html') : undefined);
    return copie || reseau;
  }
}

// Copie de l'appareil d'abord ; sinon le réseau, dont la réponse est gardée.
// `miseAJour` : même avec une copie, on va chercher la nouvelle version pour la prochaine fois.
async function copieDabord(evenement, miseAJour) {
  const cache = await caches.open(CACHE);
  const copie = await cache.match(evenement.request);
  if (copie && !miseAJour) return copie;
  const reseau = fetch(evenement.request).then((reponse) => {
    if (reponse.ok || reponse.type === 'opaque') cache.put(evenement.request, reponse.clone());
    return reponse;
  });
  if (!copie) return reseau;
  evenement.waitUntil(reseau.catch(() => {}));
  return copie;
}

self.addEventListener('fetch', (evenement) => {
  const { request: requete } = evenement;
  if (requete.method !== 'GET') return;
  const adresse = new URL(requete.url);
  if (adresse.origin === self.location.origin && adresse.pathname.startsWith(new URL(self.registration.scope).pathname)) {
    evenement.respondWith(reseauDabord(evenement));
  } else if (adresse.href.startsWith('https://www.gstatic.com/firebasejs/')) {
    evenement.respondWith(copieDabord(evenement, false));
  } else if (POLICES.test(adresse.href)) {
    evenement.respondWith(copieDabord(evenement, true));
  }
});
