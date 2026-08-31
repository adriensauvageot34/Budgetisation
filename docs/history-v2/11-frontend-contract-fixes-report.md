# History V2 — Frontend contract fixes report

## 1. Causes exactes des deux FAIL

Le premier FAIL venait de la perte de l'identité des Ribbons après sélection
des quatre lanes visibles : le payload ne conservait que le nombre masqué. Le
second venait d'un `history_category_detail` qui ne publiait pas les projections
M3 au grain de la catégorie. Dans les deux cas, React ne pouvait pas satisfaire
le Brief sans reconstruire une doctrine métier interdite.

## 2. Contrats corrigés

- `RibbonOverflowReadModel` publie, par semaine, `count` et la collection
  ordonnée `items` avec identité, titre, icône, intervalle, `sourceRefs` et
  `QueryTargetRef` vers le Journal.
- `CategoryDetailReadModel` publie `classificationViews.necessity`,
  `.behavior` et `.lifeScope`, en réutilisant les structures M3 existantes.
- `count === items.length`, les identités sont uniques et les UNKNOWN restent
  non classés. Aucun maximum de quatre lanes ni comptage analytique n'a changé.

## 3. Types, schemas et builders

Les changements sont bornés aux types/schemas/builders Calendar et Bilan M2/M3,
aux descriptions/versionnements des quatre ressources réellement dépendantes
(`history_month_calendar`, `history_week`, `history_day_journal`,
`history_category_detail`) et aux deux consommateurs frontend. Aucun nouveau
builder métier, aucune 16e ressource et aucun God RPC n'ont été créés.

## 4. Tests discriminants ajoutés

- overflow nul, overflow non nul, cibles exactes, ordre stable, unicité,
  indépendance Marker/Ribbon et conservation de tous les éléments ;
- axes Necessity/Behavior/LifeScope, UNKNOWN non renormalisé, réconciliation au
  total Category et payload totalement préparé côté serveur ;
- menu Ribbon, navigation `QueryTargetRef`, cinq tabs Category, navigation
  clavier et absence de `groupBy`/tri métier React.

Résultats backend déjà acquis : Calendar/Daily `31/31`, ReadModels `23/23`,
Month Balance `64/64`, transversal `48`, matérialisation `50` avec 15 familles.
La certification finale déjà acquise couvre `907/907` RuntimeSchemas,
`348` invariants et `0` FAIL sur les douze mois.

## 5. Versioning

Le `contractVersion` global reste `v2`. Les versions de ReadModel et les
signatures déterministes ont évolué uniquement pour les ressources dont le
payload dépend du nouveau contrat. L'artifact Calendar Semantic passe à sa
méthode V2 ; le Daily Economic Ledger reste inchangé.

## 6. factsHash et policies

Les `factsHash` des douze mois sont inchangés byte-for-byte : aucun fait
canonique consommé n'a changé. Les valeurs de `policyVersions` restent
inchangées ; seules les dépendances déjà existantes nécessaires au détail
Category sont explicitement portées par sa signature.

## 7. Matérialisation et publication live

Les douze publications ont suivi Begin, Stage, barrière globale puis Finalize
atomique. L'état courant acquis est : `analytics_revision=43`, `12/12`
publications, `24/24` artifacts courants, `907/907` snapshots courants,
15 familles par mois, aucun draft et zéro read-through. Les nouveaux champs
Ribbon/Category sont présents live et le rollback reste disponible.

Les anciennes signatures restent conservées physiquement pour l'historique et
le rollback, mais ne sont pas adressables par les nouvelles identités de
ressource. Aucun snapshot actif n'a été édité manuellement.

## 8. État des douze mois

Chaque mois de `2025-08` à `2026-07` est publié et complet. La certification
12 mois a produit un digest déterministe
`88617c4f91004edae2b418889f813be26fba30b55ee504a61a1e514ff3babe7a`.
Aucun écart CODE ni aucune publication partielle active ne subsiste.

## 9. Non-régression V1

V1 reste inchangé : `4865` artifacts, `1538` Query snapshots et `1149`
snapshots Analysis actifs. Aucun moteur V1, aucune route legacy et aucune
primitive de rollback n'ont été retirés.

## 10. Frontend adapté

`RibbonRail` rend le +N depuis `overflow.items` et ouvre uniquement la cible
serveur. Le drawer Category expose Explication, Composition, Nécessité,
Fixe-Variable et Contexte ; les trois derniers tabs rendent directement
`classificationViews[tab]`. Escape, restitution du focus et navigation clavier
des tabs sont conservés. React ne calcule ni regroupement, ni montant, ni part,
ni UNKNOWN.

## 11. Smoke visuel

Le smoke n'a pas pu être terminé à cause de l'environnement local
Next/middleware/browser. Les variables publiques Supabase n'ont pas été copiées
et aucun mécanisme temporaire n'est conservé.

`VISUAL_SMOKE = NOT_COMPLETED_ENVIRONMENT_LIMITATION`

## 12. Re-gate UX01 → UX132

Le gate structurel frontend couvre de nouveau les 132 exigences : `132 PASS`,
`0 FAIL`. UX40 est prouvé par la collection Ribbon structurée et sa cible ;
UX80 par les projections Category préparées serveur. Cette preuve est un gate
code/contrat, distinct du smoke visuel non terminé.

## 13. Nettoyage et divergences restantes

La route admin temporaire, son bundle privé, les fragments base64, les scripts
de transport, le harness de smoke, l'exception middleware et la configuration
de tracing temporaire ont été supprimés. Le générateur de publication a retrouvé
son batch produit légitime. Aucun cutover Production, push, merge, nouvelle
publication ou nouvelle certification n'a été lancé pendant cette clôture.

Aucune divergence contractuelle restante n'est connue pour les deux FAIL de ce
lot. La seule preuve absente reste le smoke visuel, explicitement qualifié.

HISTORY_V2_RIBBON_OVERFLOW_CONTRACT_GATE = PASS

HISTORY_V2_CATEGORY_DETAIL_CONTRACT_GATE = PASS

VISUAL_SMOKE = NOT_COMPLETED_ENVIRONMENT_LIMITATION

HISTORY_V2_FRONTEND_CODE_GATE = PASS
