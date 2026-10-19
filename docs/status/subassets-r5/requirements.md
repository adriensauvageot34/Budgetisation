# Registre normatif et réception R5

Source de vérité machine : requirements.json.222 IDs uniques, A105/B62/C55. La précision R5 prime sur la formulation initiale.

Produit : cc9d2595dd95a69051d88d54beeb408ab308263d. Niveau de preuve et limites propres à chaque ligne ; aucun167/167 PASS.

## Décisions R5 conservées intégralement

### R5-D01

Le Board conserve son algorithme de placement déterministe mais résout la **demande de gabarit par scène**, au lieu d'imposer à toute carte Bar active une largeur universelle.

### R5-D02

Une réduction visuelle sans réduction de l'empreinte (`rowSpan`/`columnSpan` ou équivalent) n'est **pas** une amélioration de compacité reconnue.

### R5-D03

Les surfaces suivent fermé vide / fermé partiel / fermé riche / ouvert court / calendrier / lieu / objet / trajet / groupe riche, sans imposer un nombre arbitraire de pixels à chaque module.

### R5-D04

Lors d'une saisie, recherche, réponse fournisseur, focus clavier, drag ou garde RAW, la carte active et sa page de Board restent **spatialement stables**.

### R5-D05

Recomposition et dimensionnement sont autorisés aux **transitions explicitement stabilisées**, avec priorité à l'identité/ancre de la carte active.

### R5-D06

Le Board récupère **réellement** l'espace d'une carte repliée, sans réserver indéfiniment une cellule fantôme, tout en acceptant un petit vide transitoire qui protège la navigation.

### R5-D07

L'ouverture d'une carte Bar **n'impose pas** une nouvelle page si une solution locale stable et accessible existe.

### R5-D08

Une focalisation sur une page distincte est un **dernier recours motivé** par la place, jamais le parcours normal d'une petite scène.

### R5-D09

**Zéro scroll vertical interne** dans la carte, les éditeurs et leurs sous-panneaux ; le document peut défiler seulement comme filet de sécurité en viewport minimal.

### R5-D10

Les 20–30 objets économiques sont accessibles via synthèses bornées et scènes/groupes **sémantiquement paginés**, non par trente fiches en même temps.

### R5-D11

Les voisines Mascara/Sourcils/Vêtements/Maison possèdent une géométrie et une densité propres ; une carte plus riche ne les étire pas.

### R5-D12

Le dock visible fait partie du budget spatial du Board ; lorsqu'il ne sert à rien, il ne réserve pas une bande passive permanente.

### R5-D13

**Cliquer une valeur est la porte d'édition principale** : lieu, date, personnes, montant, objet et direction de trajet.

### R5-D14

L'interface exige **une seule décision consciente par valeur simple** ; elle peut enchaîner des contrôles techniques non visibles (Details/owner) avant admission.

### R5-D15

Une frappe Google n'admet aucun bar ; seul un **résultat explicitement sélectionné et vérifié** peut conduire à une mutation.

### R5-D16

Résultats Google actifs près du champ ; favoris/lieux connus dans le dock **avant frappe** quand ils sont utiles, sans afficher deux fois un même lieu établi par identité.

### R5-D17

Recherche lieu : gabarit stable, échecs/réponses périmées neutralisés, focus/texte/retour préservés ; image optionnelle, sans promotion Canonical fictive.

### R5-D18

La capsule Lieu remplace au clic ; la croix locale retire **cette valeur** et n'altère pas les trajets personnalisés sans contrat.

### R5-D19

Le nom libre est une action de **repli explicite**, pas un onglet principal permanent.

### R5-D20

Le calendrier est une scène **à gabarit propre**, dont le calendrier occupe la largeur utile et dont le dock est absent.

### R5-D21

Cliquer un jour choisi le **désélectionne** ; cliquer un autre le remplace **si admissible** ; pas de bouton « Retirer la date ».

### R5-D22

Les mois/jours hors contrat ne deviennent pas disponibles sous prétexte de donner des flèches au calendrier.

### R5-D23

Choix atomique réussi : **retour à la surface d'origine** (fermée/ouverte, groupe/focus) ; échec : rester dans la scène sans perdre les données.

### R5-D24

Contacts/partages en multi-sélection : **dock maintenu** pour répétition ; sélectionner un avatar de présence ne crée pas un coût.

### R5-D25

Échap ferme une seule couche à la fois ; undo textuel prioritaire dans le champ, Undo de domaine après admission.

### R5-D26

La sortie avec un RAW modifié est préparée/guardée **avant** toute navigation qui effacerait une saisie ; pas de commit par caractère ni `onBlur` non fiable.

### R5-D27

Undo simple remplace les confirmations rituelles, mais ne supprime pas les arbitrages de conséquences économiques ou de liens.

### R5-D28

Le dock est une **surface de propositions** pour la tâche active, pas un menu secondaire de l'application.

### R5-D29

La hiérarchie Événement → Moment → Famille → Objet → Propriété est **sémantique**, et ne crée aucune séquence forcée de cinq écrans.

### R5-D30

Le dock offre une seule nature de choix à la fois (familles/objets/personnes/modes/points/financement).

### R5-D31

Les propositions du dock Bar se présentent dans un **rail horizontal continu**, pas un pager numéroté.

### R5-D32

Un catalogue volumineux exige **propositions courtes + recherche et filtres**, non un défilement de centaines de tuiles par défaut.

### R5-D33

Flèches et focus clavier sont opérationnels ; auto-défilement au survol **expérimental, désactivé par défaut** tant qu'il n'est pas testé contre clics et drag.

### R5-D34

Le rail mémorise le contexte d'ajout, son scroll/filtres **seulement tant que les options restent pertinentes et admissibles**.

### R5-D35

La pagination de **postes existants** dans une scène de groupe est permise ; celle des **propositions** dans le dock ne l'est pas.

### R5-D36

Before et Au bar sont des **moments**, non des boissons ; le bouton de création Before appartient à la carte.

### R5-D37

Un Before vide non persisté peut ouvrir une scène de choix ; sa persistance ne doit être prétendue qu'après **premier objet admissible** sous owner.

### R5-D38

Le poste principal technique du Before ne peut pas être retiré par une UI fictive ; préserver extras/identités par opération propriétaire ou afficher la limite réelle.

### R5-D39

Boissons/Restauration sont séparées ; Tapas ne figure pas dans Boissons ; `Montant direct`, `Plus tard`, `Autre` opaque et `Bouteille partagée` n'y servent pas de faux objets.

### R5-D40

Ajouter Bière/Cocktail/Tapas conserve le **moment propriétaire**, permet les ajouts répétés et ne relance pas un scénario Restaurant/Bar complet.

### R5-D41

Les objets déjà présents se modifient **sur leur tuile** ; le dock peut toujours proposer un **nouvel exemplaire** du même type.

### R5-D42

Deux postes de même libellé à prix/portée/financeur différents ne sont pas fusionnés implicitement ; `selectionId` et provenance distincts.

### R5-D43

Les règles visuelles sont réutilisées entre scénarios **sans fusion** des clés économiques, owners ou flux métier.

### R5-D44

Le chiffre de l'en-tête peut être cliquable mais **l'agrégat calculé n'est pas un champ libre** permettant d'écraser des scopes distincts.

### R5-D45

Les états coût inconnu, zéro explicite, somme partielle, somme complète, prix historique et projection périmée restent différenciés.

### R5-D46

Un global **substitutif** et le détail se remplacent seulement selon une couverture admissible ; une contribution **additive** indépendante n'est pas éliminée par cet arbitrage.

### R5-D47

Toute décision de remplacement/ajout susceptible de doubler un poste est expliquée dans un arbitrage court, Undo complet avec identité/financements.

### R5-D48

Bouteille est un objet neutre ; la base `SHARED`, les personnes présentes, la répartition financière et les créances sont quatre dimensions différentes.

### R5-D49

Les parts personnelles/remboursements ne sont calculés ou affichés comme effectifs **que par un owner capable**, pas par division front.

### R5-D50

Les financements Swile/Edenred ne sont proposés que si le **poste et la transaction** sont admissibles ; aucune éligibilité de l'alcool n'est déduite.

### R5-D51

Aller et Retour ont **deux directions et deux identités de trajet** ; l'un peut rester absent si l'autre existe.

### R5-D52

Les modes, endpoints et suggestions de trajets sont proposés séparément ; `Reprendre l'inverse` est un **choix explicite**.

### R5-D53

Changer/retirer le bar n'ajuste que les **endpoints explicitement liés** et invalide leurs calculs dépendants ; les lieux/autres frais personnalisés sont préservés.

### R5-D54

Le coût d'usage automobile reste distinct d'un achat de carburant ; données TomTom/HERE/Google/prix ne sont affichées que sous owner et digest appropriés.

### R5-D55

Les opérations sont présentées comme **admission Draft**, **projection en actualisation**, **résultat frais** selon les preuves réelles, jamais toutes confondues en « enregistré ».

### R5-D56

**Argile éditoriale lumineuse** est la direction de conception globale : base claire, Clay reconnaissable, accents modérés par univers, Board calme.

### R5-D57

Décoration, proposition, poste ajouté et statut financier sont **quatre réalités visuelles différentes**.

### R5-D58

Plus la scène montre des faits, plus son décor se retire ; la décoration n'augmente **jamais** l'empreinte utile.

### R5-D59

Avant d'inventer des images, réutiliser les WebP/registre Clay existants et vérifier les cadrages 2:1 à la vraie taille des tuiles.

### R5-D60

Cocktail/Before/modes ne justifient de nouveaux visuels que si le fallback existant échoue à une reconnaissance concrète.

### R5-D61

Photo Google réservée aux lieux et aperçus sous droits, attribution, texte lisible et gabarit stable, **pas fond obligatoire de Bar**.

### R5-D62

La première version graphique peut rester sur **une seule ambiance Bar stable** ; petites variantes différées après observation, dix variations non retenues pour le premier lot.

### R5-D63

Une petite carte Beauté/Maison/Vêtements montre un titre, une silhouette pertinente, et au plus **un état d'absence** si aucune décision ; pas de doublon de libellés.

### R5-D64

Les microtextes de procédure et jargon disparaissent ; **incertitude, périmètre financier, sens des legs, erreurs, Undo et preuves au détail** demeurent.

### R5-D65

Les illustrations n'assument jamais la signification d'un paiement ou d'une décision utilisateur ; le nom et les montants lisibles restent prioritaires.

### R5-D66

Focus, hover, sélection, busy et erreur sont distincts **sans dépendance exclusive à une couleur** ; icônes gardent accessible names, hitboxes et clavier.

### R5-D67

Les animations servent le changement de décision, non l'occupation de l'espace ; gel pendant saisie/requêtes, prise en charge de `prefers-reduced-motion`.

### R5-D68

La charte se juge **sur tout le Board** et à zoom natif 125 %, pas sur une seule grande carte isolée.

### R5-D69

Les 222 recommandations UI source restent **traçables par ID** même lorsqu'une idée est différée ou modifiée par R5.

### R5-D70

Chaque nouveau changement devra citer **le contrat de scène, le propriétaire de donnée, le contexte de retour, le gabarit et ses gates**, sans inventer un moteur universel.

### R5-D71

Les risques de Before, partage, éligibilité et liens Mobility sont des **dépendances métier**, pas de simples tickets CSS.

### R5-D72

La recette est **stratifiée** : statique, fixture desktop, clavier/zoom, Auth/save-reload, fournisseur réel, identité/Finance ; une preuve ne remplace pas une autre.

### R5-D73

Le développement éventuel commence sur **le HEAD réellement visé**, avec audit/patch limité et protections de régression existantes, pas réexécution aveugle des anciens prompts 350.

### R5-D74

Réutiliser les propriétaires Finance/Mobility/Canonical/Google et les primitives/Assets existants ; **pas de programme global de réécriture/performance** pour une amélioration locale.

### R5-D75

La portabilité du langage UX se vérifie après Bar sur au moins **un scénario adjacent et un scénario différent** ; généralisation seulement si nécessité prouvée.

### R5-D76

R5 **n'exécute aucune recette ni mutation**, et ne déclare aucune décision R1–R5 déjà livrée sur la seule base de ce document.

## Exigences

### UI-001 — B — IMPLEMENTED_VERIFIED

- **UI-001** · **RETENU — INTERPRÉTATION R5** — Supprimer les confirmations inutiles. Une sélection valide doit être enregistrée immédiatement, sans bouton « Valider » ou « Enregistrer » supplémentaire.

**Précision R5 :** Un clic ne vaut admission qu'après validation métier. Aucun second bouton rituel ; maintenir garde RAW et arbitrages financiers légitimes.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-002 — A — IMPLEMENTED_VERIFIED

- **UI-002** · **RETENU — CIBLE UX** — Différencier une saisie d'une décision. Écrire « Chupitos » dans un champ lance une recherche ; sélectionner le résultat crée le choix définitif.

