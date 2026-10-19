/* Icônes Exporter et Importer de l'onglet Entretiens : les entretiens d'une voiture en fichier CSV. */
(function (EV) {
  'use strict';

  const { ui, format, voitures, echange } = EV;
  const MAXI_ERREURS = 8;
  const MAXI_NOMS = 5;

  async function exporter(voiture) {
    const nom = echange.nomFichier(voiture);
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([await echange.versCsv(voiture)], { type: 'text/csv;charset=utf-8' }));
    lien.download = nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
    ui.toast(`Fichier téléchargé : ${nom}`);
  }

  function liste(elements) {
    return `<ul class="liste-import">${elements.map((e) => `<li>${ui.echapper(e)}</li>`).join('')}</ul>`;
  }

  function quelquesNoms(noms) {
    const reste = noms.length - MAXI_NOMS;
    return noms.slice(0, MAXI_NOMS).join(', ') + (reste > 0 ? ` et ${reste} autres` : '');
  }

  function afficherErreurs(fichier, erreurs) {
    const reste = erreurs.length - MAXI_ERREURS;
    return ui.fenetre({
      titre: 'Import impossible',
      annuler: false,
      libelleValider: 'Fermer',
      contenu: `
        <p class="fenetre-texte">Rien n'a été modifié. Corrigez le fichier « ${ui.echapper(fichier.name)} », puis importez-le à nouveau.</p>
        ${liste(erreurs.slice(0, MAXI_ERREURS))}
        ${reste > 0 ? `<p class="fenetre-texte">… et ${format.pluriel(reste, 'autre problème')}.</p>` : ''}`
    });
  }

  // Résumé de ce que l'import va changer, à confirmer.
  function resume(nomVoiture, analyse) {
    const points = [`Le fichier contient ${format.pluriel(analyse.evenements.length, 'événement')} (${format.pluriel(analyse.nombreEntretiens, 'entretien')}).`];
    if (analyse.evenementsActuels) {
      points.push(`${analyse.evenementsActuels > 1 ? `Les ${analyse.evenementsActuels} événements actuels` : "L'événement actuel"} de la ${nomVoiture} ${analyse.evenementsActuels > 1 ? 'seront remplacés' : 'sera remplacé'}.`);
    }
    if (analyse.nouvellesCategories.length) {
      points.push(`Nouvelles catégories créées : ${quelquesNoms(analyse.nouvellesCategories.map((c) => c.nom))}.`);
    }
    if (analyse.colonnesIgnorees.length) points.push(`Colonnes non utilisées : ${quelquesNoms(analyse.colonnesIgnorees)}.`);
    points.push('Les relevés notés avec le bouton Km ne changent pas.');
    return liste(points);
  }

  async function importer(voiture, fichier) {
    let analyse;
    if (/\.(xlsx|xls|ods|numbers)$/i.test(fichier.name)) {
      analyse = { erreurs: ['Ce fichier est un classeur, pas un fichier CSV. Dans votre tableur, enregistrez-le au format CSV (Fichier → Enregistrer sous ou Télécharger → CSV), puis importez ce fichier CSV.'] };
    } else {
      try {
        analyse = await echange.analyser(await EV.csv.lireFichier(fichier), voiture);
      } catch (erreur) {
        console.error(erreur);
        analyse = { erreurs: ["Le fichier n'a pas pu être lu. Choisissez un fichier CSV enregistré depuis Excel ou Google Sheets."] };
      }
    }
    if (analyse.erreurs.length) {
      await afficherErreurs(fichier, analyse.erreurs);
      return;
    }

    const nomVoiture = voitures.nom(voiture);
    const remplace = analyse.evenementsActuels > 0;
    const confirme = await ui.fenetre({
      titre: remplace ? `Remplacer les entretiens de la ${nomVoiture} ?` : `Importer les entretiens de la ${nomVoiture} ?`,
      contenu: resume(nomVoiture, analyse),
      libelleValider: remplace ? 'Remplacer' : 'Importer',
      danger: remplace
    });
    if (!confirme) return;
    await echange.importer(voiture, analyse);
    ui.toast(`Import terminé : ${format.pluriel(analyse.evenements.length, 'événement')}, ${format.pluriel(analyse.nombreEntretiens, 'entretien')}.`);
    EV.routeur.afficher();
  }

  EV.echangeCsv = { exporter, importer };
})(window.EV = window.EV || {});
