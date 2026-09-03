# Analyse Globale V2 — audit préparatoire de compatibilité avec Media, Résumé contextuel, Benefit Wallet, Diagnostic et Import

> **Nature du document** : audit préparatoire en lecture seule.
>
> **Aucune implémentation Media. Aucun workflow IA. Aucune intégration Swile/Edenred. Aucun moteur Diagnostic. Aucun Refresh Planner. Aucune migration. Aucune écriture Supabase.**
>
> **Seul ce document d’audit est ajouté au repository.**
>
> **Baseline repository distante observée** : branche `main`, commit `fb20ddad1412ec9f21f8c183987774b0e5a21ce1` (`docs(global-v2): audit readmodel ux contract`).
>
> **État History pris en compte** : HC1 communiqué `PASS`; HC2 → HC6 non fermés. Les conclusions dépendant de M3, causalité Moment/Activity, Place, dependency closure, manifest, immutabilité, correction/republication et cache restent à revalider à `GA0` après `POST_HISTORY_ENTRY_GATE = PASS`.
>
> **Autorités de conception consultées** : Master Analyse Globale V2, plan conceptuel A→I, audits préparatoires Global 01→05, rapport consolidé History 20→24, brief Résumé contextuel, brief Benefit Wallet / Swile pilote compatible Edenred, brief Diagnostic & Qualité, brief provisoire Console Import & Actualisation, ainsi que le code courant pertinent (Media UI primitives, History importedSummary, Diagnostic technique courant).

---

# 0. Verdict exécutif

La future Analyse Globale V2 est **compatible par architecture** avec les cinq chantiers transversaux étudiés, à condition de préserver maintenant quelques frontières non négociables.

Le constat le plus important est qu’aucun de ces chantiers ne doit devenir une dépendance de vérité de Global :

```text
Global deterministic truth
= Canonical
→ Facts
→ Analytics
→ certified artifacts
→ Global publication
→ Global ReadModels
```

Puis seulement, en aval ou à côté :

```text
Media                 = contenu / présentation
Résumé contextuel     = narration importée, non autoritaire
Benefit Wallet        = financement + capacité, sans redéfinir la consommation
Diagnostic            = observateur indépendant, read-only
Import / Refresh      = orchestrateur des dépendances, jamais moteur métier
```

La compatibilité n’exige donc pas d’implémenter ces modules pendant Global A→H. Elle exige de **ne pas fermer les contrats dont ils auront besoin plus tard**.

## 0.1 Classification préparatoire

| Chantier futur | Classification principale | Conclusion |
|---|---|---|
| A. Gestion des médias | `NEEDS_EXTENSION` | Les primitives UI `MediaRef`/resolver existent déjà, mais pas le vrai modèle `MediaAsset`/`MediaAssignment` ni la publication `CONTENT_SCOPED`. Global peut être conçu sans dépendre des médias. |
| B. Résumé contextuel | `READY_BY_DESIGN` | Le modèle publication/factsHash/revision + module ReadModels est adapté au futur corpus déterministe. Le workflow Global Summary doit rester Phase I / aval et non autoritaire. |
| C. Benefit Wallet / Swile / Edenred | `DESIGN_RISK` | Compatible si M8 et Finance conservent strictement `purchase ≠ funding ≠ bank transaction`. Un mauvais contrat maintenant obligerait à réécrire M1/M2/M8 plus tard. |
| D. Diagnostic | `NEEDS_EXTENSION` | Le runtime expose déjà des métadonnées utiles, mais le Diagnostic courant n’est pas encore le moteur machine-first indépendant du brief. Global doit rendre ses preuves observables. |
| E. Import & Actualisation / Refresh Planner | `DESIGN_RISK` | L’architecture de publication est compatible, mais Global doit déclarer ses vraies dépendances et unités d’invalidation ; sinon le futur Refresh Planner serait forcé de recalculer tout Global ou de deviner. |

Aucun `BLOCKING_CONFLICT` structurel n’a été identifié à ce stade.

Cependant, plusieurs risques deviennent bloquants **si les futurs prompts Global les violent** :

```text
- achat assimilé à une transaction bancaire ;
- financement wallet inclus dans Actual ;
- Media utilisé comme signal analytique ;
- résumé IA utilisé pour générer un KPI ;
- Diagnostic utilisé comme source de vérité ;
- React utilisé comme moteur de dépendances ;
- outputs Global sans dependency metadata ;
- publication Global sans lineage stable ;
- module ReadModel qui masque support / coverage / provenance ;
- giant payload qui empêche une invalidation ciblée ;
- scope Global universel qui rend le Refresh Planner incapable de connaître le vrai lookback de chaque moteur.
```

## 0.2 Ordre de chantier recommandé à préserver

Le plan conceptuel Global maintient A→H comme noyau déterministe, puis Phase I Résumé contextuel. Pour la trajectoire produit complète déjà retenue autour du Benefit Wallet, la séquence la plus sûre est :

```text
History Core final
→ GA0 rebase
→ Global A→H déterministe
→ certification Global déterministe
→ audit Benefit Wallet post-Global
→ Swile pilote sur modèle provider-agnostic
→ Edenred comme second adapter
→ rebuild / recertification History + Global si les données changent la vérité économique
→ Phase I Résumé contextuel Global
→ Gestion des médias complète
→ Diagnostic final transverse
→ Import & Actualisation / Refresh Planner final
```

Raison : un résumé narratif Global ne devrait idéalement pas être généré sur une vérité que l’on sait déjà devoir enrichir immédiatement avec les achats Benefit Wallet. Ce séquencement ne change pas la doctrine du Master : **le Résumé reste après les 10 modules déterministes et leur publication autoritaire**.

La Gestion des médias peut avoir un **checkpoint de contrat** avant Phase H pour éviter de fermer les slots nécessaires, tout en repoussant son implémentation complète.

---

# 1. Sources et méthode

## 1.1 Sources Global déjà consolidées

Audits préparatoires disponibles :

- `01-global-master-capability-map.md` ;
- `02-history-global-boundary-audit.md` ;
- `03-global-authority-dependency-preaudit.md` ;
- `04-global-runtime-publication-query-audit.md` ;
- `05-global-readmodel-ux-contract-audit.md`.

Ils ont déjà établi :

```text
Canonical / Facts / Analytics communs
→ Analytics Global spécialisés
→ artifacts
→ Global publication cohérente
→ Primary ReadModels compacts
→ Detail ReadModels lazy
→ Query API
→ React présentationnel
```

Ils ont également posé :

- pas de période Global universelle ;
- support / coverage / provenance par moteur ;
- publication Global cohérente par Household × as-of ;
- pas de read-through analytique à la navigation ;
- pas de calcul métier dans React ;
- pas de réutilisation des ReadModels History comme moteur Global ;
- dependency matrix physique à finaliser uniquement après HC6/GA0.

