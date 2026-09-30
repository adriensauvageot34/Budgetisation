# Phase 2 — C6 / C7 — fiabilité et réalité déclarée

Certification du 30 septembre 2026 (Europe/Paris), depuis C0–C5 du dépôt courant.

## Implémentation

- Preview, Save et lifecycle consomment la même résolution serveur du domaine partagé et le même `deriveMonthScenario`. Les autorités calculées client sont refusées. Le Save recharge les références, observations de trajet et prix carburant ; les ressources du mois sont relues avant simulation.
- UUID stable de création arbitré par la clé primaire, sans upsert ni framework global. Double requête ou replay identique conserve une root ; collision d'intention refusée.
- Compare-and-set des mutations avec `updated_at`, foyer, ID et statut. Un concurrent ne peut pas être écrasé silencieusement. Les erreurs gardent code, path, message humain et cible de réparation ; le brouillon reste ouvert.
- Déclaration atomique : relecture scoped, validation, simulation puis un UPDATE de contenu final + statut. Correction et restore dédiés ; aucun workflow « modifier puis marquer ».
- Une date passée dérive « À confirmer ». Seulement PLANNED / DECLARED_REALIZED. Funding Banque/Swile/Edenred réservé ou utilisé déclaré, sans écriture dans un wallet observé. Contenu identique : économie et baseline neutres.
- Correction des lignes finales, financement repas/mixte à reconfirmer, aucun BANK de secours ni répartition silencieuse d'une différence globale sur plusieurs lignes.
- Report conservant la root, changement de date/mois, recalcul propre au mois cible. Réutilisation des hypothèses de travail comme estimations autorisée par l'utilisateur ; aucune copie des déclarations mensuelles Swile/Edenred. Navigation entre mois et saisie explicite des ressources manquantes.
- Suppression prospective après confirmation spécifique, PLANNED ou déclarée ; projections recalculées depuis les roots restantes. Pas de CANCELLED, Observed, realizedDate, second amount ou recovery cloud.

## Migration et audit live

Migration ciblée approuvée puis appliquée :
`20260929232710_phase2_planned_report_month.sql`.
Elle accorde uniquement UPDATE sur `target_month` à authenticated, sous les RLS
existantes. Le nom/version local correspond à l'historique distant.
Avant migration : 0 ligne prospective ; après : 0 ligne, RLS active, droit ciblé actif.

Audit du 29 septembre 2026 à 23:48 UTC (30 septembre en France), en lecture seule :

| Authority | Avant / après |
| --- | ---: |
| phase2_planned_expenses | 0 |
| phase2_month_inputs | 1 |
| operations | 1660 |
| life_events | 938 |
| mobility_trips | 296 |
| mobility_legs | 684 |
| analytics_query_snapshots | 20384 |
| analytics_artifacts | 7430 |

Novembre est résolu depuis les autorités canoniques courantes, avec son mois de
référence et ses jours de travail. Sans déclaration mensuelle, ses ressources
repas restent inconnues. Une simulation en mémoire avec des ressources synthétiques
du mois utilise seulement ces valeurs. Aucun snapshot n'est publié par cette lecture.

## Vérifications

- `check-phase2-planned-reliability.mjs` : quatre parités économiques complètes, dont route/fuel, resolver, IDEMP-CREATE-01/02, drift wallet/prix/observations/lieux, tampering, CAS avant et après validation, cross-household, META-15/16/17, Preview sans écriture.
- `check-phase2-planned-reality.mjs` : REAL-01..07, IDEMP-REAL-01, STALE-REAL-01, report intra/inter-mois, ressources propres au mois via la vraie action de saisie, suppression, restore, mauvais statuts, funding final, itemized, META-09..13/19. La frontière SQL est simulée avec unicité et CAS ; les mutations passent par les vraies actions/services/moteur. Les fixtures sont synthétiques.
- Régressions C1, C2, C3, assets, Planned Expenses, liste/calendrier, routes et finance : PASS. Imports d'architecture : PASS.
- Audits live C4/C5 et C6/C7 en lecture seule : PASS, compteurs inchangés.
- TypeScript et build Next.js de production : PASS.
- Navigateur local connecté : Preview à 25 €, modification à 28 € invalidant le résultat précédent, abandon du seul brouillon, navigation novembre et formulaire de ressources vide. Aucun Save ni lifecycle réel n'a été exécuté dans ce parcours navigateur.

Limite de certification : les scénarios de concurrence et les mutations lifecycle
sont exercés sur la frontière SQL simulée, pas sur des écritures de fixtures dans
la base distante. Le navigateur réel couvre le parcours de simulation et la
navigation ; la base réelle est auditée en lecture seule.

## Gates

```ini
C6_PREVIEW_SAVE_PARITY = PASS
SAVE_SERVER_AUTHORITY = PASS
CREATE_IDEMPOTENCE = PASS
STALE_WRITE_PROTECTION = PASS
PREVIEW_HISTORICAL_ZERO_WRITE = PASS
C7_REALITY_TRANSITION = PASS
ATOMIC_DECLARE = PASS
LIFECYCLE_IDEMPOTENCE = PASS
STALE_REALITY = PASS
CANCELLED_STATUS = ABSENT
HISTORICAL_WRITES = 0
```

Périmètre ordinateur. Publication par push sur `main`, conformément à la demande
utilisateur ; aucune vérification Vercel demandée ni exécutée.
