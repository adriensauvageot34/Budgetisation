# Mois à venir — Glass + Clay V1

## Livraison

```ini
HEAD_BEFORE = 0e00905cd0edb8548c2915add3d7804035de9be2
HEAD_AFTER = commit contenant ce rapport, résolu par la commande ci-dessous
BRANCH = main
BUILDER_INTERNAL_CHANGES = NONE
BUSINESS_RULE_CHANGES = NONE
SUPABASE_WRITES = NONE
MIGRATIONS = NONE
DEPENDENCIES_ADDED = NONE
```

```powershell
git log -1 --format=%H -- docs/status/phase2-month-glass-clay-2026-10-01.md
```

Le SHA final et l'état Vercel sont également consignés dans le dossier de preuves local après le push. Le rapport est conservé dans `docs/status`, sans contenu financier personnel ni captures dans le dépôt.

## Fichiers

```text
src/app/mois-a-venir/month-material.module.css
src/app/mois-a-venir/animated-money.tsx
src/app/mois-a-venir/month-forecast-view.tsx
src/app/mois-a-venir/month-section-nav.tsx
src/app/mois-a-venir/resource-editor.tsx
src/app/mois-a-venir/month-story.tsx
src/app/mois-a-venir/month-narrative-cards.tsx
src/app/mois-a-venir/month-calendar.tsx
src/app/mois-a-venir/month-decision-tools.tsx
scripts/check-phase2-planned-calendar.mjs
public/brands/obs.png
public/brands/promotrans.svg
public/brands/swile.svg
public/brands/edenred.png
docs/status/phase2-resource-logo-sources.md
docs/status/phase2-month-glass-clay-2026-10-01.md
```

Le harness calendrier reçoit uniquement le stub CSS Modules déjà utilisé par les autres tests SSR. Aucune assertion n'est retirée.

## Design system

```ini
DESIGN_TOKENS_ADDED = surface-page, glass-primary/secondary/border/shadow, depth-1, clay-shadow/pressed/highlight, accent-primary/adrien/manon/projection, ink/muted, radius-sm/md/lg/xl, motion-fast/normal/slow, ease-premium
GLASS_PRIMITIVES = glassPrimary, glassSecondary, glassQuiet, glassWarm, projection, nav, popover
CLAY_PRIMITIVES = clayPrimary, clayButton, clayChip, iconButton, brandBadge, roundBadge, precisionAction
MOTION_PRIMITIVES = hover-lift, press, AnimatedMoney, sectionEnter, disclosure, popoverEnter
```

Les primitives visuelles partagent un CSS Module limité à cette page. Les petites cartes et cellules simulent le verre sans blur. `AnimatedMoney` reçoit seulement une chaîne formatée : aucune interpolation, formule ou seconde valeur financière. L'animation intervient au changement de chaîne, jamais à chaque render ni au premier montage.

## Couverture de la page

| Champ demandé | Résultat |
| --- | --- |
| PAGE_BACKGROUND | Fond gris chaud, trois halos CSS diffus, titre du mois plat |
| STICKY_NAV | Plaque Glass, onglet actif légèrement enfoncé, CTA visible au scroll |
| ADD_EXPENSE_CTA | Capsule Clay vert profond, hover/press et focus visible |
| RESOURCES_PANEL | Grand panneau Glass, total plat et contrasté |
| RESOURCE_CARDS | Surfaces légères teintées, hover discret sans blur par carte |
| RESOURCE_LOGO_BADGES | Quatre logos originaux, badge/reflet/ombre CSS ; provenance séparée |
| FIXED_CHARGES | Lignes sobres, icônes rondes, détails natifs animés, épargne chaude désaturée |
| AFTER_CERTAIN_CHARGES | Synthèse horizontale vert très pâle, chiffre plat |
| CALENDAR | Container léger, cellules plates, filtres tactiles, jour courant violet |
| CALENDAR_POPOVERS | Glass, apparition subtile avec origine dérivée du point d'ouverture |
| DAILY_NECESSARY | Cartes orientées données, chiffres tabulaires, information à la demande |
| EXTRAS | Cartes légères, montants et « Probable » plats |
| PROJECTION | Panneaux Glass, teinte violette, scénario central contrasté sans bulle Clay |
| EXPLORE_CHOICES | Chips Clay, sélection via aria-pressed, résultat temporaire plat |
| PRECISION_MODULE | Enveloppe Glass et trois plaques tactiles, formulaires existants conservés |
| MONEY_VALUE_MOTION | Fade et déplacement de 3 px au changement, durée issue des tokens |
| DISCLOSURE_MOTION | Fade et déplacement de 4 px ; popover scale .975 vers 1 |
| PREFERS_REDUCED_MOTION | CSS désactive animations/transforms ; AnimatedMoney consulte matchMedia |