## 1.2 Sources History

Le rapport consolidé History 20→24 classe déjà :

- Analyse Globale : `READY_AFTER_MINOR_HISTORY_WORK` ;
- Benefit Wallet : `REQUIRES_HISTORY_EXTENSION` ;
- Media : `REQUIRES_HISTORY_EXTENSION` ;
- Résumé contextuel : `READY_AFTER_MINOR_HISTORY_WORK` ;
- Import final : `BLOCKED` tant que le graphe produit final n’est pas stabilisé.

Ce rapport rappelle également que :

```text
binary privé
→ MediaAsset canonical/content object
→ assignment validé
→ publication refs/meta
→ React résout le média
```

et que Media doit rester `CONTENT_SCOPED / PRESENTATION_SCOPED`.

## 1.3 Sources Résumé contextuel

Le brief complet fixe :

```text
Budgétisation calcule et certifie la vérité
→ prépare un corpus déterministe
→ export JSON
→ ChatGPT manuel
→ response JSON + HTML sécurisé
→ import strict
→ résumé persisté
```

Le résumé importé :

- ne modifie aucun KPI ;
- ne devient jamais une entrée Analytics ;
- porte une identité de source ;
- doit devenir `STALE` si la publication/factsHash pertinente change ;
- doit préserver ancien texte + nouvelle fraîcheur ;
- n’utilise aucune API IA ;
- n’exporte ni transactions brutes ni GPS brut.

## 1.4 Sources Benefit Wallet

Le brief Swile pilote fixe comme doctrine générique :

```text
1 achat humain = 1 PurchaseEvent

consommation économique
≠ financement
≠ flux bancaire
≠ capacité wallet
```

Swile est le premier provider, pas le modèle métier.

Le modèle doit permettre Edenred par un nouvel adapter, sans second moteur économique.

## 1.5 Sources Diagnostic

Le brief cible impose un moteur :

```text
READ ONLY
machine-first
checks atomiques
validation indépendante
preuves bornées
methodVersion
scopes GLOBAL / MONTH / DAY / IMPORT / ENTITY / PUBLICATION
```

Le Diagnostic ne recalcule pas la vérité et ne la répare pas.

## 1.6 Sources Import & Actualisation

Le brief Import reste explicitement provisoire sur le mapping physique, mais verrouille :

```text
Import
→ dataRevision N+1
→ Actualiser l'application
→ Refresh Planner
→ Facts / Analytics / ReadModels / snapshots
→ staging
→ RuntimeSchemas
→ certification
→ Diagnostic
→ atomic switch
→ navigation pré-calculée
```

et les classes conceptuelles :

```text
LOCAL_MONTH
HISTORICAL_LOOKBACK
GLOBAL_HISTORY
ENTITY_SCOPED
```

Le pré-audit Global 03 a ajouté `CONTENT_SCOPED` comme classe conceptuelle future utile pour Media/summary, sans prétendre figer le planner physique.

---

# 2. Principe transverse : Global doit rester autonome de ses extensions

## 2.1 Dépendance autorisée

Un chantier futur peut **consommer** Global :

```text
Global publication
→ Résumé contextuel

Global entity refs
→ Media assignments

Global dependency metadata
→ Refresh Planner

Global artifacts / publications
→ Diagnostic checks
```

ou enrichir les Facts communs :

```text
Benefit Wallet import
→ PurchaseEvent / Funding / wallet facts
→ Analytics officiels
→ nouvelle publication History / Global
```

## 2.2 Dépendance interdite

Global ne doit jamais exiger :

```text
une image pour calculer un lieu important
un texte ChatGPT pour choisir un insight
un solde Swile pour déterminer Actual
un résultat Diagnostic pour produire M1
la présence d’une UI Import pour savoir quoi recalculer
un classement React pour écrire un ReadModel
```

## 2.3 Test conceptuel de découplage

Pour toute future Phase Global, poser la question :

> Si je désactive entièrement Media, Résumé contextuel, Swile/Edenred, Diagnostic et la Console Import, les dix modules déterministes peuvent-ils encore être calculés, certifiés et publiés à partir de Canonical/Facts/Analytics ?

Réponse requise : **OUI**, sous réserve des capabilities `AUTHORITY_GATED` propres à Global.

---

# 3. A — Gestion des médias

## 3.1 État cible

Le futur système Media doit distinguer :

```text
binary privé
↓
MediaAsset
↓
MediaAssignment
↓
entity / slot / role
↓
publication contient référence + méta
↓
resolver serveur/client autorisé
↓
MediaSurface / fallback
```

Le média est un contenu associé à une entité ; il n’est pas une observation économique ou comportementale.

## 3.2 État actuel observé

Le code possède déjà une couche UI media intéressante :

- `MediaRef` ;
- source `bundled_asset` ;
- source `supabase_storage` ;
- rôle `photo | logo | illustration` ;
- alt descriptif/décoratif ;
- dimensions/aspect ratio ;
- focal point ;
- attribution ;
- resolver Storage ;
- fallback explicite sur absence ou échec de résolution.

Cette couche est une **primitive de présentation utile**, mais ce n’est pas encore le système métier Media cible.

Il manque notamment comme contrat complet démontré :

```text
MediaAsset identity
MediaAssignment identity
assignment validation
entity-slot semantics
content revision
assignment revision
publication lineage
CONTENT_SCOPED invalidation
private binary lifecycle
rights / attribution governance si nécessaire
```

## 3.3 Compatibilité Global

Global est compatible si ses ReadModels ne transportent que :

```text
entity identity
+
slot/ref optionnel
+
metadata de présentation minimale
```

et jamais :

```text
blob
base64
URL signée durablement persistée
résultat de résolution Storage comme vérité analytique
```

## 3.4 Entités Global potentiellement médiatisables

Candidats légitimes :

- Moment ;
- Activity ;
- Place ;
- Day / Life Event lorsque la cible UX le justifie ;
- Merchant ;
- Person / Persona si décidé ;
- éventuellement catégorie ou produit uniquement si un vrai contrat Media les couvre.

Le fait qu’une entité soit médiatisable ne signifie pas que chaque Primary RM doit porter un mediaRef.

## 3.5 Slots à ne pas fermer pendant Global H

Les futurs ReadModels doivent pouvoir être enrichis sans casser leur vérité avec :

```text
media?: {
  ref / assetId / assignmentId conceptuel
  role
  alt semantics
  focal metadata si nécessaire
}
```

Le nom physique final n’est pas décidé ici.

Il faut éviter de :

- figer des images dans des champs obligatoires ;
- mettre un fallback analytique dans le contrat Media ;
- trier des entités selon disponibilité photo ;
- changer `HIDDEN/VISIBLE` Analytics selon présence d’un média ;
- faire participer Media au `factsHash` économique si seul le contenu change.