**Précision R5 :** Autocomplétion et frappe n'engagent rien. Le clic sur une suggestion vérifiée peut lancer Details puis une seule mutation propriétaire.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : REACT_MOCK_PROVIDER_NOT_REAL_GOOGLE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-003 — B — PARTIAL

- **UI-003** · **RETENU — INTERPRÉTATION R5** — Revenir automatiquement à la vue de la soirée après une décision simple, notamment après le choix d'un lieu ou d'une date.

**Précision R5 :** Retour après succès effectif vers le **mode d'origine** (fermé/ouvert, scène, page et focus), pas fermeture prématurée.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Retour au résumé après succès testé ; restitution de tous modes fermés/pages/focus non certifiée.

### UI-004 — A — IMPLEMENTED_VERIFIED

- **UI-004** · **RETENU — CIBLE UX** — Conserver l'éditeur ouvert uniquement pour les décisions multiples, par exemple sélectionner plusieurs participants ou régler plusieurs paramètres de financement.

**Précision R5 :** Personnes, partage et ajouts répétés restent ouverts ; un choix atomique revient. Pas de règle d'auto-fermeture universelle.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-005 — A — IMPLEMENTED_VERIFIED

- **UI-005** · **RETENU — CIBLE UX** — Éliminer les étapes « Plus tard » lorsque quitter la scène sans choisir produit déjà exactement le même résultat.

**Précision R5 :** Supprimer seulement les faux reports : ne pas retirer un vrai refus ou report porteur d'un sens métier distinct.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-006 — A — IMPLEMENTED_VERIFIED

- **UI-006** · **RETENU — CIBLE UX** — Supprimer les états « À préciser » présentés comme des choix. Une information non renseignée doit rester absente, et non devenir un faux objet.

**Précision R5 :** Absence d'information = donnée non choisie, jamais ligne fictive, mode de transport ou coût à 0 €.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-007 — A — PARTIAL

- **UI-007** · **RETENU — CIBLE UX** — Limiter les opérations principales à un seul emplacement intuitif. Modifier le lieu sur la capsule Lieu, la date sur Date, les participants sur leurs avatars, le montant sur le prix.

**Précision R5 :** La valeur visible est la porte canonique de modification. Les sous-assets restent des **choix** lorsque l'utilisateur les demande, pas des doublons de navigation.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Valeurs éditables directement ; le bouton secondaire de coût reste un doublon visible dans la carte.

### UI-008 — B — PARTIAL

- **UI-008** · **RETENU — INTERPRÉTATION R5** — Garder les options avancées disponibles sans les afficher en permanence. Elles apparaissent uniquement lorsqu'on en a besoin, avec un menu contextuel ou un petit bouton secondaire.

**Précision R5 :** Les options avancées restent identifiables au clavier et dans le détail ; ne pas cacher un choix économique essentiel.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Détails secondaires accessibles ; revue exhaustive de chaque contrôle avancé non exécutée.

### UI-009 — B — PARTIAL

- **UI-009** · **RETENU — CIBLE UX** — Faire correspondre le retour arrière à une véritable transition de scène. Une flèche ne doit pas apparaître sans que l'utilisateur comprenne ce qu'il va retrouver.

**Précision R5 :** Retour à l'origine et au focus ; Échap ferme une couche à la fois, arrêté par une garde RAW dirty.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Retour/RAW couverts ; matrice complète Escape/Shift+Tab et origine de toutes scènes non exécutée.

### UI-010 — B — ALREADY_VERIFIED

- **UI-010** · **RETENU — CIBLE UX** — Garantir un Undo immédiat pour les suppressions, afin de pouvoir enlever facilement les boutons explicatifs et confirmations redondantes.

**Précision R5 :** Undo exact des décisions admises, avec IDs, finances, relation de moment et endpoints ; pas simple animation de restauration.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-011 — A — IMPLEMENTED_VERIFIED

- **UI-011** · **RETENU — CIBLE UX** — Faire que les clics sur une capsule, une tuile ou un résultat accomplissent directement l’action attendue ; ne pas demander une validation supplémentaire pour une action déjà explicite.

**Précision R5 :** Le clic accomplit l'intention unique, mais une vérification serveur, Canonical ou un arbitrage réel reste possible.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-012 — B — ALREADY_VERIFIED

- **UI-012** · **RETENU — CIBLE UX** — Permettre de retirer un élément par une croix contextuelle ou par le geste de corbeille déjà présent sur le Board, plutôt que multiplier les actions « Retirer ce moment ».

**Précision R5 :** Corbeille du Board pour **la carte entière** ; retrait ciblé depuis capsule/tuile/menu pour un poste ou une valeur. Éviter un second CTA 'Retirer ce moment' redondant, sans confondre les portées.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-013 — A — IMPLEMENTED_VERIFIED

- **UI-013** · **RETENU — CIBLE UX** — Conserver un retour explicite et immédiat après chaque décision : nouvel objet dans la bonne section, capsule actualisée, montant mis à jour si calculable.

**Précision R5 :** Valeur retenue visible rapidement ; agrégat mis à jour seulement après projection fraîche, sans présenter l'ancien prix comme actuel.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-014 — A — IMPLEMENTED_VERIFIED

- **UI-014** · **RETENU — CIBLE UX** — Éviter les scènes vides ou sans action ; revenir à la carte dès qu’une scène n’a plus de raison d’être affichée.

**Précision R5 :** Ne pas conserver des étapes creuses ; respecter les retours explicites et garder une scène si erreur ou arbitrage en cours.

**Décisions R5 dominantes :** R5-D13…D27.

Owner : Navigation / admission / RAW. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Admission propriétaire après choix ; frappe non admise ; RAW gardé ; ajouts multiples restent dans leur scène.

**Preuves :** proofs/react-interactions.json, proofs/bar-p1-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-015 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-015** · **RETENU — INTERPRÉTATION R5** — Adapter la largeur de la carte à la scène active et non à un format ouvert universel.

**Précision R5 :** Faire varier **le span réservé par le Board et la largeur visuelle ensemble**, pas seulement une propriété CSS.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-016 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-016** · **RETENU — INTERPRÉTATION R5** — Donner à la carte vide une largeur proche de celle de deux petites cartes, ou moins si le Board le permet.

**Précision R5 :** Ordre de grandeur, non largeur imposée ; maximiser la lisibilité sans fabriquer des grands blancs.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-017 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-017** · **RETENU — CIBLE UX** — Réserver les grandes largeurs aux situations où plusieurs blocs peuvent véritablement être disposés côte à côte.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-018 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-018** · **RETENU — CIBLE UX** — Permettre au Board de récupérer l'espace libéré par une carte devenue plus étroite, sans créer un trou invisible dans sa grille.

**Précision R5 :** Réutiliser l'espace au repack **stabilisé**, sans sauts pendant frappe ou drag ; pas de place fantôme permanente.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-019 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-019** · **RETENU — CIBLE UX** — Rapprocher « Bar / Apéro » et le montant, actuellement séparés par une distance excessive.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-020 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-020** · **RETENU — CIBLE UX** — Éviter de réserver une ligne entière pour un seul bouton situé à l'extrémité droite.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-021 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-021** · **RETENU — INTERPRÉTATION R5** — Regrouper Lieu, Date, Personnes et Trajet sur une même ligne quand la place le permet, mais ne pas forcer leur compression.

**Précision R5 :** Une ligne seulement si elle reste utilisable ; sinon deux lignes denses ou capsules compactes. Ne pas diminuer excessivement les hitboxes.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-022 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-022** · **RETENU — CIBLE UX** — Réduire les marges verticales des états vides, surtout sous « Au bar ».

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-023 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-023** · **RETENU — CIBLE UX** — Faire disparaître une section vide non essentielle lorsque son seul contenu est son titre.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-024 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-024** · **RETENU — CIBLE UX** — Utiliser l'espace horizontal pour présenter des informations complémentaires, mais pas pour étirer inutilement les champs de saisie.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-025 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-025** · **RETENU — CIBLE UX** — Ne jamais conserver une hauteur artificielle après la fermeture d'une scène ou le retrait d'un objet.

**Précision R5 :** La réduction de hauteur intrinsèque doit aussi être reflétée dans l'empreinte réservée.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-026 — B — PARTIAL

- **UI-026** · **RETENU — INTERPRÉTATION R5** — Stabiliser la largeur pendant une saisie : une liste Google qui arrive ne doit pas provoquer un redimensionnement permanent.

**Précision R5 :** Geler largeur et page durant frappe Google, chargement d'image/Results/Details et saisie RAW.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : Enveloppe / stabilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Pas de changement du packing. Hauteurs internes mesurées sur scènes présentes ; document de secours au petit viewport.

**Preuves :** proofs/browser-local.json, proofs/preview2.json

**Reste :** Largeur conservée par la scène existante ; arrivée réelle photo/résultats tardifs non certifiée en navigateur.

### UI-027 — B — PARTIAL

- **UI-027** · **RETENU — INTERPRÉTATION R5** — Éviter toute barre de défilement verticale à l'intérieur d'une carte. Utiliser des scènes courtes, des vues détaillées ou un résumé suivi d'un accès aux éléments supplémentaires.

**Précision R5 :** Aucun scroll vertical dans la carte, popover ou sous-panneau ; vue synthèse + détails sémantiquement navigables. Scroll de document seulement filet de sécurité en tout petit viewport.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : Enveloppe / stabilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Pas de changement du packing. Hauteurs internes mesurées sur scènes présentes ; document de secours au petit viewport.

**Preuves :** proofs/browser-local.json, proofs/preview2.json

**Reste :** Aucun scroll interne sur scènes mesurées ; pas de certification exhaustive de toutes scènes riches.

### UI-028 — B — PARTIAL

- **UI-028** · **RETENU — INTERPRÉTATION R5** — Faire évoluer la carte sans déplacer brutalement les autres cartes du Board à chaque clic.

**Précision R5 :** Reflow seulement lors de transitions stabilisées ; ancre et identité de la carte active d'abord, packing maximal ensuite.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : Enveloppe / stabilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Pas de changement du packing. Hauteurs internes mesurées sur scènes présentes ; document de secours au petit viewport.

**Preuves :** proofs/browser-local.json, proofs/preview2.json

**Reste :** Packing inchangé ; ancre pendant réponses simulées vérifiée, campagne deux cartes en navigateur final non exécutée.

### UI-029 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-029** · **RETENU — CIBLE UX** — Prévoir une taille optimale spécifique aux scènes Lieu, Date, Personnes, Consommation et Trajet.

**Précision R5 :** Gabarits de scène et contenu utile, non matrice CSS rigide par preset.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-030 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-030** · **RETENU — CIBLE UX** — Ajuster la largeur au niveau de contenu : compacte pour une soirée vide, intermédiaire pour Lieu/Date/Personnes et édition simple, étendue pour plusieurs moments ou trajets.

**Précision R5 :** Préférence de surface, mesure intrinsèque et empreinte accordée sont trois variables distinctes.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-031 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-031** · **HYPOTHÈSE À MESURER** — Employer des fourchettes de travail indicatives desktop (à valider sur navigateur) : fermé 350–480 px ; ouvert vide 480–600 px ; recherche/date 560–680 px ; consommation 560–700 px ; soirée riche 720–900 px.

**Précision R5 :** **Non contractuel** : les fourchettes historiques sont des hypothèses à corriger selon scénario/viewport. Date peut être plus étroite ; riche ne devient L que si utile.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-032 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-032** · **RETENU — CIBLE UX** — Ne pas imposer la même grille aux formulaires courts, consommations, trajectoires et résumés ; choisir la disposition verticale ou horizontale selon le contenu.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-033 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-033** · **RETENU — INTERPRÉTATION R5** — Répartir les consommations sur plusieurs colonnes si utile, sans écraser leur lisibilité pour gagner quelques pixels.

**Précision R5 :** Deux colonnes uniquement si chaque objet conserve nom, quantité, prix, unité et cible éditable lisibles.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : 2. Dimensions adaptatives, densité et absence de scroll interne — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-034 — B — PARTIAL

- **UI-034** · **RETENU — CIBLE UX** — En cas de forte densité, privilégier une page ou une scène interne réellement différente, une synthèse et un accès au détail, sans créer de défilement vertical dans la carte.

**Précision R5 :** Paginable = **détail d'objets déjà ajoutés**, pas le catalogue des propositions ; tous les postes restent atteignables.

**Décisions R5 dominantes :** R5-D01…D12.

Owner : Enveloppe / stabilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Pas de changement du packing. Hauteurs internes mesurées sur scènes présentes ; document de secours au petit viewport.

**Preuves :** proofs/browser-local.json, proofs/preview2.json

**Reste :** Pagination sémantique existante préservée ; catalogue150 testé en React, pas en navigateur.

### UI-035 — A — PARTIAL

- **UI-035** · **SOUS CONTRAT MÉTIER/PROVIDER** — Faire de Google Places le moteur principal de recherche des établissements lorsqu'il est disponible.

