# Mois à venir — correction de fluidité et animations des modules

Révision précédente : `c8c3f1deccbc06e9c38dcc8f46026a75163da223`.
Cible : PC. Ce compte rendu remplace les choix de mouvement du rapport de scène
précédent ; les données, calculs et actions métier restent ceux du produit existant.

## Correction du mouvement

L'ancienne scène recalculait des tokens hérités à chaque frame : blur, ombres,
gaps, couleurs, compression verticale et déplacement compensé du header.
Ces changements combinaient du travail de peinture/layout et plusieurs mouvements
concurrents au passage en sticky. Ces chemins ont été retirés.

- Header : texte à son échelle normale, sortie naturelle avec retrait de 12 px
  et légère baisse d'opacité ; suppression du grand backdrop du header en mouvement.
- Toolbar : position sticky native, aucune animation de sa position, filtre
  constant `blur(20px) saturate(94%)`, gap constant de 6 px, rim sans second blur.
- Fond : animation CSS native sur la timeline de scroll, de 1.04 à 1 avec
  translation maximale de -16 px ; pose figée après le verrouillage.
- Fallback : uniquement transform/opacity sur les éléments concernés, avec RAF.
- Géométrie et positions des sections mises en cache au montage/resize et lors
  des changements de contenu ; un seul listener passif de scroll, aucun état
  React par pixel ni token hérité changé par frame dans le chemin natif.

Les choix suivent les recommandations [web.dev sur les animations performantes](https://web.dev/articles/animations-guide)
et la [documentation des timelines de scroll](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline/scroll).

## Animations ajoutées

Une seule pastille violette accompagne la section courante. Elle se déplace et
s'étire légèrement en transform (420–560 ms). Un changement rapide repart de
sa pose affichée, puis converge vers le nouvel onglet sans duplication.
Le suivi utilise les positions réelles des sections, y compris dans les zones
sans titre visible et après ouverture d'un accordéon.

Les titres, ressources, contenus de charges, cartes du quotidien/extras et
scénarios de projection reçoivent une entrée de 12 px, 480 ms, avec léger
stagger de 0–135 ms. L'IntersectionObserver la déclenche une seule fois.
Les grandes surfaces de verre ne sont pas déplacées. Le contenu est visible
par défaut et les animations terminées sont libérées. Les chiffres ne sont
jamais interpolés. Reduced motion annule les animations et les reveals actifs.

Le reflet de verrouillage reste unique ; le snap qui déplaçait la barre a disparu.
L'occlusion conserve le même fond que la scène et les ancres gardent une marge
de 20 px sous la toolbar.

## Vérifications réalisées

Version compilée locale (`next start`, pas de HMR), navigateur PC existant :

- Scroll Ressources → Charges et retour : sélection correcte, une seule pastille.
- Clics rapides Charges → Projection : interruption et destination correctes.
- Toolbar à 8 px ; transform `none`, filtre et gap inchangés pendant le scroll.
- Fond initial 1.04/0, à mi-parcours environ 1.0197/-8.10, verrouillé 1/-16.
- Header à mi-parcours : matrice d'échelle 1/1, translation -6.08 px.
- Ouverture Maison puis ancre Calendrier : cible à 98.27 px,
  bas de toolbar à 77.85 px ; suivi correct après changement de hauteur.
- Projection et Quotidien : contenu visible, ancres accessibles.
- CTA : Builder ouvert et fermé sans enregistrement.
- Aucun overlay d'erreur ni erreur console. Aucun test n'écrit en base.
- `tsc --noEmit` : PASS après correction d'un type optionnel.
- `check-architecture-imports.mjs` : PASS (733 fichiers).
- `next build` : PASS (Next.js 16.2.6, TypeScript inclus).
- `git diff --check` : PASS. Lint non configuré dans ce dépôt.

Cette vérification contrôle le comportement et les poses du scroll ; ce n'est
pas un benchmark FPS. Le fallback et reduced motion ont été relus dans le code,
sans changer la préférence système ou la version du navigateur.

Capture hors Git :
`C:/Users/Manon/Documents/Codex/2026-09-28/ve/outputs/planned-fluid-navigation.jpg`.
Aucun contrôle du déploiement Vercel revendiqué.

## Fichiers

`app-shell.tsx`, `month-section-nav.tsx`, `use-planned-scroll-scene.ts`,
`use-planned-content-motion.ts`, `planned-scroll-scene.module.css`,
`month-material.module.css`, `month-story.tsx`, `resource-editor.tsx`,
`month-narrative-cards.tsx`, et ce rapport.
