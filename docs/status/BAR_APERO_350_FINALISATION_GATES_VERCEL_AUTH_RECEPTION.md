# Bar / Apéro — réception finale des gates, 18 octobre 2026

## Verdict

**NOT_READY pour une validation des 350 recommandations.** Le navigateur Codex a été réactivé et les essais physiques ont réellement repris. Des défauts reproduits ont été corrigés et publiés sur la PR Draft #67, toujours dépendante de #66. Aucune fusion ni Production.

**327/350 clos au niveau annoncé**, dont 74 nouvellement clos dans cette mission ; **23 résiduels** : 18 PARTIAL, 2 BLOCKED_ENV, 3 BLOCKED_OWNER. Zéro NOT_RUN générique restant dans le registre : les 60 exigences UI initialement non exécutées ont toutes une affectation et un résultat, dont plusieurs résultats partiels explicitement non certifiés. Cela ne signifie pas 350 PASS.

Le parcours riche **HTTP authentifié** est réussi avec une nouvelle session JWT. Le parcours **UI authentifié + World/FRESH** n'est pas certifié : le foyer fictif ne possède pas de publication Global active. Les cinq parcours G1 et la campagne G2 ont donc des preuves sur fixtures locales compilées, pas un PASS UI sur Vercel.

## Git et identité des preuves

