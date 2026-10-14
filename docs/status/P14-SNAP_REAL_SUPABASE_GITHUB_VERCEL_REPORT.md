# P14-SNAP-REAL — intégration réelle

## État de préparation, 14 octobre 2026

Mission en cours : publication et mesures authentifiées restent à exécuter. Aucun gain utilisateur revendiqué à ce stade.

- Base locale : `82fc5bbc63a93ec852c16d94e51bb71bf6c0bacc` (SNAP-2), branche `codex/composer-v3-p14-snap-real`.
- Main/Production avant livraison : `7d7e8833305c7479bea7edd1778da46f729a0e68` (P13). Le diff produit inclut les dépendances P14 Express/CSS/golden/P1/P2/P4A/P4B/P4D, le prototype P3 maintenu OFF et SNAP-1/2. Aucun merge aveugle de branches architecturales expérimentales.
- Supabase Budgetisation, PostgreSQL 17.6, eu-central-1. Migration additive `20261014105944_planner_activity_history_durable.sql` effectivement appliquée. `enabled=false`, revision 0, writer coverage true, aucun artifact initial.
- PostgreSQL local distinct 17.11 : migration exacte, 17 contrôles SNAP-2 PASS ; 5 contrôles maintenance supplémentaires PASS. Ce ne sont pas des preuves JWT Supabase.
- Régressions complètes des dépendances : 28 PASS, 1 FAIL préexistant `phase2-planner-interactions` / R3-008 (`CONTEXT_REFERENCE_OWNER_UNAVAILABLE`). Aucun golden modifié pour masquer ce FAIL.
- TypeScript PASS, build Next complet PASS, exit 0. Dépendances locales réutilisées.

## Architecture effectivement branchée

`authorizedPlanner` construit un reader authentifié uniquement si SNAP=1. READ/mutations/SUGGESTIONS peuvent l'utiliser. Apply/CHECK_APPLY gardent la relecture autoritaire directe. Aucun nouveau moteur financier.

Préparation explicite authentifiée, auteur/foyer déduits du serveur, protection Origin, hors READ. Une erreur ambiguë de publication entraîne une relecture, jamais une seconde écriture aveugle ; rejet CAS certain limité à deux essais.

Maintenance quotidienne Vercel Cron à 00:15 UTC, secret sécurisé, registre limité à 64 scopes déjà publiés. Aucun worker, queue ou World persistant. Une invalidation entraîne immédiatement MISS + direct ; préparation manuelle possible après import, Cron rétablit les scopes ensuite. Le changement quotidien de cutoff peut provoquer une fenêtre MISS après minuit local ; aucune garantie de HIT permanent. Granularité globale conservatrice et croissance des cutoffs à mesurer, sans purge automatique.

## Sécurité et frontières

Deux tables privées RLS sans policies, aucun droit DML/read direct anon/authenticated/service_role. RPC inspect seulement authenticated, publisher/inspect trusted/registry seulement service_role. Owners postgres et search_path vide vérifiés. Les sept triggers source/scope sont ALWAYS, type statement ; couverture contrôlée à chaque admission.

Sources métier/financières de production strictement en lecture seule. Les seuls writes distants autorisés sont schéma/config/artifacts SNAP. Aucun Apply, publication Global/Forecast forcée, modification d'Auth ou de foyer de test. Les tests adversariaux sont synthétiques locaux.

Instrumentation opt-in, agrégats techniques uniquement : noms de ressources, nombres, durées, octets JSON décodés. Aucun paramètre de requête, source row, secret ou identifiant utilisateur. Région inchangée (iad1). Preview autosave Draft OFF et garde de lecture seule pour éviter toute écriture financière pendant les mesures.

## Rollback

1. Flag `COMPOSER_P14_SNAP1_ACTIVITY_HISTORY=0` puis redéploiement : reader direct.
2. `UPDATE private.planner_activity_history_state SET enabled=false WHERE singleton` : admission refusée immédiatement, artifacts conservés.
3. Writer publication : désactiver PREPARE/Cron ou révoquer EXECUTE publish service_role. Aucun DROP/DELETE.
4. Si coût des nouveaux triggers incompatible : consommation OFF, état OFF/version avancée, désactiver uniquement les sept triggers SNAP dans une migration revue ; garder tables/artifacts. Réactivation impose version/coverage vérifiées et nouvelle publication.
5. Rollback Vercel vers déploiement précédent ne retire pas les objets SQL. Ne jamais consommer un artifact après DDL/méthode sans protocole OFF → version → changement → republication → activation.

## Preuves

`docs/status/evidence/p14-snap-real/` : migration/security metadata, contrôles natifs, régressions, TypeScript, build. Les preuves distantes de HIT et mesures A/B seront ajoutées après exécution.