**Précision R5 :** Si API réellement disponible. Les lieux canoniques/favoris demeurent accessibles et nom libre en repli ; aucun blocage total si provider absent.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Google mock PASS et repli utile ; un appel réel Preview1 indisponible. Pas de répétition aveugle.

### UI-036 — A — IMPLEMENTED_VERIFIED

- **UI-036** · **RETENU — CIBLE UX** — Remplacer les recherches « Lieux enregistrés » et « Chercher un bar » par une seule zone de saisie.

**Précision R5 :** Une seule recherche visible : Google pendant frappe, favoris proposés au dock lorsque champ initialement vide.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-037 — A — IMPLEMENTED_VERIFIED

- **UI-037** · **SOUS CONTRAT MÉTIER/PROVIDER** — Lancer la recherche après une courte temporisation de frappe, sans bouton de validation.

**Précision R5 :** Debounce, anti-réponses périmées, aucune mutation à la simple frappe.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : REACT_MOCK_PROVIDER_NOT_REAL_GOOGLE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-038 — A — IMPLEMENTED_VERIFIED

- **UI-038** · **RETENU — CIBLE UX** — Continuer à proposer les lieux enregistrés par défaut dans le dock, même lorsqu'aucune recherche n'a été saisie.

**Précision R5 :** Favoris **si utiles**, pas bande dock vide permanente ; résultats actifs Google proches du champ, non forcés dans le dock.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-039 — A — IMPLEMENTED_VERIFIED

- **UI-039** · **SOUS CONTRAT MÉTIER/PROVIDER** — Afficher les résultats Google à proximité immédiate du champ, plutôt que de forcer un déplacement visuel vers le bas du Board.

**Précision R5 :** Limiter la liste visible et réserver sa place : la hauteur de Bar ne doit pas suivre le nombre de résultats.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : REACT_MOCK_PROVIDER_NOT_REAL_GOOGLE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-040 — A — IMPLEMENTED_VERIFIED

- **UI-040** · **SOUS CONTRAT MÉTIER/PROVIDER** — Reconnaître les lieux déjà enregistrés et éviter de présenter deux fois le même établissement.

**Précision R5 :** Fusion/déduplication **uniquement si identité Canonical/Google autoritairement reliée**, jamais fuzzy sur nom/photo/coordonnées seules.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : REACT_MOCK_PROVIDER_NOT_REAL_GOOGLE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-041 — A — IMPLEMENTED_VERIFIED

- **UI-041** · **RETENU — CIBLE UX** — Supprimer « Autres possibilités » et les autres intitulés techniques lorsqu'aucune action distincte ne les justifie.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-042 — A — IMPLEMENTED_VERIFIED

- **UI-042** · **RETENU — CIBLE UX** — Supprimer « 3 lieu(x) correspondant(s) · choisissez une proposition dans le dock ». Les résultats visibles suffisent.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-043 — B — ALREADY_VERIFIED

- **UI-043** · **RETENU — CIBLE UX** — Mettre « Historique et sources » dans les informations secondaires, pas dans le parcours principal.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-044 — B — ALREADY_VERIFIED

- **UI-044** · **RETENU — CIBLE UX** — Déplacer les dates d'historique, le nombre de visites et la couverture des données vers un détail facultatif.

**Précision R5 :** Ne pas supprimer les sources du domaine ; les garder en second niveau pour audit.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-045 — A — IMPLEMENTED_NOT_BROWSER_PROVEN

- **UI-045** · **RETENU — CIBLE UX** — Présenter les suggestions sous la forme nom + ville, avec éventuellement une courte catégorie.

**Précision R5 :** Nom + ville (si attestée) et catégorie courte ; nom complet accessible si tronqué.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Nom/commune attestée sur lieux connus ; échantillon des noms longs réels non certifié.

### UI-046 — A — PARTIAL

- **UI-046** · **RETENU — CIBLE UX** — Donner aux propositions de lieux une hauteur stable et empêcher tout texte de déborder ou d'être coupé.

**Précision R5 :** Gabarit fixé avant arrivée de la photo/résultat. Si nom long, révélation du nom complet sans croissance verticale.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Gabarit borné et libellés accessibles ; noms longs et photos tardives non certifiés.

### UI-047 — B — PARTIAL

- **UI-047** · **SOUS CONTRAT MÉTIER/PROVIDER** — Utiliser une photo Google Places ou Street View si elle est exploitable et autorisée, avec une illustration neutre lorsque ce n'est pas le cas.

**Précision R5 :** Photo **du lieu** facultative, droits/attribution/contraste contrôlés ; jamais source d'identité ni fond obligatoire de la carte.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Photo facultative : pipeline Restaurant existant identifié, non branché dans le dock Bar ; fallback neutre.

### UI-048 — B — IMPLEMENTED_VERIFIED

- **UI-048** · **SOUS CONTRAT MÉTIER/PROVIDER** — Permettre de retirer un lieu par une croix directement sur sa capsule, sans ouvrir un autre écran.

**Précision R5 :** Retrait du **lieu central uniquement**, préservation des endpoints personnalisés ; arbitrage si liaison Mobility réelle.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-049 — B — PARTIAL

- **UI-049** · **RETENU — CIBLE UX** — Un clic sur la capsule sélectionnée doit rouvrir la recherche pour changer de bar.

**Précision R5 :** Focus rétabli immédiatement dans la recherche de remplacement.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Capsule rouvre recherche ; focus automatique exact non certifié sur toutes transitions.

### UI-050 — B — IMPLEMENTED_VERIFIED

- **UI-050** · **SOUS CONTRAT MÉTIER/PROVIDER** — Après sélection, refermer automatiquement la recherche et revenir à la soirée, tout en conservant les liens de mobilité cohérents.

**Précision R5 :** Retour après admission effective ; retarget uniquement endpoints liés, estimation marquée périmée si trajet changé.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-051 — A — IMPLEMENTED_VERIFIED

- **UI-051** · **RETENU — CIBLE UX** — Faire disparaître les portes « Lieux enregistrés », « Chercher un bar », « Nom libre » et « Plus tard » du niveau principal lorsque ces fonctions sont déjà couvertes par la recherche et ses états de secours.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-052 — A — IMPLEMENTED_VERIFIED

- **UI-052** · **RETENU — CIBLE UX** — Dans le dock, rendre chaque lieu enregistré identifiable avec le nom et la ville ; réserver les détails d’historique et de provenance aux détails secondaires.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-053 — B — PARTIAL

- **UI-053** · **SOUS CONTRAT MÉTIER/PROVIDER** — Étudier la reprise de la sélection de photo Google My Business / Places déjà proposée dans « Déclarer une dépense » pour illustrer les tuiles de bars connus.

**Précision R5 :** Réutiliser le pipeline de photo existant sous contrat et attribution ; ne pas copier un fichier fournisseur dans Clay/Draft.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Pipeline photo propriétaire identifié, pas copié ni réimplémenté ; intégration photo Bar non livrée.

### UI-054 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-054** · **EXPÉRIMENTAL** — Pour les tuiles de lieux, étudier une photographie d’établissement utilisée comme image de fond recadrée, avec le nom du bar et la ville en surcouche lisible, plutôt qu’un long texte.

**Précision R5 :** **Expérimental** pour tuile de lieu seulement. Si texte sur photo illisible, texte hors image sur surface opaque.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : 3. Lieu : recherche Google, suggestions, sélection et retrait — 24 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-055 — B — PARTIAL

- **UI-055** · **RETENU — CIBLE UX** — Si l’image réelle est mal cadrée, peu lisible, indisponible ou non utilisable selon les règles du fournisseur, revenir à une illustration contextuelle homogène.

**Précision R5 :** La photo manquante ne change ni dimensions, ni sélection, ni coût, ni identité.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Aucune dépendance à une photo pour identité/coût ; arrivée et échec photo réels non exécutés.

### UI-056 — A — IMPLEMENTED_VERIFIED

- **UI-056** · **SOUS CONTRAT MÉTIER/PROVIDER** — Conserver la saisie libre comme véritable solution de secours lorsqu’aucun établissement Google ou enregistré ne correspond, sans la proposer comme détour obligatoire.

**Précision R5 :** Nom libre sélectionné explicitement ; pas de Google ID, coordonnées ou lieu Canonical inventés.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-057 — B — IMPLEMENTED_VERIFIED

- **UI-057** · **SOUS CONTRAT MÉTIER/PROVIDER** — Donner à la capsule d’un lieu sélectionné une action directe de retrait, et préserver avec prudence les trajets personnalisés déjà associés.

**Précision R5 :** Même règle que UI-048 : dépendances prouvées et Undo ciblé ; pas de substitution par ressemblance de nom.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-058 — B — PARTIAL

- **UI-058** · **SOUS CONTRAT MÉTIER/PROVIDER** — Lorsque la recherche est rouverte pour changer de lieu, donner immédiatement le focus au champ, sans imposer l’effacement manuel de l’ancien nom.

**Précision R5 :** Préserver contexte de retour ; pas de préremplissage à effacer manuellement.

**Décisions R5 dominantes :** R5-D15…D19, D53, D61.

Owner : Lieux / Google / favoris. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Recherche unique et résultats proches du champ. Details avant admission minimale ; identités exactes, aucun rapprochement par libellé ; repli explicite.

**Preuves :** proofs/bar-p3-results.json, scripts/check-bar-subassets-r5-google.mjs, proofs/preview1.json

**Reste :** Recherche unique et contexte préservés ; focus instantané après réouverture non certifié.

### UI-059 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-059** · **RETENU — CIBLE UX** — Réduire la largeur de la carte à celle d'une véritable scène calendrier, plutôt que de garder une énorme carte presque vide.

**Précision R5 :** Scène M calendrier, pas '760 px + minuscule widget'.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : 4. Date : calendrier proportionné et manipulable — 14 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-060 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-060** · **RETENU — CIBLE UX** — Faire occuper au calendrier la majorité de la largeur disponible dans sa scène.

**Précision R5 :** Utiliser l'enveloppe utile pour les 7 colonnes, sans élargir artificiellement la carte.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : 4. Date : calendrier proportionné et manipulable — 14 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-061 — B — NO_CHANGE_REQUIRED_VERIFIED

- **UI-061** · **SOUS CONTRAT MÉTIER/PROVIDER** — Intégrer les flèches de changement de mois dans l'en-tête du calendrier.

**Précision R5 :** **Conditionnel** : flèches seulement si jours/mois hors période sont **admissibles** par le contrat de projection.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** targetMonth borne les dates : aucune flèche intermois trompeuse ajoutée. Inspection du calendrier et test toggle dans le mois.

### UI-062 — B — IMPLEMENTED_VERIFIED

- **UI-062** · **RETENU — CIBLE UX** — Supprimer le bouton « Retirer la date ».

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-063 — B — IMPLEMENTED_VERIFIED

- **UI-063** · **SOUS CONTRAT MÉTIER/PROVIDER** — Cliquer sur une date déjà sélectionnée doit permettre de la désélectionner.

**Précision R5 :** Cliquer **dans le calendrier** le jour déjà choisi retire cette date ; cliquer la capsule doit ouvrir le calendrier et non retirer instantanément.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-064 — B — IMPLEMENTED_VERIFIED

- **UI-064** · **SOUS CONTRAT MÉTIER/PROVIDER** — Cliquer sur une autre date doit immédiatement remplacer l'ancienne.

**Précision R5 :** Mutation atomique uniquement si nouvelle date autorisée.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-065 — B — IMPLEMENTED_VERIFIED

- **UI-065** · **SOUS CONTRAT MÉTIER/PROVIDER** — Refermer automatiquement le calendrier après une nouvelle sélection, sauf si l'utilisateur choisit de continuer à naviguer.

**Précision R5 :** Retour après admission ; échec garde calendrier, focus et choix actuel.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-066 — A — IMPLEMENTED_VERIFIED

- **UI-066** · **RETENU — CIBLE UX** — Éviter de réafficher des sous-assets de date lorsque l'utilisateur est déjà dans le calendrier.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-067 — B — IMPLEMENTED_NOT_BROWSER_PROVEN

- **UI-067** · **RETENU — CIBLE UX** — Mettre davantage en valeur la date sélectionnée et ne pas la confondre avec la date du jour.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Jour choisi exposé par aria-pressed ; comparaison visuelle exhaustive avec aujourd’hui non exécutée.

### UI-068 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-068** · **EXPÉRIMENTAL** — Proposer éventuellement de petits raccourcis contextuels comme « Ce week-end », uniquement s'ils sont pertinents pour le mois prévu.

**Précision R5 :** Raccourci week-end facultatif **seulement** si compatible période et utile ; pas de nouvelle surface permanente.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : 4. Date : calendrier proportionné et manipulable — 14 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-069 — A — IMPLEMENTED_VERIFIED

- **UI-069** · **RETENU — CIBLE UX** — Ne pas conserver un dock vide sous le Board pendant l'édition de la date.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-070 — B — PARTIAL

