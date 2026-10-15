# B2 — Mon Plan dans Mois à venir

Date : 15 octobre 2026. Verdict de certification : **B2_PARTIAL_WITH_BLOCKERS**.

Le code de présentation est livré en Production, Vercel READY. Le gate authentifié **avec** Plan actif demeure `NOT_RUN` : aucune révision personnelle n’a été créée. La validation serveur et navigateur avec Plan porte sur des révisions synthétiques réellement persistées dans PGlite. Le smoke authentifié après déploiement n’a pas pu être exécuté, la revue automatique ayant atteint sa limite d’usage. Ces limites empêchent `B2_PRODUCTION_PASS`.

## A. État initial

- Main/Production B1 : `ef1cb54c66b45b930204391624a0014c69ed014e`, Vercel READY.
- Branche dédiée : `codex/budgetisation-b2-official-plan-ux`.
- Réutilisation de `official-plan-comparison@v1`, `AppliedMonthView`, de la page et des propriétaires existants. Aucun changement dans `src/server`, `src/domain` ou les migrations.
- Relevé initial ciblé : ancienne projection en plusieurs encarts, contrôles et Contexts déroulés verticalement, enfants répétés comme Contexts indépendants, détails techniques trop présents, navigation peu adaptée au Plan officiel.
- Le dossier maître d’idées du 15 octobre a été consulté, notamment ses sections 3 et 29–30. Le détail progressif et la hiérarchie horizontale inspirent B2 ; les nouveaux presets et l’atelier Composer restent hors périmètre.

## B. Problèmes UX constatés

Le reste officiel manquait de hiérarchie par rapport aux postes explicatifs. Les informations de décision, financement, coût d’usage et marge conditionnelle demandaient une lecture technique. Les séjours composites produisaient des répétitions de moments et de transport.

Une anomalie visuelle a aussi été constatée pendant B2 : l’ancienne règle mobile `order:-1` du titre, prévue pour Flex, déplaçait le titre dans la nouvelle grille. Elle est explicitement neutralisée par `order:0; width:auto`. Ce correctif ne masque aucun débordement.

**Cadrage final utilisateur : application desktop uniquement.** Les mesures mobiles déjà obtenues sont conservées à titre complémentaire ; elles ne deviennent pas un chantier supplémentaire.

## C. Refonte

1. **Résumé** : un reste prévisionnel principal, sa référence sans les modifications du Plan et l’impact consolidé officiel. Révision discrète, distinction économique/banque et accès Composer.
2. **Décisions** : budgets/habitudes, événements ponctuels, réservations et déplacements. Groupes vides omis ; cartes compactes à détail repliable. Un groupe important peut être replié.
3. **Comprendre ma projection** : six postes du propriétaire financier, avertissement de non-additivité, financement distinct. Diagnostics et digests au troisième niveau.
4. **Détail métier** : destinataires, occasion, objet libre et classification, dates absentes, participants, composants, financements, provenance et liens parent/enfants conservés. Un trajet physique partagé est affiché une seule fois dans les déplacements.

Fichiers : `applied-month-view.tsx`, `applied-plan-detail.tsx`, `applied-month.module.css`, `month-forecast-view.tsx`, `month-section-nav.tsx`, `month-material.module.css`, `page.tsx`.

Les propriétaires externes restent accessibles via le Centre de contrôle et les composants Ressources/Calendrier/Dépenses indépendantes. Pas de second éditeur de Plan. Les estimations Mobility affichées proviennent du Compiler courant déjà évalué ; une ancienne estimation conservée dans le manifeste n’est plus présentée comme actuelle quand les autorités ont changé.

## D. Fidélité financière

| Contrôle | Résultat effectivement obtenu |
|---|---|
| Total consolidé | Directement `projection.plan.economicMonthEndRemainder` et `impactOnMonthEnd` B1 |
| A : Courses/Soirée | 350 → 320 € ; Soirée 100 € ; référence 650 €, Plan 580 €, impact −70 € |
| B : restaurant couvert | 40 € ; déplacement d’enveloppe certifié ; impact 0 €, aucun supplément inventé |
| C : séjour composite | Un parent, deux enfants dans son détail, un trajet physique partagé ; identités conservées |
| D : épargne | Réservation protégée visible, aucun bouton de réduction ni virement créé |
| E : Mobility | Peugeot 207, 2 € de coût d’usage synthétique ; distinction avec plein payé et cash |
| F : UNKNOWN | Total et impact indéterminés ; composant connu de 100 € toujours lisible |
| G : R1/R2 | R1 reste affichée, pointeur R2 réellement modifié dans PGlite, avertissement SUPERSEDED |
| Autorités changées | Revenu synthétique actualisé : reste 590 €, référence 660 € ; ancien reste 580 € dans le détail |
| Vérification indisponible | Révision conservée avec réserve visible, jamais « Plan à jour » |
| Interactions | Quatre restaurants à capacité partagée ; impact officiel −40 €, aucune somme des marges |
| Cadeau | Léa, anniversaire, roman libre, classification Livre et date absente conservés |

