# Entretien voiture

Application web pour suivre l'entretien de ses voitures : un dossier par voiture, le tableau des entretiens, l'historique du kilométrage et une recherche dans toutes les données.

Un **événement** est un passage (au garage ou chez soi) : une date, un kilométrage, une société, des documents, et un ou plusieurs **entretiens** (catégorie, détail). Le coût se saisit globalement ou entretien par entretien.

Elle fonctionne sur ordinateur et sur smartphone. On s'y connecte avec un compte Google : les données sont enregistrées en ligne dans un espace propre à chaque compte, et sont donc les mêmes sur tous les appareils, mises à jour en temps réel.

- Les fiches (voitures, catégories, événements, relevés) sont dans **Cloud Firestore**. Une copie reste sur l'appareil : l'application fonctionne sans réseau et envoie les modifications au retour de la connexion.
- Les documents joints (factures, photos) sont dans **Firebase Storage**. Leur envoi demande une connexion.

## Ouvrir l'application

- **En ligne** : https://leomazet0809-a11y.github.io/entretien-voiture/ (GitHub Pages).
- **L'installer comme une application** :
  - sur Android, dans Chrome : menu ⋮ → « Installer l'application » ;
  - sur iPhone, dans Safari : Partager → « Sur l'écran d'accueil » ;
  - sur ordinateur : icône d'installation dans la barre d'adresse de Chrome ou Edge.

  La rubrique *Application* des Paramètres propose aussi un bouton Installer quand le navigateur le permet. Une fois ouverte une première fois, l'application s'ouvre aussi sans réseau.
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
| 8 | Exporter / importer les entretiens d'une voiture (fichier CSV) | Fait |
| 9 | Installation comme une application, ouverture sans réseau | Fait |

Plus tard : bouton Planning.

## Organisation du code

```
index.html            page unique et barre du haut
manifest.webmanifest  description de l'application installée (nom, icônes, plein écran)
sw.js                 service worker : garde l'application sur l'appareil pour l'ouvrir sans réseau
icones/               icône de l'onglet du navigateur et de l'écran d'accueil du téléphone
css/styles.css        styles, thèmes clair et sombre
js/ui.js              icônes, messages, plaque d'immatriculation
js/installation.js    installation de l'application et ouverture sans réseau
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
js/csv.js             lecture et écriture des fichiers CSV (tableur)
js/echange.js         export / import des entretiens d'une voiture en CSV
js/format.js          montants, kilométrages, dates et tailles de fichiers à la française
js/ecrans/*.js        un fichier par écran
js/app.js             démarrage
```

Aucun outil à installer : HTML, CSS et JavaScript simples, sans compilation. Firebase est chargé depuis le site de Google.

## Ouverture sans réseau

Le service worker (`sw.js`) garde une copie de l'application sur l'appareil :
- les fichiers de l'application sont pris sur le réseau quand il répond : une nouvelle version publiée est donc prise au rechargement suivant ;
- sans réseau, ou si le réseau tarde plus de 4 secondes, c'est la copie de l'appareil qui sert ;
- les données ont leur propre copie hors ligne (Firestore) : ce qui est saisi sans réseau est envoyé au retour de la connexion ;
- l'envoi de nouveaux documents, lui, demande une connexion.

Un fichier ajouté à l'application doit aussi être ajouté à la liste `FICHIERS` de `sw.js`.

## Fichier CSV des entretiens

Dans l'onglet Entretiens d'une voiture, à droite de Rechercher :

- **Exporter** télécharge les entretiens de la voiture dans un fichier CSV (séparateur « ; », UTF-8), qui s'ouvre dans Excel ou Google Sheets. Colonnes : `Date ; Kilométrage ; Société ; Catégorie ; Détail ; Coût TTC`, une ligne par entretien.
- **Importer** remplace les entretiens de la voiture par ceux d'un fichier CSV, après un résumé à confirmer. Rien n'est modifié si le fichier contient une erreur : la liste des lignes à corriger s'affiche.

Règles de l'import :
- les lignes qui ont la même date, le même kilométrage et la même société forment un seul événement ;
- une case vide, `?????` ou `-` veut dire « inconnu » ;
- un coût écrit seulement sur la première ligne d'un événement est son coût global ; sinon, chaque ligne a son coût ;
- une catégorie inconnue est créée ;
- les colonnes de l'ancien tableur sont reconnues (`Élément`, `Observation`, `Garage`, `Prix`…) : l'observation est ajoutée au détail ;
- les documents joints restent rattachés à leur événement s'il est encore dans le fichier (même date, kilométrage et société) ; sinon ils sont supprimés, et le résumé le signale avant de confirmer ;
- les relevés notés avec le bouton Km ne changent pas.

## Configuration Firebase

Projet Firebase : `entretien-voiture-67366`. Ses identifiants publics sont dans `js/firebase-config.js` (ils ne sont pas secrets : la protection repose sur la connexion et sur les règles ci-dessous).

1. **Authentication** : fournisseur Google activé ; domaine `leomazet0809-a11y.github.io` dans *Paramètres → Domaines autorisés*.
2. **Firestore Database** : coller le contenu de [`firestore.rules`](firestore.rules) dans l'onglet *Règles*, puis *Publier*.
3. **Storage** (documents joints) : demande le forfait **Blaze** (paiement à l'usage ; pour quelques centaines de factures, quelques centimes par mois au plus). Créer le stockage dans *Storage → Commencer*, puis coller [`storage.rules`](storage.rules) dans l'onglet *Règles* et *Publier*. Penser à une alerte de budget dans Google Cloud (*Facturation → Budgets et alertes*).

Chaque compte ne peut lire et modifier que son propre espace (`users/{uid}/…`), et seuls les PDF et images de 25 Mo au plus sont acceptés dans Storage.