## 3.6 Invalidation

Concept cible :

```text
nouvelle photo / nouvel assignment
→ CONTENT_SCOPED
→ ReadModel/content projection éventuellement republiée
→ aucune invalidation Actual / Typical / Minimal / Trend / Relationship / Persona
```

Si un `mediaRef` est physiquement stocké dans le snapshot Global, il peut justifier une **nouvelle publication de présentation** ou une génération de contenu selon le futur modèle, mais ne doit jamais modifier la closure analytique.

## 3.7 Risque à éviter

### MEDIA-RISK-01 — image comme donnée métier

Exemple interdit :

```text
photo d’un restaurant présente
→ merchant considéré plus important
```

### MEDIA-RISK-02 — media availability comme gate

Interdit :

```text
pas de media
→ Moment UNKNOWN
```

Le Moment peut être analytically `KNOWN` et visuellement utiliser un fallback.

### MEDIA-RISK-03 — signed URL persistée

La publication devrait porter une référence durable, pas une URL temporaire de Storage.

## 3.8 Classification

```text
MEDIA
NEEDS_EXTENSION
```

Base de présentation : `READY_BY_DESIGN`.

Système `MediaAsset / MediaAssignment / CONTENT_SCOPED` : non implémenté.

Aucun conflit avec Global n’existe si les slots restent optionnels et hors Analytics.

---

# 4. B — Résumé contextuel Global

## 4.1 Doctrine

Le Résumé contextuel est un **sidecar narratif non autoritaire**.

Chaîne :

```text
Global publication certifiée
↓
GlobalAISummaryPayload déterministe
↓
selectedInsights + supportingContext + limitations
↓
AISummaryRequest immuable
↓
export manuel JSON
↓
ChatGPT
↓
AISummaryResult JSON + HTML safe
↓
validation stricte
↓
append-only imported summary
↓
ImportedGlobalSummaryReadModel
```

## 4.2 Ce que Global doit rendre accessible

Pour qu’un futur builder narratif n’ait jamais à recalculer, Global A→H doit rendre accessibles ou traçables :

### Identité de publication

- `publicationId` ;
- `analyticsRevision` / revision pertinente ;
- `factsHash` / digest de vérité ;
- manifest identity ;
- contract version ;
- policy/method versions utiles ;
- `asOf`.

### Outputs narrables

Pour chaque module :

- selected insight(s) publiables ;
- KPI(s) déjà sélectionnés ;
- supporting evidence ;
- references ;
- supporting context ;
- period / population réellement utilisés ;
- person/household scope ;
- quality state ;
- limitation reason ;
- capability state ;
- provenance.

### Relations utiles

- entity refs ;
- Month/Day refs ;
- Moment / Activity / Place / Person / Purchase refs ;
- relation type et niveau de preuve ;
- causal vs associated explicitement distinct.

Le builder de résumé ne doit pas relire des tables brutes pour recréer ce contexte si Global l’a déjà certifié.

## 4.3 `selectedInsights` vs narration

Global doit sélectionner ses insights déterministes avant ChatGPT.

ChatGPT peut :

- relier plusieurs insights ;
- hiérarchiser narrativement ;
- contextualiser ;
- écrire un fil conducteur.

Il ne peut pas :

- créer un `GlobalInsightCandidate` ;
- recalculer trend ;
- choisir qu’une relation statistiquement non publiée est réelle ;
- transformer UNKNOWN en conclusion ;
- modifier materiality ;
- attribuer une dépense à une personne sans preuve ;
- inventer une causalité.

## 4.4 Fraîcheur

Le contrat doit permettre :

```text
summary source = publication G42 / factsHash ABC

nouvelle publication G43
↓
si corpus pertinent différent
summary G42 = STALE
ancien texte reste accessible
nouveau request requis
```

Un changement purement non pertinent ne devrait pas forcément rendre le résumé stale si le futur dependency/hash contract prouve l’absence d’impact sur le corpus.

Cette optimisation doit être guidée par le vrai corpus/hash, pas par une heuristique React.

## 4.5 Current foundation utile

History possède déjà :

- `importedSummary` dans M1 ;
- notion `MISSING` ;
- infrastructure de fraîcheur/documentation antérieure liée à publication/revision/factsHash.

Le Global cible n’a pas encore son `ImportedGlobalSummaryReadModel` final.

Le plan conceptuel prévoit explicitement :

```text
Phase H
→ slot ImportedGlobalSummaryReadModel sans workflow IA

Phase I
→ builder payload
→ request/hash
→ export manuel
→ import strict
→ FRESH/STALE/MISSING
```

## 4.6 Information interdite dans le payload

Ne pas obliger Global à exposer :

- transactions brutes ;
- GPS brut ;
- données source non nécessaires ;
- secrets ;
- dumps complets d’entités ;
- détails hors materiality/support simplement pour donner « plus de contexte » à l’IA.

Le futur corpus doit être riche mais borné.

## 4.7 Risques

### SUMMARY-RISK-01 — IA comme moteur secondaire

Interdit :

```text
ChatGPT dit « les restaurants augmentent »
→ M8 trend = increasing
```

### SUMMARY-RISK-02 — dépendance UI

Le corpus ne doit pas être reconstruit à partir du DOM ou du texte rendu.

### SUMMARY-RISK-03 — mauvais lineage

Un résumé ne peut être `FRESH` si `publicationId/factsHash/revision/packageHash` ne correspondent pas au corpus actif.

### SUMMARY-RISK-04 — résumé avant stabilisation

Construire Phase I avant la publication Global déterministe figerait des contrats narratifs autour de sorties mouvantes.

## 4.8 Classification

```text
CONTEXTUAL SUMMARY
READY_BY_DESIGN
```

Le workflow est à implémenter plus tard, mais Global A→H peut et doit être construit pour lui fournir un corpus entièrement déterministe.

---

# 5. C — Benefit Wallet / Swile / Edenred

## 5.1 Doctrine de référence

Quatre vérités distinctes :

```text
1. consommation économique
2. sortie bancaire
3. financement Benefit Wallet
4. capacité/solde du wallet
```

Elles ne doivent jamais être fusionnées.

Exemple :

```text
PurchaseEvent Carrefour
Gross = 18,65 €

Funding:
Swile = 16,50 €
Bank card = 2,15 €

Actual = 18,65 €
Bank outflow = 2,15 €
Wallet funding = 16,50 €
Wallet credit = 0 € de consommation
```

## 5.2 Invariant Global fondamental

Global M1/M2/M8 doit être conçu autour de :

```text
PurchaseEvent = achat humain
FundingComponent = comment l’achat a été financé
Bank operation = mouvement bancaire
Wallet ledger = mouvement de capacité
```

