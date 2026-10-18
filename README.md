# Entretien voiture

Application web pour suivre l'entretien de ses voitures : un dossier par voiture, le tableau des entretiens (date, kilométrage, coût, commentaires, factures), l'historique du kilométrage et une recherche dans toutes les données.

Elle fonctionne sur ordinateur et sur smartphone. Les données restent sur l'appareil, dans le navigateur : rien n'est envoyé sur Internet.

## Ouvrir l'application

- **En ligne** : l'adresse sera ajoutée à l'étape 9, une fois l'application publiée.
- **Sur l'ordinateur, sans rien installer** : télécharger le dossier, puis ouvrir `index.html` dans Chrome, Edge ou Firefox.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Barre du haut, thème clair / sombre, adaptation à la taille de l'écran | Fait |
| 2 | Voitures : créer, modifier, supprimer | À faire |
| 3 | Paramètres : catégories d'entretien | À faire |
| 4 | Fiche voiture et tableau des entretiens | À faire |
| 5 | Documents joints (factures, photos) | À faire |
| 6 | Kilométrage : bouton Km, historique, courbe | À faire |
| 7 | Recherche dans toutes les données | À faire |
| 8 | Sauvegarde : exporter / importer | À faire |
| 9 | Installation sur smartphone, mode hors ligne, mise en ligne | À faire |

Plus tard : stockage dans Google Drive (Google Sheets), bouton Planning.

## Organisation du code

```
index.html            page unique et barre du haut
css/styles.css        styles, thèmes clair et sombre
js/ui.js              icônes, messages, plaque d'immatriculation
js/theme.js           bascule clair / sombre
js/routeur.js         navigation entre les écrans
js/ecrans/*.js        un fichier par écran
js/app.js             démarrage
```

Aucun outil à installer : HTML, CSS et JavaScript simples, sans compilation.