- **UI-070** · **SOUS CONTRAT MÉTIER/PROVIDER** — Préserver une navigation clavier claire et vérifier les mois limites, les changements d'année et les dates hors période admissible.

**Précision R5 :** Ne pas afficher navigation hors mois si le domaine fixe `targetMonth`.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Hors targetMonth interdit ; couverture clavier mois limite/année non exécutée en navigateur.

### UI-071 — B — PARTIAL

- **UI-071** · **RETENU — CIBLE UX** — Concevoir le calendrier comme la totalité du mini-module Date, sans espace latéral disproportionné ni section de navigation redondante.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Date sans dock prouvée1440 ; proportions complètes de carte réservées au futur lot dimensions.

### UI-072 — A — IMPLEMENTED_VERIFIED

- **UI-072** · **RETENU — CIBLE UX** — Éviter que la scène Date affiche un dock générique, vide ou sans rapport avec le calendrier.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D20…D22.

Owner : Date. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Calendrier sous targetMonth ; toggle du jour admis, retour après succès ; aucune projection intermois ajoutée ; dock et réserve absents.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-073 — A — IMPLEMENTED_VERIFIED

- **UI-073** · **RETENU — CIBLE UX** — Afficher en priorité les personnes existantes dans le dock, plutôt qu'un champ « Autre prénom » au milieu de la carte.

**Précision R5 :** Contacts dans le dock ; avatars choisis sur la carte ; aucune boîte 'Autre prénom' au milieu du résumé.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-074 — A — IMPLEMENTED_VERIFIED

- **UI-074** · **RETENU — CIBLE UX** — Déplacer la recherche de personnes dans le dock, près des propositions.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-075 — A — IMPLEMENTED_VERIFIED

- **UI-075** · **RETENU — INTERPRÉTATION R5** — Permettre de sélectionner plusieurs personnes à la suite, sans fermer la scène après chaque ajout.

**Précision R5 :** Le dock et le focus restent sur les participants pour sélectionner plusieurs personnes.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-076 — A — IMPLEMENTED_VERIFIED

- **UI-076** · **RETENU — CIBLE UX** — Afficher immédiatement les personnes choisies dans la carte.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-077 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-077** · **DIFFÉRÉ** — Utiliser ultérieurement les portraits PNG que tu prépares, mais garder des initiales élégantes en attendant.

**Précision R5 :** **Différé** : portraits PNG personnalisés non présumés disponibles. Initiales correctement présentées dès maintenant.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : 5. Personnes : choix multiples, avatars et contexte — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-078 — A — IMPLEMENTED_NOT_BROWSER_PROVEN

- **UI-078** · **RETENU — CIBLE UX** — Limiter le nombre de noms visibles dans la carte et afficher `+3` lorsque les participants deviennent nombreux.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Code existant slice(0,3), puis +N ; trois participants testés, plus de trois non testés en navigateur.

### UI-079 — A — IMPLEMENTED_VERIFIED

- **UI-079** · **SOUS CONTRAT MÉTIER/PROVIDER** — Permettre de retirer une personne en la désélectionnant depuis le dock ou par son avatar.

**Précision R5 :** La désélection de présence ne retire **pas** silencieusement une allocation financière de ce contact.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-080 — A — IMPLEMENTED_VERIFIED

- **UI-080** · **SOUS CONTRAT MÉTIER/PROVIDER** — Ne proposer « Ajouter un prénom libre » que lorsqu'une recherche n'a pas trouvé la personne souhaitée.

**Précision R5 :** Ajouter un prénom libre est une action explicite lorsque la recherche ne donne aucun match fiable.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-081 — A — IMPLEMENTED_VERIFIED

- **UI-081** · **RETENU — CIBLE UX** — Supprimer le gros bouton « Ajouter ce prénom » lorsqu'il ne fait que répéter une action évidente.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-082 — B — ALREADY_VERIFIED

- **UI-082** · **SOUS CONTRAT MÉTIER/PROVIDER** — Distinguer la présence à la soirée de la participation financière : sélectionner une personne n'implique aucun partage automatique.

**Précision R5 :** Présence et financement sont deux relations métier différentes ; avatars similaires, statuts distincts.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-083 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-083** · **DIFFÉRÉ** — Préparer des portraits détourés PNG pour les personnes connues, utilisés dans les sous-assets, la carte et le partage des frais avec la même charte graphique.

**Précision R5 :** **Différé à la fourniture d'images**. Identité déterminée par l'ID personne, jamais par le PNG.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : 5. Personnes : choix multiples, avatars et contexte — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-084 — A — IMPLEMENTED_VERIFIED

- **UI-084** · **RETENU — CIBLE UX** — Dans le dock des participants, conserver les contacts les plus pertinents visibles immédiatement et le champ de recherche à côté ; ne pas afficher un formulaire vide comme premier écran.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-085 — A — IMPLEMENTED_VERIFIED

- **UI-085** · **RETENU — CIBLE UX** — Conserver une décision réversible par simple sélection / désélection, sans bouton « Enregistrer les participants ».

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D23…D26, D48…D49.

Owner : Participants. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Multi-toggle de présence, recherche au dock, prénom libre uniquement après absence de résultat ; aucune inférence de paiement.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-086 — A — IMPLEMENTED_VERIFIED

- **UI-086** · **RETENU — CIBLE UX** — Ne jamais afficher un dock sans fonction utile pour la scène active.

**Précision R5 :** Aucun dock pour Date et montant seul ; masquer réellement sa réserve spatiale à transition stable.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-087 — A — IMPLEMENTED_VERIFIED

- **UI-087** · **RETENU — INTERPRÉTATION R5** — Adapter systématiquement son titre et son contenu à la décision en cours.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-088 — A — IMPLEMENTED_VERIFIED

- **UI-088** · **RETENU — CIBLE UX** — Éviter « Composer », « Compléter ta sortie » et « Choisir ce qui compte » lorsque des intitulés plus précis sont possibles.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-089 — A — IMPLEMENTED_VERIFIED

- **UI-089** · **RETENU — INTERPRÉTATION R5** — Ne jamais mélanger dans une même ligne des catégories, des objets concrets et des commandes de navigation.

**Précision R5 :** Une rangée = une nature de choix : catégories OU objets OU contacts OU modes OU lieux OU financement.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-090 — A — IMPLEMENTED_VERIFIED

- **UI-090** · **RETENU — INTERPRÉTATION R5** — Ne pas reproposer une fonction déjà accessible directement depuis la carte, sauf si elle constitue une véritable suggestion contextuelle.

**Précision R5 :** Le dock propose des options nouvelles ; carte édite les faits existants. Ne pas redonner 'Lieu' et 'Montant direct' en faux raccourcis.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-091 — A — IMPLEMENTED_VERIFIED

- **UI-091** · **RETENU — CIBLE UX** — Supprimer « Montant direct » du catalogue : le montant se manipule en cliquant sur le chiffre affiché sur la carte.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-092 — A — IMPLEMENTED_VERIFIED

- **UI-092** · **RETENU — CIBLE UX** — Remplacer les pages successives du dock par un défilement horizontal fluide, avec flèches toujours visibles.

**Précision R5 :** Rail horizontal continu. Flèches **si overflow** ; ne pas imposer toujours deux flèches inertes.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-093 — A — IMPLEMENTED_NOT_BROWSER_PROVEN

- **UI-093** · **RETENU — CIBLE UX** — Prévoir une légère ombre ou un fondu sur le bord droit pour indiquer que d'autres éléments existent.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Indice d’overflow CSS ajouté et associé à la mesure réelle ; perception visuelle finale à revoir.

### UI-094 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-094** · **EXPÉRIMENTAL — INACTIF PAR DÉFAUT** — Tester un défilement doux au survol prolongé des extrémités, sans déplacement inattendu lorsque la souris traverse le dock.

**Précision R5 :** **EXPÉRIMENTAL OFF** : ne pas activer le défilement au survol avant recette souris/drag.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : 6. Dock : catalogue horizontal et proposition réellement contextuelle — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-095 — A — PARTIAL

- **UI-095** · **RETENU — CIBLE UX** — Conserver une largeur de tuile homogène selon la famille d'objets, tout en permettant davantage de place pour les noms longs.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Tuiles bornées par famille ; noms extrêmes et grands catalogues visuels non certifiés.

### UI-096 — A — PARTIAL

- **UI-096** · **RETENU — CIBLE UX** — Éviter les textes coupés dans les tuiles ; réduire le contenu avant de réduire sa taille de police.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Retour à la ligne autorisé ; pas de preuve navigateur150 avec libellés longs.

### UI-097 — A — PARTIAL

- **UI-097** · **RETENU — CIBLE UX** — Positionner les suggestions les plus pertinentes au début, selon le contexte et l'historique exploitable.

**Précision R5 :** Historique peut prioriser une suggestion seulement avec preuve suffisante ; n'admet aucune décision automatiquement.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Suggestions propriétaires réutilisées ; aucun nouvel ordonnancement historique inventé, couverture de pertinence non certifiée.

### UI-098 — A — IMPLEMENTED_VERIFIED

- **UI-098** · **RETENU — MODIFIÉ PAR R5** — Conserver les choix déjà sélectionnés identifiables, sans les reproposer comme des objets à ajouter une seconde fois.

**Précision R5 :** Un **type de produit** peut rester ajoutable dans le dock ; une **ligne déjà ajoutée** se modifie sur la carte, sans fusion/doublon accidentel.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-099 — A — IMPLEMENTED_VERIFIED

- **UI-099** · **RETENU — CIBLE UX** — Prévoir une recherche intégrée lorsque le catalogue contient beaucoup d'options, plutôt que des pages interminables.

**Précision R5 :** Catalogue > dizaines d'options : sous-ensemble pertinent + recherche/filtres ; ne pas afficher 150 vignettes d'un coup.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-100 — A — PARTIAL

- **UI-100** · **RETENU — CIBLE UX** — Éviter que le dock saute d'une hauteur à l'autre à chaque modification mineure.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Rafale d’ajouts garde le rail ; hauteurs par nature diffèrent légèrement et petit viewport requiert document de secours.

### UI-101 — A — PARTIAL

- **UI-101** · **RETENU — CIBLE UX** — Supprimer les tuiles « Autre », « Plus tard » et « À préciser » lorsqu'elles n'apportent pas une possibilité réellement distincte.

**Précision R5 :** Conserver uniquement une option 'autre mode/produit' qui permet réellement de créer un objet différent ; pas de 'Plus tard' substituable au retour naturel.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Faux reports supprimés ; le mode other admissible reste visible sans description libre complète.

### UI-102 — A — IMPLEMENTED_VERIFIED

- **UI-102** · **RETENU — INTERPRÉTATION R5** — Occuper l’espace horizontal réellement disponible avec les propositions utiles avant d’en cacher derrière « Autre » ou une deuxième page.

**Précision R5 :** Rendre utiles les espaces existants avant d'ajouter 'Autres' ou pager ; sans tuiles trop étirées.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-103 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-103** · **EXPÉRIMENTAL — INACTIF PAR DÉFAUT** — Faire glisser les catégories et objets horizontalement dans une seule rangée à la souris, avec des flèches accessibles et, si pertinent, un auto-défilement modéré au bord après délai.

**Précision R5 :** Scroll natif horizontal, souris/molette selon support, flèches et focus ; survol bord OFF par défaut.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : 6. Dock : catalogue horizontal et proposition réellement contextuelle — 20 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-104 — A — IMPLEMENTED_VERIFIED

- **UI-104** · **RETENU — CIBLE UX** — Garder un seul vocabulaire et une même logique de retour dans tous les docks, sans faire réapparaître des portes de navigation déjà supprimées ailleurs.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-105 — A — IMPLEMENTED_VERIFIED

- **UI-105** · **RETENU — INTERPRÉTATION R5** — Dans un dock de recherche de lieux, garder les suggestions localement connues visibles même avant la première frappe, sans imposer la recherche Google pour les consulter.

**Précision R5 :** Lieux locaux suggérés au repos ; résultats Google frappés à proximité immédiate du champ.

**Décisions R5 dominantes :** R5-D28…D35.

Owner : Rail / catalogue. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Projection sur catalogue complet avant limite24, suite explicite ; rail réel sans pager ; mémoire par occurrence/scène/moment/famille.

**Preuves :** scripts/check-bar-subassets-r5-dock.mjs, proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-106 — A — IMPLEMENTED_VERIFIED

- **UI-106** · **RETENU — MODIFIÉ PAR R5** — Organiser les sous-assets selon la logique Événement → Moment → Famille → Objet.

**Précision R5 :** Ontologie sémantique, **pas cinq écrans imposés** pour ajouter une boisson.

**Décisions R5 dominantes :** R5-D36…D38.

Owner : Moments / objets. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-107 — A — IMPLEMENTED_VERIFIED

- **UI-107** · **RETENU — CIBLE UX** — Donner à Before et Au bar un véritable statut de moment, plutôt que de les présenter comme deux boissons ou deux objets.

