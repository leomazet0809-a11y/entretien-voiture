/* Panneau de résultats sous le champ « Rechercher partout ». */
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
    const { mots, resultats, total, voituresParId, evenementsParId, nomsCategories } = trouve;
    if (total === 0) {
      return `<p class="resultats-vide">Aucun résultat pour « ${ui.echapper(requete.trim())} ». Essayez une plaque, un garage, une pièce ou une date.</p>`;
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
      ${groupe('Documents', resultats.documents, (d) => element('document', d.id,
        s(d.nom), s(`Événement : ${libelleEvenement(evenementsParId[d.evenementId])}`), voituresParId[d.voitureId].plaque, 'document'))}
      ${groupe('Kilométrage', resultats.releves, (r) => element('releve', r.id,
        s(`${format.date(r.date)} · ${format.km(r.km)}`), 'Relevé kilométrique', voituresParId[r.voitureId].plaque, 'compteur'))}`;
  }

  function brancher() {
    const champ = document.getElementById('champ-recherche');
    const panneau = document.getElementById('panneau-recherche');
    const zone = champ.closest('.recherche');
    let dernier = null; // dernière recherche affichée, pour retrouver ce qui est cliqué
    let numero = 0;
    let minuterie = null;

    function fermer() {
      panneau.hidden = true;
    }

    async function lancer() {
      const requete = champ.value;
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
      if (ceNumero !== numero || champ.value !== requete) return; // une frappe plus récente a pris le relais
      dernier = trouve;
      panneau.innerHTML = rendre(trouve, requete);
      panneau.hidden = false;
    }

    function ouvrir(bouton) {
      const { type, id } = bouton.dataset;
      const { resultats } = dernier;
      fermer();
      champ.blur();
      if (type === 'voiture') {
        location.hash = `voiture/${id}`;
      } else if (type === 'evenement') {
        const ev = resultats.entretiens.find((e) => e.id === id);
        EV.evenementSignale = id;
        const cible = `voiture/${ev.voitureId}`;
        if (location.hash.replace(/^#/, '') === cible) EV.routeur.afficher();
        else location.hash = cible;
      } else if (type === 'document') {
        EV.documents.ouvrir(resultats.documents.find((d) => d.id === id));
      } else if (type === 'releve') {
        location.hash = `voiture/${resultats.releves.find((r) => r.id === id).voitureId}/km`;
      }
    }

    champ.addEventListener('input', () => {
      clearTimeout(minuterie);
      minuterie = setTimeout(lancer, 120);
    });
    champ.addEventListener('focus', lancer);
    champ.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        champ.value = '';
        fermer();
        champ.blur();
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
      else if (e.key === 'ArrowUp') (rang > 0 ? boutons[rang - 1] : champ).focus();
      else if (e.key === 'Escape') { fermer(); champ.focus(); }
      else return;
      e.preventDefault();
    });

    document.addEventListener('pointerdown', (e) => {
      if (!zone.contains(e.target)) fermer();
    });
  }

  EV.panneauRecherche = { brancher };
})(window.EV = window.EV || {});
