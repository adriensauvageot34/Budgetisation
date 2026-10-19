# Google Maps, favoris et Mobility — livraison Production

19 octobre 2026. **Livré et vérifié, avec les limites fournisseur ci-dessous.** Aucun développement supplémentaire ni activation Canonical partagée.

## Livraison effective

- Départ `main` : `bd97a33d0e4280b7796e941148057b7693af0229`.
- [PR #66](https://github.com/adriensauvageot34/Budgetisation/pull/66) rendue Ready puis fusionnée normalement : `5f469ff0da8d879a36c9af5be7486994bf0bd27a`. Production intermédiaire `dpl_E8SAJerSzvn3U7eDJKFntHqcbE9A` READY avant la suite.
- [PR #67](https://github.com/adriensauvageot34/Budgetisation/pull/67) retargetée sur main, recalculée sans conflit, rendue Ready puis fusionnée normalement : **`5f98040cffbcd3437287367775e9b368b81123cd`**. Aucun force-push ni contournement des protections GitHub. Les checks Vercel des deux heads étaient success.
- Arbre Git complet du merge : `291b7b63de8df0151a4b4dc41e0dc031ee108f3e`, identique à celui du head revu `f45f018`. Les SHA sont distincts ; les fichiers sont identiques.
- Déploiement initial #67 `dpl_5Ud1biQWfcnCiSZBFyveZpo4U78G` READY avec favoris OFF. GET authentifié : `enabled:false`.
- Activation du seul flag `BAR_PERSONAL_PLACES_ENABLED=1`, puis redéploiement du même commit : **`dpl_5EbosW3rDSitGXToi7fK3PEWHFBc`**, target **production**, READY. Les trois alias principaux pointent vers ce déploiement, dont [Budgetisation](https://budgetisation-tan.vercel.app).
- Secrets Google/TomTom/HERE et identifiants Supabase Production conservés. Aucun secret Bar-Test copié. SNAP-3 reste à 1 ; prototype P3 à 0 ; autres flags inchangés.

## Migration personnelle

Source approuvée : `supabase/migrations/20261019103139_personal_google_places.sql`.
SHA-256 disque et Git vérifiés : **EC954ECEA09B152312244679860D703622290DB24322DB0B811BC1241E62B9C3**.

Appliquée une seule fois par le mécanisme officiel Supabase MCP sur **ipuuhxrblxormwgoaqnz / Budgetisation**, PostgreSQL17.6, rôle postgres, base non read-only. L'outil attribue la version Production **20261019120247 / personal_google_places**. Cette correspondance avec le fichier source versionné est conservée ici ; ne pas réappliquer le fichier sous sa version de test ni lancer un db push global.

Contrôles après commit : deux tables privées appartenant à postgres ; RLS activée ; trois index uniques ; quatorze contraintes ; zéro favori et zéro reçu avant canari. Aucun DML direct pour anon/authenticated/service_role. Fonction privée DEFINER et wrapper public INVOKER, propriétaires postgres, search_path vide ; EXECUTE seulement service_role. Membership et bannissement revérifiés dans le writer. Aucun writer financier ou Canonical ajouté.

Advisors : INFO deny-all attendu pour les deux tables privées sans policies ; avertissements existants sur les RPC d'inspection SNAP et la protection des mots de passe compromis. Aucun changement de ces protections dans ce lot. Ce contrôle de catalogue Production complète les tests Auth/JWT multi-auteurs déjà exécutés sur SQL identique dans Bar-Test ; ce n'est pas une nouvelle campagne multi-comptes Production.

Sauvegarde B0 toujours disponible :188229114 octets, EFS Encrypted, SHA-256 **7EDCF52017A8BD85D7D855331EE5AF4F5522B77046F33D3A36CD65E946FB8C37**. Restauration critique PostgreSQL17 antérieure conservée ; exclusions administrées Supabase/vault et dépendance au profil EFS inchangées. Sauvegarde datée du11 octobre, pas un point de récupération des modifications ultérieures. Le rollback de cette release est applicatif, sans restauration destructive de la base.

## Canari authentifié Production

Session utilisateur existante, aucun nouvel utilisateur/foyer. Novembre2026 affichait « Aucun brouillon enregistré ». Une seule carte Bar de canari, aucun montant de consommation retenu, date et personnes inconnues conservées.

| Étape | Preuve exécutée |
|---|---|
| Google Bar | Autocomplete réel Invader/Montpellier, fiche Details, choix explicite distinct de l'enregistrement personnel |
| Favori SAVE | Reçu SAVED v1, request `0a168a40-2382-40c6-bbda-ac6b55a55f69` |
| Reload | Rechargement réel ; Draft sauvegardé repris, bar retenu conservé ; favori relu dans la recherche réouverte |
| Renommage | SAVED v2, request `255438aa-b12c-46fb-b270-7bd6d3d25128` ; libellé de la sortie inchangé |
| Archive | ARCHIVED v3, request `4151c4a8-d986-4708-88a5-415412c07ca5` ; sortie toujours liée au même bar |
| Récupération | SAVED v4, request `dec022e8-dae8-49f7-8058-e2e3ae38f355` ; une seule ligne et les quatre reçus relus en base |
| Nettoyage favori | ARCHIVED v5, request `7d2d8e71-46e0-4f0a-99c9-f89286cab45b`, récupérable |
| Nettoyage Draft | « Abandonner mes essais » confirmé : unique Draft de canari ABANDONED v9. Zéro ACTIVE pour son auteur/foyer/mois ; les autres archives/auteurs restent hors intervention |

Chaque mutation personnelle a présenté sa version attendue et son reçu unique. Les tests de concurrence, rejouabilité et réponse perdue de Bar-Test restent les preuves de ces cas : ils ne sont pas réétiquetés comme tests Production.

RAW réel : saisie `8,`, tentative de changement de date, « Continuer à modifier », valeur `8,` conservée. La saisie a ensuite été explicitement abandonnée sans retenir8€. Undo a retiré le retour du canari, Redo l'a rétabli. Anciennes estimations affichées « précédent/actualisation » pendant recalcul ; Apply indisponible. La projection finalement actualisée reste BLOCKED en raison des informations du mois manquantes : aucun PASS Apply ou mois READY revendiqué.

Google fonctionne également dans « Ajouter une dépense » sur le mois déjà préparé : Restaurant → date inconnue → recherche Café Riche/Montpellier → résultat Google → Details → étape transport. Formulaire quitté sans simulation d'enregistrement ni dépense créée. Sur novembre incomplet, le bouton d'ajout n'ouvrait pas ce formulaire ; aucune ressource réelle n'a été modifiée pour rendre le mois admissible.

## Mobility réelle et limites

Scène de canari : origine publique résolue Aéroport Marseille-Provence, bar Google à Montpellier, Peugeot207 explicitement retenue. Pas de domicile textuel transformé en coordonnées supposées.

| Sens | Distance | Durée | Carburant consommé estimé | Coût d'usage affiché |
|---|---:|---:|---:|---:|
| Aller |154,525km|6262s|11,270291L|22,50€|
| Retour indépendant |155,038km|6049s|11,193653L|22,34€|

L'UI indique explicitement **prix de carburant de repli**, **estimation partielle**, **péage à préciser**, **aucun achat de carburant**. Ces valeurs ne sont ni un plein payé ni une nouvelle référence officielle fraîche. Compiler/FinanceV2 restent propriétaires.

Le canari Production démontre le calcul réel des deux itinéraires et la présentation honnête de l'inconnu. **Il ne démontre pas un péage positif HERE en Production ni la cause précise de son indisponibilité sur ce parcours.** Les appels HERE positifs32,80€/32,80€/5,50€ et le refus urbain importSplitRoute restent les preuves réelles antérieures du fournisseur sur le code conservé. Aucun résultat de ces parcours n'est attribué au canari Production. La politique UNAVAILABLE/null, sans faux zéro ni tarif d'un autre trajet, reste appliquée ; aucune nouvelle investigation fournisseur lancée.

## Vérifications finales et frontières

- Parité :22cas ×9empreintes = **198/198**, goldens inchangés.
- TypeScript : `npx.cmd tsc --noEmit`, exit0.
- Favoris React/HTTP :7groupes PASS ; Google/route :7groupes PASS. Preuves locales distinctes du canari authentifié.
- Build Production Next16.2.6 complet : compilation29,9s, TypeScript, pages, Build Completed puis Deployment completed. Logs/extraits et métadonnées conservés ; certaines listes MCP sont tronquées et ne constituent pas un journal exhaustif.
- Gardes : page de recette404 en session Production authentifiée ; GET public redirigé vers Auth ; paramètre OTP de recette sur connexion n'expose aucun mécanisme OTP ; GET API de recette405. Matrice de garde serveur Preview/projet exact déjà PASS. Une sonde POST contenant APPLY a été **refusée avant exécution** par auto-review et retirée, sans contournement ; aucun Apply n'a été envoyé.
- API personnelle anonyme401 après activation. Catalogue droits Production vérifié ; séparation multi-auteurs prouvée par les JWT isolés antérieurs, sans nouveau compte réel utilisé.
- Compteurs INSERT/UPDATE/DELETE des **17 tables sensibles** contrôlées : strictement identiques avant/après, diff vide. Plans officiels0, PlanRevisions0. Aucun achat, Operation, PlannedExpense, Wallet, MonthInput, trajet observé ni lieu Canonical créé par le canari. Ces compteurs statistiques ne sont pas un audit ligne par ligne de toute l'activité de la plateforme.
- Aucune erreur runtime trouvée sur les routes modifiées et Composer dans la fenêtre ciblée après activation.
- Canonical partagé : candidat non appliqué, registry/writer non activés ; aucun droit d'éditeur ou classification ajouté.
- Aucun correctif produit supplémentaire nécessaire pendant cette release. Pas de migration supplémentaire, de nouveau cache ou de changement des propriétaires financiers.

## Rollback non destructif

1. Si incident personnel : `BAR_PERSONAL_PLACES_ENABLED=0` en Production puis redéploiement du commit courant. Vérifier GET `enabled:false` et refus du POST par le contrat, sans Apply.
2. Si régression applicative : rollback Vercel vers `dpl_Dx2yWDXQcSLELioKADymN6GGu1Gn` (main précédent bd97a33), après fermeture du flag. Aucun rollback n'a été exécuté. Un rollback Vercel peut suspendre l'assignation automatique des prochains déploiements ; reprendre ensuite le flux par promote contrôlé.
3. Conserver tables, favoris, reçus, Drafts et archives. Aucun DROP, DELETE ou restauration globale B0. Retour Git possible par revert revu, sans réécriture d'historique.

## Verdict

```ini
RELEASE_GOOGLE_MOBILITY_OCT2026 = DELIVERED_VERIFIED_WITH_DOCUMENTED_LIMITS
GITHUB_MAIN_BEFORE = bd97a33d0e4280b7796e941148057b7693af0229
GITHUB_MAIN_AFTER = 5f98040cffbcd3437287367775e9b368b81123cd
PR_66 = MERGED_5f469ff0da8d879a36c9af5be7486994bf0bd27a
PR_67 = MERGED_5f98040cffbcd3437287367775e9b368b81123cd
MERGE_VERIFIED = YES_EXACT_TREE
SUPABASE_PRODUCTION_PROJECT = ipuuhxrblxormwgoaqnz
PERSONAL_MIGRATION_PRODUCTION = APPLIED_VERIFIED_20261019120247
PERSONAL_RLS_PRODUCTION = CATALOG_PASS_AUTH_ISOLATION_PROOF_REUSED_IDENTICAL_SQL
PERSONAL_RPC_PRODUCTION = PASS_SERVICE_ONLY_REAL_CANARY
VERCEL_PRODUCTION_URL = https://budgetisation-tan.vercel.app
VERCEL_DEPLOYMENT_ID = dpl_5EbosW3rDSitGXToi7fK3PEWHFBc
VERCEL_PRODUCTION_SHA = 5f98040cffbcd3437287367775e9b368b81123cd
VERCEL_PRODUCTION_READY = YES_ALL_MAIN_ALIASES
PERSONAL_FAVORITES_FLAG = ACTIVE_1
PERSONAL_SAVE_PRODUCTION = PASS_AUTH
PERSONAL_RELOAD_PRODUCTION = PASS_AUTH_REAL_RELOAD
PERSONAL_RENAME_PRODUCTION = PASS_AUTH
PERSONAL_ARCHIVE_RECOVERY_PRODUCTION = PASS_AUTH_FINAL_ARCHIVED_5
GOOGLE_PLACES_PRODUCTION = PASS_BAR_AND_EXPENSE_SEARCH
TOMTOM_PRODUCTION = PASS_TWO_INDEPENDENT_ROUTES
FUEL_PRODUCTION = PASS_OWNER_ESTIMATE_EXPLICIT_FALLBACK
HERE_PRODUCTION = UNKNOWN_ON_CANARY_POSITIVE_TOLL_NOT_RECERTIFIED
HERE_URBAN_POLICY = ACCEPTED_UNAVAILABLE_NO_FALSE_ZERO_PRIOR_LIVE_PROOF_RETAINED
RAW = PASS_AUTH_TARGETED
UNDO = PASS_AUTH_UNDO_AND_REDO
FINANCE_PARITY = PASS_198_198
TYPESCRIPT = PASS_EXIT_0
BUILD = PASS_FULL_NEXT_VERCEL_PRODUCTION
NO_UNINTENDED_FINANCIAL_WRITES = VERIFIED_17_COUNTERS_UNCHANGED_NO_APPLY
CANONICAL_SHARED_ADMISSION = OFF_NOT_CERTIFIED_LIVE
TEST_RECEPTION_GUARDS = PASS_NO_APPLY_ATTEMPT
ROLLBACK_READY = YES_NON_DESTRUCTIVE
PRODUCTION_RELEASE_VERIFIED = YES_WITH_PROVIDER_LIMITS
MAPS_MOBILITY_FROZEN_FOR_OCTOBER = YES
REMAINING_CRITICAL_BLOCKERS = NONE_FOR_DELIVERED_SCOPE
```

Preuves : `docs/status/evidence/bar-google-production-release/`. Les réceptions historiques restent conservées ; aucune certification globale des350 cas ou de tous les trajets HERE n'est ajoutée. **Clôture et gel du périmètre livré pour octobre.**