**Précision R5 :** Before/Au bar ont des owners/sections propres ; ils ne figurent pas dans la liste des produits Boissons.

**Décisions R5 dominantes :** R5-D36…D38.

Owner : Moments / objets. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-108 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-108** · **RETENU — INTERPRÉTATION R5** — Créer une illustration spécifique au Before : petite table, verres, cartes et ambiance de début de soirée.

**Précision R5 :** Illustration **d'ambiance** de moment, non preuve de Chips/Vodka/etc. sélectionnés.

**Décisions R5 dominantes :** R5-D36…D38.

Owner : 7. Moments de la soirée : Before, Au bar et autres moments — 10 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-109 — A — IMPLEMENTED_VERIFIED

- **UI-109** · **SOUS CONTRAT MÉTIER/PROVIDER** — Lorsqu'une boisson est ajoutée, montrer son résultat immédiatement dans le bon moment et conserver le dock Boissons si l'utilisateur veut en ajouter d'autres.

**Précision R5 :** Mutation via owner du **bon moment**, le dock reste sur Boissons pour d'autres ajouts.

**Décisions R5 dominantes :** R5-D36…D38.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-110 — A — IMPLEMENTED_VERIFIED

- **UI-110** · **RETENU — INTERPRÉTATION R5** — Afficher Before comme un moment facultatif « Avant de sortir », au même niveau conceptuel qu’« Au bar », et non comme un objet du catalogue Boissons.

**Précision R5 :** Before est un moment optionnel ; son objet principal technique actuel ne doit pas dicter la nomenclature visuelle.

**Décisions R5 dominantes :** R5-D36…D38.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-111 — A — IMPLEMENTED_VERIFIED

- **UI-111** · **SOUS CONTRAT MÉTIER/PROVIDER** — Ne créer la section Before que lorsqu’elle est demandée ; conserver une petite action « + Avant de sortir » sur la carte lorsqu’elle est absente.

**Précision R5 :** Cliquer '+ Avant de sortir' peut ouvrir le choix ; **pas de Before persisté vide**. Admission après premier poste réel sous owner.

**Décisions R5 dominantes :** R5-D36…D38.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-112 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-112** · **RETENU — CIBLE UX** — Doter Before d’une illustration contextuelle de table basse avec cartes, verres, bouteille et quelques snacks, dans la même direction artistique que Bar.

**Précision R5 :** L'ambiance illustrée peut inclure verres/cartes/table, mais une bouteille spécifique ne doit pas sembler une consommation retenue.

**Décisions R5 dominantes :** R5-D36…D38.

Owner : 7. Moments de la soirée : Before, Au bar et autres moments — 10 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-113 — A — IMPLEMENTED_VERIFIED

- **UI-113** · **RETENU — INTERPRÉTATION R5** — Quand « + Ajouter » est utilisé dans Before, afficher directement les familles d’objets adaptées à ce moment, sans reproposer « Before ».

**Précision R5 :** Dès le moment actif, accéder familles/objets de Before directement, sans repasser par la porte Before.

**Décisions R5 dominantes :** R5-D36…D38.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-114 — A — IMPLEMENTED_VERIFIED

- **UI-114** · **SOUS CONTRAT MÉTIER/PROVIDER** — Associer chaque boisson, aliment et coût au moment auquel il a été ajouté ; ne pas déplacer implicitement un objet d’« Au bar » vers Before.

**Précision R5 :** `selectionId`/owner du Before distinct du parent Au bar ; aucun déplacement tacite de poste.

**Décisions R5 dominantes :** R5-D36…D38.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-115 — A — IMPLEMENTED_VERIFIED

- **UI-115** · **RETENU — INTERPRÉTATION R5** — Afficher les différents moments comme sections reconnaissables sans transformer Before en seconde carte ou en événement séparé.

**Précision R5 :** Moment visuel ≠ nouvelle carte indépendante du Board.

**Décisions R5 dominantes :** R5-D36…D38.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-116 — A — IMPLEMENTED_VERIFIED

- **UI-116** · **RETENU — CIBLE UX** — Afficher des catalogues Boissons et Restauration distincts.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-117 — A — IMPLEMENTED_VERIFIED

- **UI-117** · **RETENU — CIBLE UX** — Réserver Bière, Vin, Cocktail, Shot, Soft, Eau et Bouteille au catalogue Boissons.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-118 — A — IMPLEMENTED_VERIFIED

- **UI-118** · **RETENU — CIBLE UX** — Réserver Tapas, Planche, Snack, Repas et autres aliments au catalogue Restauration.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-119 — A — PARTIAL

- **UI-119** · **SOUS CONTRAT MÉTIER/PROVIDER** — Réutiliser les catalogues existants d'autres modules sans ouvrir leurs formulaires complets ni perdre le contexte Bar.

**Précision R5 :** Réemployer asset/métier compatible, **pas** le wizard Restaurant/Repas et pas un nouveau owner universel.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Réutilisation limitée aux assets admissibles Bar/club/house_party ; pas d’import arbitraire de tout le catalogue Restaurant.

### UI-120 — A — IMPLEMENTED_VERIFIED

- **UI-120** · **SOUS CONTRAT MÉTIER/PROVIDER** — Ne pas multiplier les objets identiques sans conserver leurs prix et règles de financement distincts.

**Précision R5 :** Deux lignes identiques peuvent coexister si prix, scope ou financement diffèrent. Ne pas les fusionner par libellé.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-121 — A — IMPLEMENTED_VERIFIED

- **UI-121** · **SOUS CONTRAT MÉTIER/PROVIDER** — Regrouper toutes les boissons dans leur famille : Bière, Vin, Cocktail, Shot, Soft, Eau, Bouteille et éventuellement Boisson personnalisée.

**Précision R5 :** Boissons réellement admissibles seulement ; pas 'Before', 'Repas' ni 'Montant direct'.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-122 — A — IMPLEMENTED_VERIFIED

- **UI-122** · **RETENU — INTERPRÉTATION R5** — Retirer du catalogue Boissons les entrées Before, Montant direct, « Repas, before et autres choix » et Planche / tapas.

**Précision R5 :** Contrat strict de famille : Before = moment ; Planche/Tapas = Restauration ; global = clic sur montant.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-123 — A — IMPLEMENTED_VERIFIED

- **UI-123** · **SOUS CONTRAT MÉTIER/PROVIDER** — Regrouper dans Restauration les catégories Snack, Tapas, Planche, Sandwich, Repas et aliment personnalisé, selon ce que le module sait réellement créer.

**Précision R5 :** Inclure produit personnalisé seulement si une opération métier réelle sait créer ce poste.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-124 — A — PARTIAL

- **UI-124** · **SOUS CONTRAT MÉTIER/PROVIDER** — Dans la soirée, importer le catalogue et ses règles d’un sous-module existant sans ouvrir le scénario complet « Restaurant » ou « Repas » comme un autre événement.

**Précision R5 :** Réutilisation d'un sous-module dans **l'événement parent**, sans seconde demande date/lieu/personnes.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Même limite owner que UI119 ; aucun second scénario ni demande date/lieu/personnes lors d’ajout compatible.

### UI-125 — B — NO_CHANGE_REQUIRED_VERIFIED

- **UI-125** · **SOUS CONTRAT MÉTIER/PROVIDER** — Permettre de réutiliser une définition de boisson, repas ou snack dans Bar, Soirée techno, Festival, Voyage et Déclarer une dépense tout en conservant l’événement et le moment propriétaires.

**Précision R5 :** Transfert de grammaire graphique et catalogue sous adaptateur de domaine ; **ne pas généraliser** `EDIT_NIGHT_OUT` à Voyage.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Grammaire réutilisée pour sous-assets admissibles ; EDIT_NIGHT_OUT non généralisé à Voyage.

### UI-126 — A — IMPLEMENTED_VERIFIED

- **UI-126** · **RETENU — INTERPRÉTATION R5** — Empêcher le retour non sollicité vers une porte générique « Lieu », « Date » ou « Personnes » après avoir sélectionné « Repas » ou « Boissons ».

**Précision R5 :** Après ajout d'un objet, rester dans la même famille/moment ; ne pas déclencher une sous-application.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-127 — A — IMPLEMENTED_VERIFIED

- **UI-127** · **SOUS CONTRAT MÉTIER/PROVIDER** — Conserver deux lignes distinctes pour deux bières de prix différents, sauf fusion explicitement choisie et financièrement correcte.

**Précision R5 :** Conserver identités et couvertures distinctes, Undo exact.

**Décisions R5 dominantes :** R5-D39…D43.

Owner : Moments / objets. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Premier Before par objet réel ; promotion atomique du principal ; propriétaires et selectionId distincts ; familles compatibles sous EDIT_NIGHT_OUT.

**Preuves :** proofs/react-interactions.json, proofs/bar-p4-results.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-128 — A — IMPLEMENTED_VERIFIED

- **UI-128** · **RETENU — MODIFIÉ PAR R5** — Supprimer « Bouteille partagée » comme catégorie : une bouteille est un objet, le partage est une propriété financière.

**Précision R5 :** Bouteille = objet ; `SHARED` désigne une base/unité et **n'est pas** une dette ni une répartition entre personnes.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-129 — A — BLOCKED_OWNER

- **UI-129** · **SOUS CONTRAT MÉTIER/PROVIDER** — Permettre de configurer qui partage le coût directement depuis la tuile de la bouteille ou des tapas.

**Précision R5 :** Afficher/activer partage effectif **seulement** si l'owner Finance sait persister les parts du poste.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log, src/domain/phase2/planner/component-contract.ts, src/domain/phase2/planner/night-out-edit.ts

**Reste :** ComponentSelectionV1 ne conserve pas les parts par payeur/remboursements ; aucune UI de partage financier fictive.

### UI-130 — A — BLOCKED_OWNER

- **UI-130** · **SOUS CONTRAT MÉTIER/PROVIDER** — Faire apparaître les personnes de la soirée dans le dock lorsqu'on choisit une répartition de frais.

**Précision R5 :** Dock d'avatars lié au **poste ciblé**, pas à tous les coûts de la soirée.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log, src/domain/phase2/planner/component-contract.ts, src/domain/phase2/planner/night-out-edit.ts

**Reste :** Pas de dock de répartition financière sans contrat de parts du poste ; présence reste indépendante.

### UI-131 — B — BLOCKED_OWNER

- **UI-131** · **SOUS CONTRAT MÉTIER/PROVIDER** — Permettre d'ajouter une personne absente de la soirée, avec confirmation de son association à l'événement.

**Précision R5 :** Nouvel invité proposé au partage : association explicite à l'événement si requise ; présence et dette ne sont pas synonymes.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log, src/domain/phase2/planner/component-contract.ts, src/domain/phase2/planner/night-out-edit.ts

**Reste :** Association présence/payeur non publiée par l’owner de parts ; aucune dette fabriquée.

### UI-132 — A — IMPLEMENTED_VERIFIED

- **UI-132** · **RETENU — MODIFIÉ PAR R5** — Rendre le montant global cliquable directement dans l'en-tête de Bar.

**Précision R5 :** Le clic sur montant ouvre son **périmètre réellement éditable**, jamais un agrégat calculé librement écrasable.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-133 — A — PARTIAL

- **UI-133** · **RETENU — MODIFIÉ PAR R5** — Ouvrir un petit éditeur de montant à proximité du chiffre, plutôt qu'un nouveau catalogue ou un long formulaire.

**Précision R5 :** Popover ancré près du montant ; si plusieurs scopes, arbitrage précis plutôt qu'un champ total général trompeur.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** Le coût ouvre sa portée sûre existante, mais pas un popover ancré à la valeur. Aucun agrégat Compiler écrasable.

### UI-134 — B — PARTIAL

- **UI-134** · **SOUS CONTRAT MÉTIER/PROVIDER** — Distinguer visuellement « Aucun montant défini », « Coûts connus partiels » et « Total prévisionnel complet ».

**Précision R5 :** Coût inconnu, zéro reconnu, connu partiel, complet, référence historique et estimation périmée sont six cas distincts.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** UNKNOWN et frais/précédent conservés ; six états visuels pas tous certifiés.

### UI-135 — B — ALREADY_VERIFIED

- **UI-135** · **RETENU — CIBLE UX** — Ne jamais présenter `0,00 €` comme un coût connu lorsque rien n'a été décidé.

**Précision R5 :** UNKNOWN ≠ 0 explicite ; ne pas 'remettre à zéro' lors d'un passage global → détail.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-136 — B — PARTIAL

- **UI-136** · **RETENU — INTERPRÉTATION R5** — Éviter les répétitions de type « À définir · aucun choix retenu ».

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** Textes normaux allégés ; quelques répétitions dans états avancés conservées.

### UI-137 — B — PARTIAL

- **UI-137** · **RETENU — INTERPRÉTATION R5** — Montrer les prix unitaires uniquement lorsqu'ils sont utiles à la compréhension d'un objet ; privilégier autrement son coût prévu.

