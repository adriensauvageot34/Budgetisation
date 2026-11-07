# Before N2 — clôture Git en Draft

Cette tranche poursuit le candidat de la PR #101, commit
`8bdbcaf8e88d03555e91c81e944a13fdbd18d4c2`, basé sur main
`c53f1fe2abdf6ced0a7aa8756818fefd2ddf7b7b`. Elle conserve le Before descriptif
en CHILD_CONTEXT et sécurise son Save par rejeu des owners existants.

## Comportement reçu localement

- Premier Draft et premier Bar/Apéro avec Before NONE, lieu et participants,
  en un Save puis Reload exact, depuis la source Plan/état vide canonique.
- Gestes mixtes Before, Bar, descriptions d'un autre Context racine et transport
  existant, uniquement par handlers et capabilities publiés.
- Journal borné, identités originales, RAW, Undo/Redo, réconciliation des ACK et
  retries exacts. Une ancienne commande X ne cible jamais automatiquement Y.
- Admission interne gelée, exécuteur SQL dédié, CAS et métadonnée de compatibilité
  monotone ; anciennes entrées Save/Archive/Restore refusées sur le scope promu.
- Inverses spécialisées exactes via owners existants : montant/modes v1,
  montant/modes v2 et restauration des slots après remplacement de couverture.

Les inverses de modes ne sont admises que si l'owner retrouve exactement le
pré-état. L'adoption initiale de mode et certaines métadonnées inactives restent
refusées. Une préférence absente n'est jamais normalisée en NORMAL : son inverse
reste `STOP_LOCAL[OWNER_CONTRACT_REQUIRED]`. Aucun CLEAR_PREFERENCE ni effacement
et recréation du Context n'est introduit.

## Preuves et limites

Voir [le reçu synthétique](evidence/c-n2-cloture-git/receipt.json) et
[les instructions du runner](../../scripts/before-admission/README.md).

- 54 groupes intégrés existants et cinq nouveaux groupes spécialisés, incluant
  explicitement les refus attendus ; service réel, Shell React, HTTP loopback et
  PostgreSQL/PGlite isolé.
- F01–F03, D1 et quatre goldens, TypeScript et vérification du diff reçus.
- Build Next complet : `BASELINE_BUILD_FAILURE`, UnhandledSchemeError node:crypto
  reproduit sur la base #101 propre et le candidat dans les mêmes conditions.
  Aucun build complet PASS revendiqué ; bundle client ciblé reçu séparément.

Le niveau reste EDITOR_LOCAL / SAVED_ISOLATED, avec limites fonctionnelles.
Le canal COMPOSER_BEFORE_DATABASE_URL réel n'est pas provisionné ; l'exécuteur
échoue fermé. La migration locale n'est appliquée sur aucun Supabase distant.
La concurrence PostgreSQL native, Auth/RLS inter-foyers, SAVED_AUTH, le navigateur
et son focus, FRESH et APPLIED restent NOT_RUN. Archive/Restore compatible n'est
pas développé ; le périmètre promu conserve son refus explicite.

Publication exclusivement en PR Draft successeure liée à #101 : aucune permission
de fusion, migration distante, provisioning, activation de flag ou Production.
