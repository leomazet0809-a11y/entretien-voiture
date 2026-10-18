# Entretien voiture

Application web pour suivre l'entretien de ses voitures : un dossier par voiture, le tableau des entretiens, l'historique du kilométrage et une recherche dans toutes les données.

Un **événement** est un passage (au garage ou chez soi) : une date, un kilométrage, un garage, des documents, et un ou plusieurs **entretiens** (catégorie, détail, commentaire). Le coût se saisit globalement ou entretien par entretien.

Elle fonctionne sur ordinateur et sur smartphone. On s'y connecte avec un compte Google : les données sont enregistrées en ligne dans un espace propre à chaque compte, et sont donc les mêmes sur tous les appareils, mises à jour en temps réel.

- Les fiches (voitures, catégories, événements, relevés) sont dans **Cloud Firestore**. Une copie reste sur l'appareil : l'application fonctionne sans réseau et envoie les modifications au retour de la connexion.
- Les documents joints (factures, photos) sont dans **Firebase Storage**. Leur envoi demande une connexion.

## Ouvrir l'application

- **En ligne** : https://leomazet0809-a11y.github.io/entretien-voiture/ (GitHub Pages).
- **Sur l'ordinateur, pour tester** : la connexion Google ne fonctionne pas en ouvrant `index.html` directement. Lancer un serveur local dans le dossier (`python -m http.server`, ou l'extension Live Server de VS Code), puis ouvrir `http://localhost:8000`.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Barre du haut, thème clair / sombre, adaptation à la taille de l'écran | Fait |
| 2 | Voitures : créer, modifier, supprimer | Fait |
| 3 | Paramètres : catégories d'entretien | Fait |
| 4 | Événements d'entretien et tableur de la voiture | Fait |
| 5 | Documents joints (factures, photos) | Fait |
| 6 | Kilométrage : bouton Km, historique, courbe | Fait |
| 7 | Recherche dans toutes les données | Fait |
| 8 | Sauvegarde : exporter / importer | À faire |
| 9 | Installation sur smartphone, mode hors ligne, mise en ligne | À faire |

Plus tard : bouton Planning.

## Organisation du code

```
index.html            page unique et barre du haut
css/styles.css        styles, thèmes clair et sombre
js/ui.js              icônes, messages, plaque d'immatriculation
js/theme.js           bascule clair / sombre
js/routeur.js         navigation entre les écrans
js/firebase-config.js identifiants publics du projet Firebase
js/compte.js          connexion et déconnexion avec Google
js/stockage.js        enregistrement en ligne : Cloud Firestore (fiches) et Firebase Storage (fichiers)
js/voitures.js        règles sur les voitures (format de plaque, vérifications)
js/categories.js      règles sur les catégories d'entretien
js/evenements.js      règles sur les événements (vérifications, total des coûts, tri)
js/documents.js       documents joints : vérification, ouverture, téléchargement
js/kilometrage.js     relevés kilométriques : vérifications, chiffres clés
js/graphique.js       courbe du kilométrage (SVG, sans bibliothèque)
js/recherche.js       recherche dans toutes les données (accents et majuscules ignorés)
js/format.js          montants, kilométrages, dates et tailles de fichiers à la française
js/ecrans/*.js        un fichier par écran
js/app.js             démarrage
```

Aucun outil à installer : HTML, CSS et JavaScript simples, sans compilation. Firebase est chargé depuis le site de Google.

## Configuration Firebase

Projet Firebase : `entretien-voiture-67366`. Ses identifiants publics sont dans `js/firebase-config.js` (ils ne sont pas secrets : la protection repose sur la connexion et sur les règles ci-dessous).

1. **Authentication** : fournisseur Google activé ; domaine `leomazet0809-a11y.github.io` dans *Paramètres → Domaines autorisés*.
2. **Firestore Database** : coller le contenu de [`firestore.rules`](firestore.rules) dans l'onglet *Règles*, puis *Publier*.
3. **Storage** (documents joints) : demande le forfait **Blaze** (paiement à l'usage ; pour quelques centaines de factures, quelques centimes par mois au plus). Créer le stockage dans *Storage → Commencer*, puis coller [`storage.rules`](storage.rules) dans l'onglet *Règles* et *Publier*. Penser à une alerte de budget dans Google Cloud (*Facturation → Budgets et alertes*).

Chaque compte ne peut lire et modifier que son propre espace (`users/{uid}/…`), et seuls les PDF et images de 25 Mo au plus sont acceptés dans Storage.