**Précision R5 :** Présenter `€/u` quand nécessaire pour éviter l'ambiguïté quantité × base ; ne pas masquer l'unité financière critique.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** Réception exhaustive de cette exigence non obtenue ; voir les limites du lot.

### UI-138 — B — ALREADY_VERIFIED

- **UI-138** · **SOUS CONTRAT MÉTIER/PROVIDER** — Donner au choix « Total global » et « Détail des consommations » une interaction explicite de remplacement, pour éviter le double comptage.

**Précision R5 :** Global substitutif remplacé seulement dans sa couverture ; entrée additive indépendante conservée ; arbitrage en cas de chevauchement.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-139 — B — ALREADY_VERIFIED

- **UI-139** · **RETENU — CIBLE UX** — Conserver les protections RAW et les règles de financement, même si l'interface devient beaucoup plus légère.

**Précision R5 :** Garde RAW/Undo/Finance V2 non négociable même si labels et boutons disparaissent.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-140 — A — IMPLEMENTED_VERIFIED

- **UI-140** · **RETENU — MODIFIÉ PAR R5** — Remplacer « Bouteille partagée » par « Bouteille » (ou type précis : Vodka, Rhum, etc.), sans préjuger d’un partage.

**Précision R5 :** Objets neutres ; partage est une action avancée autoritaire sur l'objet, pas un type de bouteille.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-141 — A — PARTIAL

- **UI-141** · **SOUS CONTRAT MÉTIER/PROVIDER** — Après ajout d’une bouteille, permettre de choisir librement quantité, prix, unité et répartition financière depuis l’objet lui-même.

**Précision R5 :** Options avancées ouvertes à la demande ; part personnelle et remboursements seulement sous contrat Finance prouvé.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log, src/domain/phase2/planner/component-contract.ts, src/domain/phase2/planner/night-out-edit.ts

**Reste :** Quantité/prix/unité/funding accessibles ; répartition financière bloquée par absence de parts propriétaire.

### UI-142 — A — BLOCKED_OWNER

- **UI-142** · **SOUS CONTRAT MÉTIER/PROVIDER** — Lorsque « Partager les frais » est activé, proposer d’abord les participants déjà associés à la soirée.

**Précision R5 :** Prioriser contacts déjà présents, sans supposer qu'ils partagent les coûts.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log, src/domain/phase2/planner/component-contract.ts, src/domain/phase2/planner/night-out-edit.ts

**Reste :** Partage financier non activé : ne pas confondre contacts de présence et payeurs.

### UI-143 — B — BLOCKED_OWNER

- **UI-143** · **SOUS CONTRAT MÉTIER/PROVIDER** — Si une nouvelle personne est choisie pour un partage, prévoir explicitement son rattachement à la soirée, sans déduire qu’elle paie d’autres postes.

**Précision R5 :** Ne faire payer aucun autre poste automatiquement quand un contact rejoint un partage.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log, src/domain/phase2/planner/component-contract.ts, src/domain/phase2/planner/night-out-edit.ts

**Reste :** Absence de contrat payeur/association explicite ; ne crée aucune allocation croisée.

### UI-144 — B — NO_CHANGE_REQUIRED_VERIFIED

- **UI-144** · **SOUS CONTRAT MÉTIER/PROVIDER** — Conserver le coût total de l’objet distinct de la part individuelle et d’un éventuel remboursement attendu ; ne pas diviser le coût total de l’événement par défaut.

**Précision R5 :** Montant bouteille complet ≠ part individuelle ≠ payé par portefeuille ≠ dette/remboursement.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log, src/domain/phase2/planner/component-contract.ts, src/domain/phase2/planner/night-out-edit.ts

**Reste :** Le coût entier est conservé ; aucune division individuelle ou créance calculée en React. Parts non exposées.

### UI-145 — B — NO_CHANGE_REQUIRED_VERIFIED

- **UI-145** · **SOUS CONTRAT MÉTIER/PROVIDER** — Réutiliser les règles de partage et de financement existantes lorsqu’elles s’appliquent, y compris les cas de type Swile, sans inventer une prise en charge.

**Précision R5 :** Swile/Edenred : uniquement si éligibilité **du poste et de la transaction** démontrée ; pas de badge implicite sur alcool.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log, src/domain/phase2/planner/component-contract.ts, src/domain/phase2/planner/night-out-edit.ts

**Reste :** Funding existant et Kernel inchangés ; aucune éligibilité Swile/Edenred ajoutée ou prétendue pour alcool.

### UI-146 — B — ALREADY_VERIFIED

- **UI-146** · **SOUS CONTRAT MÉTIER/PROVIDER** — Lorsque l’utilisateur saisit d’abord un montant global puis détaille ses consommations, remplacer le global par le détail selon une règle explicitée, sans cumul accidentel et sans effacer silencieusement du RAW.

**Précision R5 :** Pas `50 + 8 = 58` si couvertures se chevauchent ; pas `0` inventé ; remplacement ciblé undoable avec IDs/funding.

**Décisions R5 dominantes :** R5-D44…D50.

Owner : Scopes / financement. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Bouteille neutre, bases économiques existantes ; remplacement ciblé sous couverture ; aucun partage de dette ou droit Wallet inventé.

**Preuves :** proofs/bar-p1-results.json, proofs/bar-p4-results.json, proofs/finance-final.log

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-147 — A — IMPLEMENTED_VERIFIED

- **UI-147** · **SOUS CONTRAT MÉTIER/PROVIDER** — Concevoir des mini-éditeurs propres à chaque objet : quantités, prix et options sur une seule petite surface.

**Précision R5 :** Mini-éditeur court et spécifique, mutation propriétaire ; prix RAW différent du Draft admis.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

Owner : Mini-éditeurs. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Prix/quantité dans tuile, détails secondaires ; virgule terminale non admise ; Entrée explicite sans commit au blur.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-148 — A — PARTIAL

- **UI-148** · **RETENU — CIBLE UX** — Faire varier ces mini-éditeurs selon le type de donnée : compteur pour une quantité, choix illustrés pour une boisson, sélection d'avatars pour le partage.

**Précision R5 :** Le même style de tuile peut contenir des contrôles différents selon l'objet et le moment.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

Owner : Mini-éditeurs. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Prix/quantité dans tuile, détails secondaires ; virgule terminale non admise ; Entrée explicite sans commit au blur.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Compteur et prix courts livrés ; avatars de partage non activés faute de contrat financier.

### UI-149 — A — IMPLEMENTED_VERIFIED

- **UI-149** · **RETENU — INTERPRÉTATION R5** — Éviter de transformer chaque mini-module en formulaire avec cinq labels et quatre boutons.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

Owner : Mini-éditeurs. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Prix/quantité dans tuile, détails secondaires ; virgule terminale non admise ; Entrée explicite sans commit au blur.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-150 — A — IMPLEMENTED_VERIFIED

- **UI-150** · **SOUS CONTRAT MÉTIER/PROVIDER** — Garder les unités, noms personnalisés et détails de financement accessibles dans un niveau secondaire.

**Précision R5 :** Menu ⋯ accessible au clavier, détails de provenance/financement non détruits.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

Owner : Mini-éditeurs. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Prix/quantité dans tuile, détails secondaires ; virgule terminale non admise ; Entrée explicite sans commit au blur.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-151 — A — IMPLEMENTED_VERIFIED

- **UI-151** · **SOUS CONTRAT MÉTIER/PROVIDER** — Éditer quantité, prix et options par interaction directe sur une petite tuile, plutôt que déployer une fiche complète sous l’objet.

**Précision R5 :** La tuile Bière déjà admise se modifie sur place, sans injecter une grande fiche longue.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

Owner : Mini-éditeurs. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Prix/quantité dans tuile, détails secondaires ; virgule terminale non admise ; Entrée explicite sans commit au blur.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-152 — A — IMPLEMENTED_VERIFIED

- **UI-152** · **RETENU — INTERPRÉTATION R5** — Alléger les libellés tels que « Quantité totale », « Prix unitaire (€) », « Détails du poste », « Unité, financement et nom » ; conserver seulement les indices indispensables et ouvrir les détails à la demande.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

Owner : Mini-éditeurs. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Prix/quantité dans tuile, détails secondaires ; virgule terminale non admise ; Entrée explicite sans commit au blur.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-153 — A — IMPLEMENTED_VERIFIED

- **UI-153** · **SOUS CONTRAT MÉTIER/PROVIDER** — Si la valeur a déjà été saisie, ne pas imposer de clic supplémentaire sur « Enregistrer » lorsque l’action peut être appliquée sans ambiguïté.

**Précision R5 :** Entrée, ou blur **démontré sûr** seulement ; jamais autosave caractère ni garde RAW supprimée.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

Owner : Mini-éditeurs. Niveau : BROWSER_PREVIEW_AUTH_MEMORY_PLUS_REACT. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Prix/quantité dans tuile, détails secondaires ; virgule terminale non admise ; Entrée explicite sans commit au blur.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-154 — A — IMPLEMENTED_VERIFIED

- **UI-154** · **RETENU — CIBLE UX** — Utiliser icônes compréhensibles, compteurs et sélecteurs contextuels sans créer de menus incompréhensibles ou de contrôle sans retour visible.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D25…D27, D41…D42.

Owner : Mini-éditeurs. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Prix/quantité dans tuile, détails secondaires ; virgule terminale non admise ; Entrée explicite sans commit au blur.

**Preuves :** proofs/react-interactions.json, proofs/preview2.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-155 — A — IMPLEMENTED_VERIFIED

- **UI-155** · **RETENU — MODIFIÉ PAR R5** — Séparer les propositions de trajets habituels des choix de mode de transport.

**Précision R5 :** Modes et trajets complets appartiennent à deux catalogues/sous-étapes différents.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-156 — A — PARTIAL

- **UI-156** · **RETENU — CIBLE UX** — Présenter les modes Voiture, Tram/Train, Bus, Taxi/Uber et À pied avec des illustrations de même style et de même taille.

**Précision R5 :** Illustration À pied nécessaire ; modes courts et pertinents, pas 'Autre transport' ambigu en façade.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Clay voiture/train/bus/marche réutilisé ; Taxi reste un fallback iconographique, harmonisation complète non certifiée.

### UI-157 — A — IMPLEMENTED_VERIFIED

- **UI-157** · **SOUS CONTRAT MÉTIER/PROVIDER** — Afficher les trajets déjà connus sous une forme compacte : `Maison → Le Café Riche · Peugeot 207`.

**Précision R5 :** Suggestion de route ≠ trajet décidé ; nom véhicule compact, coût seulement après estimation.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-158 — B — IMPLEMENTED_VERIFIED

- **UI-158** · **SOUS CONTRAT MÉTIER/PROVIDER** — Garder la fiche technique détaillée du véhicule dans une information secondaire.

**Précision R5 :** Détails véhicule en seconde lecture, `Peugeot 207` au premier niveau.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-159 — A — IMPLEMENTED_VERIFIED

- **UI-159** · **RETENU — CIBLE UX** — Ne pas afficher les choix « Plus tard » et « À préciser » comme modes de transport.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-160 — A — BLOCKED_OWNER

- **UI-160** · **SOUS CONTRAT MÉTIER/PROVIDER** — Prévoir un mode personnalisé dans les options avancées pour les transports non couverts.

**Précision R5 :** Transport libre dans détails uniquement si le contrat permet réellement sa description.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json, src/domain/phase2/planner/component-contract.ts, src/domain/phase2/planner/night-out-edit.ts

**Reste :** Mode other existant mais description libre nommée absente du contrat ; pas de champ éphémère trompeur.

### UI-161 — B — ALREADY_VERIFIED

- **UI-161** · **RETENU — INTERPRÉTATION R5** — Rendre l'Aller et le Retour visuellement distincts, tout en leur donnant la même structure graphique.

**Précision R5 :** Aller et Retour indépendants par sens/identité ; Retour peut être décidé en premier.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-162 — B — ALREADY_VERIFIED

- **UI-162** · **SOUS CONTRAT MÉTIER/PROVIDER** — Afficher distance, carburant et péages uniquement lorsqu'une estimation correspondante est réellement disponible.

**Précision R5 :** Distance/carburant/péages affichés si owner et digest **frais et correspondants** à ce trajet, pas valeur obsolète.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-163 — B — IMPLEMENTED_VERIFIED

- **UI-163** · **SOUS CONTRAT MÉTIER/PROVIDER** — Transformer les longs textes d'indisponibilité Mobility en une indication courte comme « Estimation indisponible », avec explication accessible au besoin.

**Précision R5 :** Explication longue à la demande ; la valeur inconnue n'est pas 0 €.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-164 — B — ALREADY_VERIFIED

- **UI-164** · **SOUS CONTRAT MÉTIER/PROVIDER** — Proposer un ajustement lorsque le bar change, sans remplacer automatiquement les lieux de départ ou de retour personnalisés.

**Précision R5 :** Ne mettre à jour que les endpoints **explicitement liés** au bar. Ne jamais déduire un lien via nom ou distance.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-165 — A — IMPLEMENTED_VERIFIED