Les calculs, actions serveur, transports, lifecycle et règles de funding restent identiques. Le style des projets vise uniquement les lignes de liste ; aucun sélecteur n'entre dans le Builder interne.

## Vérifications ciblées

```text
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-phase2-planned-calendar.mjs
node scripts/check-phase2-month-narrative.mjs
node scripts/check-phase2-month-decision-engine.mjs
node node_modules/next/dist/bin/next build
git diff --check
git diff --name-only -- src/domain src/server supabase src/app/mois-a-venir/actions.ts src/app/mois-a-venir/restaurant-wizard.tsx src/app/mois-a-venir/planned-intent-builder.tsx src/app/mois-a-venir/planned-expenses-control.tsx
```

Exécutées avec le runtime Node du poste. La dernière commande ne retourne aucun fichier.

```ini
TYPECHECK = PASS
CALENDAR_TESTS = PASS
MONTH_NARRATIVE_TESTS = PASS
MONTH_DECISION_ENGINE_TESTS = PASS
LINT = NOT_CONFIGURED (aucun script ni configuration lint dans ce dépôt)
BUILD = PASS
DIFF_CHECK = PASS
BROWSER_TARGETED_SMOKES = PASS
```

Parcours navigateur local, sans enregistrement : navigation sticky et sections, ouverture/fermeture des détails calendrier, retour du focus au jour, ouverture des charges Maison, deux simulations successives et état sélectionné, fermeture de simulation, édition/annulation d'une ressource, CTA ouvrant puis fermant la surcouche existante, ouverture/fermeture du formulaire de solde. Aucune erreur console capturée. Les montants de référence avant/après restent identiques.

## Performance et accessibilité

```ini
BLUR_PERFORMANCE_CHECK = 6 grandes surfaces visibles au repos ; 0 cellule calendrier avec backdrop-filter ; popover supplémentaire uniquement lorsqu'ouvert
ACCESSIBILITY_CHECK = contrôle ciblé des contrastes, labels natifs, aria-pressed/current, focus visible et restauration du focus
```

Contrastes de palette calculés sur les fonds clairs conservateurs : texte financier 13,41:1, texte secondaire 5,55:1, CTA blanc 5,05:1 sur l'extrémité la plus claire du gradient, texte violet 5,74:1. Il ne s'agit pas d'un audit WCAG complet. Les détails natifs conservent leur activation clavier. Aucun blur par ligne, logo ou cellule, aucune bibliothèque d'animation ajoutée.

## Captures avant/après

Dossier local, hors dépôt :

```text
C:/Users/Manon/Documents/Codex/2026-09-28/ve/outputs/month-glass-clay-2026-10-01
```

Avant : version production du HEAD précédent. Après : worktree local final. `before-full.jpg` et `after-full.jpg` gardent le contexte complet.

| Zone | Avant | Après |
| --- | --- | --- |
| Haut | before-top.jpg | after-top.jpg + after-top-viewport.jpg |
| Ressources | before-resources.jpg | after-resources.jpg |
| Charges | before-charges.jpg | after-charges.jpg + after-charges-open.jpg |
| Après charges | before-after-charges.jpg | after-after-charges.jpg |
| Calendrier | before-calendar.jpg | after-calendar.jpg + after-calendar-scroll.jpg + after-calendar-popover.jpg |
| Quotidien | before-daily.jpg | after-daily.jpg |
| Extras | before-extras.jpg | after-extras.jpg |
| Projection | before-projection.jpg | after-projection.jpg |
| Choix | before-choices.jpg | after-choices.jpg |
| Précision | before-precision.jpg | after-precision.jpg + after-precision-open.jpg |

`after-builder-unchanged.jpg` prouve l'ouverture de la surcouche existante. Comparaison visuelle : hiérarchie et densité conservées, montants nets, matières différenciées, ombres contenues. Les captures financières sont exclusivement locales.

## Limites

```ini
KNOWN_LIMITATIONS = comparaison visuelle ciblée sans suite de pixels ; reduced-motion vérifié dans le code, non émulé dans ce navigateur ; avertissements Next/Image préexistants sur certains logos du calendrier ; absence de lint configuré
FOLLOW_UPS = aucun blocage identifié ; audit accessibilité exhaustif et mobile hors vérification de ce patch desktop
```
