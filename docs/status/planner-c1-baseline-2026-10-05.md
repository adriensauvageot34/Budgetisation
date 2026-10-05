# C1 — PlanningBaselineV1

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `1ab8612298626a2f0fe1ab2373bef23fae8584d7` |
| HEAD_AFTER | Commit contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-c1-baseline-2026-10-05.md` |
| BRANCH | `main` |
| MIGRATION_REQUIRED | NO |
| TYPECHECK | PASS — `tsc --noEmit` et contrôle TypeScript du build |
| BUILD | PASS — Next.js production build |
| ZERO_HISTORICAL_WRITE | YES — aucun appel distant effectué pour C1 ; tests sur fixtures synthétiques |
| C1_READY_FOR_C2 | YES |

## SCOPE_DONE

`buildPlanningBaseline(sources)` construit un read-model JSON pur. Le foyer, le mois,
la timezone et `knowledgeCutoff` sont explicites ; le builder n'utilise ni horloge ni client.
`readPlanningBaselineSources(repository, targetMonth, knowledgeCutoff)` est l'adapter de lecture des owners existants.
`readPlanningBaseline(...)` compose les deux sans persister de snapshot.

Modules : `baseline.ts`, `baseline-food.ts`, `baseline-habits.ts`, `baseline-mobility.ts`,
`baseline-adapters.ts`, `baseline-evidence.ts`, `baseline-sources.ts`, `baseline-structural.ts`.
Le contrat C0 est précisé avec des types pour valeurs, références, capacités et réserves.

- Ressources et obligations du forecast, corrections et faits mensuels autoritaires conservés.
- Épargne mensuelle/annuelle et réserve de sécurité conservées dans les réservations structurelles.
- Courses en montant économique Purchase-aware ; financement bancaire et wallets ne créent pas un deuxième coût.
- Restaurants en occurrences sémantiques FOOD ; les paiements ne deviennent pas des occurrences.
- Repas/cafés de travail issus de l'historique daté et du scope personnel, sans importer le midpoint hypothétique de l'ancien scénario.
- Habitudes issues exclusivement de `person_habit_assertions` USER_VALIDATED et admissibles au cutoff ; prix indicatif distingué d'un paiement.
- Observations de produits reliées au sujet Canonical du Need ; slots conditionnels avec due-state UNKNOWN en attendant C4.
- Mobilité personnelle issue des legs Canonical et des liens M7 : WORK, contextes hors travail et UNRESOLVED.
- Trajets de travail sans commande SET_AMOUNT/SET_COUNT ; références de contexte hors travail en suggestion, sans coût incrémental inventé.
- Historique économique inexpliqué, mobilité non attribuable, achats inconnus et couverture locale incomplète conservés sous forme de réserves.
- Planned Expenses représentées une seule fois comme intents dans `structuralFacts.externalKnownContexts`, selon le contrat M20/C0.

Sortie : `structuralFacts`, `slots`, `unresolvedReserves`, `sourceRefs`, `modelVersions`,
`knowledgeCutoff`, `digest`, `diagnostics`. Les trois types de slots AMOUNT, OCCURRENCE
et CONDITIONAL_OCCURRENCE sont produits.

## Doctrine et déterminisme

La fenêtre historique utilise seulement les mois clos/certifiés, avec source revision,
strictement antérieurs au mois cible et terminés avant la date locale du cutoff.
La comparabilité reste locale : BANK pour l'économique inexpliqué, MOBILITY pour la mobilité,
BANK/SWILE/EDENRED selon les besoins alimentaires, avec statut complet de la période concernée.
Les références P25/P50/P75 réutilisent le quantile existant et exigent trois échantillons comparables.
Elles ne constituent jamais un hard floor. Un mois couvert sans occurrence peut valoir zéro ;
un manque de preuve ou un montant inconnu reste null. Les minima partiels restent explicites.

Les arrays sans ordre sémantique sont triés ; les identités de slots réutilisent `planSlotId` C0.
Les identités sources contradictoires sont bloquées, sans choix dépendant de l'ordre d'entrée.
Le résultat est copié en JSON sans muter les owners.

Le SHA-256 canonique porte sur les faits admissibles, références, versions et diagnostics.
`digest` et l'heure de construction `knowledgeCutoff` sont exclus du hash : relire les mêmes
faits une heure plus tard conserve le digest. Le cutoff continue de filtrer les faits et reste
dans le read-model. Un changement de faits ou de couverture effectivement admissible change le digest.

Le builder n'accepte aucun Plan ou état sémantique. Les champs `monthInputs.decision`,
les exclusions/déclinaisons d'obligations et les autres résultats du scénario n'y entrent pas.
`legacySeedDecisions(inputs)` est un export séparé réservé à un usage aval, sans lecture par le builder.
Les Planned Expenses et les anciens événements mensuels restent des intents externes ;
leurs coûts et déplacements ne sont jamais injectés silencieusement dans les facts/slots.

## TESTS_ADDED

Commande dédiée : `npm run check:phase2-planner-baseline`.

| Oracle | Résultat |
| --- | --- |
| BASE-BLD-001 — mêmes faits, permutations et nouvelle heure de construction, même digest | PASS |
| BASE-BLD-002 — décisions du Plan absentes | PASS |
| BASE-BLD-003 — anciennes assumptions sans apprentissage d'habitude | PASS |
| BASE-BLD-004 — intent externe unique, sans contamination par son prix | PASS |
| BASE-BLD-005 — UNKNOWN/null et minimum partiel conservés | PASS |
| BASE-BLD-006 — réserve inexpliquée conservée, charges structurelles exclues de son corpus | PASS |
| BASE-BLD-007 — références closes stables face au courant/futur et aux timestamps de calcul | PASS |
| BASE-BLD-008 — épargne protégée réservée structurellement | PASS |
| BASE-BLD-009 — mobilité travail non exposée comme levier arbitraire | PASS |
| BASE-BLD-010 — masques de comparaison locaux et minima hors couverture conservés | PASS |
| BASE-ADAPT-001 — assertion personnelle filtrée par foyer/cutoff et sujet autorisé | PASS |
| BASE-ADAPT-002 — composition des adapters avec owners simulés, bornes et scopes vérifiés | PASS |
| BASE-BOUNDARY-001 — aucune mutation/RPC/lecture de Plan/pricing prospectif dans les modules C1 | PASS |

Fixtures entièrement synthétiques ; aucun accès à `.env`, aucune donnée bancaire personnelle,
aucun Supabase local ni test distant avec écriture. Le contrôle des adapters est une intégration
sur fixtures, pas une certification live de l'ensemble des sources distantes.

## REGRESSIONS

- Architecture imports : PASS, 796 fichiers.
- Contrats C0 : 7 groupes PASS.
- Persistence C0 : 9 groupes PASS, uniquement PostgreSQL/PGlite en mémoire sur fixtures.
- Planned finance : PASS.
- Month control center V5 : 38/38 PASS, clé de test synthétique pour l'Undo simulé.
- TypeScript et build de production : PASS.

## État Supabase C0

La migration C0 locale `20261005202346_phase2_month_plan_foundation.sql` a été appliquée
dans le lot précédent après validation humaine. Supabase l'a enregistrée sous la version
`20261005204529`, nom `phase2_month_plan_foundation`, avec un contenu identique.
Les 14 contrôles post-migration en lecture seule étaient PASS, les deux tables vides.
Cette correspondance est conservée ; C1 ne relance ni ne répare aucune migration, ne fait aucun
`db push`, ne réinitialise rien et n'appelle pas la RPC réelle.

## KNOWN_LIMITATIONS

- C1 expose une Baseline de référence, sans totals financiers, Compiler, Apply, expansion de Context, assistant ou UI.
- Les profils/episodes/due-windows de renouvellement appartiennent à C4 ; C1 n'invente pas de périodicité à partir de quelques achats.
- La mobilité hors travail reste une référence brute contextuelle ; l'owner M7 n'a pas de contre-factuel incrémental.
- Une autorité indisponible ou conflictuelle bloque la lecture plutôt que de fournir un fallback zéro.
- Les lectures de sources multiples ne forment pas une transaction distante unique. C2 devra reconstruire et comparer les preuves avant Apply.
- Le cutoff filtre les sources connues du read-model ; il ne recrée pas une version bitemporelle absente des tables existantes.
- La table d'assertions d'habitudes exige le client serveur de lecture de confiance déjà prévu par ses grants ; aucun changement RLS n'est fait ici.

## FOLLOW_UPS

C2 peut consommer ce contrat et ces fixtures. Il devra utiliser l'autorité financière existante
`deriveMonthScenario()` via son adapter et assurer le contrôle de fraîcheur avant Apply.
C4 pourra résoudre les slots de renouvellement conditionnels. Aucun de ces lots n'est commencé dans C1.
