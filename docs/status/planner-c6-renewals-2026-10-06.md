# C6 — Renouvellements, épisodes d’acquisition et occurrences de besoins

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `7b7e0af40a527001aa74f8a625980149e55c1c2c` |
| HEAD_AFTER | Commit contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-c6-renewals-2026-10-06.md` |
| BRANCH | `main` |
| MIGRATION_REQUIRED | NO |
| ZERO_HISTORICAL_WRITE | YES |
| C6_RENEWALS_READY | YES — 31 groupes, dont les 11 oracles obligatoires |

## Résultat

Le propriétaire pur `renewal-engine.ts` transforme les observations canoniques et
les assertions personnelles en AcquisitionEpisodes, ReplenishmentProfiles et
NeedOccurrences. `renewal-baseline.ts` enrichit la Baseline C1/C3 sans recevoir
de Decision du Plan. Le lecteur serveur utilise cet enrichissement et le compiler
publie les Needs dans son résultat et son manifest. Les components acceptés d’un
BeautyRestock peuvent référencer chacun leur NeedOccurrence.

Le scénario passe par l’adapter financier C2 et `deriveMonthScenario()`. Preview,
Apply après relecture serveur et reload immédiat utilisent les mêmes propriétaires.
Les objets de renouvellement restent des read-models ; seule la révision de Plan
C0 contient leur snapshot et les preuves de compilation habituelles. Aucune
table supplémentaire, aucune migration et aucun historique produit ne sont écrits.

## Preuves et limites de l’éligibilité

Les acquisitions sont regroupées par Need canonique, personne et date réelle.
Plusieurs lignes le même jour produisent un épisode ; deux Needs achetés ensemble
gardent deux épisodes, deux distributions et deux NeedOccurrences. L’identité
d’un épisode dépend de Need + date, sans dépendre du prix ou des IDs de ses lignes.
L’identité d’une NeedOccurrence dépend de Need + dernier épisode réel ; recalibrer
sa fenêtre ou changer le mois cible la conserve. Une nouvelle acquisition réelle
fait avancer cette identité et rend un ancien rattachement invalide.

La couverture produit reprend les périodes canoniques du foyer closes, avec
révision de source et états finance/life complets, avant le cutoff et le mois cible.
Elle utilise tout ce corpus, indépendamment de la fenêtre financière glissante de
douze mois. Les mois comparables sont publiés dans le profil. Les intervalles qui
traversent un trou de couverture n’enseignent aucune cadence ; le trou interdit
la certification. La durée couverte est la somme des intervalles admis.

La politique versionnée `planner-renewals@v1` impose au moins quatre acquisitions
distinctes et trois intervalles couverts, une identité produit stable, un ratio
IQR/médiane ≤ 0,5 et un ratio gap maximal/minimal ≤ 3. Une acquisition ne produit
pas de cadence ; deux montrent une répétition ; trois restent candidates. Les
quantiles réutilisent `referenceQuantile`, avec arrondissement des dates au jour.
Aucune probabilité numérique de réapprovisionnement n’est fabriquée.

Mascara Manon et sourcils Manon sont les seuls produits auto-éligibles V1. Leur
Need et leur personne doivent correspondre aux autorités canoniques. Une cadence
certifiée n’autorise un état temporel connu que si la couverture continue atteint
au moins la veille du cutoff. Sinon le besoin reste UNKNOWN / manuel, avec un
diagnostic. Cela inclut un mois courant insuffisamment couvert et empêche un faux
LATE à partir d’anciens imports. La couverture reste conservatrice : aucune preuve
des jours récents n’est inventée.

Eyeliner, cire, skincare, haircare et les autres soins restent EXPLICIT_ONLY,
même lorsqu’ils présentent plusieurs observations. Les Needs connus sans
observation ont count = null et dueWindow = null. Le lecteur demande aussi les
clés V1 gated pour retrouver les Needs canoniques existants sans observation ; il
ne crée aucune ligne de Need lorsqu’une clé n’existe pas.

Le coiffeur Adrien réutilise exclusivement l’assertion Canonical USER_VALIDATED,
son nombre mensuel et son prix indicatif. Le Need personnel dérivé porte une
identité explicite `personal-habit:<personId>:hairdresser` ; il ne réattribue pas
silencieusement le Need legacy `coiffeur_foyer`. Sa cadence mensuelle déclarée
prime sur les observations faibles. Aucune date de visite ni cadence en jours
n’est inventée. Le nombre peut exceptionnellement être fixé à zéro dans le Plan.

## Compilation et coût

Les produits certifiés exposent des ConditionalOccurrences, dont la capacité
n’est pas une réservation centrale automatique. `SET_STATE { count: 1 }` accepte
le besoin, `count: 0` le reporte pour ce scénario. Un prix manquant peut être
renseigné explicitement ; il reste null dans la Baseline. Les Needs manuels
n’acquièrent aucun calendrier à partir de cette confirmation.

Le socket `beauty-restock.products` publie `acceptsNeedOccurrence`. Un composant
peut y porter `needOccurrenceId`, que le serveur vérifie contre la Baseline relue.
Un composant représente une acquisition ; une quantité différente de un est
refusée. Un besoin identifié et calibré consomme sa capacité une fois. Le coût
résiduel du slot devient zéro après consommation et le composant explicite reste
le seul coût de cet achat. Une seconde sélection du même besoin est refusée,
sauf intention explicite EXTRA_TO_SLOT. Deux Needs dans un panier ne fusionnent
pas leurs identités ni leurs cadences.

Une acquisition manuelle d’un Need non calibré utilise le prix saisi avec
NO_RELATED_SLOT ; elle ne prétend pas déplacer une réservation inexistante.
Une valuation ou une relation incertaine reste UNKNOWN. Les suggestions
PERSONAL_SUGGESTION n’activent ni slot ni coût ; un Context actif sans sélection
économique acceptée conserve le diagnostic C4 de composition incomplète.

Les prix produit servent exclusivement de références unitaires prospectives,
pas d’allocations du débit bancaire du panier. Ils sont calculés par épisode puis
par profil, sans sommer les références produit comme un paiement certifié.
L’assertion coiffeur conserve INDICATIVE_PRICE_NOT_PAYMENT ; les produits portent
OBSERVED_PRODUCT_REFERENCE_PRICE. Le financement demeure celui du moteur V2.

## Certification

`node scripts/check-phase2-planner-renewals.mjs` : **31 groupes PASS**.

| Oracle obligatoire | Preuve |
| --- | --- |
| REN-001 | Deux lignes produit le même jour : un épisode, aucun gap nul |
| REN-002 | Co-achat mascara/sourcils : distributions séparées |
| REN-003 | Couverture récente manquante : UNKNOWN, aucun faux LATE |
| REN-004 | Fenêtre centrale novembre → octobre : identité conservée |
| REN-005 | Deux components : deux consommations, chaque capacité consommée une fois |
| C6-006 | Coiffeur personnel validé devant un historique foyer faible |
| C6-007 | Deux acquisitions seulement : besoin manuel, achat explicite possible |
| C6-008 | Un Purchase/BeautyRestock Context conserve deux NeedOccurrences |
| C6-009 | Mois cible novembre → décembre : identité conservée |
| C6-010 | SWAP_PRODUCT et champ produit de remplacement refusés |
| C6-011 | Aucun apprentissage automatique de ShoppingSession |

Les 20 groupes supplémentaires couvrent déterminisme, cutoff d’autorité, gates explicites, seuils,
dispersion, produit mixte, trous internes, absence de réservation automatique,
confirmation/report, prix inconnu, suggestion exclue, couverture du mois courant,
correction de ligne, historique produit complet, double consommation, nouvelle
acquisition, scope, prix non bancaire, propriétaire financier et refus avant
écriture des previews périmés ou des capabilities forgées.

La fixture longue reproduit les gaps synthétiques 65/98/60/56/71 : médiane 65,
P25 60 et P75 71, sans tronquer la première acquisition hors corpus financier.
Les round trips vérifient projection, scénario et manifest, sur PGlite synthétique
avec la SQL C0 inchangée. Les huit canaris historiques interdisent toute écriture.
Les prix ou acquisitions changés invalident le preview avant le premier appel RPC.

Régressions : C0 contrats/persistence, C1 Baseline, C2 Kernel (40 groupes), C3
leviers simples (30), C4 Contexts (29), C5 Mobility (37), Needs/materiality,
Persona et ses suites golden/direct/editorial, Planned Finance, category targets,
savings, month decisions et decision engine : **PASS**. Le mock de lecture serveur
C2 a été actualisé pour exiger les options C6 et son builder ; les garanties
financières et la voie DIRECT_V2 sans Plan sont rejouées sans changement.

Architecture : **PASS — 824 fichiers**. TypeScript et build Next.js : **PASS**.
Le build final est effectué après les derniers changements du corpus produit.

## Périmètre distant et suite

Les Apply de certification appellent uniquement PostgreSQL synthétique PGlite.
Aucun appel réel à la RPC distante, aucun test Supabase distant avec écriture,
aucune migration, aucun reset, aucun import ou provider externe n’ont été lancés.
Les suites V2 emploient des mocks et un secret synthétique de test.

Aucune UI, SWAP_PRODUCT ou ShoppingSession automatique n’est ajoutée. La
réconciliation avec des acquisitions réalisées dans le mois courant et les
PlannedExpenses externes n’est pas inférée depuis un montant bancaire. Le lot
certifie les propriétaires et leur intégration sur fixtures ; il ne certifie pas
une éligibilité actuelle des données personnelles distantes. C7 n’est pas commencé.

```ini
C6_RENEWALS_READY = YES
```