Donc :

```text
purchase
≠ funding
≠ bank transaction
```

et :

```text
economic consumption
≠ wallet funding
≠ bank flow
```

## 5.3 Ce que Global peut faire avant Swile

Global déterministe peut implémenter M1/M2/M8 avec les Facts autoritaires actuellement disponibles et les capabilities effectivement ouvertes.

Il doit cependant **éviter toute hypothèse de fermeture** telle que :

```text
un achat existe seulement s’il a une bank operation
purchase amount = bank outflow
payer = bank account owner
merchant = payment provider
place = GPS presence
```

Ces raccourcis fonctionneraient peut-être sur la data bancaire actuelle mais casseraient dès l’arrivée de Swile.

## 5.4 M1 Finance

M1 doit distinguer :

```text
consommation économique
vs
flux bancaires
```

Le Benefit Wallet ne doit pas créer une seconde version d’Actual.

L’arrivée de Swile doit enrichir la couche de Facts/PurchaseEvent de sorte que le moteur Actual officiel continue à produire la consommation économique correctement.

## 5.5 M2 Catégories

Les catégories doivent s’appuyer sur la consommation économique et l’identité du PurchaseEvent/merchant réel, pas uniquement sur les opérations bancaires.

Les merchant/purchase drivers actuellement absents peuvent être enrichis lors du chantier Benefit Wallet plutôt que simulés avant.

## 5.6 M8 Consumption

M8 est la zone à plus fort risque.

Il devra pouvoir exprimer :

- fréquence d’achat ;
- panier ;
- merchant ;
- channel ;
- product/line analytics si authority disponible ;
- funding mix comme **dimension secondaire** ;
- wallet usage si un futur insight le justifie ;
- sans transformer funding en consommation.

### Exemple d’output correct

```text
Restaurant X
12 PurchaseEvents
panier médian 16,80 €

financement observé :
70 % wallet
30 % bank
```

### Exemple interdit

```text
12 dépenses Swile
+ 12 dépenses carte
= 24 achats
```

## 5.7 Provider-agnostic obligatoire

Global ne doit pas avoir :

```text
if provider === "SWILE"
```

dispersé dans :

- Analytics ;
- ReadModels ;
- React ;
- materiality ;
- Persona ;
- relations.

Il peut exister un adapter Swile côté import/source.

Les Analytics consomment un contrat générique :

```text
BenefitWallet
WalletLedger
PurchaseEvent
PurchaseFundingComponent
```

Edenred doit ensuite pouvoir être ajouté par nouvel adapter + nouvelles données.

## 5.8 Personnes

Le brief Benefit Wallet interdit :

```text
WALLET_OWNER → BENEFICIARY automatique
BANK_ACCOUNT_OWNER → PAYER automatique
```

Global M9/M10 devra donc consommer des rôles person explicitement autoritaires.

## 5.9 Lieux

Même séparation :

```text
PERSON_PRESENCE_EVIDENCE
≠ TRANSACTION_PLACE
≠ MERCHANT_FULFILLMENT_PLACE
```

Swile/Uber Eats rend cette distinction particulièrement importante pour M7 et les relations Place↔Finance.

## 5.10 Moments / Activities

Un PurchaseEvent financé par wallet peut avoir un gross causal.

Le `causalCost` doit utiliser la consommation économique, pas la seule part bancaire.

Toujours :

```text
spentDuring ≠ causalCost
```

HC2 doit stabiliser cette sémantique avant Global.

## 5.11 Invalidation future

Import Swile/Edenred :

```text
new provider source
→ new / enriched PurchaseEvents
→ new funding components
→ dataRevision
→ affected History months
→ M1/M2/M8 + relations/persona/etc. selon dependency graph
→ new certified Global generation
```

Le provider lui-même n’est pas une raison de recalculer toutes les Analytics ; ce sont les Facts réellement modifiés qui le sont.

## 5.12 Risques

### WALLET-RISK-01 — bank-centric purchase identity

Risque maximal : faire de la bank operation l’identité d’un achat.

### WALLET-RISK-02 — provider as merchant

Swile/Edenred ne doit jamais remplacer le commerce réel.

### WALLET-RISK-03 — credits in Actual

Un crédit wallet augmente une capacité ; ce n’est ni revenu bancaire ni consommation.

### WALLET-RISK-04 — Persona attribution implicite

Wallet owner n’est pas automatiquement bénéficiaire/payer.

### WALLET-RISK-05 — funding-specific ReadModels

Ne pas créer un deuxième jeu de ReadModels Global « Swile » parallèle aux ReadModels économiques.

## 5.13 Classification

```text
BENEFIT WALLET
DESIGN_RISK
```

Aucun conflit actuel si Global préserve les identités économiques génériques.

L’intégration réelle reste `NEEDS_EXTENSION` après le Global déterministe.

---

# 6. D — Diagnostic

## 6.1 Diagnostic cible

Le moteur final doit répondre :

> Quel contrat ou invariant est violé, sur quel scope, avec quelles preuves, et à quel étage faut-il enquêter ?

Il ne répond jamais :

> Quelle devrait être la vérité métier à la place du moteur ?

## 6.2 Architecture cible

```text
Sources / Canonical / Facts / Analytics / Artifacts / Publications
                         │
                         └──────────────┐
                                        ↓
                              DiagnosticRepository
                                  READ ONLY
                                        ↓
                              independent checks
                                        ↓
                         CheckResults + Evidence
                                        ↓
                            DiagnosticReadModel
```

## 6.3 État actuel observé

Une route `/diagnostic` existe déjà et affiche :

- contexte Household ;
- personnes ;
- périodes ;
- dataRevision ;
- analyticsRevision ;
- runtime environment ;
- quelques Query health checks ;
- source health ;
- Minimal source health.

Cette route est utile comme **diagnostic technique existant**, mais elle ne constitue pas encore le moteur cible du brief avec :

- catalogue atomique de checks ;
- `DiagnosticCheckDefinition` ;
- stratégies de validation indépendantes ;
- fingerprints ;
- lifecycle ;
- POST_IMPORT ;
- POST_PUBLICATION ;
- POST_CORRECTION ;
- preuves structurées ;
- certifications transverses.

Il ne faut donc pas considérer l’existence de `/diagnostic` comme `REUSE` final automatique.

## 6.4 Ce que Global doit exposer pour être diagnostiquable

### Publication

- publicationId ;
- generation identity ;
- source/data/analytics revision ;
- factsHash ;
- manifest hash ;
- method/policy versions ;
- active/inactive/published status ;
- certification status ;
- artifact/query completeness.

### Module outputs

Pour chaque M1→M10 :

- knowledge state ;
- support ;
- coverage ;
- provenance ;
- capability state ;
- selected insight IDs ;
- materiality method ;
- dependency refs ;
- populations / time windows utilisées ;
- entity/person scope ;
- reason codes.

