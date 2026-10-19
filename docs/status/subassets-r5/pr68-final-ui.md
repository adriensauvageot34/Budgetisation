# PR68 — clôture opérationnelle UI (gates externes reportés)

Base contrôlée sur GitHub :34994a6, branche codex/bar-subassets-r5, PR68 ouverte/Draft, main5f98040. Travail historique et78A conservés ; outputs non suivi préservé. Déploiement main→Production automatique, aucune double commande de publication prévue.

Le diff applicatif hérité contient des composants UI et le host de recette protégé. Le serveur de recette ne lit que des faits synthétiques et refuse Apply ; l’ajout est un lieu fictif en mémoire. Les mutations existantes de favoris personnels ne changent pas ; seules leurs suggestions/affichages sont raccordés. Aucun fichier de migration, contrat/domain financier ou writer Draft/Plan/Google/Canonical/Mobility changé par la PR. Pas d’excuse Auth différée pour un writer nouveau.

## Table ciblée G0

| ID | Défaut / preuve manquante | Composant owner | Action / oracle attendu | Statut initial |
|---|---|---|---|---|
| UI093 | Effacement filtre150 sans remesure | ContextPalette | Mesurer les options effectivement rendues, clic/effacement/clavier et fin de rail25/120/150 | FAIL_BROWSER reproduit |
| UI097 | Ordre pertinent, pas de corpus réel | Bar/editor/catalogue | Fixtures lieux connus/sans historique, Before/Au bar, familles ; aucune admission implicite | LOCAL |
| UI100 | Rafale et focus non observés | Dock/editor | Cinq ajouts puis familles, hauteur/rail/focus mesurés | LOCAL |
| UI046 | Résultats tardifs, erreurs, photo | BarPlaceSearch | Mocks loading/error/stale, nom long ; photo non publiée signalée | PARTIAL |
| UI141/148 | Mini-édition supportée vs parts absentes | BarLivingEditor | Quantité/prix/unité/IDs, RAW/Undo ; parts différées | PARTIAL |
| UI203/204/222 | Dock sous viewport1152 | Dock/host/document | Dernière action atteignable par défilement externe et clavier, zéro scroll interne | PARTIAL |
| UI220 | Dernier Redo désactive le bouton focalisé | ComposerShell | Destination d’historique toujours montée ; fermeture coût vers sa propre ancre | PARTIAL |
| UI035/live046 | Fournisseur réel | Capacité existante | Aucun appel live dans ce lot | DEFERRED_EXTERNAL_GOOGLE_REAL |
| Save/Reload réel | Tables isolées absentes | Gate externe | Aucun schéma ou compte ajouté | DEFERRED_AUTH_SAVE_RELOAD |
| UI215/zoom203204 | Zoom natif indisponible | Gate externe | Pas de simulation DPR | DEFERRED_NATIVE_ZOOM_125 |
| UI129/130/142/160 | Parts / OTHER nommé | Contrats propriétaires | Report utilisateur conservé, pas d’extension | DEFERRED_OWNER_APPROVED |

Plan limité : patch overflow et focus, tests ciblés/mocks/parité, une Preview regroupée et réception desktop ; retest uniquement sur défaut observé. Décision de livraison fondée sur ces gates UI. Les55C et la compaction générale ne sont pas développées.

## Reports de certification

Voir [deferred-reception.md](deferred-reception.md). Aucun de ces reports ne devient PASS, ni une condition automatique empêchant une livraison UI sûre.

## Résultat des gates UI et décision

**Gates du lot UI réussis, GO_MAIN=YES sous protections GitHub normales.** L’état de livraison effectif est consigné dans la PR puis dans les preuves finales ; aucune promotion manuelle redondante prévue.

| Champ | Résultat exécuté |
|---|---|
| PRODUCT_SHA_TESTED | ecca4bff353284c2fccea22fca4e7139e0bf422d |
| PR_URL | https://github.com/adriensauvageot34/Budgetisation/pull/68 |
| UI093_CLEAR_FILTER_OVERFLOW | PASS_BROWSER au SHA final |
| UI097_RELEVANCE_FIXTURE | PASS — ordre propriétaire positif/sans historique, familles/moments, recherche exhaustive |
| UI100_DOCK_STABILITY | PASS_BROWSER — cinq Bière, focus/famille conservés, hauteur143px/top704,6px identiques |
| UI046_LATE_PHOTO_MOCK | PARTIAL — loading/error/stale/out-of-order PASS ; photo non publiée, données photo ignorées sans sélection automatique |
| UI141_UI148_SUPPORTED_EDITOR | PASS supporté — RAW12, annulation, prix12.50, quantité2/coût25, financement Banque25 explicite ; parts non développées |
| UI203_UI204_DESKTOP_1152 | PASS_ACCESSIBLE par défilement de MAIN extérieur aux surfaces Composer ; pas « tout visible sans scroll » |
| UI220_FOCUS_REDO | PASS_BROWSER — dernier Redo→Undo actif ; Échap coût→sa propre ancre |
| UI222_NO_INTERNAL_VERTICAL_SCROLL | PASS_BROWSER borné aux scènes reçues aux trois viewports sans zoom |
| FINANCE_PARITY | 198/198, aucun golden changé, zéro écriture distante |
| RAW_UNDO | PASS tests propriétaires et parcours Preview |
| VERCEL_PREVIEW | https://budgetisation-haqto6h0q-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris / READY / ecca4bf |
| GOOGLE_REAL | DEFERRED_BY_USER — DEFERRED_EXTERNAL_GOOGLE_REAL |
| AUTH_DURABLE_SAVE_RELOAD | DEFERRED_BY_USER — DEFERRED_AUTH_SAVE_RELOAD |
| NATIVE_ZOOM_125 | DEFERRED_BY_USER — DEFERRED_NATIVE_ZOOM_125 |
| FOUR_OWNER_CONTRACTS | DEFERRED_OWNER_APPROVED |
| C_55_RESERVED | YES |
| NEXT_STAGE | BOARD_DIMENSIONS_AND_CARD_GEOMETRY — non commencé |

