# N1-C-A — Contrat candidat de persistance, sans writer

Statut : candidat local à revoir. Aucun endpoint, writer, gate, schéma ou écran actif n’est raccordé par cette tranche.

## Formats et conservation

- Finances historiques : `month-plan-state@v1`, parser/digest inchangés.
- Document N1 complet : `month-plan-state@v2-root-relations`, relations `root-context-relation@v1`, ordre explicite `orderedContextIds`, `relationId` stable et provenance `EXPLICIT_USER_DECISION`.
- Record sérialisé candidat : `{version:"composer-root-relation-draft-record@1",draft:{...}}`.
- Transport candidat distinct : `composer-draft-http@2-root-relations`. Aucun handler ne l’implémente encore. `composer-draft-http@1` et `/api/composer/drafts` restent V1.

Le record conserve draftId, version CAS, lifecycle, baseRevisionId/Number, date de sauvegarde/archive et identité de dernière mutation. Son semanticState contient le document entier ; son digest est celui de la version effective. V1 passe par `parsePlanSemanticState` / `semanticStateDigest`, N1 par le parser/digest N1 existant. La conversion V1→N1 vide reste explicite via l’adaptateur N1-A ; la lecture compatible n’effectue aucune conversion implicite.

Les champs JSON opaques, slots legacy, nulls, composants, participants/payeurs/allocations éventuels et selectionId sont conservés selon le parser V1 historique. Sa normalisation existante (tri, parent absent normalisé null, dernier SET_STATE par slot) n’est pas changée. Une clé top-level historiquement interdite reste refusée. L’ordre des Contexts ne détermine jamais l’ordre des membres d’une relation.

`readRootRelationDraftRow` est un mapping pur de la forme SQL existante vers le record compatible, avec comparaison auteur/foyer/mois fournis par son appelant. Il n’ouvre aucune connexion. Cette comparaison ne prouve ni Auth ni RLS. Une version inconnue, un digest différent ou une relation invalide provoque un refus sans réparation, suppression de membre ou écrasement de frame.

## Préparation et concurrence

Paquet candidat :

```ts
{ contract: "composer-draft-http@2-root-relations", kind: "SAVE", command: {
  targetMonth, requestId, semanticState, digest,
  expectedDraftId, expectedDraftVersion, expectedDocumentVersion, expectedDraftDigest,
  expectedBaseRevisionId, expectedBaseRevisionNumber
} }
```

Le document proposé pour Save est toujours N1 complet. À la création, expectedDraftId/DocumentVersion/Digest valent null et expectedDraftVersion vaut zéro ; sinon tous sont présents. Le couple de base garde la convention null/0 du contrat historique. User, foyer, modèle, canManageRelations et grants ne figurent pas dans ce paquet et les clés supplémentaires sont refusées.

`prepareRootRelationDraftSave` valide structure, mois, digest, lifecycle actif, identité/version/format/digest attendus et base courante. Sa sortie est `PREPARED_LOCAL_ONLY`, `writable=false`. Le mapping storage ne contient que le document entier, son digest et sa taille compacte ; aucune suppression de rootRelations ni projection V1 de sauvegarde. Un dépassement de 1 Mio est refusé localement ; la limite de taille SQL doit aussi être contrôlée au futur writer (la représentation JSONB peut différer).

Cette préparation ne simule pas une transaction. Deux appels préparés sur une même version peuvent être structurellement valables : le futur writer doit refaire la comparaison sous verrou atomique. Le test modélise explicitement ce point : premier CAS accepté en mémoire, seconde réorganisation sur l’ancienne version refusée ; aucun merge automatique.

Le même requestId déjà observé est refusé à la préparation. Après réponse perdue, relire par le canal authentifié puis rapprocher un reçu exact ; ne pas transformer une préparation en retry writer. N1-C-B devra conserver l’idempotence/reconciliation officielle du writer existant et attester les nouveaux paramètres CAS (format/digest de départ), soit dans les métadonnées de la mutation, soit via un fingerprint de commande lié à l’auteur/foyer/mois. Aucun ledger ou colonne supplémentaire n’est créé ici.

Le reçu candidat `{contract,kind:"SAVE_RECEIPT",draft,replayed}` doit correspondre exactement à la commande : id, version+1, mois, base, requestId, version attendue de mutation, lifecycle, document complet et digest. Le record déjà connu doit être la source attendue ou le même reçu, jamais une version supérieure ou un état différent à version identique. Si la décision locale a changé depuis l’envoi, le validateur refuse son remplacement. Sa sortie `VALIDATED_RECEIPT_ONLY` ne place pas l’UI en SAVED.

Le validateur de Reload refuse document V1 sur un local N1, lecture plus ancienne, id/mois/lifecycle incompatible, collision de version/digest et remplacement d’un brouillon DIRTY. Il retourne une valeur ; il ne l’installe pas dans Composer. Aucun nouveau gestionnaire Undo, navigation ou autosave n’est introduit. La conservation F02 du cache financier reste inchangée.

