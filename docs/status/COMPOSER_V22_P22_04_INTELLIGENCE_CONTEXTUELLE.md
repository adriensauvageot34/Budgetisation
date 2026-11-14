# Composer V22 · P22-04 · Intelligence contextuelle

14 novembre 2026 · `STRAT:P21-RECENTRAGE@v1` · Ordinateur uniquement.

## A — Base et sources

- Branche locale `codex/p22-04-contextual-suggestions`, issue de `467944e398d19ceeb0645ee76e23a2ed6993c289` (P22-03). Le correctif P22-01 est présent via P22-02 (`b651e52`, rapport `0f7e24e)). P22-03 conserve l'accès direct aux champs et le retour vers la bonne occurrence.
- GitHub `main` et Vercel Production vérifiés à `47f73aaffc70f8e5101defef546e138e52e24617`, déploiement `dpl_58FP9Hn8yECmhcxiFBiosSDwgMg4` READY. GitHub retourne zéro fichier de différence entre le contenu final de la PR #123 et celui de son merge dans `main`.
- Le travail Cadeau non commité est resté dans le workspace d'origine ; SHA-256 des deux fichiers inchangés. Le rapport local P22-01 hors index est également préservé.
- Composer utilise l'index public `clay-v22-collection@2` (687 entrées), lu par la découverte : identifiants visuels, famille, nature, contextes et liens publiés. Les alias des presets et les références portées par les sélections précisent les résultats. Une entrée n'accorde aucune permission d'écriture. Le classeur original privé a été localisé, sans importer ni copier ses données.

| Mécanisme | Source et contexte | Cible, action et condition | Classement, refus et adoption |
| --- | --- | --- | --- |
| S1 · éditeurs métier | Preset, champs et sockets publiés | Préparer billet, hébergement, produit ou complément dans le bon éditeur. Carte éditable et capability du poste. | Essentiel avant facultatif ; consulter ne change rien. Le formulaire demande une validation explicite. |
| S2 · adaptateurs métier | Sélections, quantités, prix connus ou inconnus, dates, lieu, vendeur, types de postes, protection | Modifier l'ID de sélection admis ou choisir entre plusieurs IDs. Le trajet dépend de Mobility ; la livraison dépend du panier et de son socket. | Propositions ordonnées par priorité métier, au plus quatre dans le Dock. Masquage local par occurrence, réversible, jusqu'au rechargement. |
| S3 · projets | Type du parent, enfants effectivement rattachés, postes couverts, préférence de session | Rattacher une seule nouvelle intention si le socket et le `DROP` publié l'autorisent. | Complément lié au projet puis préférence de session. Masquer ou désactiver ne change pas le Draft. Le rattachement exige une confirmation et revérifie le digest et les droits. |
| Catalogue | Index Clay public et correspondances de presets | Consulter / préparer / modifier pour la cible active quand la commande est publiée. | Classement par cible et usage, recherche explicite possible après masquage ; une recherche n'adopte aucun poste. |

## B — Pertinence des parcours pilotes

| Contexte | Avant (P22-03) | Après (P22-04) |
| --- | --- | --- |
| Cinéma | Billet, jour, lieu, popcorn. Le sous-menu Jour proposait « Préciser le lieu » même après sa saisie. | Conserve ces quatre suggestions au départ. Le lieu renseigné n'est plus présenté comme manquant depuis le jour. Taxi reste facultatif et soumis à Mobility. |
| Cinéma avec billet | Modification du billet, jour, lieu, popcorn. Un nouveau taxi pouvait remonter devant les compléments dès qu'un lieu était connu. | Édition du billet existant conservée. Un complément déjà choisi passe avant une nouvelle proposition ; le trajet déjà choisi reste éditable via son ID. |
| Cinéma + Restaurant | Le projet composé reconnaissait déjà son Restaurant lié. | Cette suppression de doublon est conservée. En cas de nouveau rattachement confirmé depuis S3, le focus suit l'enfant ajouté. |
| Mascara | « Préciser le produit », puis édition directe du prix et de la quantité. | Parcours conservé. Ni trajet, ni tarif historique imposé, ni duplication du produit. |
| Amazon avec articles | Livraison, nouvel article, choix entre lignes homonymes, modification du vendeur déjà déclaré. | Livraison à préciser, choix des lignes existantes, ajout explicite. Un prix inconnu passe devant l'ajout ; une seule ligne modifiable ouvre directement son prix. Le vendeur déclaré reste modifiable dans les réglages de l'achat. |
| Week-end | « Préciser le départ », puis « Préciser le retour » si seul le retour manque. Un hébergement déjà chiffré passait devant la durée manquante. | « Préciser la période », avec une raison adaptée aux informations manquantes et accès à l'éditeur direct. La durée d'un tarif par nuit passe avant la modification d'un hébergement déjà chiffré. |
| Week-end + Musée | Randonnée et Restaurant admissibles ; pas de deuxième Musée. | Compléments conservés. Après confirmation d'un Restaurant, l'enfant exact reçoit le focus et la suggestion disparaît, sans changer le Musée. |

## C — Les quinze briques dans les parcours pilotes

**E** : essentielle dans ce parcours ; **F** : facultative selon le contexte ou via l'éditeur existant ; **—** : hors sujet dans ce parcours ; **D** : capacité absente ou différée. Les catégories se rapportent à ces parcours, pas à l'intégralité de Composer.

| Brique | Cinéma + Restaurant | Mascara + Amazon | Week-end + Musée |
| --- | --- | --- | --- |
| Calendrier | F · séance | F · date d'achat | E · période / durée |
| Rythmes et renouvellements | — | F · renouvellement beauté par son propriétaire, hors Dock Amazon | — |
| Lieux | E · lieu de séance et repas distinct | — | F · destination, préalable à certains trajets |
| Enseignes et prestataires | F · lieu / restaurant | F · vendeur seulement s'il reste à préciser | F · descriptif d'hébergement |
| Personnes | F · participants | — | F · participants |
| Équipements | — | — pour ce panier | — pour ce projet |
| Trajets | F · Mobility uniquement | — | F · Mobility uniquement |
| Achats et livraison | — pour le cinéma | E · lignes et frais de livraison séparés | F · panier possible selon le type de séjour et le propriétaire |
| Réservations | D · aucun acte fournisseur | — | D · aucun acte fournisseur |
| Besoins et réapprovisionnement | — | F · produit beauté existant | — |
| Prix et dépenses | E · billet et repas, extras distincts | E · prix / quantité de la ligne, UNKNOWN conservé | E · forfait ou prix/nuit, suppléments distincts |
| Budget et financement | F · lecture des résultats officiels et financement existant selon le poste | F · lecture officielle | F · lecture officielle |
| Épargne et flux | — | — | — |
| Moments et composition | E · projet et enfants distincts | F · regroupement en panier, pas de projet imposé | E · séjour, Musée et activités rattachées |
| Décisions | E · confirmation | E · validation par ligne | E · confirmation et choix de la cible |

## D — Portée du code

- `cinema-suggestions.ts`, `restaurant-editor.tsx` : classement des compléments et du trajet, détection du lieu déjà renseigné, distinction entre Dock et recherche explicite dans Clay. Le mapping de l'illustration ne remplace pas l'ID de sélection.
- `purchase-suggestions.ts`, `purchase-basket-editor.tsx` : classement et sélection par identifiants déjà publiés, réglage du vendeur hors suggestions quand il est renseigné, focus dans le prix. Les noms homonymes servent à ouvrir un choix, jamais à fusionner deux lignes.
- `short-stay-suggestions.ts`, `short-stay-editor.tsx` : priorité de préparation de la durée et de la période ; une proposition de période stable qui ouvre le champ manquant ; sélection des suppléments modifiables uniquement. Le forfait n'est pas modifié lorsqu'on examine un complément.
- `project-completion.tsx`, `composer-shell.tsx`, `linked-intentions.tsx` : recalcul S3 limité aux entrées pertinentes et maintien du focus après l'admission effective d'un nouveau lien, vérifiée sur le parent, le socket et l'ID de l'enfant. Aucun nouveau mécanisme de rattachement.
- Assertions ciblées ajoutées aux bancs `check-composer-purchase-basket.mjs`, `check-composer-v22-a06-stay.mjs` et `check-restaurant-suggestions.mjs`. Les règles Compiler / Finance V2, writers, mobilité, RAW, Save et Undo/Redo restent les contrats existants. Aucun changement de SNAP-3, de World ou de gate.

## E — Recette

| Contrôle | Résultat |
| --- | --- |
| TypeScript et format du diff | PASS : `tsc --noEmit --incremental false` et `git diff --check`. |
| Référence avant changement, Chromium/C8 à 1280 × 720 | 3/3 parcours PASS. Les suggestions du Dock et les compléments S3 ont été relevés sur P22-03. |
| Desktop après changement, Chromium/C8 | 9/9 parcours PASS à 1920 × 1080, 1440 × 900 et 1280 × 720. |
| Cinéma, contre-épreuve sur le bundle final à 1280 × 720 | PASS : lieu déjà renseigné retiré des suggestions de la séance ; le popcorn exige « Supplément réel », puis « Conserver ce poste ». Après sauvegarde, une seule ligne demeure et le Dock propose de la modifier. Trace : `cinema-confirm/results.json`. |
| Zoom natif Chrome 125 % | 3/3 parcours PASS en fenêtre 1280 × 720 ; viewport mesuré 1024 × 576, DPR 1,25. Aucun débordement horizontal, Dock séparé des panneaux sur les captures contrôlées. Le scroll vertical de l'éditeur reste disponible. |
| Panier, Séjour et Mascara | PASS : panier (5 groupes), séjour A06 (12), Mascara A1 (16). Édition d'un homonyme, droits, prix inconnu distinct de zéro, aucune référence historique auto-adoptée, forfait/supplément, refus des opérations fournisseur non publiées. |
| Restaurant/Cinéma, S3 et catalogue | PASS : Restaurant et Cinéma (11), détail compris (5), S3 (12), découverte (687 identités recherchables, dont les 529 concepts). Recette S3 : le Restaurant ajouté est le seul enfant de ce type et reçoit le focus ; le Musée est inchangé. |
| Persistance locale et RAW | PASS : le panier conserve l'identité des lignes au rechargement. La saisie « 9, » reste visible après refus, sans changement du digest ; Undo/Redo restitue les digests attendus. Les passages parent/enfant n'écrivent pas. |

Le survol et le choix au clavier dans le panier, le masquage et le réaffichage au Cinéma et la consultation/confirmation encore ouverte en S3 ont laissé inchangés le digest et le reçu C8. Aucun POST supplémentaire vers `/interaction` ou `/draft` sur ces gestes. Aucun Plan, aucune révision et aucune écriture distante dans les parcours navigateur. Les propositions lisent le modèle et le contexte déjà disponibles ; le panier, le séjour et S3 réutilisent leurs résultats tant que ces entrées ne changent pas. Le chargement normal d'un seul éditeur actif est inchangé dans le code. Aucun nouveau benchmark SNAP-3 ou profil de découpage de bundle n'a été lancé.

La recette authentifiée distante, la persistance en Production et la Preview financière authentifiée sont **NOT_RUN**. Les Save/Reload mesurés utilisent le banc C8 isolé. Les traces et captures synthétiques sont conservées localement dans `repo/outputs/p22-04` (référence : `before/results.json` ; bureau : `desktop/results.json` ; zoom : `native-125/results.json`).

## F — Ce que l'utilisateur voit

Composer savait déjà suggérer quoi préparer et retrouver plusieurs postes déjà choisis. Il privilégie maintenant le travail qui reste sur des objets existants : le prix à compléter dans un panier, la durée d'un séjour ou le prix d'un complément de cinéma déjà choisi. Les réglages facultatifs restent accessibles, tandis que le vendeur connu et le lieu déjà saisi cessent d'encombrer les suggestions concernées. Le focus aide à reprendre l'enfant qui vient d'être rattaché. Aucune décision de dépense, réservation ni préférence personnelle n'est déduite du classeur ou d'un comportement historique.

## G — Suites proposées

1. Valider les parcours Chrome sur une Preview authentifiée autorisée avant publication.
2. Exposer, avec son propriétaire actuel, une référence de prix lorsqu'elle est réellement disponible, clairement présentée comme une information à consulter.
3. Étudier une préférence personnelle explicite et désactivable si un besoin utilisateur est démontré.