### Evidence

Les artifacts doivent être suffisamment traçables pour permettre une vérification indépendante sans exposer un dump complet de données privées.

## 6.5 Exemples de checks Global futurs

Sans implémenter le Diagnostic ici, Global doit permettre des checks du type :

```text
- UNKNOWN n’est pas transformé en zéro ;
- selected insight satisfait support/coverage ;
- publication contient uniquement des outputs certifiés ;
- M1 total se réconcilie avec economic facts ;
- Trend n’utilise pas de look-ahead ;
- Relationship insight respecte son gate ;
- M7 localized finance respecte coverage ;
- M8 ne double-compte pas PurchaseEvent/funding ;
- M9 Persona utilise common comparable support ;
- M10 ne fabrique pas participation partagée ;
- toutes les Query resources actives appartiennent au même publicationId ;
- RuntimeSchemas passent ;
- aucune ressource HIDDEN n’est servie comme insight visible.
```

## 6.6 Séparation DataStatus / DiagnosticSeverity

Global doit conserver :

```text
KNOWN / PARTIAL / UNKNOWN / NOT_APPLICABLE / CONFLICT
```

Le Diagnostic produit séparément :

```text
PASS / ERROR / WARNING / INFO / NOT_APPLICABLE / NOT_RUN
```

Exemple :

```text
M8 Product analysis = UNKNOWN car aucune authority
→ Diagnostic = INFO si la capability est correctement masquée
→ ERROR seulement si l’UI invente un résultat.
```

## 6.7 Risques

### DIAG-RISK-01 — self-validation

Le Diagnostic ne doit pas appeler `RelationshipEngine()` pour vérifier que RelationshipEngine a raison.

### DIAG-RISK-02 — diagnostic comme gate métier implicite

Le moteur métier doit être correct avant le Diagnostic. Le Diagnostic peut empêcher une activation selon certification, mais ne produit pas la valeur à publier.

### DIAG-RISK-03 — preuves absentes

Une sortie Global sans support/provenance/dependency refs rendrait les futurs checks imprécis.

### DIAG-RISK-04 — UI calcule la sévérité

React Diagnostic doit afficher une sévérité fournie par le moteur de checks.

## 6.8 Classification

```text
DIAGNOSTIC
NEEDS_EXTENSION
```

Global est `READY_BY_DESIGN` pour être diagnostiquable si les métadonnées de qualité, lineage et dépendances sont conservées.

---

# 7. E — Import & Actualisation / Refresh Planner

## 7.1 Statut du brief

Le brief Import est volontairement **provisoire**.

Il ne fixe pas encore :

- schéma physique final du package ;
- tables finales ;
- RPC/jobs ;
- mapping final des dépendances ;
- exact Refresh Planner.

Il impose cependant l’architecture :

```text
Import
→ Canonical/relations
→ dataRevision N+1
→ user action "Actualiser l’application"
→ Refresh Planner
→ official engines/builders
→ staging
→ certification
→ Diagnostic
→ atomic switch
→ navigation sans calcul métier
```

## 7.2 Global doit rendre ses dépendances déclarables

Pour chaque famille d’output Global, le futur planner doit pouvoir déterminer :

```text
FACT_DEPENDENCIES
ENTITY_DEPENDENCIES
HISTORICAL_LOOKBACK
OTHER_GLOBAL_DEPENDENCIES
METHOD/POLICY_DEPENDENCIES
PUBLICATION_OUTPUTS
```

Le nom physique des colonnes/tables n’est pas fixé ici.

## 7.3 Minimum metadata à préserver

Pour chaque moteur / artifact / ReadModel Global :

### Inputs

- Fact families ;
- entity IDs/types si scoped ;
- person/household scope ;
- population/time window réellement utilisée ;
- upstream artifact IDs si réutilisés ;
- policy/method versions ;
- source revision/dataRevision.

### Outputs

- artifact identity ;
- module family ;
- query resources produites ;
- publication inclusion ;
- output factsHash / dependency digest ;
- certification state.

### Recompute semantics

- additive safe ? ;
- historical recompute required ? ;
- entity recompute ? ;
- global full-family recompute ? ;
- no-op provable ?.

## 7.4 Classes conceptuelles

### `LOCAL_MONTH`

Correction locale History.

Global ne devrait pas être invalidé si aucune dépendance Global ne consomme ce changement.

### `HISTORICAL_LOOKBACK`

Exemple : Typical/Trend utilise une fenêtre comprenant le mois corrigé.

### `GLOBAL_HISTORY`

Exemple : Trend, ChangePoint, relationships, Persona, routines.

### `ENTITY_SCOPED`

Exemple : correction d’un Place, merchant, participant ou Activity.

### `CONTENT_SCOPED`

Exemple futur : image/assignment/media metadata ou contenu narratif, sans changer la vérité analytique.

Ces classes restent conceptuelles jusqu’au runtime final.

## 7.5 Exemple — nouveau mois

```text
Import septembre
→ dataRevision N+1
→ Facts septembre
→ History septembre
→ Global dependencies impactées
→ moteurs concernés
→ Global generation G+1
→ certification
→ switch
```

Les anciennes publications History qui ne dépendent pas de septembre ne doivent pas être republiées inutilement.

## 7.6 Exemple — correction de mai

```text
Correction mai
↓
History mai directement affecté
↓
Typical des mois futurs peut être affecté
↓
Trend Global peut être affecté
↓
ChangePoint peut être affecté
↓
M5/M9 peuvent être affectés selon dependency graph
↓
rebuild ciblé
```

Mais :

```text
si la dependency closure prouve qu’une famille Global ne dépend pas du changement
→ aucune republication de cette famille
```

## 7.7 Global ne doit pas être « incrémental par défaut »

Le Refresh Planner peut réutiliser les anciennes sorties, mais certains moteurs ne sont pas additionnables naïvement :

- médiane ;
- Typical ;
- Trend/Stability ;
- ChangePoint ;
- RelationshipEngine ;
- Persona ;
- cycles ;
- materiality ;
- FDR/statistical corrections.

Donc le contrat Global doit déclarer la méthode officielle ; le planner orchestre, il ne dérive jamais lui-même une approximation incrémentale.

## 7.8 Publication cohérente

Pendant refresh :

```text
ancienne publication G42 reste active
↓
build G43 en staging
↓
certification
↓
Diagnostic
↓
atomic switch
↓
G43 devient active
```

Interdit :

```text
M1 de G43
+ M2 de G42
+ M8 en recalcul dynamique
```

sauf si un futur manifest/versioned lineage formalise explicitement un partage immuable entre générations et que la publication cohérente reste démontrée.

## 7.9 Résumé contextuel pendant refresh

