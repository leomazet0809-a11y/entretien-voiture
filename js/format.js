/* Lecture et affichage des montants, kilométrages et dates, à la française. */
(function (EV) {
  'use strict';

  const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const NOMBRE = new Intl.NumberFormat('fr-FR');
  const KM_MAXI = 2000000;

  // « 84 », « 84,9 », « 1 234,50 € » → centimes (8400, 8490, 123450). Vide → null. Illisible → NaN.
  function lireMontant(texte) {
    const propre = String(texte ?? '').replace(/[\s  €]/g, '').replace(',', '.');
    if (propre === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(propre)) return NaN;
    return Math.round(parseFloat(propre) * 100);
  }

  // « 158 220 », « 158220 km » → 158220. Vide → null. Illisible → NaN.
  function lireKm(texte) {
    const propre = String(texte ?? '').replace(/km/gi, '').replace(/[\s  .]/g, '');
    if (propre === '') return null;
    if (!/^\d+$/.test(propre) || Number(propre) > KM_MAXI) return NaN;
    return Number(propre);
  }

  function montant(centimes) {
    return centimes === null || centimes === undefined ? '' : EUROS.format(centimes / 100);
  }

  // Valeur à remettre dans un champ de saisie : 8490 → « 84,90 ».
  function montantSaisie(centimes) {
    return centimes === null || centimes === undefined ? '' : (centimes / 100).toFixed(2).replace('.', ',');
  }

  function km(valeur) {
    return valeur === null || valeur === undefined ? '' : `${NOMBRE.format(valeur)} km`;
  }

  function kmSaisie(valeur) {
    return valeur === null || valeur === undefined ? '' : NOMBRE.format(valeur);
  }

  // « 2025-01-13 » → « 13/01/2025 ».
  function date(iso) {
    if (!iso) return '';
    const [annee, mois, jour] = iso.split('-');
    return `${jour}/${mois}/${annee}`;
  }

  // « 13/01/2025 » (ou « 2025-01-13 ») → « 2025-01-13 ». Vide → null. Illisible ou date impossible (31/02) → NaN.
  function lireDate(texte) {
    const propre = String(texte ?? '').trim();
    if (propre === '') return null;
    const francaise = propre.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const iso = propre.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!francaise && !iso) return NaN;
    const [jour, mois, annee] = francaise ? francaise.slice(1).map(Number) : iso.slice(1).reverse().map(Number);
    const verifiee = new Date(Date.UTC(annee, mois - 1, jour));
    if (annee < 1900 || annee > 2100 || verifiee.getUTCMonth() !== mois - 1 || verifiee.getUTCDate() !== jour) return NaN;
    return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
  }

  function aujourdhui() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function pluriel(nombre, mot) {
    return `${nombre} ${mot}${nombre > 1 ? 's' : ''}`;
  }

  // 250 880 octets → « 245 Ko » ; 3 355 443 → « 3,2 Mo ».
  function taille(octets) {
    if (octets < 1024) return `${octets} octets`;
    if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(octets / (1024 * 1024))} Mo`;
  }

  EV.format = { lireMontant, lireKm, lireDate, montant, montantSaisie, km, kmSaisie, date, aujourdhui, pluriel, taille };
})(window.EV = window.EV || {});
