/* Fenêtre « Relevé kilométrique » (bouton Km). */
(function (EV) {
  'use strict';

  const { ui, format, voitures, kilometrage } = EV;

  // Ouvre la fenêtre. Renvoie { action: 'enregistre', releve }, { action: 'supprime' } ou null si l'utilisateur annule.
  async function ouvrir({ releve = null, voitureId = null } = {}) {
    const listeVoitures = await voitures.liste();
    const voitureChoisie = releve?.voitureId || voitureId || (listeVoitures.length === 1 ? listeVoitures[0].id : '');
    const libelleValider = releve ? 'Enregistrer' : 'Enregistrer le relevé';
    let avertissementAccepte = false;
    let resultat = null;

    const contenu = `
      <div class="champ">
        <label for="releve-voiture">Voiture</label>
        <select id="releve-voiture" name="voitureId" aria-describedby="releve-voiture-erreur"${voitureChoisie ? '' : ' autofocus'}>
          <option value="">Choisir une voiture</option>
          ${listeVoitures.map((v) => `<option value="${v.id}"${v.id === voitureChoisie ? ' selected' : ''}>${ui.echapper(v.plaque)} · ${ui.echapper(voitures.nom(v))}</option>`).join('')}
        </select>
        <p class="champ-erreur" id="releve-voiture-erreur" hidden></p>
      </div>
      <div class="champs-ligne">
        ${ui.champ({
          id: 'releve-date', nom: 'date', libelle: 'Date', valeur: releve?.date || format.aujourdhui(),
          attributs: `type="date" max="${format.aujourdhui()}"`
        })}
        ${ui.champ({
          id: 'releve-km', nom: 'km', libelle: 'Kilométrage au compteur', valeur: format.kmSaisie(releve?.km),
          attributs: `inputmode="numeric" autocomplete="off" placeholder="Ex. : 158 220"${voitureChoisie ? ' autofocus' : ''}`
        })}
      </div>
      <p class="avertissement" data-avertissement role="alert" hidden></p>`;

    await ui.fenetre({
      titre: releve ? 'Modifier le relevé' : 'Relevé kilométrique',
      contenu,
      libelleValider,
      preparer: (formulaire) => {
        // Toute modification de la saisie annule l'avertissement déjà accepté.
        formulaire.addEventListener('input', () => {
          avertissementAccepte = false;
          formulaire.querySelector('[data-avertissement]').hidden = true;
          formulaire.querySelector('[type="submit"]').textContent = libelleValider;
        });
      },
      valider: async (formulaire) => {
        const champs = formulaire.elements;
        const saisie = { id: releve?.id, voitureId: champs.voitureId.value, date: champs.date.value, km: champs.km.value };
        const { valeurs, erreurs, avertissement } = kilometrage.verifier(saisie, saisie.voitureId ? await kilometrage.historique(saisie.voitureId) : []);
        if (!ui.afficherErreurs(formulaire, erreurs)) return false;
        if (avertissement && !avertissementAccepte) {
          const zone = formulaire.querySelector('[data-avertissement]');
          zone.textContent = avertissement;
          zone.hidden = false;
          formulaire.querySelector('[type="submit"]').textContent = 'Enregistrer quand même';
          avertissementAccepte = true;
          return false;
        }
        resultat = { action: 'enregistre', releve: await kilometrage.enregistrer({ ...releve, ...valeurs }) };
        return true;
      },
      supprimer: releve && (async () => {
        const confirme = await ui.confirmer({
          titre: 'Supprimer ce relevé ?',
          message: `Le relevé du ${format.date(releve.date)} (${format.km(releve.km)}) sera supprimé.`,
          libelleValider: 'Supprimer le relevé'
        });
        if (!confirme) return false;
        await kilometrage.supprimer(releve.id);
        resultat = { action: 'supprime' };
        return true;
      })
    });

    return resultat;
  }

  // Affiche l'onglet Kilométrage de la voiture.
  function montrer(voitureId) {
    const cible = `voiture/${voitureId}/km`;
    if (location.hash.replace(/^#/, '') === cible) EV.routeur.afficher();
    else location.hash = cible;
  }

  // Bouton « Km » : nouveau relevé, pour la voiture affichée s'il y en a une.
  async function nouveau(voitureId = null) {
    if ((await voitures.liste()).length === 0) {
      ui.toast("Ajoutez d'abord une voiture : son kilométrage sera rangé dans son dossier.");
      return;
    }
    const resultat = await ouvrir({ voitureId });
    if (!resultat) return;
    ui.toast('Kilométrage enregistré.');
    montrer(resultat.releve.voitureId);
  }

  async function modifier(releve) {
    const resultat = await ouvrir({ releve });
    if (!resultat) return;
    ui.toast(resultat.action === 'supprime' ? 'Relevé supprimé.' : 'Modifications enregistrées.');
    montrer(resultat.action === 'supprime' ? releve.voitureId : resultat.releve.voitureId);
  }

  EV.fenetreReleve = { nouveau, modifier };
})(window.EV = window.EV || {});
