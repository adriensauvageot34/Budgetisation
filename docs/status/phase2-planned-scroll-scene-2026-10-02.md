# Mois à venir — scène de scroll Liquid Glass

Date : 2026-10-02. Cible finale : PC, conformément à la dernière instruction utilisateur.

## Périmètre et fichiers

Travail de présentation uniquement, autour des composants existants. Aucun calcul,
montant, contrat serveur, action métier, migration ou écriture Supabase modifié.

- `src/components/layout/app-shell.tsx` : scène et header dédiés à `/mois-a-venir`.
- `src/app/mois-a-venir/use-planned-scroll-scene.ts` : progression et mesures.
- `src/app/mois-a-venir/planned-scroll-scene.module.css` : fond, lentille, verre,
  verrouillage, reflet et occlusion.
- `src/app/mois-a-venir/month-section-nav.tsx` : branchement sur les onglets/CTA
  existants ; suivi de section adapté à la hauteur réelle de la barre.
- `src/app/mois-a-venir/month-forecast-view.tsx` : marqueur de portée des ancres.
- `src/app/mois-a-venir/month-material.module.css` : retrait de l'ancien fond CSS.
- `public/planned-visuals/background-planned-depense.webp` : image fournie.

HEAD initial : `db8cf039524794446d7f2157501b55ce857423ad`.
Les commits distants `6220d0a` et `dc23f4a` ajoutant la même image ont été intégrés
par fast-forward avant le commit final. Le fichier distant sans extension
`background planned depense` devient le WebP nommé ci-dessus, sans doublon.
Les deux sources ont le même blob Git : `d572ce4f604410fe1349de5c12f7cf681b51596f`.
Image : 1672 × 941, 189120 octets ; pas de réencodage ni d'imitation CSS.

## Architecture et progression

Une couche fixe affiche l'image en `cover`, centrée, sans répétition, à la taille
du viewport avec 24 px de débord de sécurité. Le document continue de défiler.

`p = clamp(scrollY / (positionDocumentAncreToolbar - stickyTop), 0, 1)`.
La position de l'ancre, les dimensions du header et de la toolbar sont mesurées
au montage et lors des changements de dimensions. Le listener passif planifie
un `requestAnimationFrame` ; aucun état React n'est mis à jour par pixel.
Après `p = 1`, les écritures de styles cessent jusqu'au retour ou au resize.

La même progression pilote les deux sens : fond `1.05 → 1`, translation
`0 → -24 px` puis figée ; lentille du header avec une courbe smoothstep de
`p = .25 → 1` ; blur de la toolbar `14 → 24 px`, saturation finale 94 %, gap
des onglets `7 → 4 px`. La compression visuelle du header conserve sa place
dans le flux pour éviter les sauts de layout.

Le centre translucide et le bord masqué de 10 px ont des traitements distincts.
La sensation optique utilise gradients, blur, highlights et ombres internes.
Au passage en sticky : snap de 210 ms, excursion maximale 1.25 px, reflet unique
de 620 ms et micro-reflet du CTA violet. Aucune boucle décorative.

## Occlusion et navigation

Une couche fixe au z-index 19 réutilise exactement la pose du fond figé.
Son clip couvre la bande au-dessus des 8 px de sticky et l'extérieur des coins
supérieurs arrondis. La toolbar est au z-index 20 ; les dialogues existants
restent au-dessus. Aucun ancêtre des modules/dialogues n'est tronqué.

Les contenus passent derrière le verre, puis sont masqués au bord supérieur.
Les ancres utilisent `stickyTop + hauteurToolbar + 20 px` ; le ciblage des
sections reste visible sous la barre. Les liens et l'action CREATE sont conservés.

`prefers-reduced-motion` supprime parallaxe, compression, déformation, snap et
onde. Implémentation vérifiée dans le code ; préférence système non changée
pour cette vérification navigateur. Les garde-fous responsive existants sont
préservés ; aucun travail supplémentaire n'est prévu sur ce sujet.

## Vérifications ciblées

| Vérification | Résultat |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node scripts/check-architecture-imports.mjs` | PASS, 732 fichiers |
| `node node_modules/next/dist/bin/next build` | PASS, Next.js 16.2.6 |
| `git diff --check` | PASS |
| Lint | Aucun script/configuration ESLint dans le dépôt |
| A, arrivée PC | p=0 ; header à 12 px ; fond 1.05/0 px |
| B, transition PC | p=.5064 ; header comprimé ; matière progressive |
| C, verrouillage PC | p=1 ; snap transitoire puis toolbar à 8 px |
| D, scroll profond PC | fond figé 1/-24 px ; blur 24 px ; aucune fuite supérieure |
| D → A | p=0 ; header et pose initiale restaurés |
| Ancres Calendrier / Projection | Environ 20 px sous la toolbar |
| CTA | Builder ouvert puis fermé, sans enregistrement |
| Console navigateur | Aucune erreur ; avertissements de ratio des logos existants |

Des contrôles ponctuels à 390 px et 1024 px ont aussi confirmé l'absence de
débordement horizontal et l'accès au CTA avant la dernière instruction PC.
Pas de campagne supplémentaire ni d'installation de dépendance.

Captures conservées hors Git dans
`C:/Users/Manon/Documents/Codex/2026-09-28/ve/outputs` :
`planned-scene-A-top.jpg`, `planned-scene-B-transition.jpg`,
`planned-scene-C-lock.jpg`, `planned-scene-D-deep.jpg`.
Les captures A/D finales incluent la saturation corrigée à 94 % au verrouillage.

Vérification réalisée sur localhost dans une session existante. Aucun contrôle
du déploiement Vercel n'est revendiqué.
