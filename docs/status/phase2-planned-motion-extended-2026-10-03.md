# Mois à venir — animations enrichies (PC)

Base : `0dac8c2d95d3f2a6f5523b369fb6e4b7818bc174`.

## Changements

- Déplacement liquide partagé entre navigation, filtres du calendrier et scénarios.
  Une seule pastille par groupe ; une interruption reprend sa pose affichée.
  Les mesures utilisent les dimensions et bordures fractionnaires réelles.
- Entrées distinctes des titres, ressources, charges, projets, semaines et scénarios :
  380–620 ms, décalage progressif limité à 180 ms. Déclenchement unique par visibilité.
- Calendrier : transition du contenu filtré en 300 ms, géométrie des semaines
  conservée, apparition du lien « Prévoir » et liseré au survol/focus.
  Le bouton « + autres » est en bloc pour éviter le supplément de hauteur de sa ligne.
- Cartes : reflet contenu, icônes des charges légèrement animées, projet soulevé
  de 3 px, image agrandie à 1.035, chevron tournant à l'ouverture.
  L'attribution photo reste lisible et à son échelle normale.
- Scénarios : sélection liquide et nouvelle entrée du résultat à chaque choix.
- Barre : progression discrète sur timeline CSS native et reflet du bouton principal.
  Sa position sticky, son flou et ses espacements restent constants au scroll.

Les effets ne déplacent pas les grandes surfaces floutées. Pas de nouvelle
dépendance, de boucle d'animation permanente ou d'état React par pixel.
Les préférences de mouvement réduit annulent les déplacements et les entrées.
Les calculs, données, actions serveur et règles de domaine restent inchangés.

## Vérification

Version finale compilée locale (`next start --port 3000`), navigateur PC :

- Tout → Projets → Charges → Tout : une seule pastille, alignement final x/y/largeur à 0 px.
- Hauteurs des cinq semaines identiques pour les trois filtres : 98 / 82 / 74 / 82 / 66 px.
- Filtre Projets : un événement pour l'unique projet existant ; détails du jour ouverts/fermés.
- Projet : ouverture/fermeture, zoom 1.035, déplacement -3 px et chevron à 180° observés.
- Courses → Tabac : simulations temporaires, sélection correcte, pastille alignée ; fermeture.
  Aucun bouton d'enregistrement ni action sur les données n'a été exécuté.
- Scroll réel : toolbar à 8 px, transform `none`, flou `blur(20px) saturate(0.94)`.
  Progression sur `scroll(root)` ; changements rapides de section vérifiés.
- Console : aucune erreur.
- TypeScript (`tsc --noEmit`, puis TypeScript du build final) : PASS.
- `node scripts/check-architecture-imports.mjs` : PASS, 735 fichiers.
- `node scripts/check-phase2-planned-calendar.mjs` : PASS, harness en mémoire.
- `node node_modules/next/dist/bin/next build` : PASS, Next.js 16.2.6.
- `git diff --check` : PASS.

Le contrôle navigateur vérifie les comportements et les poses ; aucun benchmark
FPS ni contrôle Vercel n'est revendiqué. Mouvement réduit et fallback relus dans
le code sans changer les préférences système. Pas de campagne responsive.

Capture hors Git :
`C:/Users/Manon/Documents/Codex/2026-09-28/ve/outputs/planned-extended-motion.jpg`.
