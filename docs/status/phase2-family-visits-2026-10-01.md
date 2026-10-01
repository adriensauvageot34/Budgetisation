# Visites famille — Fontès / Servian — 1 octobre 2026

## État de livraison

```ini
HEAD_BEFORE = a5e1b776f8969bec485d05cbcfdc1d88c1032607
HEAD_AFTER = commit contenant ce rapport (git log -1 --format=%H -- docs/status/phase2-family-visits-2026-10-01.md)
FILES_CHANGED = 21 (liste ci-dessous)
MIGRATIONS = NONE
FAMILY_VISIT_FLOW = PASS
CONTACT_RANKING = PASS
MARC_FONTES = PASS (parcours, lieu, routes, carburant) / péage aller indisponible
ISABELLE_SERVIAN = PASS
OUTBOUND_RETURN_MODEL = PASS
RETURN_REQUIRED = PASS
CAR_PRIORITY = PASS (choix explicite ; Habituel seulement avec preuve)
DRIVER_QUESTION_REMOVED = PASS
TOMTOM_OUTBOUND = PASS LIVE (Servian et Fontès)
TOMTOM_RETURN = PASS LIVE (Servian et Fontès)
FUEL_TOTAL = PASS (somme des coûts arrondis par sens)
HERE_TOLL_OUTBOUND = PASS Servian / UNAVAILABLE Fontès
HERE_TOLL_RETURN = PASS Servian / PASS Fontès
ROOT_DESTINATION_PRESERVED = PASS
ZERO_HISTORICAL_WRITE = PASS
UNIT_TESTS = PASS
SMOKE_SERVIAN = PASS
SMOKE_FONTES = PARTIAL (HERE aller indisponible ; fallback explicite vérifié)
TYPECHECK = PASS
BUILD = PASS (Next.js 16.2.6, compilation et pages générées)
LINT = NOT_CONFIGURED
```

## Parcours et contrat

Voir quelqu’un → Famille commence par Adrien / Manon / Nous deux, sans sélection initiale. Les deux premières suggestions sont calculées par `rankFamilyVisitContacts` : relation parent, fréquence des jours observés au lieu, récence, lieu lié exploitable. Aucun branchement sur le nom. Les jours observés prouvent la fréquentation d’un lieu, pas la présence du contact : le libellé est **Lieu habituel**, avec cette limite dans l’infobulle.

Les clés prospectives existantes `manon_father` et `manon_mother` portent les noms Marc et Isabelle demandés dans le brief. Elles utilisent les références déjà présentes : `9c6b6a7a-3301-5a8c-ad5c-64446f6cbb12` (Fontès) et `45b9c4a9-4da2-5768-9aa0-4f8d32549fbb` (Servian). Aucun nouveau Person, Place ou contact persisté. Le domicile est résolu depuis le rôle existant OWN_HOME. Les suggestions génériques restent compatibles avec les autres membres de la famille et la saisie prospective libre.

Audit en lecture : 35 jours au lieu de Servian, 21 au lieu de Fontès sur les douze derniers mois ; dernière visite observée le 25 juillet 2026. Trois dates de trajets dirigés domicile → Servian justifient Voiture · Habituel ; Fontès n’en a que deux et affiche Voiture sans cette affirmation. Un clic utilisateur reste nécessaire.

`context.visitTiming` contient les deux moments, avec retour obligatoire. Les dates sont contrôlées, les heures facultatives, et les horaires legacy contradictoires rejetés. Le nouveau chemin n’utilise pas roundTrip comme authority. Les anciennes dépenses sans visitTiming gardent leur chemin de lecture. Le report déplace les deux dates en conservant la durée du séjour et recalcule les faits.

Le service Transport Live V2 est réutilisé pour chaque direction. Chaque date sans heure produit trois échantillons TomTom 08/14/18 ; HERE importe chaque géométrie séparément. Une référence SP95 actuelle commune sert au calcul prospectif, sans prétendre connaître le prix futur. Le total essence est la somme des deux coûts arrondis, et non un aller multiplié par deux. Fuel reste ECONOMIC_ONLY, sans allocation Bank ; les péages restent payables. Les variantes comparent les deux sens et requièrent un choix explicite.

Le ROOT_PLACE est conservé entre domicile et retour. Un arrêt child ajouté à une visite est inséré avant la destination familiale à l’aller ; les arrêts de retour restent portés par la même route root. Les changements de timing invalident les faits dérivés, l’aperçu et les coûts automatiques ; Undo restaure le brouillon. Les variantes locales passent d’un écran du Builder à l’autre, et une estimation incompatible ne peut plus proposer une ancienne variante.

## Résultats providers réels

Lecture live du 1 octobre, départ 17 octobre / retour 18 octobre 2026, heures inconnues :

| Cas | Aller km / litres | Retour km / litres | Essence totale | Péage aller / retour |
| --- | --- | --- | --- | --- |
| Isabelle / Servian | 74,111 / 5,579151 | 64,952 / 5,183771 | 24,43 € | 4,90 € / 3,90 € |
| Marc / Fontès | 62,962 / 5,190873 | 64,341 / 5,253307 | 23,71 € | indisponible / 0,00 € |

