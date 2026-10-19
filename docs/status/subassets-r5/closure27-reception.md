# Clôture ciblée des27 lignes A — PR68

> **Réception historique conservée.** La mission suivante reporte explicitement Google réel, Auth durable et zoom125%, corrige UI093 et le focus, puis autorise la livraison si les gates UI passent. État courant : [pr68-final-ui.md](pr68-final-ui.md). Les échecs et mesures ci-dessous ne sont pas effacés.

**PARTIAL_READY_FOR_REVIEW ; GO_MAIN=NO.** Les quatre reports de contrats sont acceptés par l’utilisateur ; aucune fusion ni Production effectuée.

## Résultat exploitable

| Champ | Résultat |
|---|---|
| BASE_SHA | 5f98040cffbcd3437287367775e9b368b81123cd |
| PRODUCT_SHA_TESTED | 157b7f6b63d19a9e60d8ba5ff95d4a117e9cf849 |
| PR_URL | https://github.com/adriensauvageot34/Budgetisation/pull/68 — Draft |
| PREVIEW_FINAL | https://budgetisation-q0jchhg63-adriensauvageot34-6137s-projects.vercel.app/recette/bar-favoris — READY |
| A_PREVIOUS_VERIFIED | 78 conservées ; régressions intégrées, pas78 nouveaux parcours navigateur |
| A_27_FIXED_AND_VERIFIED | 14 FIXED_BROWSER |
| A_27_LOCAL_ONLY | 2 |
| A_27_PARTIAL | 7 |
| A_27_BLOCKED_OWNER | 4 — report accepté |
| A_27_BLOCKED_ENV / NOT_RUN | 0 / 0 (gates externes distincts ci-dessous) |
| B_62_REVIEWED | 62/62, sans déclaration62 implémentées |
| B_CRITICAL_UI215_UI220_UI222 | PARTIAL / PARTIAL / PARTIAL |
| C_55_RESERVED | YES — aucun chantier dimensions/Board/carte fermée |
| GOOGLE_REAL | NOT_RUN de certification ; un appel réel indisponible en Preview1, fallback utile vérifié |
| AUTH_DURABLE_SAVE_RELOAD | BLOCKED_ENV — tables Draft/PlanRevision absentes du projet fictif |
| ZOOM_NATIVE_125 | NOT_VERIFIED_ZOOM |
| DESKTOP_NO_INTERNAL_VERTICAL_SCROLL | PASS borné aux scènes mesurées ; visibilité1152 PARTIAL |
| RAW_UNDO | PASS React/PGlite et parcours coût réel ; clavier exhaustif PARTIAL |
| FINANCE_PARITY | 198/198, code financier inchangé au correctif UI final |
| BUILD_VERCEL | PASS complet Next, TypeScript, génération/assemblage puis READY au SHA157b7f6 |
| GO_MAIN / PRODUCTION | NO / UNCHANGED |

## Développement livré

- `011df52` : porte de coût unique, surface ancrée, scopes financiers existants, saisie incomplète non admise.
- `a71af6d` : réemploi des foods admissibles dans Bar ; choix de lieux lisibles ; modes sans faux OTHER ; host de recette protégé et synthétique.
- `99681b4` : labels complets du dock, miniatures48×40 recadrées, fallback contextuel ; correction du remplacement abusif d’un coût explicitement ADDITIVE lors d’un ajout.
- `157b7f6` : correction réellement reproduite du popover. Le portail de l’éditeur peut être détaché puis rattaché dans une autre cellule ; son effet initial ne trouvait alors aucun déclencheur et ne s’installait pas. Surveillance d’attachement limitée à la durée de la scène coût, reprise du popover seulement en présence de son ancre et hors modal RAW. Nettoyage de l’observateur/listeners/RAF au démontage. Aucun polling ni calcul financier React ajouté.

Réutilisation : Compiler/Finance V2, admission NightOut, identités, coûts et funding existants. Produits compatibles documentés dans `proofs/closure27-catalogue-owner.json`. Aucune image générée pour simuler une capacité absente ; Taxi/Cocktail utilisent un fallback fonctionnel explicite.

## Preuves exécutées, avec leur arbre réel

| Arbre | Exécution | Résultat |
|---|---|---|
| a71af6d Preview1 | Lieux longs, groupe9 puis8, cinq modes | PASS borné ; Google indisponible ; coût fermé = FAIL conservé |
| 99681b4 Preview2 | Coût, participants0/1/3/4/8 puis7, foods,20 postes, pagination1→5, miniatures, desktop réel | Coût encore fermé = FAIL ; autres preuves conservées |
| 99681b4 | Campagne intégrée P1/P2/P3/P4, R5, Google mock, Finance | 25/21/14/15 ;11 ; mock PASS ;198/198 |
| 157b7f6 | Test ciblé8, TypeScript explicite exit0, build Vercel complet | PASS |
| 157b7f6 Preview3 | Coût après déplacement du Board, RAW12, Échap→annuler, zéro→Entrée, Undo/Redo | PASS fonctionnel ; focus Redo non certifié |
| 157b7f6 Preview3 | Catalogue25/120/150 : dernier choix recherché, sélection Espace/Entrée, long label au focus, flèche | PASS ciblé ; défaut après effacement du filtre conservé |
| 157b7f6 Preview3 | Calendrier, flèche clavier, lieu connu long | dock0/réserve0 ; focus02novembre ; nom+ville complets et choix par Entrée |