### Changements et preuve au bon SHA

`0b541bb` corrige la mesure du rail sur la projection rendue, ajoute l’effacement accessible et restaure le focus d’historique quand le dernier Redo devient désactivé. Aucun nouvel observer ni polling du rail. Le test à prop `question` stable réussit25/120/150, par bouton et suppression du texte, sans resize ; tolérance2px conservée.

La Preview regroupée a réellement exécuté :150 options affichées avec dernière sélection au clavier, cinq ajouts et familles, mini-édition avec refus d’un financement Banque vide, trois participants puis retrait1, lieu connu long, Before4 objets,20 postes au bar et dernière page5/5. Souris/clavier, calendrier sans dock et RAW12, protégés. `0b541bb` avait encore un retour coût→Replier ; échec préservé dans `final-ui-browser.json`.

`ecca4bf` change uniquement7 lignes du retour de focus de coût : chercher l’ancre encore connectée de cette carte après stabilisation, attendre deux frames bornées, ne pas voler le focus d’un champ ou modal. Le seul retest Preview confirme **coût→ancre, RAW annulé conservé, zéro explicite, dernier Redo→Undo et UI093** au SHA final. Les autres preuves ne sont pas réétiquetées avec ce SHA : elles sont héritées du code identique0b541bb hors cleanup UI.

Tests exécutés : dock25/120/150 ; Google mock étendu ; ciblé8/8 ; P1=25/25 ; P4=15/15 ; R5=11/11 ; Finance198/198 ; TypeScript exit0 puis retest exit0 ; build final Next16.2.6 complet READY. P2/P3 sont conservés à leur preuve précédente, sans faux nouveau lancement. Les contrôles GitHub disponibles sont vérifiés avant merge ; aucun contournement de protection.

### Géométrie mesurée et risques résiduels bornés

`innerWidth/innerHeight` ont été relus à **1152×720,1440×900,1920×1080** : calendrier, lieux enregistrés, Before riche,20 postes et coût ; catalogue150 également. Quelques premiers essais de resize ont encore mesuré1440, ils restent dans la preuve comme tels et ne comptent pas pour1152/1920 ; les captures `_ACTUAL` et leurs valeurs font foi.

Rich20 : carte client393=scroll393, éditeur307=307, dock143=143. À1152, le dock descend d’abord jusqu’à889,7px ; défilement souris dans le **MAIN de la page** (extérieur à la carte, éditeur et dock) jusqu’à scrollTop205,6 donne bottom709,7px. Dernier choix Bouteille atteint au clavier, sans piège. Le rail défile uniquement horizontalement. Le calendrier n’a aucun dock ni réserve. Aucun packer, gabarit global ou carte voisine modifié.

Limites acceptées du lot : rendu photo absent plutôt que capacité inventée ; pertinence sur corpus personnel non revendiquée ; certaines questions avancées peuvent laisser temporairement body focalisé mais restent atteignables, sans perte RAW ni accès bloqué. La correction Redo et le retour coût, qui étaient les défauts reproduits, sont prouvés. Aucun contrôle essentiel inaccessible observé dans le périmètre reçu. Pas de certification générale222/222 ou167/167.

La matrice conserve les78A et14 acquisitions navigateur antérieures ; nouveaux statuts :18 acquisitions navigateur au total parmi les27 (14 anciennes+4 nouvelles),1 locale,3 PARTIAL_SCOPED,1 DEFERRED_EXTERNAL et4 DEFERRED_OWNER_APPROVED. Textes normatifs222 et55C inchangés.

A rebanni et marqueur retiré/relu, pont OTP fermé. Aucun nouveau compte, favori, Draft distant, Plan ou Apply ; aucune écriture financière ni migration. Seul l’accès temporaire au compte fictif existant a été réutilisé. Rollback après intégration : revert conventionnel du merge UI ; aucune suppression ou restauration destructive de données.

Preuves : `proofs/final-ui-browser.json`, `final-ui-retest.json`, `final-ui-*.log` et captures synthétiques `proofs/screenshots/final-ui-*`.
