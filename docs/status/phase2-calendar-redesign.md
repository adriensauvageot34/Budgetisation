# Refonte du calendrier mensuel — 30 septembre 2026

Brief appliqué : `CODEX_CALENDRIER_MONTH_UI_UX_REDESIGN.md`.
Base : `main`, commit `e9ee22d`.

## Livré

- Grille desktop de sept colonnes, un seul cadre, séparateurs légers. Semaines de
  76 px (vides), 86 px (ordinaires), 98 px (chargées), hauteur commune à chaque ligne.
- Événements sur une ligne : icône/logo local de 18 px, libellé court, coût brut au
  centime. Deux visibles au maximum ; les suivants restent accessibles dans le panneau.
- Priorité visuelle aux projets passés à confirmer, puis aux projets personnels.
  Échéances neutres, projets bleus, déclarations vertes avec ✓, confirmations ambre.
- Marques et libellés calculés dans la projection ; catégories, références et
  nombre d'observations de date transmis depuis les sources déjà disponibles.
  Aucun alias de personne ou de contrat n'est inventé. Les titres des projets sont conservés.
- Dates estimées marquées ≈ ; totaux mixtes marqués ◌. Le panneau sépare les
  montants positionnés à date précise et ceux positionnés à date estimée.
- Mois visible, filtres Tout/Projets/Charges, accès aux confirmations et aux projets
  à placer, aide repliée. Aujourd'hui utilise la date du fuseau du foyer.
- Jour vide → formulaire existant, date préremplie. Jour occupé → panneau avec
  création pour ce jour. Clic sur événement → focus sur son détail dans le panneau.
  Une navigation de création ne remplace pas un brouillon modifié déjà ouvert.
- Panneau centré sur le projet ; effet mensuel, financement, trajet, coûts et
  sources accessibles dans des sections repliables. Actions contextualisées et
  libellés partagés avec la liste.
- Deux zones distinctes : « À placer dans le calendrier » pour les projets,
  « Sans jour précis » pour les charges/objectifs mensuels sans date.

## Invariants conservés

Une racine prospective produit une seule occurrence ; aucun événement enfant.
Montants bruts, financement et impact mensuel restent distincts. Aucun revenu ou
jour fictif ajouté. Le moteur financier, les services de mutation, les contraintes
SQL, les RLS et les autorités historiques ne sont pas modifiés.
Aucune migration ni fixture Supabase écrite pour ce lot.

## Vérifications ciblées

| Vérification | Résultat |
| --- | --- |
| `node scripts/check-phase2-planned-calendar.mjs` | PASS |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node node_modules/next/dist/bin/next build` — version finale | PASS |
| `git diff --check` | PASS |
| Navigation locale serveur `/mois-a-venir` | HTTP 200 |
| Contrôle visuel / interactions navigateur | NOT_TESTED : navigateur intégré indisponible |

La suite calendrier couvre les centimes, les totaux mixtes, le seuil deux/+N,
les contrats distincts, l'absence d'alias inventé, la saillance des projets,
les actions passé/futur/réalisé, le marqueur aujourd'hui, le jour initial,
les six semaines, les éléments sans date, les preuves de date lorsqu'elles existent,
et les synchronisations création/modification/déclaration/correction/restauration/
report/suppression avec le serveur en mémoire. Les tests de navigation clavier
existants sont conservés. Aucun PASS navigateur n'est revendiqué.

L'ancienne attente statique de hauteur dans `check-phase2-post-v1-fixes.mjs` est
adaptée au nouveau contrat ; sa campagne complète n'est pas relancée dans ce lot.

## Contrôle manuel restant

1. Regarder la densité du mois, les contrats de même marque et les jours chargés.
2. Cliquer un jour vide, vérifier la date du formulaire ; fermer sans enregistrer.
3. Ouvrir un événement et « +N autres », vérifier le ciblage, les sections repliées,
   la fermeture du panneau et le retour de focus.

Assets locaux existants réutilisés ; pas de téléchargement de logo à chaque rendu.
Pas de chantier mobile, de nouvelle règle financière ou de vérification Vercel.