Les suites intégrées sont exécutées99681b4, pas annoncées comme un second lancement157b7f6. Seul `atomic-popover.tsx` change entre ces SHA (26 lignes de diff) ; les chemins financiers, mutations et fixtures restent identiques. Les preuves navigateur portent leur propre SHA. Le correctif de popover a son retest réel sur Preview3. Aucune mise à jour de golden.

### Desktop mesuré, pas viewport supposé

Preview2 : **1152×720,1440×900,1920×1080** vérifiés par `innerWidth/innerHeight`. Scène20 postes : carte client353=scroll353, éditeur269=269, dock143=143 ; quatre postes par page, dernier groupe atteint. À1440 dock bottom877,3<900 ; à1920 bottom1027,6<1080. À1152 bottom877,3>720 : **pas de PASS de visibilité complète**. Pas de scroll vertical interne dans les trois surfaces mesurées, mais recours au défilement extérieur non recertifié ici.

Preview3 coût1440×900 : popover360×284,6, top396,5, ancre bottom387,5 ; input focalisé. Catalogue synthétique dans un nouvel onglet : **largeur effective1280×720**, pas1440 présumé ; tuiles72px, tooltip complet36,6px. Les catalogues testent le vrai composant de dock avec callbacks de comptage, pas une admission financière de150 produits fictifs.

Images réellement inspectées sur captures complètes : Bière48×40 lisible, modes dans même frame ; photos Google tardives non certifiées. Les noms de personnes/lieux des captures proviennent exclusivement de la fixture.

## Sept lignes partielles et deux locales

- UI035 : pas de fournisseur Google réel disponible sur le parcours exécuté ; pas de nouvelle tentative en boucle.
- UI046 : gabarits/noms longs prouvés ; photo de lieu et arrivée tardive restent non certifiées.
- UI093 : **défaut reproduit**, effacer une recherche dans le host150 laisse `data-overflow-after=false` alors que scrollWidth4468>clientWidth1027. Les flèches disparaissent jusqu’à rechargement ou mesure ultérieure. La recherche retrouve toujours les150 choix. Cause ciblée : l’effet de mesure du rail n’observe pas la recherche interne lorsque la prop `question` reste stable. Prochain correctif minimal : dépendance au filtre/volume visible puis retest du seul parcours. Non dissimulé ; pas de quatrième Preview ajoutée au protocole borné.
- UI141/UI148 : partie quantité/prix/unité/funding conservée ; partage financier absent du contrat, report accepté.
- UI203/UI204 : visibilité1152 et zoom non complètement certifiés malgré surfaces internes sans scroll et calendrier sans réserve.
- UI097/UI100 : ordre propriétaire et gabarit stable prouvés localement ; pertinence sur corpus réel et absence de tout flash durant une rafale non certifiées.

Les quatre **BLOCKED_OWNER** sont UI129/UI130/UI142 (parts financières du poste) et UI160 (OTHER nommé durable). Le mini-contrat et les coûts sont dans `closure27-owner-decision.md`. Décision utilisateur : **conserver le report dans ce lot UI**. Aucun nouveau writer, DTO financier ni migration implémenté.

## Gates externes, sécurité et limites

- Auth réel du compte fictif A pour accéder aux Previews ; **Composer en mémoire**. Lecture seule du schéma isolé : pas de tables Draft/PlanRevision. Auth durable reste BLOCKED_ENV ; pas de substitution par un test PGlite et pas d’accès au Draft personnel.
- A temporairement réactivé puis **rebanni et marqueur retiré/relu** ; `closure27-account-cleanup.log`. B/C non réactivés. Pont OTP loopback arrêté. Aucun favori, Draft distant, Plan, Apply, compte ou ligne financière créé/modifié dans ce lot. Seuls les accès temporaires A déjà autorisés ont été utilisés. Aucune migration et aucune écriture Production.
- UI220 : Tab, Shift+Tab, Espace, Entrée, Échap, garde annulée, calendrier et noms accessibles exécutés. Undo garde le focus du bouton ; après Redo document.body a été observé. Ne pas prétendre à une réception exhaustive du focus.
- Zoom natif non exposé : API viewport seulement. Contrôle humain minimal restant : ouvrir la Preview autorisée à1152×720 puis zoom natif125% via menu du navigateur ; parcourir coût→RAW→annuler, calendrier, lieux et rich20 au clavier, vérifier toutes commandes et absence de scroll interne. Aucun DPR ni redimensionnement simulant125% annoncé comme zoom réel.
- Before riche, images lentes et Google hors ordre restent couverts par tests locaux/mocks, pas par nouvelle certification navigateur complète. Aucune nouvelle campagne générale lancée.

## Décision

**PR68 prête à examiner, pas prête à promouvoir silencieusement.**14/27 améliorations vérifiées en navigateur,2 locales,7 partielles,4 reports owner acceptés ; les78A antérieures restent à leur niveau avec non-régressions. Prochaines décisions limitées : traiter le résidu UI093 puis réception focus/visibilité, choisir une voie Auth durable réellement isolée et un navigateur exposant le zoom. La disponibilité Google reste un gate fournisseur indépendant.

Rollback : branche/PR uniquement, aucune Production à annuler ; revert normal des commits UI si nécessaire, aucune suppression de donnée ni reset. Les55C et toute extension owner restent hors lot.