Le bouton `Actualiser l’application` :

- ne contacte jamais ChatGPT ;
- ne génère pas de résumé ;
- marque le résumé `STALE` ou `MISSING` selon la nouvelle publication ;
- laisse le workflow manuel séparé.

## 7.10 Media pendant refresh

Un ajout purement Media :

```text
CONTENT_SCOPED
→ pas de recalcul Global Analytics
```

Le planner final doit pouvoir distinguer cette mutation d’une correction de Facts économiques.

## 7.11 Risques

### IMPORT-RISK-01 — dependency graph incomplet

Sans vraie closure, planner obligé de :

```text
A. tout recalculer
ou
B. deviner
```

A est coûteux ; B est incorrect.

### IMPORT-RISK-02 — scope global unique

Une `observationWindow` universelle empêcherait de connaître le vrai lookback de M1/M3/M5/M9.

### IMPORT-RISK-03 — planner qui réimplémente Analytics

Interdit : planner calcule Trend ou médiane pour décider une sortie.

### IMPORT-RISK-04 — navigation lazy build

Un snapshot manquant après refresh ne doit pas être reconstruit lors de l’ouverture de `/analyse-globale`.

### IMPORT-RISK-05 — content mutation = analytic mutation

Changer une photo ne doit pas déclencher M1→M10.

## 7.12 Classification

```text
IMPORT / REFRESH PLANNER
DESIGN_RISK
```

Le système final reste `NEEDS_EXTENSION`, mais Global peut être rendu compatible maintenant en déclarant correctement ses dépendances, lineage et publications.

---

# 8. F — GLOBAL MUST NOT DEPEND ON

Liste normative à injecter dans les futurs prompts Global.

## 8.1 Media

```text
GLOBAL MUST NOT DEPEND ON:
- media availability
- successful Storage resolution
- photo count
- image quality
- media assignment presence
- signed URL
- fallback artwork
```

## 8.2 ChatGPT / Résumé contextuel

```text
GLOBAL MUST NOT DEPEND ON:
- ChatGPT response
- imported summary text
- narrative ranking
- AI-generated conclusion
- AI-selected relationship
- AI-generated classification
- AI availability
```

## 8.3 Benefit Wallet provider specifics

```text
GLOBAL MUST NOT DEPEND ON:
- provider === SWILE
- provider-specific labels in Analytics
- Swile as merchant
- Swile ledger row as PurchaseEvent identity
- wallet owner as beneficiary
- wallet debit as second consumption
```

## 8.4 Diagnostic

```text
GLOBAL MUST NOT DEPEND ON:
- Diagnostic KPI output as business input
- Diagnostic severity to calculate a metric
- Diagnostic correction
- manual "resolved" state
```

Le pipeline de publication peut exiger un Diagnostic/certification PASS comme gate d’activation, mais les **valeurs métier** ne sont jamais produites par le Diagnostic.

## 8.5 Import UI

```text
GLOBAL MUST NOT DEPEND ON:
- React Import state
- button state
- spreadsheet layout
- filename
- manual UI choices as business authority
```

## 8.6 React presentation

```text
GLOBAL MUST NOT DEPEND ON:
- client-side sort
- client-side top N
- DOM presence
- responsive breakpoint
- hover state
- chart layout
- local component state
```

---

# 9. Compatibilité par phase Global A→I

## Phase A — Foundations

### Doit préserver

- support/coverage/provenance généralisables ;
- knowledge states ;
- economic identities ;
- revision lineage ;
- dependency closure ;
- publication identity ;
- policy/method versions.

### Prépare

- Diagnostic ;
- Refresh Planner ;
- Contextual Summary lineage ;
- Benefit Wallet anti-double-counting.

### Ne doit pas implémenter

- MediaAsset ;
- Swile ;
- IA ;
- Import planner final.

## Phase B — Finance M1/M2

### Doit préserver

```text
Actual économique
≠ bank flow
```

et catégories basées sur les Facts économiques, pas uniquement sur la banque.

### Future extension critique

Benefit Wallet.

## Phase C — Temporal/Life M3/M4

### Doit préserver

- periods réellement utilisées ;
- support ;
- change point evidence ;
- routines observables ;
- aucune dépendance Media.

### Future extension

Summary supporting context ; Diagnostic evidence ; Refresh historical lookback.

## Phase D — Relations M5

### Doit préserver

- relation type ;
- association vs causalité ;
- population ;
- support ;
- evidence refs ;
- method version.

### Future extension

Benefit Wallet peut ajouter des signaux Purchase/Funding, mais ne doit pas redéfinir les relations existantes.

## Phase E — Moments / Geo M6/M7

### Doit préserver

```text
spentDuring ≠ causalCost
presence ≠ transaction place ≠ fulfillment
```

### Future extension critique

- Media assignments ;
- Benefit Wallet gross causal ;
- Diagnostic coverage ;
- Refresh entity-scoped.

## Phase F — Consumption M8

### Future compatibility la plus critique

- PurchaseEvent first ;
- funding secondary ;
- provider-agnostic ;
- merchant réel ;
- PurchaseLine/ProductVariant conditionnels ;
- no bank-centric assumptions.

## Phase G — People M9/M10

### Doit préserver

- attribution person explicitement prouvée ;
- common comparable support ;
- shared participation evidence ;
- wallet owner / bank owner non transformés en bénéficiaire/payer.

### Future extension

Summary personas ; Diagnostic anti-inference ; Benefit Wallet person roles.

## Phase H — Query / ReadModels / UX

### Doit préserver

- publicationId cohérent ;
- Primary RM compacts ;
- Detail RM lazy ;
- quality metadata ;
- optional media slots sans dépendance ;
- `ImportedGlobalSummaryReadModel` slot sans workflow IA ;
- entity refs pour futur Media/Summary ;
- aucun blob ;
- aucun provider-specific UI contract obligatoire.

### Checkpoint Media recommandé

Avant de figer les schemas H, vérifier uniquement que les entités visuelles importantes peuvent accepter plus tard un ref/assignment optionnel sans migration sémantique majeure.

Ne pas implémenter le Media Manager complet.

## Phase I — Résumé contextuel

### Entrée

Uniquement Global publication déterministe certifiée.

### Ne doit pas démarrer si

- modules A→H instables ;
- selectedInsights non autoritaires ;
- publication lineage incomplet ;
- factsHash/packageHash contract non défini.

---

# 10. Matrice Future Compatibility → Global outputs nécessaires

