/* Courbe du kilométrage dans le temps (SVG dessiné à la main, sans bibliothèque).
   Une seule série : pas de légende, le titre dit ce qui est tracé. Survol et clavier : repère vertical + bulle. */
(function (EV) {
  'use strict';

  const { format } = EV;
  const NOMBRE = new Intl.NumberFormat('fr-FR');
  const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' });

  // Graduations « rondes » (1, 2, 2,5 ou 5 × 10ⁿ) qui encadrent les valeurs.
  function graduations(min, max, nombreVoulu = 4) {
    if (min === max) {
      min -= 1000;
      max += 1000;
    }
    const brut = (max - min) / nombreVoulu;
    const puissance = 10 ** Math.floor(Math.log10(brut));
    const pas = [1, 2, 2.5, 5, 10].map((f) => f * puissance).find((p) => p >= brut);
    const debut = Math.floor(min / pas) * pas;
    const fin = Math.ceil(max / pas) * pas;
    const valeurs = [];
    for (let v = debut; v <= fin + pas / 2; v += pas) valeurs.push(v);
    return { debut, fin, valeurs };
  }

  // Repères de l'axe du temps : chaque 1er janvier sur une longue période, sinon des débuts de mois.
  function reperesTemps(jourMin, jourMax) {
    const debut = new Date(jourMin * 86400000);
    const fin = new Date(jourMax * 86400000);
    const duree = jourMax - jourMin;
    const reperes = [];
    if (duree >= 540) {
      const pasAnnees = Math.max(1, Math.ceil(duree / 365 / 6));
      for (let a = debut.getUTCFullYear() + 1; a <= fin.getUTCFullYear(); a += pasAnnees) {
        reperes.push({ jour: Date.UTC(a, 0, 1) / 86400000, libelle: String(a) });
      }
    } else {
      const pasMois = Math.max(1, Math.ceil(duree / 30 / 6));
      let annee = debut.getUTCFullYear();
      let mois = debut.getUTCMonth() + 1;
      for (;;) {
        if (mois > 11) { annee += Math.floor(mois / 12); mois %= 12; }
        const jour = Date.UTC(annee, mois, 1) / 86400000;
        if (jour > jourMax) break;
        reperes.push({ jour, libelle: MOIS.format(new Date(jour * 86400000)) });
        mois += pasMois;
      }
    }
    return reperes;
  }

  function dessiner(conteneur, points) {
    const largeur = Math.max(280, Math.round(conteneur.clientWidth));
    const etroit = largeur < 520;
    const hauteur = etroit ? 220 : 280;
    const marge = { haut: 28, droite: 16, bas: 30, gauche: etroit ? 58 : 66 };
    const l = largeur - marge.gauche - marge.droite;
    const h = hauteur - marge.haut - marge.bas;

    const jours = points.map((p) => EV.kilometrage.jours(p.date));
    let jourMin = Math.min(...jours);
    let jourMax = Math.max(...jours);
    if (jourMin === jourMax) { jourMin -= 15; jourMax += 15; }
    const axeY = graduations(Math.min(...points.map((p) => p.km)), Math.max(...points.map((p) => p.km)), etroit ? 3 : 4);
    const x = (jour) => marge.gauche + ((jour - jourMin) / (jourMax - jourMin)) * l;
    const y = (km) => marge.haut + h - ((km - axeY.debut) / (axeY.fin - axeY.debut)) * h;
    const positions = points.map((p, i) => ({ ...p, px: x(jours[i]), py: y(p.km) }));

    const grille = axeY.valeurs.map((v) => `
      <line class="graphique-grille" x1="${marge.gauche}" x2="${largeur - marge.droite}" y1="${y(v)}" y2="${y(v)}"></line>
      <text class="graphique-texte" x="${marge.gauche - 8}" y="${y(v)}" dy="0.32em" text-anchor="end">${NOMBRE.format(v)}</text>`).join('');
    const reperes = reperesTemps(jourMin, jourMax).filter((r) => x(r.jour) > marge.gauche + 12 && x(r.jour) < largeur - marge.droite - 12);
    const axeX = reperes.map((r) => `
      <line class="graphique-graduation" x1="${x(r.jour)}" x2="${x(r.jour)}" y1="${marge.haut + h}" y2="${marge.haut + h + 4}"></line>
      <text class="graphique-texte" x="${x(r.jour)}" y="${hauteur - 8}" text-anchor="middle">${r.libelle}</text>`).join('');

    const trace = positions.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');
    const aire = positions.length > 1
      ? `<path class="graphique-aire" d="${trace} L${positions.at(-1).px.toFixed(1)},${marge.haut + h} L${positions[0].px.toFixed(1)},${marge.haut + h} Z"></path>`
      : '';
    const dernier = positions.at(-1);
    const etiquetteAGauche = dernier.px > largeur - 120;

    conteneur.innerHTML = `
      <svg class="graphique-svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}" tabindex="0" role="img"
        aria-label="Courbe du kilométrage : de ${format.km(points[0].km)} le ${format.date(points[0].date)} à ${format.km(dernier.km)} le ${format.date(dernier.date)}. Survolez ou utilisez les flèches pour lire chaque relevé.">
        ${grille}
        <line class="graphique-axe" x1="${marge.gauche}" x2="${largeur - marge.droite}" y1="${marge.haut + h}" y2="${marge.haut + h}"></line>
        ${axeX}
        ${aire}
        ${positions.length > 1 ? `<path class="graphique-ligne" d="${trace}"></path>` : ''}
        <line class="graphique-repere" y1="${marge.haut}" y2="${marge.haut + h}" visibility="hidden"></line>
        ${positions.map((p, i) => `<circle class="graphique-point${i === positions.length - 1 ? ' graphique-point-fin' : ''}" cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="${i === positions.length - 1 ? 5 : 4}"></circle>`).join('')}
        <text class="graphique-texte graphique-etiquette" x="${dernier.px + (etiquetteAGauche ? -10 : 10)}" y="${dernier.py - 12}" text-anchor="${etiquetteAGauche ? 'end' : 'start'}">${format.km(dernier.km)}</text>
        <rect class="graphique-zone" x="${marge.gauche}" y="0" width="${l}" height="${hauteur}"></rect>
      </svg>
      <div class="graphique-bulle" hidden><strong></strong><span></span></div>`;

    // Survol et clavier : le repère se cale sur le relevé le plus proche.
    const svg = conteneur.querySelector('svg');
    const repere = svg.querySelector('.graphique-repere');
    const cercles = [...svg.querySelectorAll('.graphique-point')];
    const bulle = conteneur.querySelector('.graphique-bulle');
    let actif = -1;

    function montrer(index) {
      actif = index;
      const p = positions[index];
      repere.setAttribute('x1', p.px);
      repere.setAttribute('x2', p.px);
      repere.setAttribute('visibility', 'visible');
      cercles.forEach((c, i) => c.classList.toggle('graphique-point-actif', i === index));
      bulle.querySelector('strong').textContent = format.km(p.km);
      bulle.querySelector('span').textContent = `${format.date(p.date)} · ${p.origine}`;
      bulle.hidden = false;
      const demiLargeur = bulle.offsetWidth / 2;
      bulle.style.left = `${Math.min(Math.max(p.px, demiLargeur + 4), largeur - demiLargeur - 4)}px`;
      bulle.style.top = `${p.py - 14}px`;
    }

    function cacher() {
      actif = -1;
      repere.setAttribute('visibility', 'hidden');
      cercles.forEach((c) => c.classList.remove('graphique-point-actif'));
      bulle.hidden = true;
    }

    svg.querySelector('.graphique-zone').addEventListener('pointermove', (e) => {
      const xSouris = e.clientX - svg.getBoundingClientRect().left;
      let proche = 0;
      positions.forEach((p, i) => { if (Math.abs(p.px - xSouris) < Math.abs(positions[proche].px - xSouris)) proche = i; });
      if (proche !== actif) montrer(proche);
    });
    svg.addEventListener('pointerleave', cacher);
    svg.addEventListener('focus', () => montrer(positions.length - 1));
    svg.addEventListener('blur', cacher);
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && actif > 0) montrer(actif - 1);
      else if (e.key === 'ArrowRight' && actif < positions.length - 1) montrer(actif + 1);
      else return;
      e.preventDefault();
    });
  }

  // Trace la courbe dans `conteneur` et la redessine quand sa largeur change.
  // `points` : [{ date, km, origine }] du plus ancien au plus récent.
  function courbeKm(conteneur, points) {
    let largeurPrecedente = 0;
    let affiche = false;
    const observateur = new ResizeObserver(() => {
      // L'écran est préparé hors de la page avant d'être montré : on attend qu'il y soit, et on s'arrête quand il la quitte.
      if (!conteneur.isConnected) {
        if (affiche) observateur.disconnect();
        return;
      }
      affiche = true;
      if (conteneur.clientWidth === 0 || Math.abs(conteneur.clientWidth - largeurPrecedente) < 2) return;
      largeurPrecedente = conteneur.clientWidth;
      dessiner(conteneur, points);
    });
    observateur.observe(conteneur);
  }

  EV.graphique = { courbeKm };
})(window.EV = window.EV || {});
