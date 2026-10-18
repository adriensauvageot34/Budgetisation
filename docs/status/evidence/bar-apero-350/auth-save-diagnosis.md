# Sauvegarde riche : Draft et Preview séparés

## Conclusion

`NOT_RUN_AUTH` pour cette clôture. L'incident du 18 octobre sur bd97a33 n'est pas expliqué par les preuves disponibles. Aucun nouvel essai dans le Draft personnel, aucune réactivation de compte ni modification de droits n'a été effectuée.

Le rapport privé `outputs/bar-last/live/PRODUCTION_AUTH_RECEPTION_2026-10-18.md` a été relu intégralement. Parent/date/Bière étaient enregistrés, Before non confirmé; l'archive récupérable n'inclut pas le Before. Les erreurs Canonical57014 portaient sur `/api/composer/preview`. Aucun lien causal avec le writer Draft n'est établi. Les captures personnelles restent hors dépôt.

## Chemins propriétaires examinés

- `/api/composer/drafts` : origine exacte, contrat HTTP, taille, authentification et foyer dérivés côté serveur, gate d'activation. Aucun appel Apply ou readWorld.
- `authorizedPlanner` : authentification/bootstrap puis construction des lecteurs. La construction n'exécute pas les lecteurs historiques de Preview. Un échec bootstrap peut toutefois empêcher l'accès au writer; pas de preuve de cet échec lors de l'incident ancien.
- `composer-draft-service` : validation du Semantic Draft incomplet, digest, version/base, lecture préalable, RPC CAS, contrôle de réponse. Réponse RPC malformée/perdue : relecture puis reconnaissance du request ID/version/digest avant toute nouvelle mutation. Archive/restauration gardent leur mécanisme acquis.
- `draft-http-transport` et hook durable : réponse non confirmée reste ERROR, jamais SAVED supposé. La Preview peut être FRESH tandis que Draft est ERROR, et inversement.

## Instrumentation minimale ajoutée

`COMPOSER_DRAFT_DIAGNOSTICS=1` active uniquement, au serveur, un identifiant de corrélation aléatoire et les phases READ_PLAN_BASE / READ_DRAFTS / WRITE_SAVE / WRITE_ARCHIVE / WRITE_RESTORE, durée arrondie et code expurgé. Par défaut aucun nouveau log. Aucun payload, personne, lieu, token, message SQL, ID utilisateur/foyer ou montant. Une erreur de l'observateur ne change jamais le résultat métier.

Cette instrumentation ne prouve pas la cause historique. Elle permettra d'isoler lecture préalable, RPC et récupération lors d'un prochain test Auth autorisé. La réponse RPC valide confirme son propre commit; aucune relecture obligatoire supplémentaire n'a été ajoutée.

## Exécuté

1. `check-bar-apero-closure-draft.mjs` : cinq contrôles du service réel sur transport Supabase contrôlé. Parent, Before, enfants, date absente, UNKNOWN, unités et IDs conservés. Réponse perdue après commit : lecture puis replay, deux écritures au total pour deux requêtes distinctes; pas de troisième commit. Refus42501 et timeout57014 distincts, pas de faux SAVED. Les seules tables accessibles au transport sont Draft et Plan actif.
2. HTTP loopback réel : sept contrôles, quatre saves, CAS, perte de réponse, Undo/Redo, rich Before, Compiler38 connu et incomplet; aucun Apply dans ce parcours. Pas RLS/Auth Supabase.
3. Navigateur du candidat : rich Draft dense relu après reload local. Refus unique avant commit : ERROR/Réponse non confirmée tandis que Preview est FRESH. Une reprise par Options → Réessayer la sauvegarde aboutit à SAVED. Aucune conclusion sur l'incident Supabase ancien.

## Traversée Auth encore nécessaire

Prérequis non réunis : tenant/mois isolé effectivement accessible dans l'application, session réelle de ce tenant et nouvel accord explicite de création/archivage de son Draft de test. Les anciens foyers F0 et l'ancien accord personnel ne sont pas réutilisés automatiquement.

Dans ce tenant : relever version/digest avant; créer Bar+Before VodkaSHARED/DiluantITEM/SnackUNKNOWN+Bière/date/participants/Aller/Retour; attendre réponse SAVE confirmée; nouvelle page/session, comparer IDs/slots/unités/prix/liens; modifier un poste, relire; archiver sans DELETE et sans Apply. Corréler uniquement les phases expurgées. Si réponse perdue, relire avant de retenter avec le même request ID. Noter séparément FAILED_DRAFT, FAILED_REREAD et FAILED_PREVIEW.

Aucune migration, hausse de timeout, modification RLS/index ou donnée financière n'est nécessaire pour préparer ce protocole. Une éventuelle modification de droits exige sa propre revue.
# Complément courant — 18 octobre, réception ba949a6

La preuve récente est dans `finalisation/auth-receipt.md` et `finalisation/auth-http-reception.json` : SAVE/replay/nouvelle session/relecture/modification/CAS/archive réellement passés avec JWT A/H1. Ce PASS_HTTP_AUTH ne certifie pas le bootstrap Composer/FRESH, bloqué séparément par `FORECAST_ACTIVE_GLOBAL_PUBLICATION_MISSING`. L'ancienne erreur personnelle demeure inexpliquée. Les observations ci-dessous sont conservées comme historique.
