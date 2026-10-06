# C3 — Leviers simples, OccurrenceModels et mappings

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `a688ec1122254db9daa545c721b8d7853d1d9e1a` |
| HEAD_AFTER | Commit contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-c3-simple-levers-2026-10-06.md` |
| BRANCH | `main` |
| MIGRATION_REQUIRED | NO |
| ZERO_HISTORICAL_WRITE | YES — fixtures synthétiques, aucun appel distant |
| C3_SIMPLE_CAPABILITIES_READY | YES — 30 groupes, dont les 11 oracles obligatoires |

## SCOPE_DONE

`buildSimplePlanningBaseline()` enrichit le read-model C1 pur, sans accepter d'état
du Plan. Le reader de production charge cette Baseline avec les occurrences
Canonical et leurs liens causaux confirmés, dans le périmètre historique autorisé.
Les lectures C1 ordinaires conservent leur contrat et leur builder.

Courses et tabac/vape exposent des slots montant. Adrien dispose d'un slot
d'occurrences de repas travail fondé sur les dates de repas identifiées par leur
purpose. Manon reste UNKNOWN / NEEDS_NEW_INPUT : son historique de quelques achats
ne constitue pas une fréquence validée. Une assertion personnelle USER_VALIDATED
peut fournir cette fréquence ; elle apparaît une seule fois, avec sa provenance.
Une décision explicite peut renseigner le nombre, et le prix si nécessaire, sans
enseigner cette décision à la Baseline. Les anciennes assumptions restent exclues.

Restaurants, fast-food et livraison sont trois slots distincts. Leur count model
utilise des occurrences de repas/livraison Canonical, reliées au coût économique
Purchase-aware, avec comparabilité locale des sources et des périodes closes.
Le ticket est résolu séparément du nombre. Un paiement seul, un parent de visite,
une ambiguïté de canal ou un prix non identifié ne crée pas une occurrence connue.
La liaison d'une Purchase à son opération propriétaire est conservée.

Le mapping économique utilise les sous-catégories Canonical existantes ; pour un
intent externe, le module métier identifie restaurant/fast-food et le mode DELIVERY
prend priorité. Une ligne ambiguë bloque. Lorsqu'un membre de la restauration est
possédé par le Plan, les trois capacités remplacent ensemble l'unique référence
legacy `household-restaurants`. Cette référence et ses assumptions/targets sont
neutralisées une seule fois. Un Planned Expense comportant plusieurs lignes de
repas consomme une occurrence du slot, et conserve une seule entrée externe.

Vêtements, Maison petit et jeux/numérique sont des enveloppes optionnelles sans
réservation automatique. Leur montant initial de 0 désigne une absence de décision,
avec knowledge NOT_APPLICABLE ; il ne désigne ni un prix ni un achat observé.
Un contrôle ajoute une réservation anonyme en mémoire, sans purchase fact, contexte
ou ligne DB. Maison petit utilise le mapping explicite du catalogue existant :
décoration, plantes, vaisselle, petit bricolage, multiprise/électricité, lampe et
rangement. Meuble et literie relèvent de Home project ; « cuisine » et les autres
libellés trop larges restent NEEDS_MAPPING. Aucun seuil de prix ne sert de frontière.
Home project reste hors C3.

`publishSimpleCapabilities()` publie SET_SLOT_AMOUNT, SET_SLOT_OCCURRENCES ou
SET_SAVINGS_ALLOCATION avec flexibility, knowledge, gate, références historiques,
contraintes hard/soft et presets. Les repères low/central/high restent fixes lorsque
l'intention change. Ils ne deviennent jamais des floors. Les floors Courses/Tabac
ne sont publiés que pour un coût économique déjà observé, avec ses preuves Canonical.
Les simulations sous ce floor sont BLOCK ; aucun minimum historique arbitraire
n'est inventé. Sans preuve de floor, une intention explicite peut aller jusqu'à 0.

L'épargne PROTECTED publie zéro action d'ajustement et aucun preset de réduction.
Toute tentative d'ajustement est bloquée avant la RPC. ADJUSTABLE publie sa capability
explicite et modifie la disponibilité via les réservations MonthInputs en mémoire,
sans créer de consommation économique. La mobilité travail conserve ses protections
C1/C2 et n'est pas ajoutée aux leviers réductibles.

Le Compiler, l'adapter financier et les contraintes portent des versions C3. Ils
réutilisent `deriveMonthScenario()` ; aucun moteur financier parallèle n'est ajouté.
Le manifest inclut les capabilities et la politique temporelle active du propriétaire
financier. Un changement SAFE/ASOF est une nouvelle autorité, donc CHANGED_AUTHORITIES
lors de la relecture, plutôt qu'une divergence à autorités prétendument identiques.
Preview, Apply et Immediate Reload restent identiques sur les fixtures certifiées.

## TESTS_ADDED

`node scripts/check-phase2-planner-simple-levers.mjs` : **30 groupes PASS**.
Les oracles C3-001 à C3-011 sont présents. Les 19 groupes supplémentaires couvrent
Maison petit/project, jeux optionnels, repas Adrien, absence de source d'occurrences,
prix explicite manquant, intégralité des counts, mapping des intents externes,
déterminisme, absence d'apprentissage legacy, fréquence Manon validée, identité
Purchase-aware, canal ambigu, observations courantes gated, frontière d'écriture,
épargne protégée sans RPC, parent contextuel, politique temporelle, presets discrets et preview périmé
sans écriture. La parité utilise PostgreSQL/PGlite et le SQL C0 réel, exclusivement
sur données synthétiques ; huit tables canaries refusent les écritures historiques.

## REGRESSIONS

| Suite | Résultat |
| --- | --- |
| C0 contracts / persistence | PASS — 7 + 9 groupes |
| C1 Baseline | PASS — 13 groupes |
| C2 Kernel | PASS — 40 groupes |
| V2 category targets / choices | PASS — 36 checks |
| V2 savings allocations | PASS — 21 checks |
| V2 month decisions | PASS |
| V2 month decision engine | PASS |
| V2 control center V5 | PASS — 38 checks |
| V2 forecast temporal modes | PASS — 13 checks |
| V2 planned finance | PASS |
| Architecture imports | PASS — 811 fichiers |
| TYPECHECK | PASS — `tsc --noEmit` |
| BUILD | PASS — build Next.js de production |

La suite ancienne month-decision-engine était désynchronisée du moteur déjà présent
avant C3. Ses fixtures/assertions ont été remises à jour : ASOF explicite, preuves de
couverture par source, comparaison de deux sorties au même niveau avant enrichissement
wallet, fenêtre de training à cinq mois, opportunités de travail empiriques, conservation
des coûts non couverts, nowcast borné, CUSTOM legacy portant sur le restant, couche
épargne dans l'identité d'affichage, arrondi propre aux cartes, preuves de calibration,
mock du snapshot publié et ancrages SSR actuels. Les implémentations financières et
React V2 n'ont pas été modifiées. Les tests d'undo utilisent une clé synthétique en
processus ; aucune clé réelle n'est employée dans les tests.

## LIMITATIONS / FOLLOWUPS

Une catégorie possédée comportant des observations du mois reste BLOCK tant que
sa réconciliation n'est pas certifiée, conformément à la protection C2. Les floors
observés n'autorisent pas à passer cette protection. Les sources sans occurrences
ou ticket fiable restent gated et conservent leurs réserves non résolues.

Les enveloppes optionnelles ne créent pas de modèles de renouvellement ou de projets.
Home project, Context expansion, NightOut/ShortStay, Journey resolver, NeedOccurrence,
pricing prospectif, assistant et UI Composer restent hors scope. La projection garde
les limites PARTIAL de C2 sur le financement, le cash et les domaines non compilés.

Aucune migration C3, aucun déploiement, aucune écriture distante et aucun appel réel
de la RPC. Le lot suivant n'est pas lancé.

```ini
C3_SIMPLE_CAPABILITIES_READY = YES
```
