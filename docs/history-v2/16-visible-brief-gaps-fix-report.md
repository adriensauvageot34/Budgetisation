# History V2 — migration de compatibilité et écarts visibles

## Périmètre et causes confirmées

Base de travail : `e9eeba96a0b076692544816b67f1b2ab9e37a93a` sur `main`, sans divergence avec `origin/main` au contrôle pré-commit.

- Calendar rendait `iconKey` comme texte au lieu d'utiliser une icône UI.
- Calendar Semantic conservait un `life_events.title` technique lorsqu'il était identique à `type_key`; le catalogue n'exposait pas de libellé public pour chacun des 25 types.
- Les Markers et Ribbons n'imposaient pas les contraintes de réduction nécessaires dans une cellule étroite.
- M3 publiait déjà `shareOfActual`, mais React ne l'affichait pas.
- M3 ne publiait pas les contributeurs compacts au niveau du mois.
- M4 classait les Activities avant d'écarter celles dont `occurrences = 0`.
- Une signature Query fait partie de `query_key`. Une transition naïve aurait donc rendu OLD illisible avant le Finalize NEW, ou aurait permis deux générations actives. La lecture et l'activation ont été traitées comme deux problèmes distincts.

## Architecture de compatibilité OLD / NEW

La compatibilité est une liste fermée de signatures, jamais un schéma permissif :

1. `historyV2AcceptedMethodSignatures()` ne retourne que `current` et, pour les ressources réellement touchées, `history_v2_visible_gaps_legacy`.
2. Le store interroge les couples exacts `query_key + method_signature`, exige `is_active`, `invalidated_at is null`, une `publication_id` et une publication `published`.
3. Le RuntimeSchema est choisi à partir de la variante reconnue. Seul M3 possède deux formes : `oldMonthSpendingNatureReadModelSchema` et `newMonthSpendingNatureReadModelSchema`, toutes deux strictes.
4. Une signature inconnue, une ambiguïté active ou un payload invalide est refusé. Pour History V2, l'échec ne déclenche jamais de read-through Analytics.
5. La vague live finalise chaque DRAFT avec le RPC officiel dans une transaction qui désactive aussi les autres lignes `contract_version = v2` du même mois. La publication NEW devient donc la seule génération active; les lignes OLD restent stockées et le RPC de rollback peut les réactiver.

Signatures OLD autorisées et NEW produites :

| Ressource migrée | OLD | NEW |
|---|---|---|
| `history_month_calendar` | `12d5d82c863f2cbb3ff17e19f0f3e27ce11e7a0fceb44180e6d377c5287c1449` | `62416a0294ce7e8bb08b1f92a2083854322404cf495a3682f214cfc52beee44c` |
| `history_week` | `4b3227f4a40369ad2919184aeca9cd7885b56ee40ca1c6632e4a4ec2d741503a` | `488a70d46bac6b6cd0bf657eb616e00b56d6a8f38a83094dc4b3e01d430b946b` |
| `history_day_journal` | `0a4a8b44d656a82aebba8021755ac82d5f2bed62e3e018ffc7410a4510b9f3b2` | `5072f04a7cfa455073d823f5b1737a03a930f7282fc023b5ae3215160a0137c0` |
| `history_month_overview` | `f1368f8102e108964053dccea31642cc1a7e140a675b50e8c616037787d7f2e6` | `d089ff6d4d3aab473e30fe2b6b4c4aa4c0c3332813db3f9f59b8fc0ca0dcf675` |
| `history_category_detail` | `b4596dd65bcc99a9b73fec48fef60a098454172bd82e412a597b324a37cf81b1` | `ed84263e57c20f516f169fd195accc5a40238514df78d2739fa74ab6f19f9140` |
| `history_month_spending_nature` | `eff62c4ef7fbcbefe71c464fbad70e3c5bd21fcb8dabc905958ae9aef221e58c` | `465ac1eaa14fc54339ce4cdbdc8d46cd40606bae988a21c71e4bcf041fba706a` |
| `history_spending_segment_detail` | `550a1a06485319de31f22ed2f53b22c35ebd8213b1d1c18347619aa60cdc7f30` | `de6260311627fb1ae98d05eb39074153bca967f978226c1d927e8fdb8b2be80b` |
| `history_minimal_preview` | `32e6b79da5a0c551f1de2bf9e91835a10ccdc2ab836816c9eee0246601b683d9` | `3b25abf864250763ca7f8796b3a3f5946ef9134d566b55fbd2ff86f37640f9a0` |
| `history_month_life_money` | `52b34c4790f8e510077a1abfff99ce99775b95621eacb5189db7ad6e2c96ca79` | `fe3bf74c367562f6dcc9b14fad0627c323d0a22d7db69f2658b8b3b3ba4934b8` |
| `history_activity_detail` | `efccbe4e56f7fdab31ad88d85e5aa39a874077fea6e60a6fe052db668e3ae900` | `73cd3766389ff6b7256c01a598e448ef72c98be84856609e1b1a991c86e0c416` |
| `history_moment_detail` | `0128ef63e90962ed60943891086b2c8178812235523368712cf176a20da7d5e2` | `e89ff71e251d902fae4619822b0aa4ac6543f79124daa415811a5b497f1f88a4` |
| `history_place_detail` | `8f53a8286b3d4f2b93fa50c628513a8fa7ac8177aa575c72439c4e32408931f9` | `f4726916eac3956838912135bc22280e092e555fb899c0c23ad7cd94a51eb3c8` |