## Autorité et G-A — chemin durable toujours fermé

Structure valide ≠ permission N1 ≠ trajets complets ≠ Save autorisé ≠ Apply possible.

La readiness candidate valide la structure puis publie : organisation `STRUCTURALLY_VALID`, Mobility et Apply `NOT_EVALUATED`, Save `BLOCKED`. Les blockers sont admission N1 authentifiée requise, writer durable absent et politique G-A au seuil de Save indécise. Aucun booléen ou token client ne peut ouvrir ce chemin local.

Avant tout writer futur : obtenir l’identité serveur (`authorizedPlanner`), foyer/auteur/mois, Draft privé et version fraîche, publier les capacités privées/proposées et conserver leur intersection, vérifier PRESERVE/ancres/preset/provenance/parenté et la restriction aux membres sauvegardés, puis réutiliser l’owner N1. Une cible historique ou un digest cohérent ne donne aucun droit. Le contrôle doit aussi couvrir les relations inchangées et le chargement d’un ancien record ; le stockage ne doit pas sérialiser une publication de capabilities devenue périmée comme une permission.

G-A doit intervenir **après validation/admission N1 et avant la transaction Save**. Les options à soumettre à décision sont : autoriser un brouillon organisationnel incomplet clairement marqué (sans conclure Apply), ou refuser Save jusqu’à complétude explicitement attestée. Cette tranche ne choisit aucune option, ne déduit pas les trajets à partir de l’ordre et ne permet pas de franchir le gate. G-B et G-C restent ouverts ; aucun enfant Before ne devient racine et aucune disposition visuelle n’est choisie.

## N1-C-B — changements nécessaires, non exécutés

| Frontière existante | Suite minimale à recevoir séparément |
|---|---|
| `composer-draft-contract.ts`, route `app/api/composer/drafts/route.ts` et `draft-http-transport.ts` | Installer un contrat HTTP distinct négocié, lecteur compatible et erreurs explicites ; refuser V1 sur record N1, sans envoyer un document tronqué. Aucun raccord dans C-A. |
| `composer-draft-service.ts` : parseRow/readRows, save et lifecycle | Lecture versionnée du record complet ; réponse/relecture vérifiée, snapshot/archives conservés. Ajouter l’admission privée fraîche N1 et ne pas appeler le writer V1 pour un document N1. |
| `durable-draft.ts`, Shell, workspace | Nouvelle représentation locale et digest discriminé, suspension/reprise, reçu exact et protection des frames DIRTY. Aucun succès sur timer, ancien reçu ou reconstruction V1 ; sauvegarde des relations puis Reload exact à recevoir. |
| `20261011130256_p07b_m0_phase2_composer_drafts_fixture_gate.sql` : contrainte `phase2_composer_drafts_state` | Elle impose actuellement `phase2_month_plan_state_valid_v1`. Une migration ciblée future est nécessaire pour admettre V2 et vérifier ses invariants relationnels ; conserver V1 sans réécriture de ses données. Le semanticState JSONB permet de stocker le document complet, sans nouvelle table financière ou Context artificiel. |
| `private/public.save_phase2_composer_draft_v1`, `..._v2` et futur writer N1 | Sous le verrou de ligne et dans les chemins de création/replay/update : vérifier auteur/foyer/mois, base, id/version, version du document déjà stocké, digest de départ, requestId et sémantique complète. Tous les anciens writers doivent refuser un record N1, même si la version numérique CAS est correcte et que la proposition V1 est valide. Un header HTTP ne protège pas un appel RPC direct. |
| Archive/Restore et anciennes révisions | Conserver le document et son format, étendre validation et concurrence sans réintroduire une ancienne frame sur un N1 actif. Vérifier les chemins RPC historiques accessibles ainsi que les permissions d’exécution. |
| SQL/permissions/digest | Définir l’accès au futur writer et l’attestation d’admission afin qu’un RPC direct ne puisse pas contourner F01 avec un grant ou digest client. Vérification RLS/Auth et migration ciblée sous validation humaine distincte ; aucune politique ou clé modifiée ici. |

L’actuel ancien service applicatif refuse une ligne N1 avant RPC car son parser est fermé V1. Le test local démontre ce refus. **La garantie anti-écrasement par ancien RPC direct n’est pas implémentée** : elle deviendra obligatoire avant de desserrer la contrainte V1 ou d’écrire la première ligne N1. Étendre uniquement la contrainte et ajouter un writer N1 laisserait ce risque ouvert. Le test SQL correspondant reste NOT_RUN.

Aucune migration n’est rédigée ou appliquée dans C-A ; ces points définissent son impact futur. Aucun Save/Reload distant, CAS distant, Auth/RLS réel, FRESH relationnel ou Apply n’est reçu. Le gate `COMPOSER_ROOT_RELATIONS_ENABLED` reste inchangé et la PR de cette tranche doit rester Draft.