Les deux directions sont réellement différentes. Le navigateur a confirmé Servian jusqu’à l’aperçu (essence 24,44 €, péages 8,80 €, paiement Bank 8,80 € lors de cette estimation fraîche). Fontès a confirmé le parcours, les deux directions, l’essence et **Péage non disponible** avec saisie manuelle ; aucune valeur automatique de 0 € n’est inventée. Les valeurs live peuvent évoluer lors d’un recalcul : ce tableau conserve les faits du smoke script, pas des tarifs figés.

HERE a refusé l’import aller Fontès (`INVALID_RESPONSE`). Une variante Servian sans péage a également conservé un péage inconnu lorsqu’un import HERE échouait. Le montant global reste incomplet et le Preview est bloqué tant que le péage n’est pas renseigné ou explicitement confirmé sans péage. Le test négatif a confirmé ce refus ; cette dépendance live interdit d’annoncer le smoke Fontès entièrement PASS.

Les six requêtes TomTom simultanées ont initialement rencontré HTTP 429 et des timeouts. Les départs de requêtes sont maintenant espacés de 350 ms par processus, avec cache/déduplication existants, timeout de 8 s et une seule relance bornée (timeout ou HTTP 429/502/503/504). Les tests providers ont été rejoués après ce changement. La limitation n’est pas globale entre plusieurs instances Vercel.

## Vérifications exécutées

Commandes avec le runtime Node déjà installé :

```text
node scripts/check-phase2-family-visits.mjs
node scripts/check-phase2-planned-car.mjs
node scripts/check-phase2-planned-routes.mjs
node scripts/check-phase2-planned-builder.mjs
node scripts/check-phase2-planned-server-contract.mjs
node scripts/check-phase2-planned-finance.mjs
node scripts/check-phase2-planned-reliability.mjs
node scripts/smoke-family-visits-live.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/next/dist/bin/next build
git diff --check
```

Le nouveau test couvre participants explicites, ranking indépendant des noms, lieu dérivé, retour manquant/antérieur, heures distinctes le même jour, six samples aux heures inconnues, deux calls dirigés par variante, deux imports HERE, arrondi par jambe (7,85 + 10,39 = 18,24 et non 18,25), péage/funding, absence de doublage du véhicule, child avant ROOT, invalidation/Undo, Preview/Save/reload, report, refus cross-household, snapshots incohérents/récursifs et lecture legacy.

Les cinq autres smokes du brief (Servian, Fontès, même jour, heures inconnues, retour invalide) et le child stop sont couverts : les cas providers Servian/Fontès sont live, et les variations temporelles/child sont exercées par les vrais adapters avec réponses providers déterministes. Le navigateur local authentifié a confirmé le parcours Servian et Fontès. Aucun Save distant de fixture n’a été effectué.

Preview/Save/reload emploie le vrai serveur, avec lectures/options/providers live pour Servian, et une frontière d’écriture prospective en mémoire. La suite déterministe vérifie la parité complète et un seul root. Ce n’est pas une certification d’un nouvel INSERT live Supabase ; le contrat JSON existant est extensible et aucun changement de schéma n’est nécessaire. RLS inchangé.

### Zéro écriture historique

Le smoke live compare nombre de lignes et empreinte SHA-256 de toutes les lignes avant/après :

| Authority | Lignes avant = après |
| --- | ---: |
| mobility_legs | 684 |
| mobility_trips | 296 |
| operations | 1660 |
| purchase_events | 200 |
| product_observations | 18 |
| fuel_price_observations | 12 |
| referentiel_lieu | 180 |

Empreintes identiques pour les sept tables ; 0 écriture distante par le script. Les probes serveur n’écrivent que `phase2_planned_expenses` dans la frontière mémoire. L’aperçu navigateur indique qu’il n’enregistre rien. Aucune préférence silencieuse, table de mémoire ou authority historique ajoutée.

Les preuves détaillées live et la capture navigateur restent dans le dossier local `outputs` extérieur au dépôt ; aucun secret ou snapshot privé intégral n’est ajouté à la production. Scan des 1 088 fichiers suivis/nouveaux et du bundle `.next/static` contre les trois secrets locaux concernés : 0 occurrence. `git diff --check` : PASS.

## Fichiers

- Domaine : `planned-visits.ts` (nouveau), `planned-contract.ts`, `planned-rules.ts`, `planned-places.ts`, `planned-builder.ts`, `planned-car.ts`, `planned-mutations.ts`.
- Serveur : `planned-context.ts`, `planned-car-estimation.ts`, `planned-car-providers.ts`, `planned-expenses.ts`.
- UI : `planned-family-visit-fields.tsx` (nouveau), `planned-intent-builder.tsx`, `planned-route-editor.tsx`, `planned-car-summary.tsx`, `planned-expenses-control.tsx`, `planned-expenses-actions.ts`, `month-calendar.tsx`.
- Preuves : `check-phase2-family-visits.mjs`, `smoke-family-visits-live.mjs`, ce rapport.

## Limites et suites

```ini
KNOWN_LIMITATIONS = HERE aller Fontès indisponible ; variantes avec frais inconnus explicites ; lint non configuré ; aucun Save distant de fixture ; limitation TomTom par processus
FOLLOW_UPS = investiguer l’import HERE Fontès si le service continue de le refuser ; essai utilisateur de l’enregistrement en production
```

Le fallback manuel demandé est disponible. Aucun montant de frais ni préférence permanente n’est appris silencieusement. Les anciens projets restent lisibles, sans réécriture en masse ni refonte du moteur financier.
