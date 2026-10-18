/* Fenêtre « Nouvelle voiture » / « Modifier la voiture ». */
(function (EV) {
  'use strict';

  const { ui, voitures } = EV;

  const MARQUES = ['Alfa Romeo', 'Audi', 'BMW', 'BYD', 'Citroën', 'Cupra', 'Dacia', 'DS', 'Fiat', 'Ford',
    'Honda', 'Hyundai', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Mazda', 'Mercedes-Benz', 'MG', 'Mini',
    'Mitsubishi', 'Nissan', 'Opel', 'Peugeot', 'Porsche', 'Renault', 'Seat', 'Škoda', 'Smart', 'Subaru',
    'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'];

  // Ouvre la fenêtre. Renvoie la voiture enregistrée, ou null si l'utilisateur annule.
  async function ouvrir(voiture = null) {
    let enregistree = null;

    const contenu = `
      ${ui.champ({
        id: 'voiture-plaque', nom: 'plaque', libelle: "Plaque d'immatriculation", valeur: voiture?.plaque,
        aide: 'Exemple : AB-123-CD. Les tirets sont ajoutés automatiquement.',
        attributs: 'class="saisie-plaque" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" autofocus'
      })}
      <div class="champs-ligne">
        ${ui.champ({
          id: 'voiture-marque', nom: 'marque', libelle: 'Marque', valeur: voiture?.marque,
          attributs: 'list="liste-marques" autocomplete="off" maxlength="40"'
        })}
        ${ui.champ({
          id: 'voiture-modele', nom: 'modele', libelle: 'Modèle', valeur: voiture?.modele,
          attributs: 'autocomplete="off" maxlength="40"'
        })}
      </div>
      ${ui.champ({
        id: 'voiture-annee', nom: 'annee', libelle: 'Année', facultatif: true, valeur: voiture?.annee ?? '',
        aide: 'Exemple : 2019',
        attributs: 'class="saisie-courte" inputmode="numeric" autocomplete="off" maxlength="4"'
      })}
      <datalist id="liste-marques">${MARQUES.map((m) => `<option value="${m}"></option>`).join('')}</datalist>`;

    const validee = await ui.fenetre({
      titre: voiture ? 'Modifier la voiture' : 'Nouvelle voiture',
      contenu,
      libelleValider: voiture ? 'Enregistrer' : 'Ajouter la voiture',
      preparer: (formulaire) => {
        const plaque = formulaire.elements.plaque;
        plaque.addEventListener('blur', () => { plaque.value = voitures.normaliserPlaque(plaque.value); });
      },
      valider: async (formulaire) => {
        const champs = formulaire.elements;
        const saisie = {
          id: voiture?.id,
          plaque: champs.plaque.value,
          marque: champs.marque.value,
          modele: champs.modele.value,
          annee: champs.annee.value
        };
        const { valeurs, erreurs } = voitures.verifier(saisie, await voitures.liste());
        champs.plaque.value = valeurs.plaque;
        if (!ui.afficherErreurs(formulaire, erreurs)) return false;
        enregistree = await voitures.enregistrer({ ...voiture, ...valeurs });
        return true;
      }
    });

    return validee ? enregistree : null;
  }

  EV.fenetreVoiture = { ouvrir };
})(window.EV = window.EV || {});
