/* Échange des entretiens d'une voiture avec un tableur (fichier CSV) : export du modèle rempli, et import.
   Une ligne du fichier = un entretien. Les lignes qui ont la même date, le même kilométrage et la même société
   forment un seul événement. Les colonnes de l'ancien tableur (Élément, Observation…) sont aussi reconnues. */
(function (EV) {
  'use strict';

  const { csv, format, stockage, voitures, categories, evenements } = EV;

  const COLONNES = ['Date', 'Kilométrage', 'Société', 'Catégorie', 'Détail', 'Coût TTC'];

  // Titres de colonnes reconnus à l'import, une fois les accents, majuscules et symboles retirés.
  const TITRES = {
    date: ['date'],
    km: ['kilometrage', 'km', 'kilometres', 'compteur'],
    societe: ['societe', 'garage'],
    categorie: ['categorie'],
    detail: ['detail', 'details', 'element', 'elements', 'description', 'entretien', 'travaux'],
    observation: ['observation', 'observations', 'commentaire', 'commentaires', 'remarque', 'remarques'],
    cout: ['cout ttc', 'cout', 'prix', 'prix ttc', 'montant', 'montant ttc']
  };

  // « Coût TTC (€) » → « cout ttc ».
  function normaliser(texte) {
    return String(texte ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Dates écrites par Excel : « 5/6/2021 » ou « 05/06/21 » → « 05/06/2021 ».
  function dateComplete(texte) {
    const morceaux = texte.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/);
    if (!morceaux) return texte;
    let annee = morceaux[3];
    if (annee.length === 2) annee = (Number(annee) <= new Date().getFullYear() % 100 ? '20' : '19') + annee;
    return `${morceaux[1].padStart(2, '0')}/${morceaux[2].padStart(2, '0')}/${annee}`;
  }

  // Ce qui identifie un événement dans le fichier : sa date, son kilométrage et sa société.
  function cle({ date, km, garage }) {
    return `${date || ''}|${km ?? ''}|${(garage || '').toLocaleLowerCase('fr')}`;
  }

  function nomFichier(voiture) {
    return `Entretiens ${voiture.plaque} ${voitures.nom(voiture)}.csv`.replace(/[\\/:*?"<>|]+/g, '-');
  }

  // Le modèle rempli : une ligne par entretien, du plus récent au plus ancien.
  async function versCsv(voiture) {
    const [liste, listeCategories] = await Promise.all([evenements.parVoiture(voiture.id), categories.liste()]);
    const noms = Object.fromEntries(listeCategories.map((c) => [c.id, c.nom]));
    const lignes = [COLONNES];
    liste.forEach((evenement) => evenement.lignes.forEach((ligne, rang) => {
      // Un coût global est écrit sur la première ligne seulement : à l'import, il redevient le coût global.
      const cout = evenement.modeCout === 'detail' ? ligne.cout : (rang === 0 ? evenement.coutGlobal : null);
      lignes.push([format.date(evenement.date), evenement.km ?? '', evenement.garage || '', noms[ligne.categorieId] || '',
        evenements.texteDetail(ligne), format.montantSaisie(cout)]);
    }));
    return csv.ecrire(lignes);
  }

  // Lit le texte d'un fichier CSV destiné à remplacer les entretiens de la voiture.
  // Renvoie les erreurs trouvées (avec le numéro de ligne du tableur), ou tout ce qu'il faut pour l'import
  // et pour le résumé que l'utilisateur confirme.
  async function analyser(texte, voiture) {
    const tableau = csv.lire(texte);
    const colonne = {};
    const colonnesIgnorees = [];
    (tableau[0] || []).forEach((titre, rang) => {
      const nom = normaliser(titre);
      const champ = Object.keys(TITRES).find((c) => TITRES[c].includes(nom));
      if (champ && colonne[champ] === undefined) colonne[champ] = rang;
      else if (nom) colonnesIgnorees.push(titre.trim());
    });
    if (colonne.detail === undefined && colonne.categorie === undefined) {
      return { erreurs: [`La première ligne du fichier doit donner le titre des colonnes : ${COLONNES.join(', ')}. Le plus simple est de partir du fichier obtenu avec l'icône Exporter.`] };
    }

    const parNom = new Map((await categories.liste()).map((c) => [categories.cle(c.nom), c]));
    const nouvellesCategories = [];
    const groupes = new Map();
    const erreurs = [];

    tableau.slice(1).forEach((cellules, rang) => {
      if (cellules.every((c) => !c.trim())) return; // ligne vide
      const numero = rang + 2; // numéro de la ligne dans le tableur : la ligne 1 porte les titres
      // Case vide, « ????? » ou « - » : valeur inconnue.
      const valeur = (champ) => {
        const texteCase = colonne[champ] === undefined ? '' : String(cellules[colonne[champ]] ?? '').trim();
        return /^[?\-–—]*$/.test(texteCase) ? '' : texteCase;
      };

      const date = format.lireDate(dateComplete(valeur('date')));
      if (Number.isNaN(date)) {
        erreurs.push(`Ligne ${numero} : date « ${valeur('date')} » illisible. Écrivez-la au format JJ/MM/AAAA, ou laissez la case vide.`);
        return;
      }
      const km = format.lireKm(valeur('km'));
      if (Number.isNaN(km)) {
        erreurs.push(`Ligne ${numero} : kilométrage « ${valeur('km')} » illisible. Écrivez-le en chiffres, ou laissez la case vide.`);
        return;
      }
      const garage = valeur('societe').replace(/\s+/g, ' ');
      const nomCategorie = valeur('categorie').replace(/\s+/g, ' ');
      let categorie = null;
      if (nomCategorie) {
        categorie = parNom.get(categories.cle(nomCategorie));
        if (!categorie) {
          categorie = { id: stockage.nouvelId(), nom: nomCategorie };
          parNom.set(categories.cle(nomCategorie), categorie);
          nouvellesCategories.push(categorie);
        }
      }
      const groupe = cle({ date, km, garage });
      if (!groupes.has(groupe)) groupes.set(groupe, { date, km, garage, lignes: [] });
      groupes.get(groupe).lignes.push({
        numero,
        categorieId: categorie ? categorie.id : '',
        detail: [valeur('detail'), valeur('observation')].filter(Boolean).join('\n'),
        cout: valeur('cout')
      });
    });

    // Chaque groupe de lignes devient un événement, vérifié comme une saisie du formulaire.
    const lus = [];
    groupes.forEach(({ date, km, garage, lignes }) => {
      const avecCout = lignes.map((ligne, rang) => (ligne.cout ? rang : -1)).filter((rang) => rang >= 0);
      // Un seul coût, sur la première ligne : c'est le coût de tout l'événement (comme à l'export).
      const global = lignes.length === 1 || avecCout.length === 0 || (avecCout.length === 1 && avecCout[0] === 0);
      const verification = evenements.verifier({
        voitureId: voiture.id,
        date: date || '',
        km: km === null ? '' : String(km),
        garage,
        modeCout: global ? 'global' : 'detail',
        coutGlobal: global ? lignes[0].cout : '',
        lignes: lignes.map((ligne) => ({ categorieId: ligne.categorieId, detail: ligne.detail, cout: global ? '' : ligne.cout }))
      });
      const coutIllisible = (ligne) => `Ligne ${ligne.numero} : coût « ${ligne.cout} » illisible. Écrivez un montant, par exemple 84,90.`;
      if (verification.erreurs.coutGlobal) erreurs.push(coutIllisible(lignes[0]));
      verification.erreursLignes.forEach((erreur, rang) => {
        if (erreur.cout) erreurs.push(coutIllisible(lignes[rang]));
        if (erreur.categorie) erreurs.push(`Ligne ${lignes[rang].numero} : indiquez le détail de l'entretien ou sa catégorie.`);
      });
      lus.push({ ...verification.valeurs, id: stockage.nouvelId() });
    });
    erreurs.sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    if (!erreurs.length && !lus.length) erreurs.push('Le fichier ne contient aucun entretien.');

    return {
      erreurs,
      evenements: lus,
      nombreEntretiens: lus.reduce((somme, ev) => somme + ev.lignes.length, 0),
      evenementsActuels: (await evenements.parVoiture(voiture.id)).length,
      nouvellesCategories,
      colonnesIgnorees
    };
  }

  // Remplace les entretiens de la voiture par ceux du fichier analysé.
  function importer(voiture, analyse) {
    return stockage.remplacerEvenements(voiture.id, analyse.evenements, { categories: analyse.nouvellesCategories });
  }

  EV.echange = { COLONNES, nomFichier, versCsv, analyser, importer };
})(window.EV = window.EV || {});