| Référence | Valeur |
|---|---|
| Entrée documentaire | `78300455af286a94ba438d9eb098f37379869131` |
| Base empilée #66 | `d25ead9f3c8b2033c038491ce9262fa82e787171` |
| Produit final | `ba949a65796850ecfaec83e0aba03566b82b9058` |
| Branche | `codex/bar-apero-350-effective-closure` |
| PR Draft | [#67](https://github.com/adriensauvageot34/Budgetisation/pull/67), base `codex/bar-apero-350-reconciliation` |
| Main observé | `bd97a33d0e4280b7796e941148057b7693af0229`, non modifié par ce lot |

Les captures n'ont pas toutes le SHA final : b1/90 pour la majorité des scènes et largeurs, a1 pour retrait/Undo/RAW, ba pour le défaut final de focus. Les deltas sont isolés : a1 ne change que BoardCarousel ; ba ne change que la restauration du focus Bar/Dock. CSS, champs, coûts et contrats des captures réutilisées sont identiques. La preuve de durabilité reste attribuée à1624, où le writer final est identique. Les nouvelles pièces documentaires ne changent pas le produit testé.

## Corrections effectives

- **1624edc** : mémoire de vue limitée à32contextes dans Composer, recherches/pages conservées après repli/remontage, fiche Google transitoire5min ; RAW et finance exclus de cette mémoire. Couverture de coût obligatoirement choisie : contribution additive ou regroupement substitutif. Aucun choix implicite.
- **507d4c4** : cibles Bar trop petites22/18px reproduites et portées à32px minimum ; champs inconnus voisins ramenés à16px ; mise en page A/R intrinsèque ; initiales de lieux dérivées des noms réels ; sonde géométrique strictement opt-in.
- **491ff31 / ade988b / b1bc0c5 / a1abe1a** : traversées de cartes observées pendant FLIP, réservation tardive du contenu et déplacement de Bar à la réduction de scène corrigés. Hauteur intrinsèque réservée avant peinture par les observateurs natifs quand elle change ; page de Bar ouverte ancrée ; pas de FLIP sur une page contenant Bar, y compris retrait/Undo fermé. Les autres pages conservent leur comportement.
- **dfd0983** : une action explicite dans la carte/dock reprend le suivi de sa page après consultation manuelle d'une étagère.
- **90edbbc / ba949a6** : question supprimant son bouton → focus BODY reproduit puis corrigé ; resize rendant la flèche inactive → focus repris par la carte reproduit puis corrigé. Le focus rejoint désormais le groupe de choix et le remontage de la carte ne le vole plus.
- **baa6e8b** : harnais P4 adapté à la pagination mémorisée. L'échec initial est conservé ; les oracles financiers n'ont pas été changés.

Ni nouveau moteur, ni migration, ni changement de golden, ni généralisation des ateliers. Les composants péage/parking/fare/cash déjà publiés sont affichés sans inventer les composantes inconnues. Le DTO véhicule ne permet toujours pas de distinguer marque/modèle : libellé officiel conservé.

## Vercel et gates

| Gate | Déploiement / SHA | Résultat exact |
|---|---|---|
| G1 | `dpl_Bic2ffsswLuVwk24jv9qNrFxy3JE` /1624edc, [Preview](https://budgetisation-g9vsssb0x-adriensauvageot34-6137s-projects.vercel.app) | READY ; bootstrap isolé bloqué ; cinq parcours sur fixtures, **pas PASS_PREVIEW** |
| G2 | `dpl_EJUsxjh6Usgf6wcKpYYmGH1dQZxD` /507d4c4, [Preview](https://budgetisation-e45mnszw0-adriensauvageot34-6137s-projects.vercel.app) | READY ; campagne physique sur bundle local production ; **pas PASS_PREVIEW** |
| G3 HTTP | `dpl_9UcA8pqAGLLPb1oLRjVD8Jru7KDD` /1624edc, [Preview isolée](https://budgetisation-lu4f0qarx-adriensauvageot34-6137s-projects.vercel.app) | **PASS_AUTH_HTTP_NOT_BROWSER** ; World/FRESH isolé bloqué séparément |
| Candidat précédent | `dpl_BkLnbhAMuRgK6fN8AcKnJ2M6poUs` /90edbbc | READY, page de connexion effectivement atteinte ; réserve Undo corrigée ensuite |
| Candidat a1 | `dpl_5mQwd5fW34X2QqU1QsEFmJ5zZWx7` /a1abe1a | READY, Next complet ; code Undo physiquement vérifié sur fixture |
| **Candidat final** | `dpl_DcPEDV2RqLPsxe9KUsz7mfFjCqSZ` /ba949a6, [Preview finale](https://budgetisation-jun26c55r-adriensauvageot34-6137s-projects.vercel.app) | **READY**, Next complet : compile55s, TypeScript69s, génération8/8, sortie terminée2min ; aucun PASS fonctionnel authentifié inventé |

Une demande API supplémentaire a été refusée par la revue automatique parce qu'elle n'explicitait pas la cible Preview. L'API n'accepte pas `target:preview` et a rejeté cette variante sans création. Aucun contournement : le déploiement Git Preview déjà déclenché par le push autorisé a été retrouvé et inspecté, `target:null`, branche #67, SHA exact. Aucune promotion.

## Réception physique et défauts avant/après

Navigateur intégré Codex, interactions natives et locators officiels ; bundle React compilé/minifié avec découpage des éditeurs. Fixtures synthétiques C0/Compiler, aucun appel provider externe admis par le serveur de fixture. Pas de chronomètre Codex utilisé comme métrique produit.

| Cas | Observation réellement obtenue |
|---|---|
| Vide réel BAR_P3, ajout par Library | Carte créée et ouverte ;245px, 1440×900 effectifs ; pas d'objet/lieu/date inventé |
| Profils1/2/4/10/15 | Réellement ouverts ; deux Bières distinctes, UNKNOWN visible, pagination4postes selon largeur, Before9objets |
| Summary → scènes | Lieu, date, personnes, Before, boissons, coût, aller, retour, endpoints, véhicule, tarif, unité et legacy reçus ; hauteur245–505px selon scène sur grand viewport |
| Largeurs | 1152×720,1280×720,1440×900,1728×900,1920×1080 effectifs dans les pièces admises ; les tailles par défaut1159/DPR1.25 restent nommées telles quelles |
| Ancrage | Summary/Boissons restent au même x/y après correctif ; le passage de scène ne replace plus Bar dans un trou précédent |
| Traversées | Retrait/Undo fermé :10frames en collision sur90 ;2sur variante intermédiaire ;**0/66frames sur a1**, logique identique sur ba. Campagne scènes ouvertes sans collision dans les frames retenues |
| RAW | Prix18,25 tapé, valeur8encore admise, Apply indisponible ; Escape → Continuer garde18,25 ; Escape → Abandonner revient aux décisions8/9et263connus |
| Focus final | Dock2/3 → resize1728 →2/2 ; flèche devenue inactive, focus **DIV Consommations**, pas BODY ni Replier. Preuve surba |
| Compteurs saisie | +2livraisons MO, +1RO, +3mesures, +1repack lorsque le dock devient RAW ; pas un repack par caractère. Une séquence, pas un P95 |
| Retrait/Undo | Retrait en cours honnête jusqu'à confirmation ; carte retirée puis restaurée avec Before9, boissons15, participants, date et deux legs ; aucune écriture distante |
| Drag natif | Glisser depuis la poignée vers une zone vide annulé, événements dragstart/end reçus, données conservées ; drop sur corbeille et visibilité intermédiaire **non certifiés** |
| Zoom natif125 | Raccourcis essayés, pas de changement vérifié ; **PARTIAL**, DPR1.25 ne sert pas de preuve |

Les scrollWidth/clientWidth et scrollHeight/clientHeight sont égaux sur les surfaces carte/dock reçues ; le contenu riche fermé peut nécessiter le défilement **externe** du Board. Un popover ouvert augmente parfois scrollHeight mais reste en overflow visible, sans scrollbox ni action masquée. Les captures sont complètes, non recadrées.

Les premières mesures utilisant une closure d'ancien onglet et les essais à viewport effectif différent sont **conservés et exclus** explicitement dans `geometry-receipt.json`. On ne transforme pas une capture stabilisée en preuve d'animation ; les frames brutes avant/après sont jointes. Pas de certification WCAG exhaustive ou de P95 clic/frappe→peinture.

## Durabilité isolée réellement exécutée

Un seul nouveau Draft A/H1, janvier2027 ; ancienne cible vide, aucun Plan officiel. SAVEv1 → replay idempotent → **nouvelle session JWT** → relecture exacte → montant8→9v2 → conflitCAS sans écrasement → archive récupérablev3. Les anciens Drafts de novembre sont intacts. Le writer ne change pas de1624àba.

Les durées HTTP réelles2000msSAVE,1392msreplay,1408msREAD,2086msSAVE,1638msconflit,1117msarchive sont des échantillons isolés, pas un benchmark production. La Preview/FRESH ne s'en déduit pas.

Le premier403était `COMPOSER_DRAFT_DISABLED`, corrigé seulement dans l'environnement de déploiement isolé. L'UI H1 rencontre indépendamment **FORECAST_ACTIVE_GLOBAL_PUBLICATION_MISSING** ; aucune publication ni donnée personnelle substituée. L'ancien incident personnel n'est pas expliqué artificiellement par cette erreur.

Nettoyage effectué et relu : A rebanni, marqueur d'accès retiré, signOut global demandé ; archive conservée. Secrets uniquement en mémoire pendant le transfert local, aucune valeur dans ce dossier. Les bridge/testeurs locaux ont été arrêtés. Aucun compte réel modifié, aucun Apply, paiement, publication, PlanRevision ou writer financier appelé par ce lot. Ce bilan porte sur nos opérations, pas une affirmation d'immobilité globale de la base pendant l'activité d'autres utilisateurs.

## Tests et traçabilité

- Porte terminale complète surb1 :13commandes exit0, dont P1–P4, Bar350, Draft, durabilité, HTTP, C8, Apply/CAS P13, TypeScript et198empreintes.
- Retours ciblés90/a1/ba : React27groupes, P2, TypeScript ; P4sur90 ; C8sur a1. **Parité198/198 surba**, goldens inchangés.
- Builds Next complets Vercel, avec TypeScript, génération8/8et sortie terminée : journaux exacts joints ; pas seulement compilation Turbopack.
- Intégrité350originaux et7contrôles négatifs ; matrice97transitions et60affectations UI ;253lignes acquises inchangées.

Pièces : [`finalisation/matrix-97.md`](evidence/bar-apero-350/finalisation/matrix-97.md), [`matrix-60-ui.md`](evidence/bar-apero-350/finalisation/matrix-60-ui.md), [`geometry-receipt.json`](evidence/bar-apero-350/finalisation/geometry-receipt.json), [`auth-receipt.md`](evidence/bar-apero-350/finalisation/auth-receipt.md), [`tests.json`](evidence/bar-apero-350/finalisation/tests.json), [`owner-google.md`](evidence/bar-apero-350/finalisation/owner-google.md).

## Résidu et prochaine décision

1. **Environnement intégré isolé** : publication Global admissible manquante dans H1. Fournir un environnement déjà préparé, ou autoriser séparément sa préparation par l'owner. Aucun nouvel essai dans le foyer personnel. Cela débloque G1/G2/G3 UI et la recette fournisseur comparée ; la preuve Draft HTTP n'est pas à refaire sans changement de writer.
2. **Contrats propriétaires** : Google↔Canonical exact/admission, marque/modèle Mobility, lien explicite route↔lieu et discriminant machine regroupé/additif. Les replis actuels sont utiles, sans faux KNOWN/prix/liaison.
3. **Réception encore limitée** : zoom natif125, corbeille pendant drag/drop, tactile et latences paint calibrées. Le navigateur fonctionne ; ce sont ces capacités et méthodes précises qui restent non certifiées, pas un blocage générique Work.
4. **Deux résidus UI locaux** : certains détails Mobility restent à10/11px sans preuve de contraste renforcé ; Undo fermé peut laisser le focus BODY alors que les transitions carte/dock et confirmations RAW sont corrigées. Ils restent PARTIAL, non transformés en limites externes. La recette n'est donc pas une clôture de tous les travaux UI.

Pas de réplication ni de GO intégration proposé tant que le parcours UI riche authentifié n'est pas certifié. Les corrections sont disponibles sur la PR Draft pour revue ; aucun lot suivant engagé.

```text
BASE_GIT = 78300455af286a94ba438d9eb098f37379869131 (entrée), parent #66 d25ead9
PRODUCT_SHA_TESTED = ba949a65796850ecfaec83e0aba03566b82b9058
PR_DRAFT = #67, dépendance #66 conservée
FINAL_PREVIEW = dpl_DcPEDV2RqLPsxe9KUsz7mfFjCqSZ / READY / ba949a6
REQUIREMENTS = 350/350 tracées
ALREADY_VERIFIED = 253 au niveau historique annoncé, inchangées
NEWLY_CLOSED = 74
PARTIAL = 18
NOT_RUN = 0 (ne signifie pas zéro sous-test non exécuté)
BLOCKED_ENV = 2
BLOCKED_OWNER = 3
FAIL = 0 gate automatisé final ; résidus UI et certifications ouverts explicités
G1 = PARTIAL_BUILD_READY_FUNCTIONAL_UI_NOT_CERTIFIED
G2 = PARTIAL_LOCAL_BROWSER_FIXTURE
G3 = PARTIAL_AUTH_HTTP_PASS_UI_FRESH_BLOCKED
AUTH_RICH_SAVE_RELOAD = PASS_AUTH_REAL_HTTP_NOT_BROWSER
GOOGLE_CANONICAL = BLOCKED_OWNER
BOARD_GEOMETRY_NO_SCROLL = PASS_SCOPED_LOCAL_FIXTURE / PARTIAL_GLOBAL_CERTIFICATION
FINANCE_PARITY = 198/198 sur ba949a6
VERDICT = NOT_READY
NEXT_REQUIRED_ACTION = Préparer Global dans le foyer fictif par son owner pour la recette intégrée ; traiter les résidus UI/owner listés, sans refaire le writer déjà prouvé
```