| Future chantier | Global output à préserver | Pourquoi | Si absent |
|---|---|---|---|
| Media | stable entity IDs | assigner un asset à Moment/Place/Activity/etc. | assignments fragiles |
| Media | optional content slot/ref | publier le contenu sans changer Analytics | rupture de RM plus lourde |
| Media | separation analytic/content revision | éviter recalcul M1→M10 | refresh inutile |
| Summary | publicationId | lier le texte à une génération exacte | fraîcheur impossible |
| Summary | factsHash / corpus digest | détecter changement sémantique | stale non fiable |
| Summary | selectedInsight IDs | raconter seulement des insights publiables | IA recrée sélection |
| Summary | supportingContext | fournir contexte sans raw data | tentation de relire brut |
| Summary | limitations/support/coverage | narration honnête | affirmation excessive |
| Wallet | PurchaseEvent identity | 1 achat humain unique | double comptage |
| Wallet | economic amount distinct bank outflow | Actual correct | M1/M8 cassés |
| Wallet | merchant real identity | analytics merchant stables | provider confondu |
| Wallet | person roles distincts | Persona correct | attribution inventée |
| Diagnostic | support/coverage/provenance | checks indépendants | impossible de vérifier gates |
| Diagnostic | method/policy versions | traçabilité | résultats non reproductibles |
| Diagnostic | dependency refs | propagation check | correction non vérifiable |
| Diagnostic | publication metadata | coherence/single generation | publication non certifiable |
| Import | facts dependencies | invalidation ciblée | full rebuild/guess |
| Import | entity dependencies | correction ciblée | recalcul trop large |
| Import | historical lookback | Typical/Trend/ChangePoint | stale silencieux |
| Import | publication outputs | build plan | navigation peut manquer |
| Import | recompute semantics | orchestrer moteur officiel | planner devient moteur |

---

# 11. Gaps de contrat à ne pas fermer prématurément

## GAP-FUT-01 — Media content identity

À définir lors du chantier Media, pas dans Global A-F.

Global H doit seulement éviter un schema impossible à enrichir.

## GAP-FUT-02 — Global summary corpus schema

Le brief Summary fournit la doctrine et le protocole, mais les champs exacts doivent être alignés sur les vrais Global ReadModels après H.

## GAP-FUT-03 — Benefit Wallet Global exposure

Le brief Swile réserve explicitement le Bilan et Global pour audit après leurs designs finaux.

Donc les KPI spécifiques wallet ne doivent pas être inventés ici.

## GAP-FUT-04 — Diagnostic physical repository

Le Diagnostic courant n’est pas encore le moteur final.

Les tables/results physiques restent à concevoir plus tard.

## GAP-FUT-05 — Refresh Planner physical graph

Le brief Import interdit lui-même de figer tables/jobs/RPC avant stabilisation du runtime final.

Le Global 03 ne fournit donc qu’une matrix provisoire ; GA0 et le runtime final devront produire la version physique.

---

# 12. Revalidation obligatoire à GA0

Après HC6, GA0 devra revalider au minimum :

## History / Media

- les ReadModels finalisés ont-ils conservé des slots médias seulement là où utile ? ;
- les refs actuels sont-ils présentationnels ou participent-ils à un hash analytique ? ;
- HC3 a-t-il séparé correctement facts dependencies et content dependencies ?.

## History / Summary

- PublicationMeta final ;
- factsHash ;
- manifest durable ;
- summary freshness contract ;
- `importedSummary` toujours sidecar.

## History / Wallet

- PurchaseEvent identity finale ;
- causalCost Moment/Activity final HC2 ;
- place semantics finale HC2 ;
- M3 classifications finales HC2.

## History / Diagnostic

- manifest/dependency evidence final ;
- publication immutability ;
- correction/republication test ;
- cache generation behavior.

## History / Import

- vrais scopes d’invalidation ;
- durable dependency graph ;
- generation identities ;
- reconstruction primitive ;
- dataRevision/analyticsRevision behavior.

---

# 13. Clauses à injecter dans tous les futurs prompts Codex Global

Chaque prompt d’implémentation A→H devrait contenir une section :

```text
EXTENSION_COMPATIBILITY — DO NOT IMPLEMENT
```

avec les invariants suivants.

## Media

- aucun Analytics ne dépend d’un mediaRef ;
- absence de média ≠ UNKNOWN analytique ;
- entity IDs stables ;
- refs seulement, jamais blobs ;
- préparer content-scoped extension sans l’implémenter.

## Contextual Summary

- outputs narrables déterministes ;
- selected insights serveur ;
- publication/facts lineage conservé ;
- aucune logique IA ;
- aucun text summary comme input Analytics.

## Benefit Wallet

- `purchase ≠ funding ≠ bank transaction` ;
- economic consumption ≠ bank/wallet flow ;
- provider-agnostic ;
- aucun code Swile-specific hors adapter futur ;
- ne jamais fabriquer funding data absente.

## Diagnostic

- support/coverage/provenance/method/revision observables ;
- evidence refs bornables ;
- aucun engine auto-validé ;
- ne pas implémenter Diagnostic ici.

## Import

- déclarer les dépendances réelles ;
- ne pas inventer le Refresh Planner ;
- garder les moteurs appelables par orchestration ;
- aucune reconstruction métier à la navigation.

---

# 14. Anti-patterns à rechercher pendant les futures reviews

## 14.1 Media leakage

Chercher :

```text
imageRef dans Analytics
media availability dans capability
media sort dans engine
```

## 14.2 Summary leakage

Chercher :

```text
summary.text → ranking
summary → category classification
summary → Persona
```

## 14.3 Wallet leakage

Chercher :

```text
bankOperationId comme PurchaseEventId
provider comme merchant
wallet debit additionné à Actual
wallet credit comme inflow bancaire
```

## 14.4 Diagnostic leakage

Chercher :

```text
diagnosticResult → metric value
diagnosticSeverity → business decision
```

## 14.5 Import leakage

Chercher :

```text
React detects stale → rebuild
query miss → compute Global
Refresh Planner calculates analytics
```

---

# 15. Conséquences pour la future chaîne de prompts

## 15.1 Phase A

Ajouter un check obligatoire :

```text
FUTURE_EXTENSION_FOUNDATION_GATE
```

Il vérifie :

- lineage ;
- support/coverage/provenance ;
- economic identities ;
- dependency declarations ;
- publication metadata.

## 15.2 Phase F M8

Ajouter un gate :

```text
BENEFIT_WALLET_COMPATIBILITY_GATE
```

sans intégrer Swile.

Minimum :

- PurchaseEvent n’est pas bank-centric ;
- funding n’est pas consumption ;
- provider n’est pas merchant ;
- channel distinct ;
- person roles non inférés.

## 15.3 Phase H

Ajouter :

```text
MEDIA_CONTRACT_CHECKPOINT
CONTEXTUAL_SUMMARY_HANDOFF_GATE
DIAGNOSTIC_OBSERVABILITY_GATE
REFRESH_DEPENDENCY_EXPORT_GATE
```

Ces gates vérifient les contrats, sans développer les modules futurs.

