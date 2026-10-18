# Entretien voiture

Application web pour suivre l'entretien de ses voitures : un dossier par voiture, le tableau des entretiens (date, kilométrage, coût, commentaires, factures), l'historique du kilométrage et une recherche dans toutes les données.

Elle fonctionne sur ordinateur et sur smartphone. On s'y connecte avec un compte Google : les données sont enregistrées en ligne dans Cloud Firestore (Firebase), dans un espace propre à chaque compte, et sont donc les mêmes sur tous les appareils. Une copie reste sur l'appareil pour fonctionner sans réseau.

## Ouvrir l'application

- **En ligne** : l'adresse sera ajoutée à l'étape 9, une fois l'application publiée.
- **Sur l'ordinateur, pour tester** : la connexion Google ne fonctionne pas en ouvrant `index.html` directement. Lancer un serveur local dans le dossier (`python -m http.server`, ou l'extension Live Server de VS Code), puis ouvrir `http://localhost:8000`.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Barre du haut, thème clair / sombre, adaptation à la taille de l'écran | Fait |
| 2 | Voitures : créer, modifier, supprimer | Fait |
| 3 | Paramètres : catégories d'entretien | À faire |
| 4 | Fiche voiture et tableau des entretiens | À faire |
| 5 | Documents joints (factures, photos) | À faire |
| 6 | Kilométrage : bouton Km, historique, courbe | À faire |
| 7 | Recherche dans toutes les données | À faire |
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
js/stockage.js        enregistrement des données en ligne (Cloud Firestore)
js/voitures.js        règles sur les voitures (format de plaque, vérifications)
js/ecrans/*.js        un fichier par écran
js/app.js             démarrage
```

Aucun outil à installer : HTML, CSS et JavaScript simples, sans compilation. Firebase est chargé depuis le site de Google.

## Règles de sécurité Firestore

Chaque compte ne peut lire et modifier que son propre espace :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
