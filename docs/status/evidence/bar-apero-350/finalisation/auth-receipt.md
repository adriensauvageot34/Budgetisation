# Durabilité authentifiée — 2026-10-18

PASS_AUTH_HTTP_NOT_BROWSER sur 1624edcb77867f4861209283c69e666e1289e06a, Preview dpl_9UcA8pqAGLLPb1oLRjVD8Jru7KDD.

Un seul Draft synthétique A/H1, janvier 2027, cible initialement vide, zéro PlanRevision. SAVE v1 → replay même requête sans commit → nouvelle session JWT → relecture exacte → montant seul 8→9 v2 → CAS périmé refusé → archive récupérable v3. IDs, liens, unités, date, deux Bières, Before et trajets conservés. Voir auth-http-reception.json. Les writers, contrats et RPC n'ont pas changé entre 1624 et ba949a65796850ecfaec83e0aba03566b82b9058.

Le premier 403 COMPOSER_DRAFT_DISABLED a été distingué d'une erreur de writer. L'override autosave/canari A ne concerne que la Preview isolée. Le bootstrap Composer de H1 échoue séparément avec FORECAST_ACTIVE_GLOBAL_PUBLICATION_MISSING (digest 4024053469). Aucune publication financière n'a été créée pour contourner ce prérequis. Aucune preuve de FRESH/World authentifié ni de création UI riche intégrée n'est revendiquée. L'ancienne erreur personnelle n'a pas été reproduite : cause historique inconnue.

Nettoyage réellement effectué : signOut global demandé, A rebanni (876000h), marqueur administrateur retiré, état relu via Auth Admin et confirmé FIXTURE_A_REBANNED_MARKER_REMOVED. Les deux anciens Drafts de novembre restent intacts ; l'unique nouveau Draft est conservé en archive v3. Les processus locaux de transmission de secrets ont été arrêtés. Aucun secret dans les pièces versionnées. Pas de test de révocation immédiate d'un ancien JWT revendiqué.

Le bridge local refusait initialement l'Origin opaque dû à Referrer-Policy:no-referrer ; passage à same-origin, contrôles Host/Origin/CSRF/CSP maintenus. Ceci est un défaut du harnais local, pas du writer Composer.

Décision minimale : fournir une publication Global admissible dans un environnement de test préparé, ou autoriser séparément sa préparation par l'owner. Pas d'utilisation du foyer personnel en remplacement.
