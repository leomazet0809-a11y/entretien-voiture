/* Recherche dans toutes les données : voitures, entretiens et relevés kilométriques.
   Majuscules et accents ignorés ; plusieurs mots = tous doivent être trouvés. */
(function (EV) {
  'use strict';

  const { stockage, format, voitures, evenements } = EV;
  const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  // « Révision » → « revision » ; les espaces insécables deviennent des espaces simples.
  function normaliser(texte) {
    return String(texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[  ]/g, ' ');
  }

  function motsDe(requete) {
    return normaliser(requete).split(/\s+/).filter(Boolean);
  }

  // Les différentes façons d'écrire une date, un kilométrage ou un montant.
  function variantesDate(iso) {
    if (!iso) return [];
    const [annee, mois, jour] = iso.split('-').map(Number);
    return [iso, format.date(iso), DATE_LONGUE.format(new Date(Date.UTC(annee, mois - 1, jour)))];
  }

  function variantesKm(km) {
    return km === null || km === undefined ? [] : [String(km), format.km(km)];
  }

  function variantesMontant(centimes) {
    return centimes === null || centimes === undefined ? [] : [format.montant(centimes), String(Math.floor(centimes / 100))];
  }

  function texte(...morceaux) {
    return normaliser(morceaux.flat().filter((m) => m !== null && m !== undefined && m !== '').join(' \n '));
  }

  // Un élément correspond si chaque mot se trouve dans son propre texte ou dans son contexte,
  // et qu'au moins un mot est dans son propre texte (« renault » seul ne liste pas tous les entretiens de la Renault).
  function correspond(mots, propre, contexte = '') {
    return mots.every((m) => propre.includes(m) || contexte.includes(m)) && mots.some((m) => propre.includes(m));
  }

  async function chercher(requete) {
    const mots = motsDe(requete);
    if (mots.length === 0) return null;

    const [listeVoitures, listeEvenements, releves, listeCategories] = await Promise.all([
      voitures.liste(), stockage.tous('evenements'), stockage.tous('releves'), stockage.tous('categories')
    ]);
    const nomsCategories = Object.fromEntries(listeCategories.map((c) => [c.id, c.nom]));
    const voituresParId = Object.fromEntries(listeVoitures.map((v) => [v.id, v]));

    const texteVoiture = {};
    listeVoitures.forEach((v) => {
      texteVoiture[v.id] = texte(v.plaque, v.plaque.replace(/[^A-Z0-9]/gi, ''), v.marque, v.modele, v.annee);
    });

    const texteEvenement = (ev) => texte(
      variantesDate(ev.date), variantesKm(ev.km), ev.garage, variantesMontant(evenements.total(ev)),
      ev.lignes.map((l) => [nomsCategories[l.categorieId], l.detail, l.commentaire, variantesMontant(l.cout)])
    );

    const parDate = (a, b) => (b.date || '').localeCompare(a.date || '');

    const resultats = {
      voitures: listeVoitures.filter((v) => correspond(mots, texteVoiture[v.id])),
      entretiens: listeEvenements
        .filter((ev) => voituresParId[ev.voitureId] && correspond(mots, texteEvenement(ev), texteVoiture[ev.voitureId]))
        .sort(parDate),
      // Les relevés tirés des entretiens sont déjà trouvés avec leur entretien.
      releves: releves
        .filter((r) => r.source !== 'evenement' && voituresParId[r.voitureId])
        .filter((r) => correspond(mots, texte(variantesDate(r.date), variantesKm(r.km), 'relevé kilométrage'), texteVoiture[r.voitureId]))
        .sort(parDate)
    };
    const total = Object.values(resultats).reduce((somme, liste) => somme + liste.length, 0);
    return { mots, resultats, total, voituresParId, nomsCategories };
  }

  // Met en évidence les mots trouvés dans un texte, sans tenir compte des accents ni des majuscules.
  // Renvoie du HTML sûr : le texte est échappé, seules les balises <mark> sont ajoutées.
  function surligner(texteOriginal, mots) {
    const original = String(texteOriginal ?? '');
    let normalise = '';
    const position = []; // position dans le texte original de chaque caractère normalisé
    for (let i = 0; i < original.length; i++) {
      for (const caractere of normaliser(original[i])) {
        normalise += caractere;
        position.push(i);
      }
    }
    const zones = [];
    mots.forEach((mot) => {
      for (let i = normalise.indexOf(mot); i !== -1; i = normalise.indexOf(mot, i + mot.length)) {
        zones.push([position[i], position[i + mot.length - 1] + 1]);
      }
    });
    zones.sort((a, b) => a[0] - b[0]);
    let html = '';
    let curseur = 0;
    zones.forEach(([debut, fin]) => {
      if (fin <= curseur) return;
      debut = Math.max(debut, curseur);
      html += EV.ui.echapper(original.slice(curseur, debut)) + `<mark>${EV.ui.echapper(original.slice(debut, fin))}</mark>`;
      curseur = fin;
    });
    return html + EV.ui.echapper(original.slice(curseur));
  }

  EV.recherche = { chercher, surligner, normaliser };
})(window.EV = window.EV || {});