- **UI-165** · **RETENU — INTERPRÉTATION R5** — Ne pas mêler dans la même rangée un trajet habituel long avec les simples modes de transport ; afficher le trajet connu comme suggestion distincte et courte.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-166 — A — IMPLEMENTED_NOT_BROWSER_PROVEN

- **UI-166** · **RETENU — INTERPRÉTATION R5** — Prévoir pour « À pied » et les autres modes une illustration visible et harmonisée, y compris à petite taille.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Asset walking Clay référencé ; lisibilité petite taille pas certifiée séparément.

### UI-167 — B — ALREADY_VERIFIED

- **UI-167** · **SOUS CONTRAT MÉTIER/PROVIDER** — Réutiliser le calculateur existant de « Déclarer une dépense » pour les distances, carburants, péages et illustrations de trajets lorsque leurs contrats sont compatibles.

**Précision R5 :** Réutiliser le fournisseur/calculateur déjà disponible, **aucun second moteur de route ni calcul front improvisé**.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-168 — A — IMPLEMENTED_VERIFIED

- **UI-168** · **SOUS CONTRAT MÉTIER/PROVIDER** — Garder le choix de transport facultatif : ne pas ajouter « Plus tard » si l’utilisateur peut simplement ne rien choisir.

**Précision R5 :** Absence de choix = transport non décidé, pas option 'On verra plus tard'.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-169 — B — IMPLEMENTED_VERIFIED

- **UI-169** · **SOUS CONTRAT MÉTIER/PROVIDER** — Éviter d’afficher en première ligne le nom technique complet du véhicule ; privilégier « Peugeot 207 » avec ses spécifications en second niveau.

**Précision R5 :** N'afficher constructeur/modèle court ; motorisation/carburant/BVM accessibles au détail.

**Décisions R5 dominantes :** R5-D51…D54.

Owner : Mobility. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Modes séparés des trajets connus ; sens indépendants, endpoints liés explicitement ; owner existant seul pour les devis ; inconnu reste inconnu.

**Preuves :** proofs/bar-p3-results.json, proofs/bar-p4-results.json, proofs/preview1.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-170 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-170** · **RETENU — INTERPRÉTATION R5** — Réduire la hauteur des cartes simples qui n'ont encore aucun choix utilisateur.

**Précision R5 :** Compacter également l'empreinte de grille et non seulement l'intérieur de la petite carte.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-171 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-171** · **RETENU — CIBLE UX** — Afficher un seul état « À prévoir » ou « À définir », plutôt que plusieurs formulations équivalentes.

**Précision R5 :** N'afficher qu'un seul état utile sans prix fictif à 0 €.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-172 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-172** · **RETENU — INTERPRÉTATION R5** — Ne pas utiliser une énorme taille de police pour une absence de décision, au détriment du nom de l'objet.

**Précision R5 :** Typographie de l'objet et de la décision prioritaire à celle de l'absence.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-173 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-173** · **RETENU — CIBLE UX** — Faire de l'illustration et du titre les deux éléments les plus importants des cartes non configurées.

**Précision R5 :** Illustration d'univers **décorative** clairement distincte d'un poste économique ajouté.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-174 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-174** · **RETENU — CIBLE UX** — Afficher les détails économiques uniquement lorsque des informations suffisantes existent.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-175 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-175** · **SOUS CONTRAT MÉTIER/PROVIDER** — Rendre chaque carte voisine directement manipulable depuis son information principale : fréquence, prix, quantité ou destination, selon sa nature.

**Précision R5 :** Clic sur le prix/fréquence visible du preset correspondant ; ne pas copier de force l'éditeur Bar.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-176 — B — PARTIAL

- **UI-176** · **SOUS CONTRAT MÉTIER/PROVIDER** — Permettre à la carte Bar fermée de présenter une synthèse de sa soirée : lieu, date, personnes, quelques consommations et éventuels trajets.

**Précision R5 :** Synthèse **bornée** : groupes et +N ; accès réel aux deux trajets et à tous les postes, pas liste complète forcée.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : Synthèse existante. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Synthèses bornées existantes conservées ; aucune modification de dimensions ou gabarit fermé.

**Preuves :** proofs/bar-p2-results.json, proofs/preview2.json

**Reste :** Synthèse fermée conservée ; aucune refonte spatiale ni réception exhaustive état fermé riche.

### UI-177 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-177** · **RETENU — INTERPRÉTATION R5** — Préserver un alignement cohérent des cartes entre elles, même lorsque certaines contiennent beaucoup plus de données.

**Précision R5 :** Alignement calme sans imposer une hauteur commune artificielle.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-178 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-178** · **RETENU — INTERPRÉTATION R5** — Éviter de forcer toutes les cartes fermées dans un format dont la hauteur dépend de la carte voisine la plus dense.

**Précision R5 :** Hauteur intrinsèque propre à chaque carte, malgré CSS Grid voisin.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-179 — B — PARTIAL

- **UI-179** · **RETENU — INTERPRÉTATION R5** — Dans la carte Bar fermée, réutiliser l’espace disponible pour faire ressortir le contexte réellement choisi et ses objets, plutôt que laisser une grande zone vide.

**Précision R5 :** Placer les informations **réelles** dans l'espace présent, pas agrandir la cellule pour meubler.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : Synthèse existante. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Synthèses bornées existantes conservées ; aucune modification de dimensions ou gabarit fermé.

**Preuves :** proofs/bar-p2-results.json, proofs/preview2.json

**Reste :** Informations réelles affichées ; compacité générale de carte fermée réservée à C.

### UI-180 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-180** · **RETENU — INTERPRÉTATION R5** — Ne pas grossir artificiellement une carte fermée avec du texte explicatif ; remplir la surface par une composition graphique sobre et des contenus réels.

**Précision R5 :** Décor à empreinte constante ; si le Board réserve 760px inutilement, corriger le packer d'abord.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-181 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-181** · **RETENU — INTERPRÉTATION R5** — Rationaliser les cartes Mascara, Sourcils, Vêtements et Maison petit qui répètent « À définir » et « Aucun choix retenu » sur plusieurs lignes.

**Précision R5 :** Un seul 'À prévoir' au lieu de lignes redondantes ; garder prix de référence seulement si qualifié et pertinent.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-182 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-182** · **RETENU — INTERPRÉTATION R5** — Éviter qu’une carte détaillée oblige ses voisines à s’étirer verticalement et à afficher des zones blanches inutiles.

**Précision R5 :** Ne jamais étirer les petites voisines par la grande carte sur leur rangée.

**Décisions R5 dominantes :** R5-D03…D12, D63.

Owner : 12. Carte fermée, tuiles voisines et synthèse du Board — 13 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-183 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-183** · **RETENU — INTERPRÉTATION R5** — Lorsque Bar est vide, utiliser une illustration d'ambiance plus présente plutôt qu'une grande surface blanche.

**Précision R5 :** Ambiance Clay douce **dans** l'espace déjà utile, jamais surlargeur/surhauteur pour décor.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-184 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-184** · **RETENU — INTERPRÉTATION R5** — Lorsque Bar est riche, diminuer le décor et donner la priorité aux véritables éléments sélectionnés.

**Précision R5 :** Densité de la **scène affichée** gouverne la quantité de décor, pas seulement total de postes en arrière-plan.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-185 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-185** · **EXPÉRIMENTAL** — Introduire des ombres, reflets ou motifs contextuels discrets propres à chaque catégorie d'asset, avec une bibliothèque graphique réutilisable.

**Précision R5 :** Fonds matière/reflet ultra discrets, sans lire un halo comme statut de prix.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-186 — A — PARTIAL

- **UI-186** · **RETENU — CIBLE UX** — Utiliser une seule famille d'illustrations 3D pour les objets, transports, moments et catégories, avec des miniatures réellement lisibles.

**Précision R5 :** Réutiliser d'abord bibliothèque Clay du Builder ; vérifier cadrage WebP 2:1 et lisibilité petit format.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : Illustrations. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Clay existant, recadrage local des vignettes dock ; icônes fonctionnelles conservées ; photo fournisseur jamais identité.

**Preuves :** proofs/screenshots/final-preview-1920.png, proofs/screenshots/final-preview-1152.png

**Reste :** Clay existant prioritaire ; certains produits/modes restent des icônes, pas de nouvelle image inventée.

### UI-187 — A — PARTIAL

- **UI-187** · **RETENU — INTERPRÉTATION R5** — Supprimer les pictogrammes génériques violets lorsqu'une illustration contextuelle claire existe.

**Précision R5 :** Remplacer les icônes génériques uniquement quand une vraie image Clay reconnaissable existe ; garder icônes fonctionnelles pour action.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : Illustrations. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Clay existant, recadrage local des vignettes dock ; icônes fonctionnelles conservées ; photo fournisseur jamais identité.

**Preuves :** proofs/screenshots/final-preview-1920.png, proofs/screenshots/final-preview-1152.png

**Reste :** Images existantes utilisées ; fallback générique encore visible pour certains produits, notamment Cocktail.

### UI-188 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-188** · **RETENU — INTERPRÉTATION R5** — Créer une identité visuelle commune à toutes les cartes de Budgetisation, déclinée par univers : bar, soirée, voyage, maison, vêtements, tabac/vape, etc.

**Précision R5 :** Design system commun, accent Bar ambre, Soirée prune, Voyage horizon, Maison sauge, etc. ; même focus et état financier partout.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-189 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-189** · **RETENU — INTERPRÉTATION R5** — Favoriser des fonds très discrets : ombres projetées, reflets de verres, lumière d’ambiance, matières ou silhouettes contextuelles, plutôt qu’une grande photo derrière les textes.

**Précision R5 :** Effet décoratif stable et non interactif ; supprimer si concurrence avec prix/nom/objets.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-190 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-190** · **HYPOTHÈSE À MESURER** — Pour Bar, explorer une palette crème/ambre avec ombres de verres, silhouette de comptoir et reflets dorés ; pour Soirée des lumières violettes ; pour Voyage des ombres d’horizon ou de végétation.

**Précision R5 :** **Hypothèses visuelles**, pas palette validée ; calibrer sur Board complet, contrastes et 125% natif.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-191 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-191** · **RETENU — CIBLE UX** — Associer au thème un accent décoratif 3D facultatif sur la carte vide ; le réduire à mesure que les consommations et informations réelles occupent la carte.

**Précision R5 :** Clay décoratif ≠ achat ; ambiance s'efface quand les vrais objets occupent la carte.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-192 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-192** · **DIFFÉRÉ** — Définir une banque de variantes limitées pour chaque univers (par exemple trois ambiances Bar cohérentes), sans changer aléatoirement l’image à chaque rendu.

**Précision R5 :** **Différé** : démarrer avec UNE ambiance Bar stable. Jusqu'à 3 variantes seulement après besoin démontré ; pas 10 variantes d'emblée.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-193 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-193** · **SOUS CONTRAT MÉTIER/PROVIDER** — Si une variante est choisie à la création, la stabiliser durablement pour la carte afin d’éviter un décor différent après chaque rechargement.

**Précision R5 :** Variante future déterministe par carte, pas de nouveau schéma de persistance sans propriétaire explicite.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-194 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-194** · **SOUS CONTRAT MÉTIER/PROVIDER** — N’utiliser une sous-catégorie de bar (cocktails, pub/brasserie, vin) pour le décor que si elle est étayée par une classification fiable ; sinon conserver le thème Bar générique.

**Précision R5 :** Catégorie de bar uniquement si source/owner fiable ; aucun classification par guessing du nom ou photo.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-195 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-195** · **RETENU — CIBLE UX** — Ne jamais ajouter de question obligatoire « Quel type de bar ? » uniquement pour choisir le décor.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-196 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-196** · **DIFFÉRÉ** — Envisager une personnalisation facultative « Changer l’ambiance » dans les options secondaires de la carte.

**Précision R5 :** **Différé** : pas d'action 'Changer l'ambiance' dans le premier périmètre.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : 13. Direction artistique réutilisable, décors et images — 17 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-197 — B — ALREADY_VERIFIED

- **UI-197** · **RETENU — CIBLE UX** — Ne pas utiliser les photos Google/My Business comme fond principal obligatoire de Bar : réserver de préférence la photo réelle à la tuile du lieu, à son aperçu ou à son détail.

**Précision R5 :** Photo fournisseur = illustration **du lieu**, jamais fond identitaire obligatoire de l'événement.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : Illustrations. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Clay existant, recadrage local des vignettes dock ; icônes fonctionnelles conservées ; photo fournisseur jamais identité.

**Preuves :** proofs/screenshots/final-preview-1920.png, proofs/screenshots/final-preview-1152.png

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-198 — A — PARTIAL

- **UI-198** · **RETENU — CIBLE UX** — Rendre les images de lieux, boissons et transports reconnaissables sur de petites tuiles ; remplacer les miniatures blanches ou quasiment invisibles.

