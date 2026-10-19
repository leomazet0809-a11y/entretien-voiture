/* Champ « Rechercher » (onglet Entretiens de la fiche voiture) et son panneau de résultats.
   La recherche porte sur toutes les données : toutes les voitures, entretiens et relevés. */
(function (EV) {
  'use strict';

  const { ui, format, voitures, recherche } = EV;
  const MAXI_PAR_GROUPE = 20;

  // Texte sur une ligne, raccourci : les retours à la ligne du détail deviennent des « · ».
  function extrait(texte, longueur) {
    const ligne = String(texte || '').replace(/\s*\n+\s*/g, ' · ').trim();
    return ligne.length > longueur ? `${ligne.slice(0, longueur - 1)}…` : ligne;
  }

  function element(type, id, titre, detail, plaque, icone = '') {
    return `
      <li>
        <button type="button" class="resultat" data-type="${type}" data-id="${id}">
          ${icone ? `<span class="resultat-icone">${ui.icone(icone, 18)}</span>` : ''}
          <span class="resultat-textes">
            <span class="resultat-titre">${titre}</span>
            ${detail ? `<span class="resultat-detail">${detail}</span>` : ''}
          </span>
          ${plaque ? `<span class="resultat-plaque">${ui.echapper(plaque)}</span>` : ''}
        </button>
      </li>`;
  }

  function groupe(titre, liste, rendre) {
    if (liste.length === 0) return '';
    const reste = liste.length - MAXI_PAR_GROUPE;
    return `
      <section class="resultats-groupe">
        <h3>${titre} <span>${liste.length}</span></h3>
        <ul>${liste.slice(0, MAXI_PAR_GROUPE).map(rendre).join('')}</ul>
        ${reste > 0 ? `<p class="resultats-reste">… et ${reste} autres : précisez la recherche.</p>` : ''}
      </section>`;
  }

  function rendre(trouve, requete) {
    const { mots, resultats, total, voituresParId, nomsCategories } = trouve;
    if (total === 0) {
      return `<p class="resultats-vide">Aucun résultat pour « ${ui.echapper(requete.trim())} ». Essayez une plaque, une société, une pièce ou une date.</p>`;
    }
    const s = (texte) => recherche.surligner(texte, mots);
    const libelleEvenement = (ev) => [ev.date ? format.date(ev.date) : 'Date inconnue', ev.garage, format.km(ev.km)].filter(Boolean).join(' · ');

    return `
      <p class="resultats-resume" aria-live="polite">${format.pluriel(total, 'résultat')}</p>
      ${groupe('Voitures', resultats.voitures, (v) => element('voiture', v.id,
        `${s(v.plaque)} · ${s(voitures.nom(v))}`, v.annee ? s(`Année ${v.annee}`) : '', '', 'cle'))}
      ${groupe('Entretiens', resultats.entretiens, (ev) => element('evenement', ev.id,
        s(libelleEvenement(ev)),
        s(extrait(ev.lignes.map((l) => [nomsCategories[l.categorieId], l.detail, l.commentaire].filter(Boolean).join(' — ')).join(' / '), 160)),
        voituresParId[ev.voitureId].plaque))}
      ${groupe('Kilométrage', resultats.releves, (r) => element('releve', r.id,
        s(`${format.date(r.date)} · ${format.km(r.km)}`), 'Relevé kilométrique', voituresParId[r.voitureId].plaque, 'compteur'))}`;
  }

  function champ() {
    return `
      <div class="recherche" role="search">
        <div class="recherche-saisie">
          <span class="recherche-icone" aria-hidden="true">${ui.icone('recherche')}</span>
          <label class="masque" for="champ-recherche">Rechercher dans toutes les données</label>
          <input id="champ-recherche" type="search" placeholder="Rechercher" autocomplete="off" enterkeyhint="search">
        </div>
        <div class="recherche-panneau" id="panneau-recherche" hidden></div>
      </div>`;
  }

  // Un clic en dehors du champ et de ses résultats ferme le panneau.
  document.addEventListener('pointerdown', (e) => {
    const zone = document.querySelector('.recherche');
    if (zone && !zone.contains(e.target)) zone.querySelector('.recherche-panneau').hidden = true;
  });

  // Branche le champ créé par champ(), une fois inséré dans la page.
  function brancher(racine) {
    const saisie = racine.querySelector('#champ-recherche');
    const panneau = racine.querySelector('#panneau-recherche');
    let dernier = null; // dernière recherche affichée, pour retrouver ce qui est cliqué
    let numero = 0;
    let minuterie = null;

    function fermer() {
      panneau.hidden = true;
    }

    async function lancer() {
      const requete = saisie.value;
      const longueur = requete.trim().length;
      if (longueur === 0) {
        fermer();
        return;
      }
      if (longueur < 2) {
        panneau.innerHTML = '<p class="resultats-vide">Tapez au moins 2 caractères.</p>';
        panneau.hidden = false;
        return;
      }
      const ceNumero = ++numero;
      const trouve = await recherche.chercher(requete);
      if (ceNumero !== numero || saisie.value !== requete) return; // une frappe plus récente a pris le relais
      dernier = trouve;
      panneau.innerHTML = rendre(trouve, requete);
      panneau.hidden = false;
    }

    function ouvrir(bouton) {
      const { type, id } = bouton.dataset;
      const { resultats } = dernier;
      fermer();
      saisie.blur();
      if (type === 'voiture') {
        location.hash = `voiture/${id}`;
      } else if (type === 'evenement') {
        const ev = resultats.entretiens.find((e) => e.id === id);
        EV.evenementSignale = id;
        const cible = `voiture/${ev.voitureId}`;
        if (location.hash.replace(/^#/, '') === cible) EV.routeur.afficher();
        else location.hash = cible;
      } else if (type === 'releve') {
        location.hash = `voiture/${resultats.releves.find((r) => r.id === id).voitureId}/km`;
      }
    }

    saisie.addEventListener('input', () => {
      clearTimeout(minuterie);
      minuterie = setTimeout(lancer, 120);
    });
    saisie.addEventListener('focus', lancer);
    saisie.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        saisie.value = '';
        fermer();
        saisie.blur();
      } else if (e.key === 'ArrowDown') {
        const premier = panneau.querySelector('.resultat');
        if (premier && !panneau.hidden) {
          e.preventDefault();
          premier.focus();
        }
      } else if (e.key === 'Enter') {
        const premier = panneau.querySelector('.resultat');
        if (premier && !panneau.hidden) ouvrir(premier);
      }
    });

    panneau.addEventListener('click', (e) => {
      const bouton = e.target.closest('.resultat');
      if (bouton) ouvrir(bouton);
    });
    panneau.addEventListener('keydown', (e) => {
      const boutons = [...panneau.querySelectorAll('.resultat')];
      const rang = boutons.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && rang < boutons.length - 1) boutons[rang + 1].focus();
      else if (e.key === 'ArrowUp') (rang > 0 ? boutons[rang - 1] : saisie).focus();
      else if (e.key === 'Escape') { fermer(); saisie.focus(); }
      else return;
      e.preventDefault();
    });
  }

  EV.panneauRecherche = { champ, brancher };
})(window.EV = window.EV || {});