Les marges sont présentées uniquement dans le détail comme comparaison du Plan entier avec le même Plan sans cette décision. Le texte prévient qu’elles ne s’additionnent pas. Aucun montant de démonstration n’est introduit dans le produit.

## E. Navigateur et visuel

Contrôles effectués avec le navigateur réel de Codex, composants produit et CSS compilés en mode production dans le harnais local. Le harnais annonce explicitement les données synthétiques et l’absence d’accès Supabase.

- Desktop : 1280×720, 1440×900, 1728×900, 1920×1080, sans débordement global ni texte tronqué constaté.
- Complément déjà exécuté avant le cadrage desktop : largeurs 320, 375, 768 ; test explicite `scrollWidth <= innerWidth`, mesure des dimensions réellement obtenues.
- Montant de neuf chiffres issu d’un scénario synthétique persistant : pas de clipping ni débordement aux sept largeurs.
- À 1440×900, dans le harnais, bas du résumé vers 524 px et début des décisions vers 571 px. Ces positions n’incluent pas le chrome applicatif complet de Production.
- Détails ouverts/fermés, séjour et enfants, Mobility, cadeau, UNKNOWN, statuts de fraîcheur et interactions inspectés.
- Entrée clavier sur un enfant et une explication conditionnelle : ouverture effective, focus `SUMMARY`, contour visible. Centre de contrôle authentifié : Échap ferme et restitue le focus au déclencheur.
- Lien Composer authentifié réellement suivi ; Board FRESH, Draft CLEAN, aucune édition ou Apply.

Captures : `evidence/b2-mois-a-venir-plan-ux/A-*.jpg`, ainsi que les détails métier. Les captures enregistrées dans Git contiennent uniquement les données synthétiques. Les mesures authentifiées enregistrent uniquement des booléens et dimensions, aucun montant personnel.

Limites : pas de campagne de zoom navigateur ni de lecteur d’écran, pas de certification exhaustive WCAG. La préférence de réduction des animations et les contrôles natifs de divulgation sont préservés. Pas de capture avant/après avec Plan authentifié, faute d’une telle révision admissible.

## F. Tests fonctionnels

| Gate | Statut |
|---|---|
| TypeScript `tsc --noEmit --incremental false` | EXECUTED_PASS, sortie 0 |
| B2 : révisions persistées, vrais Apply/Compiler/V2/relecture C0 | EXECUTED_PASS_PGLITE_SYNTHETIC_ONLY : 12 scénarios distincts |
| Parité existante | EXECUTED_PASS : 22 cas × 9 empreintes, zéro écriture distante |
| Navigateur avec Plan synthétique | EXECUTED_PASS_LIMITED_SERVER_FIXTURE |
| Navigateur authentifié sans Plan, Preview | EXECUTED_PASS : DIRECT_V2, comparaison absente, invitation présente |
| Projection sans Plan comparée à B1 Production | Identique, comparaison effectuée en mémoire sans enregistrer les valeurs personnelles |
| Centre de contrôle réel / accès Composer | EXECUTED_PASS en lecture, sans soumission ni Apply |
| Build complet Next Vercel | EXECUTED_PASS, puis build final de livraison selon reçu ci-dessous |
| Authentifié avec Plan actif | **NOT_RUN** — aucun environnement isolé avec Plan et session réelle disponible |
| Smoke Production authentifié après déploiement | **NOT_RUN_AUTO_REVIEW_USAGE_LIMIT** ; le smoke Preview authentifié du même code a passé |

Commandes :

```text
node scripts/check-b2-plan-ux.mjs
node scripts/check-b2-plan-ux.mjs CHANGED LONG
node scripts/check-planner-performance-parity.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/check-b2-presentation-cost.mjs
```

Les 11 premiers cas ont passé, puis CHANGED a été renforcé avec une vraie variation de ressource et LONG ajouté : 13 exécutions réussies, 12 scénarios distincts. Les résultats complémentaires remplacent le premier contrôle CHANGED limité à un changement de génération.

Pour reproduire le navigateur : définir `PLANNER_BROWSER_TOOLS` vers un répertoire contenant `node_modules/esbuild`, puis `node scripts/serve-b2-plan-fixture.mjs` ; ouvrir `http://127.0.0.1:3192/?case=A`. Le serveur écoute seulement localhost et refuse les méthodes autres que GET. Les seuls Apply sont exécutés en mémoire par le générateur synthétique. Les writers externes sont refusés dans le harnais ; leur fonctionnement visuel réel est vérifié séparément sur la Preview authentifiée sans Plan.

Les premiers essais du harnais ont nécessité des corrections de ses imports Next, de son environnement navigateur et de ses fixtures (versions de champs et options admissibles). Ces échecs ne sont pas présentés comme des tests produit réussis. La validation C0/Compiler n’a pas été affaiblie pour les faire passer.

## G. Performance