## 15.4 Phase I

Ne démarrer que lorsque :

```text
GLOBAL_DETERMINISTIC_CORE = PASS
```

et, selon le séquencement produit retenu, après intégration Benefit Wallet si l’objectif est que la première synthèse Global reflète déjà cette vérité économique enrichie.

---

# 16. Verdict par chantier

## A. Gestion des médias

```text
Status: NEEDS_EXTENSION
Blocking conflict: NO
Design risk: LOW if media remains optional/content-scoped
Global action now: preserve entity identity + optional content hooks
Do not implement now: MediaAsset/MediaAssignment manager
```

## B. Résumé contextuel

```text
Status: READY_BY_DESIGN
Blocking conflict: NO
Design risk: LOW if publication lineage is preserved
Global action now: expose deterministic narrable outputs
Do not implement before Phase I: export/import/HTML workflow
```

## C. Benefit Wallet / Swile / Edenred

```text
Status: DESIGN_RISK
Blocking conflict: NO CURRENTLY
Design risk: HIGH in M1/M2/M8/M9/M10
Global action now: preserve purchase/funding/bank separation
Do not implement now: Swile/Edenred providers
```

## D. Diagnostic

```text
Status: NEEDS_EXTENSION
Blocking conflict: NO
Design risk: MEDIUM if outputs lose provenance/dependencies
Global action now: keep outputs independently diagnosable
Do not implement now: target Diagnostic Engine
```

## E. Import & Actualisation

```text
Status: DESIGN_RISK
Blocking conflict: NO CURRENTLY
Design risk: HIGH if dependency metadata remains incomplete
Global action now: make every output dependency-declarable
Do not implement now: final Refresh Planner / Import Orchestrator
```

---

# 17. MUST_PRESERVE_FOR_FUTURE

Les contraintes suivantes doivent survivre à GA0 puis être injectées dans la chaîne finale de prompts.

## MUST_PRESERVE_FOR_FUTURE — 01

```text
Global deterministic truth never depends on Media.
```

## MUST_PRESERVE_FOR_FUTURE — 02

```text
Absence of media never means missing analytic data.
```

## MUST_PRESERVE_FOR_FUTURE — 03

```text
Media changes are CONTENT_SCOPED / PRESENTATION_SCOPED unless they modify a separate Canonical truth.
```

## MUST_PRESERVE_FOR_FUTURE — 04

```text
Snapshots carry media identities/refs/meta, never binary payloads.
```

## MUST_PRESERVE_FOR_FUTURE — 05

```text
Contextual Summary consumes certified Global outputs and never computes Analytics.
```

## MUST_PRESERVE_FOR_FUTURE — 06

```text
Summary freshness is bound to publication/revision/facts/package identity.
```

## MUST_PRESERVE_FOR_FUTURE — 07

```text
Old summary text may remain readable when STALE, but is never silently considered current.
```

## MUST_PRESERVE_FOR_FUTURE — 08

```text
No LLM API, automatic generation or agent is introduced by Global implementation.
```

## MUST_PRESERVE_FOR_FUTURE — 09

```text
1 human acquisition = 1 PurchaseEvent.
```

## MUST_PRESERVE_FOR_FUTURE — 10

```text
purchase ≠ funding ≠ bank transaction.
```

## MUST_PRESERVE_FOR_FUTURE — 11

```text
economic consumption ≠ wallet funding ≠ bank flow.
```

## MUST_PRESERVE_FOR_FUTURE — 12

```text
Swile/Edenred are providers, never the Global economic model.
```

## MUST_PRESERVE_FOR_FUTURE — 13

```text
Provider is never substituted for the real merchant.
```

## MUST_PRESERVE_FOR_FUTURE — 14

```text
Wallet owner / bank owner never automatically implies payer / beneficiary.
```

## MUST_PRESERVE_FOR_FUTURE — 15

```text
PERSON_PRESENCE_EVIDENCE ≠ TRANSACTION_PLACE ≠ MERCHANT_FULFILLMENT_PLACE.
```

## MUST_PRESERVE_FOR_FUTURE — 16

```text
spentDuring ≠ causalCost.
```

## MUST_PRESERVE_FOR_FUTURE — 17

```text
Diagnostic is read-only and never a business truth source.
```

## MUST_PRESERVE_FOR_FUTURE — 18

```text
Diagnostic severity is distinct from KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE/CONFLICT.
```

## MUST_PRESERVE_FOR_FUTURE — 19

```text
Every Global output remains independently diagnosable through support, coverage, provenance, method, revision and evidence/dependency refs.
```

## MUST_PRESERVE_FOR_FUTURE — 20

```text
Refresh Planner orchestrates official engines; it never reimplements them.
```

## MUST_PRESERVE_FOR_FUTURE — 21

```text
Every Global family declares its real Facts/entity/lookback/global dependencies.
```

## MUST_PRESERVE_FOR_FUTURE — 22

```text
A correction invalidates only proven dependent outputs, but correctness always takes priority over avoiding recalculation.
```

## MUST_PRESERVE_FOR_FUTURE — 23

```text
No Business Analytics calculation is triggered by Global navigation.
```

## MUST_PRESERVE_FOR_FUTURE — 24

```text
During rebuild, the previous certified Global publication remains active until the new generation passes validation/certification and atomic switch.
```

## MUST_PRESERVE_FOR_FUTURE — 25

```text
React presentation, Import UI, Media availability, ChatGPT response and Diagnostic result are never dependencies of Global Analytics.
```

---

# 18. Conclusion

Les cinq chantiers futurs ne nécessitent pas de sur-concevoir Global aujourd’hui.

La bonne stratégie est plus simple :

```text
construire une vérité Global déterministe, versionnée, traçable et dependency-aware
+
préserver des identités stables
+
préserver support / coverage / provenance / revisions
+
préserver purchase / funding / bank separation
+
préserver optional content hooks
+
préserver des outputs narrables
```

Cela suffit pour permettre ensuite :

```text
Benefit Wallet
Media
Contextual Summary
Diagnostic
Import / Refresh Planner
```

sans que ces modules deviennent des moteurs parallèles ni obligent à réécrire l’Analyse Globale.

Le point de vigilance le plus fort pour la future implémentation est **M8 Consumption + identité économique PurchaseEvent**, suivi par **dependency metadata / publication lineage** pour Import et Diagnostic.

La bonne nouvelle est qu’aucun conflit architectural irréversible n’a été identifié dans les audits 01→05 : la cible Global peut être construite proprement en anticipant ces extensions, sans les implémenter maintenant.

```text
GLOBAL FUTURE INTEGRATION COMPATIBILITY
READY_FOR_PROMPT_CHAIN
```

```text
MUST_PRESERVE_FOR_FUTURE
RECORDED
```
