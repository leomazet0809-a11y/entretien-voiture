/* Fichiers CSV (tableur) : lecture et écriture.
   À la lecture, le séparateur (« ; », « , » ou tabulation) est deviné, et les cellules entre guillemets peuvent
   contenir des retours à la ligne. À l'écriture : « ; » et encodage UTF-8 avec marque d'en-tête, ce qu'Excel
   en français ouvre directement en colonnes, avec les accents. */
(function (EV) {
  'use strict';

  // Le séparateur le plus fréquent sur la première ligne, hors guillemets.
  function separateur(texte) {
    const compte = { ';': 0, ',': 0, '\t': 0 };
    let entreGuillemets = false;
    for (const c of texte) {
      if (c === '"') entreGuillemets = !entreGuillemets;
      else if (!entreGuillemets && (c === '\n' || c === '\r')) break;
      else if (!entreGuillemets && c in compte) compte[c] += 1;
    }
    return Object.keys(compte).reduce((a, b) => (compte[b] > compte[a] ? b : a), ';');
  }

  // Texte CSV → lignes du tableau, chacune étant la liste de ses cellules.
  function lire(texte) {
    const sep = separateur(texte);
    const lignes = [];
    let ligne = [];
    let cellule = '';
    let entreGuillemets = false;
    for (let i = 0; i < texte.length; i += 1) {
      const c = texte[i];
      if (entreGuillemets) {
        if (c !== '"') cellule += c;
        else if (texte[i + 1] === '"') { cellule += '"'; i += 1; }
        else entreGuillemets = false;
      } else if (c === '"') {
        entreGuillemets = true;
      } else if (c === sep) {
        ligne.push(cellule);
        cellule = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && texte[i + 1] === '\n') i += 1;
        ligne.push(cellule);
        lignes.push(ligne);
        ligne = [];
        cellule = '';
      } else {
        cellule += c;
      }
    }
    if (cellule !== '' || ligne.length) {
      ligne.push(cellule);
      lignes.push(ligne);
    }
    return lignes;
  }

  // Une cellule commençant par = + - @ serait prise pour une formule par le tableur :
  // une espace devant la garde en texte (elle est retirée à l'import).
  function cellule(valeur) {
    let texte = String(valeur ?? '');
    if (/^[=+\-@]/.test(texte)) texte = ` ${texte}`;
    return /[";\r\n]|^\s|\s$/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
  }

  function ecrire(lignes) {
    return `﻿${lignes.map((ligne) => ligne.map(cellule).join(';')).join('\r\n')}\r\n`;
  }

  // Contenu d'un fichier choisi par l'utilisateur : UTF-8, ou à défaut l'encodage des anciens fichiers Excel.
  async function lireFichier(fichier) {
    const octets = await fichier.arrayBuffer();
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(octets);
    } catch (e) {
      return new TextDecoder('windows-1252').decode(octets);
    }
  }

  EV.csv = { lire, ecrire, lireFichier };
})(window.EV = window.EV || {});