**Précision R5 :** Tester la miniature réellement rendue à 30–40px, corriger cadrage 2:1 ou fallback : un fichier présent n'est pas preuve lisible.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : Illustrations. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Clay existant, recadrage local des vignettes dock ; icônes fonctionnelles conservées ; photo fournisseur jamais identité.

**Preuves :** proofs/screenshots/final-preview-1920.png, proofs/screenshots/final-preview-1152.png

**Reste :** Recadrage dock corrigé ; miniatures sur objets admis restent petites, visibles sur capture finale. Pas de PASS de lisibilité globale.

### UI-199 — A — IMPLEMENTED_VERIFIED

- **UI-199** · **À VALIDATION VISUELLE** — Préserver une différence nette entre décoration et objets réellement ajoutés à la soirée.

**Précision R5 :** Quatre états distincts : décor, proposition au dock, objet sélectionné sur carte, statut financier.

**Décisions R5 dominantes :** R5-D56…D68.

Owner : Illustrations. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Clay existant, recadrage local des vignettes dock ; icônes fonctionnelles conservées ; photo fournisseur jamais identité.

**Preuves :** proofs/screenshots/final-preview-1920.png, proofs/screenshots/final-preview-1152.png

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-200 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-200** · **RETENU — INTERPRÉTATION R5** — Réduire les espaces verticaux inutiles entre les cartes, la pagination du Board et le dock.

**Précision R5 :** Réduire la réserve passive Board/dock sans déplacer la carte à chaque réponse asynchrone.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

Owner : 14. Placement dans le Board, pagination et espace périphérique — 9 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-201 — A — IMPLEMENTED_VERIFIED

- **UI-201** · **RETENU — CIBLE UX** — Conserver une séparation claire entre la pagination du Board et le défilement horizontal des catalogues.

**Précision R5 :** Trois navigations distinctes : pagination Board, rail de proposition, pagination sémantique de groupes possédés.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

Owner : Dock et Board. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Pagination Board distincte du rail ; défaut de découpe parent130px/contenu136px reproduit puis corrigé au SHA produit ; réception finale distincte.

**Preuves :** proofs/preview2.json, proofs/screenshots/final-preview-1152.png

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-202 — A — IMPLEMENTED_VERIFIED

- **UI-202** · **RETENU — MODIFIÉ PAR R5** — Ne jamais présenter deux systèmes de navigation numérotée simultanément si l'un peut devenir un carrousel.

**Précision R5 :** Dock jamais paginé ; le détail de 20 postes peut l'être ; ne pas cloner une seconde pagination Board.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

Owner : Dock et Board. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Pagination Board distincte du rail ; défaut de découpe parent130px/contenu136px reproduit puis corrigé au SHA produit ; réception finale distincte.

**Preuves :** proofs/preview2.json, proofs/screenshots/final-preview-1152.png

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-203 — A — PARTIAL

- **UI-203** · **RETENU — CIBLE UX** — Garantir que les propositions de dock sont entièrement visibles, sans être coupées par le bas de la fenêtre.

**Précision R5 :** Vérifier bas d'écran à 1152×720 et zoom 125% ; pas de tuile inaccessible.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

Owner : Dock et Board. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Pagination Board distincte du rail ; défaut de découpe parent130px/contenu136px reproduit puis corrigé au SHA produit ; réception finale distincte.

**Preuves :** proofs/preview2.json, proofs/screenshots/final-preview-1152.png

**Reste :** Découpe parent130px corrigée ; à1152 le dock résumé nécessite le document de secours, zoom125 non vérifiable.

### UI-204 — A — PARTIAL

- **UI-204** · **RETENU — CIBLE UX** — Positionner le dock de manière stable pendant l'édition, avec une hauteur maîtrisée.

**Précision R5 :** Dock fait partie du viewport utile et se masque lorsqu'inutile à transition stable.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

Owner : Dock et Board. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Pagination Board distincte du rail ; défaut de découpe parent130px/contenu136px reproduit puis corrigé au SHA produit ; réception finale distincte.

**Preuves :** proofs/preview2.json, proofs/screenshots/final-preview-1152.png

**Reste :** Ancrage et réserve vide corrigés localement ; visibilité garantie sur tous états denses et125% non certifiée.

### UI-205 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-205** · **RETENU — CIBLE UX** — Décorréler la largeur visuelle de la carte et l’empreinte réservée dans le moteur de placement, pour que la place libérée serve réellement à d’autres cartes.

**Précision R5 :** Clarification R5 : la largeur rendue ET le `columnSpan` réservé doivent diminuer ensemble ; pas de dissociation durable des deux.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

Owner : 14. Placement dans le Board, pagination et espace périphérique — 9 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-206 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-206** · **RETENU — INTERPRÉTATION R5** — Ne pas laisser un grand trou vide dans le Board simplement parce qu’une carte compactée conserve un grand emplacement virtuel.

**Précision R5 :** Le packer récupère physiquement l'espace, sans densification agressive pendant saisie.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

Owner : 14. Placement dans le Board, pagination et espace périphérique — 9 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-207 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-207** · **SOUS CONTRAT MÉTIER/PROVIDER** — Rendre la transition compact ↔ détaillé stable, sans chevauchement, collision ou déplacement disproportionné des cartes voisines.

**Précision R5 :** Conserver ancre/carte active, gel pendant focus/drag et repack lors de transition explicite.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

Owner : 14. Placement dans le Board, pagination et espace périphérique — 9 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-208 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-208** · **RETENU — CIBLE UX** — Conserver des éléments de navigation de Board reconnaissables sans multiplier les libellés redondants autour de « Précédente / Page 2 sur 3 / 1 2 3 / Suivante ».

**Précision R5 :** Une seule pagination Board reconnaissable ; titre/label court, pas 5 variantes de précédent/suivant.

**Décisions R5 dominantes :** R5-D01…D12, D31…D35.

Owner : 14. Placement dans le Board, pagination et espace périphérique — 9 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-209 — B — PARTIAL

- **UI-209** · **RETENU — INTERPRÉTATION R5** — Utiliser des animations très courtes pour matérialiser le passage d'une scène à l'autre, sans ralentir les actions répétées.

**Précision R5 :** Transitions courtes et non bloquantes ; aucun délai supplémentaire entre deux ajouts rapides.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Aucun délai de décision ajouté ; reduced-motion implémenté, OS reduced-motion non exécuté.

### UI-210 — B — ALREADY_VERIFIED

- **UI-210** · **SOUS CONTRAT MÉTIER/PROVIDER** — Faire apparaître les résultats économiques immédiatement après une modification, et distinguer une éventuelle actualisation serveur encore en cours.

**Précision R5 :** Décision admise visible immédiatement, total agrégé seulement lorsqu'il est recalculé/frais ; ne pas confondre SAVED/FRESH/APPLIED.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-211 — B — PARTIAL

- **UI-211** · **RETENU — INTERPRÉTATION R5** — Conserver des zones cliquables confortables, même lorsque le texte visible est réduit.

**Précision R5 :** Ne pas gagner de compacité en réduisant les zones de clic à 16 px ; prioriser moins de mots.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Boutons accessibles et compteurs conservés ; audit complet des hitboxes de chaque scène non exécuté.

### UI-212 — B — PARTIAL

- **UI-212** · **RETENU — INTERPRÉTATION R5** — Utiliser des infobulles seulement pour les fonctions peu évidentes ; ne pas remplacer une interaction incompréhensible par davantage de texte caché.

**Précision R5 :** Tooltip n'est pas un substitut à affordance incohérente ; accessible au clavier si nécessaire.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Noms accessibles conservés ; revue exhaustive tooltips clavier non exécutée.

### UI-213 — B — PARTIAL

- **UI-213** · **RETENU — INTERPRÉTATION R5** — Ne pas montrer les termes techniques `Compiler/V2`, `projection FRESH`, `RAW` ou les sources de données dans l'interface courante.

**Précision R5 :** Cacher le jargon du premier niveau, mais garder états et traçabilité pour l'audit financier.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Notification Compiler/V2 retirée ; état Preview technique et détails financiers non supprimés ; audit complet jargon non certifié.

### UI-214 — B — ALREADY_VERIFIED

- **UI-214** · **SOUS CONTRAT MÉTIER/PROVIDER** — Conserver les informations de provenance et d'incertitude dans les détails accessibles, sans les supprimer du système ni encombrer les tuiles.

**Précision R5 :** Les sources et la provenance existent au niveau secondaire, pas dans la tuile compacte.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Contrats/provenance préservés par P1/P3/P4 et parité ; détails secondaires conservés.

### UI-215 — B — BLOCKED_ENV

- **UI-215** · **CRITÈRE DE RECETTE** — Vérifier systématiquement les transitions avec la souris et le clavier sur desktop, aux résolutions prévues et au zoom navigateur 125 %, sans scroll vertical dans les cartes.

**Précision R5 :** Validation **desktop souris + clavier**, 1152×720, 1440×900, 1920×1080, **zoom natif 125%**, reduced motion ; pas de campagne tactile.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Viewport desktop réellement mesuré ; zoom natif125% absent de l’API. NOT_VERIFIED_ZOOM, pas de DPR substitué.

### UI-216 — A — IMPLEMENTED_VERIFIED

- **UI-216** · **RETENU — CIBLE UX** — Supprimer les phrases qui expliquent des actions évidentes : « 3 lieu(x) correspondant(s) · choisissez une proposition dans le dock », « Choisir dans les lieux enregistrés » ou « Toutes les précisions restent facultatives » si la scène suffit.

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-217 — A — IMPLEMENTED_VERIFIED

- **UI-217** · **RETENU — CIBLE UX** — Transformer les titres redondants en intitulés contextuels courts ; ne pas afficher successivement « Chercher dans les lieux enregistrés », « Lieux enregistrés · Chercher un bar », « Autres possibilités » et « Historique et sources ».

**Précision R5 :** Aucune précision supplémentaire.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-218 — B — IMPLEMENTED_VERIFIED

- **UI-218** · **SOUS CONTRAT MÉTIER/PROVIDER** — Ne pas afficher de termes internes comme « Brouillon simulé par le Compiler/V2 » dans le parcours normal.

**Précision R5 :** Diagnostic Compiler/V2 réservé à l'outil technique, jamais collé à la carte.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Preuve bornée au niveau indiqué ; aucune certification Auth Draft ou fournisseur réel implicite.

### UI-219 — C — OUT_OF_SCOPE_NEXT_STAGE

- **UI-219** · **SOUS CONTRAT MÉTIER/PROVIDER** — Raccourcir les statuts financiers des petites cartes, sans réduire la distinction entre un prix de référence, un choix validé, une inconnue et un coût réel.

**Précision R5 :** Ne pas faire passer `Référence 32€` pour `32€ retenus`; qualifier historique/UNKNOWN/usage.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : 15. Microtextes, états de retour et vérification desktop — 14 recommandations. Niveau : NONE. Produit : NON_MODIFIE_C.

Réservé hors périmètre.

**Preuves :** Non exécuté :C réservé.

**Reste :** Réservé : aucun développement de dimensions, packing, décor ou auto-scroll dans ce lot.

### UI-220 — B — PARTIAL

- **UI-220** · **SOUS CONTRAT MÉTIER/PROVIDER** — Protéger l’accessibilité clavier, le focus et la lisibilité malgré la suppression de textes explicatifs.

**Précision R5 :** Tab/Espace/Entrée/Échap et focus restauré ; noms accessibles même si icône sans texte.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Noms accessibles, Enter et focus RAW testés ; toutes séquences Tab/Shift+Tab/Espace/Échap non exécutées.

### UI-221 — B — PARTIAL

- **UI-221** · **CRITÈRE DE RECETTE** — Limiter la validation navigateur au desktop réellement utilisé : souris, clavier, largeurs prévues et zoom natif, sans campagne tactile hors périmètre.

**Précision R5 :** **Périmètre explicitement desktop** ; tests tactiles/mobile non exigés pour cette phase.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Campagne strictement desktop ; zoom natif non vérifié.

### UI-222 — B — PARTIAL

- **UI-222** · **CRITÈRE DE RECETTE** — Vérifier dans des états vides et riches qu’aucun dock, résultat Google, calendrier ou tuile de sélection n’est coupé par le bas de la fenêtre.

**Précision R5 :** Scènes représentatives vides/partielles/riches, avec dock et Google chargés/échoués, aucune commande coupée.

**Décisions R5 dominantes :** R5-D55, D64…D76.

Owner : Microtextes / accessibilité. Niveau : SOURCE_REVIEW_AND_REACT_FIXTURE. Produit : cc9d2595dd95a69051d88d54beeb408ab308263d.

Titres contextuels et détails accessibles ; jargon normal supprimé ; reduced-motion prévu ; pas de preuve de zoom natif.

**Preuves :** proofs/preview2.json, proofs/react-interactions.json

**Reste :** Petits états et calendrier mesurés ; document de secours nécessaire1152, photo réelle et états extrêmes non certifiés.