Les trois autres familles (`history_month_balance_summary`, `history_bank_economy_bridge`, `history_month_categories`) gardent leur signature : aucune version artificielle.

## Corrections

### Calendar

- `HistorySemanticIcon` couvre toutes les clés des catalogues et utilise `Circle` comme fallback neutre.
- Month, Week, Ribbons, overflow et Hover n'affichent plus la chaîne `iconKey`.
- Les 25 Life Events/Activities ont un `publicLabel` explicite. Les 20 Moments réutilisent leur label public canonique.
- Un titre explicite réellement humain reste prioritaire. Un titre égal au `typeKey`/`normalizedKey` est reconnu comme alias technique et remplacé par le label public.
- Les Markers ont une icône stable, `min-width: 0`, deux lignes maximum et un overflow masqué; les Ribbons ont une ellipsis indépendante.

### M3

- React affiche le `shareOfActual` serveur, sans recalcul `amount / Actual`.
- `selectSpendingContributors()` est la primitive commune au top-level et à SegmentDetail : sous-catégorie prioritaire, catégorie fallback, ordre serveur déterministe, maximum 3, puis `otherAmount` serveur.
- NEW publie `segments`; OLD continue à afficher les axes et la matrice sans reconstruire les contributeurs dans React.

### M4

- `rankActivities()` élimine `occurrences < 1` avant `ActivityInterestScore`, tri et top 6.
- Aucune occurrence, Activity ou donnée canonique n'est fabriquée.

## Versioning et doctrine factsHash

- `calendar_semantics`: `v1 → v2`.
- `spending_nature`: `v1 → v2`.
- `life_money_selection`: `v1 → v2`.
- `history_month_spending_nature` déclare `readModelVersion = history_month_spending_nature@v2`.
- L'artifact Calendar devient `calendar_semantic_month@v3`; Daily Economic reste inchangé.
- `facts_hash` reste `v1`. Aucun hash attendu n'est forcé. La fermeture NEW est recalculée depuis les faits/dépendances réellement atteignables; l'exclusion de détails Activity désormais inéligibles peut donc modifier naturellement cette fermeture sans modification des faits canoniques.

## Tests ciblés

| Contrôle | Résultat |
|---|---:|
| Calendar + Daily discriminants | `33/33 PASS` |
| Month Balance M3/M4 | `74/74 PASS` |
| Compatibilité matérialisation | `72 checks PASS` |
| Frontend resources | `15/15 PASS` |
| UX contracts | `132/132 PASS` |
| `tsc --noEmit` | PASS |
| `next build` | PASS |
| `git diff --check` | PASS |

Le gate de transition couvre explicitement : code NEW + snapshot OLD, code NEW + snapshot NEW, signature inconnue refusée, payload invalide refusé sans read-through. Le contrôle React ciblé confirme les clés stables, les boutons typés, les icônes décoratives `aria-hidden`, l'absence de logique métier reconstruite dans les composants et l'absence de nouveau cycle d'effet.