Aucun `readWorld`, accès historique, appel fournisseur ou calcul Finance V2 ajouté aux composants. Le chemin de lecture B1 et son contrôle de pointeur restent inchangés. Dans les scénarios ordinaires, les trois lectures World correspondent à Preview, Apply puis READ officiel ; le rendu n’en déclenche aucune.

Comparaison SSR sur le même séjour composite persisté, React production, alternance ancien/nouveau, deux échauffements et 20 échantillons conservés :

| CPU de présentation | Avant B1 | Après B2 |
|---|---:|---:|
| P50 descriptif | 7,383 ms | 11,958 ms |
| P95 descriptif | 10,143 ms | 16,312 ms |
| HTML complet, détails compris | 14 022 octets | 33 171 octets |

Surcoût médian local 4,575 ms et environ 19 Ko de HTML pour la restitution plus complète et sa provenance. Les détails natifs sont repliés à l’affichage, mais présents dans le HTML ; pas de requête additionnelle à l’ouverture. Cette mesure CPU n’établit aucun gain de latence utilisateur ni objectif P14 de deux secondes. Pas de nouvelle campagne de performance distante, publication ou snapshot.

## H. Livraison

- Commit applicatif : `3e76aeaecd8e6f37d77a6c959df0a3e7591cf311`.
- Commit final testé et poussé : `d4901991ebb247097a73e483e0a32da52b88b6a5`.
- PR [#37](https://github.com/adriensauvageot34/Budgetisation/pull/37), fusionnée sous `bec09ccb0016ac3e711c39e6deef3ae44712ce05`.
- Arbre Git du merge strictement identique à celui du commit testé : `ba9097280e62d89345b1a715c896b67eed6af5ed`. Main n’avait pas dérivé pendant B2 ; aucun écrasement forcé.
- Preview finale : `dpl_HEErjYoYrKKB4JkiQ2GYkJa6WDrp`, READY, commit `d490199`. Build Next complet réussi ; statuts Vercel GitHub success. Aucun autre contrôle obligatoire en échec signalé.
- Production : `dpl_5w6KDytydrgoiLom63vyGRmm7ebY`, **READY**, commit `bec09ccb0016ac3e711c39e6deef3ae44712ce05`, alias habituel `budgetisation-tan.vercel.app` confirmé par Vercel.
- La Preview authentifiée du dernier build a montré DIRECT_V2, Forecast identique à B1, aucune comparaison fictive et zéro erreur console. Le smoke Production post-déploiement reste **NOT_RUN** : l’outil navigateur a explicitement refusé une action locale à cause de la limite d’usage de la revue automatique. Aucune tentative via CDP, autre navigateur ou extraction de session n’a été faite pour contourner ce refus.
- SNAP-3 `1`, Preview HTTP `1`, prototype P3 `0` confirmés dans la configuration Production. Aucun drapeau modifié par B2. État Supabase SNAP : enabled, révision 1, epoch 2, couverture writers vraie.
- Compteurs INSERT/UPDATE/DELETE des neuf tables financières/Plans surveillées strictement identiques avant/après les lectures B2 ; toujours zéro Plan et zéro PlanRevision. Reçu technique dans `evidence/b2-mois-a-venir-plan-ux/delivery.json` ; aucune valeur financière personnelle enregistrée.
- Clôture documentaire conservée sur la branche séparée `codex/budgetisation-b2-delivery-evidence`.

Rollback : revenir par revert des commits applicatifs B2 ou rollback Vercel vers le déploiement B1 précédent. Aucun rollback SQL nécessaire, aucune donnée Plan/Draft à supprimer. Ne jamais modifier ou supprimer une PlanRevision pour revenir à l’ancienne présentation.

## I. Limites et sécurité

- La validation authentifiée **avec Plan** et le smoke Production post-déploiement restent ouverts. Ils ne doivent jamais être confondus avec les vrais Apply/Reload synthétiques ou le smoke authentifié DIRECT_V2 en Preview.
- Aucun compte fictif, Plan personnel, dépense, transfert, publication ou migration créé sur Supabase pour B2.
- Financements Wallet non admissibles, séjours intermois et fonctionnalités futures ne sont pas présentés comme livrés par cette refonte.
- Les délais P14 ne sont pas recertifiés. SNAP-3, Draft HTTP et les garanties Apply/CAS restent sous leurs autorités existantes.
- La preuve statistique d’absence de mutations est une comparaison des compteurs opérationnels avant/après, associée à l’absence de writer appelé ; elle ne remplace pas un audit exhaustif de toutes les lignes.

## J. Suite ciblée

Après rétablissement de l’accès navigateur autorisé, exécuter seulement le smoke Production manquant. Valider ensuite le même lecteur avec une PlanRevision admissible dans un environnement isolé authentifié, sans fabriquer un Plan personnel. Le code et le harnais sont disponibles pour ce contrôle. Les nouveaux assets et la refonte de Composer restent un chantier distinct ; aucun développement suivant n’est lancé dans B2.
