# C4 — Contexts, ComponentSlots, Components et capabilities

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `8814cb4437b77e3ca147f471026849d16d9acf50` |
| HEAD_AFTER | Commit contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-c4-contexts-2026-10-06.md` |
| BRANCH | `main` |
| MIGRATION_REQUIRED | NO |
| ZERO_HISTORICAL_WRITE | YES — fixtures synthétiques, aucun appel distant |
| C4_CONTEXT_KERNEL_READY | YES — 29 groupes, dont les 12 oracles obligatoires |

## SCOPE_DONE

Le registre serveur immuable publie les 13 templates V1 : restaurant, fast-food,
delivery, activity, family-visit, friend-visit, purchase, night-out, short-stay,
beauty-restock, gift, home-project et other-context. Chaque template publie ses
champs, ses ComponentSlots, les options compatibles, les capabilities de sélection
et d'attachement des enfants, ses defaults structurels et sa version. Le manifeste
contient le registre et les versions du compiler de contexts et des contraintes.
Le core conserve ses identités génériques ; la taxonomy des templates appartient
au registre.

La sélection d'un slot contient des items identifiés. REQUIRED_ONE et OPTIONAL_ONE
sont ONE_OF : une deuxième alternative remplace la première. REPEATING accepte
plusieurs items et enfants distincts. Les helpers purs permettent de remplacer une
sélection, accepter une suggestion, promouvoir un component en enfant et changer
le parent d'un Context. La promotion retire la contribution du placeholder ; le
remplacement d'un enfant retire son sous-arbre. Le changement de parent conserve
contextOccurrenceId, ComponentIds et leurs identités financières synthétiques.

Les defaults distinguent STRUCTURAL_DEFAULT, PERSONAL_SUGGESTION et
EXPLICIT_USER_DECISION. Les defaults structurels des slots obligatoires sont des
placeholders non valorisés. Un default structurel payé fabriqué par le payload est
refusé. Une suggestion, y compris tout le sous-arbre d'un enfant suggéré, ne produit
ni component financier, ni consommation de Baseline, ni coût de mobilité avant
acceptation explicite. L'acceptation modifie l'intention, jamais les habitudes C1.

Un parent/enfant doit avoir une relation réciproque et exactement un socket
propriétaire autorisé par la capability. Les enfants incompatibles, les parents
sans socket, les liens orphelins et les doubles propriétaires sont refusés. La
frontière sémantique C0 continue à refuser doublons d'identités et cycles. Chaque
enfant compile une seule fois ; le parent expose ses liens et ses propres
ComponentIds, sans rajouter le coût des descendants à ses propres contributions.

NightOut utilise Before, Main, Food, Outbound, Return et Extras. ShortStay utilise
Hébergement, Courses, Restaurants, Activités, Achats et Transport. Chaque coût est
porté par un component indépendant et valorisé par le cost resolver existant.
Aucun template ne contient un prix global ou une formule financière autonome.
Les champs de total arbitraire sont refusés.

Les templates alimentaires identifient leur domaine C3. Une relation AUTO ne
consomme le PlanSlot que si le domaine et la capacité sont identifiés. Le nombre
de portions valorise le repas ; il ne crée pas plusieurs occurrences de restaurant.
Les compléments ne consomment pas une deuxième occurrence silencieuse. Les achats
peuvent sélectionner explicitement l'enveloppe clothing, home-small ou games-digital.
Une veste de 70 € consomme 70 € d'une enveloppe vêtements de 100 € et laisse 30 €
anonymes ; un achat de 130 € consomme 100 € et ajoute 30 €. Home project ne devient
pas une enveloppe Maison petit implicite.

Les courses d'un séjour utilisent REQUIRES_CONFIRMATION : AUTO reste UNRESOLVED,
avec déplacement et supplément inconnus, sans soustraction. Une confirmation
explicite de consommation peut fermer la relation si la capacité et le montant
sont identifiés. EXTRA_TO_SLOT et NO_RELATED_SLOT restent des choix explicites.
Les effets portent l'identité du PlanSlot, celle du component, les preuves de la
Baseline et la référence de capability/décision expliquant la relation.

Les sockets Transport émettent des MobilityIntents avec identité stable, rôle,
mode, lieux prospectifs et temporalité. Même deux sockets aux endpoints identiques
restent deux intents. C4 ne produit aucun PhysicalJourney, aucune fusion, aucun
routing et aucun prix de transport. Un mode non gratuit reste en attente C5 et
rend le montant projeté inconnu ; aucun montant carburant direct n'est accepté
dans le socket. Un mode UNKNOWN conserve knowledge UNKNOWN.

Une intention peut rester sans date ou sans prix. Un slot obligatoire non choisi,
un projet/achat répétitif sans contribution, un coût inconnu ou une mobilité non
valorisée rend la projection UNKNOWN, sans transformer l'absence en 0. Le coût
inconnu d'un component C4 est WARN : l'intention peut être conservée tant qu'aucune
contrainte dure n'est violée. Les refus certifiés du bridge générique C2, les
quotes hors cutoff, les floors réels, les protections d'épargne, les contrôles de
financement et la réconciliation des observations courantes restent en vigueur.

Le flux reste Compiler → adapter en mémoire → deriveMonthScenario(). Les contexts
ne nécessitent aucune ligne durable phase2_planned_expenses. Les intents externes
existants sont représentés une fois. Preview n'écrit rien ; Apply recompile les
autorités serveur puis utilise uniquement la RPC C0 après vérification de parité.
La relecture immédiate est EXACT sur les fixtures, y compris les intentions
incomplètes conservées avec projection UNKNOWN.

## TESTS_ADDED

`node scripts/check-phase2-planner-contexts.mjs` : **29 groupes PASS**.

CTX-001, CTX-002 et C4-001 à C4-010 sont présents. Les 17 groupes supplémentaires
couvrent le registre complet et son immutabilité, les intentions incomplètes,
la consommation d'enveloppe par achat, les sous-arbres suggérés, le remplacement
d'un enfant ONE_OF, les refus de graph, l'autorité des defaults, les sources non
identifiées, les projets sans contribution, la mobilité sans fusion, les relations
explicitement additionnelles, les prix manquants, fréquence versus quantité,
les intents externes, l'unique propriétaire financier, les quotes périmées et les
refus incompatibles avec zéro écriture.

Les round trips Preview / Apply / Immediate Reload exécutent le SQL C0 inchangé
sur PostgreSQL/PGlite, exclusivement en mémoire et sur données synthétiques.
Huit tables canaries refusent toute écriture sur historique, inputs mensuels,
dépenses prévues, wallets et révisions du foyer. Aucun Supabase local n'est lancé.

## REGRESSIONS

| Suite | Résultat |
| --- | --- |
| C0 contracts / persistence | PASS — 7 + 9 groupes |
| C1 Baseline | PASS — 13 groupes |
| C2 Kernel | PASS — 40 groupes |
| C3 Simple levers | PASS — 30 groupes |
| V2 category targets / choices | PASS — 36 checks |
| V2 savings allocations | PASS — 21 checks |
| V2 month decisions | PASS |
| V2 planned finance | PASS |
| Architecture imports | PASS — 816 fichiers |
| TYPECHECK | PASS — `tsc --noEmit` |
| BUILD | PASS — build Next.js de production |

Les tests de catégories utilisent une clé synthétique en processus. Aucun secret
réel, aucune donnée bancaire personnelle et aucun CSV réel ne sont ajoutés au lot.

## LIMITATIONS / FOLLOWUPS

Les champs publiés sont ceux nécessaires au noyau : label, date, fin de séjour,
et domaine budgétaire de l'achat. Les lieux du mouvement restent des références
prospectives ; le parsing ne les promeut pas en faits canoniques. L'enrichissement
des personnes, des lieux et des prix dépend des autorités et lots suivants.

Les dates de ce noyau restent dans le mois ciblé. Les contrôles de funding du
Kernel restent Banque uniquement ; l'éligibilité Swile/Edenred n'est pas étendue.
La valeur brute du scenario du propriétaire financier couvre ses contributions
valorisées ; lorsque le Context est incomplet, la projection Planner reste UNKNOWN
et ne prétend pas que ce sous-total constitue un total complet.

C5 possède les Journeys, la fusion et la valorisation physique. C6 possède les
NeedOccurrences et les renouvellements certifiés ; BeautyRestock C4 compose des
produits explicites sans inventer de cadence ou de besoin dû. C7/C8 possèdent
l'intégration globale, l'assistant et le Composer. Aucune UI n'est ajoutée ici.

Aucune migration C4, aucune écriture distante, aucun appel réel de la RPC et aucun
déploiement explicite. Le lot suivant n'est pas lancé.

```ini
C4_CONTEXT_KERNEL_READY = YES
```