## Pré-flight et vague live

Pré-flight READ-ONLY enregistré : 12/12 mois, 15/15 familles par mois, 907/907 RuntimeSchemas, 907 snapshots, 24 artifacts, 0 invariant exhaustif relancé. Digest déterministe : `94e40d2eb2c2ba8c335b72a5021c417b91ac1fb81ee887358ca137c24d766a03`.

Le commit code est le commit contenant ce rapport. Le push unique sur `main`, le Production READY du même SHA, puis les résultats live exacts sont attestés dans la réponse finale de la mission afin de respecter simultanément l'unique push et l'interdiction d'un second commit documentaire.

| Mois | Publication avant | Révision avant | Publication NEW prédéterminée | Révision NEW | Artifacts | Snapshots |
|---|---|---:|---|---:|---:|---:|
| 2025-08 | `de6d9c02-89f4-4e95-95a2-dd4fc8a0068e` | 32 | `bc36be3a-c399-4321-adf8-91e207052af1` | 44 | 2 | 75 |
| 2025-09 | `9197fd61-fc58-4b5b-914d-102ef0489afc` | 33 | `d7c78dbc-589d-472f-a92c-690c5818c723` | 45 | 2 | 72 |
| 2025-10 | `6b6656fb-d10f-488f-a545-a984987d3960` | 34 | `d438beb5-0e4c-4d35-8ff7-b784cb5ffa44` | 46 | 2 | 77 |
| 2025-11 | `501086f5-1565-409f-ab8a-46d4d67ddf01` | 35 | `4574f74c-4372-4fc1-838a-258348aa2582` | 47 | 2 | 77 |
| 2025-12 | `e328d200-3f88-4f60-8a6b-b21a659f26dc` | 36 | `54cfc7ce-5882-4855-9cdf-939646f10ebf` | 48 | 2 | 75 |
| 2026-01 | `a12e0461-e9ab-459a-8bb2-89ab4f81300e` | 37 | `b0e34952-49ca-4e71-a9ab-0769dbb072f8` | 49 | 2 | 79 |
| 2026-02 | `f8c5f388-a142-4a84-a66c-a46bf67d0f4d` | 38 | `1d24dd7c-192f-4ee0-a779-ebb7117ed73b` | 50 | 2 | 72 |
| 2026-03 | `6fee8d67-2dab-4962-9a67-075c78c045ab` | 39 | `55de2d1e-724f-457d-bde6-23c00ef4ec1a` | 51 | 2 | 76 |
| 2026-04 | `c4a4fc15-08f6-4c53-b865-b1104e299791` | 40 | `3f39ebfd-be84-46d1-b704-ea325ec13b7f` | 52 | 2 | 77 |
| 2026-05 | `058d4756-72b1-4aee-afd0-f58ccc7e2cf5` | 41 | `f1d058ff-fd21-4921-9092-ea690582130e` | 53 | 2 | 76 |
| 2026-06 | `1f84d163-b1ec-47d5-9d38-6532d4964c91` | 42 | `2a657452-5d7e-42d1-a203-ee1abaaa581b` | 54 | 2 | 76 |
| 2026-07 | `08ac77f3-ad31-4455-921b-be6e175be65a` | 43 | `3d70fd79-6c46-48a0-a0e0-16470af01e20` | 55 | 2 | 75 |

Les 12 DRAFTs doivent être intégralement staged et franchir ensemble le global barrier avant le premier Finalize. L'ordre de Finalize est strictement chronologique. Les anciennes publications et leurs payloads ne sont pas supprimés.

## Preuves juillet NEW

- Calendar : `lecon_conduite → Leçon de conduite`, `deplacement_pro → Déplacement professionnel`, `pharmacie → Pharmacie`.
- M3 : 12 projections; `shareOfActual` et `otherAmount` présents sur chacune; maximum observé de 3 contributeurs.
- M4 : 6 cartes (`5, 9, 4, 2, 2, 1` occurrences); 0 carte avec `occurrences = 0`.

Le smoke visuel reste volontairement manuel. Aucun Preview, navigateur automatisé, Playwright, screenshot automatisé ou recertification exhaustive n'a été lancé.
