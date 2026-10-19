# G0 ciblé27 — état initial9b69e89

PR68 ouverte, branchecodex/bar-subassets-r5 préservée, main/Production5f98040 READY. Worktree initial :outputs non suivi conservé.222 IDs,76 décisions,27A restantes exactes (19 PARTIAL,4 preuve navigateur,4 owner). Aucun écart de liste.

|ID|Statut initial|Cause / travail minimal|Preuve attendue|
|---|---|---|---|
|UI-007|PARTIAL|Valeurs éditables directement ; le bouton secondaire de coût reste un doublon visible dans la carte.|Test ciblé React puis navigateur au SHA du lot|
|UI-035|PARTIAL|Google mock PASS et repli utile ; un appel réel Preview1 indisponible. Pas de répétition aveugle.|Test ciblé React puis navigateur au SHA du lot|
|UI-045|IMPLEMENTED_NOT_BROWSER_PROVEN|Nom/commune attestée sur lieux connus ; échantillon des noms longs réels non certifié.|Test ciblé React puis navigateur au SHA du lot|
|UI-046|PARTIAL|Gabarit borné et libellés accessibles ; noms longs et photos tardives non certifiés.|Test ciblé React puis navigateur au SHA du lot|
|UI-078|IMPLEMENTED_NOT_BROWSER_PROVEN|Code existant slice(0,3), puis +N ; trois participants testés, plus de trois non testés en navigateur.|Test ciblé React puis navigateur au SHA du lot|
|UI-093|IMPLEMENTED_NOT_BROWSER_PROVEN|Indice d’overflow CSS ajouté et associé à la mesure réelle ; perception visuelle finale à revoir.|Test ciblé React puis navigateur au SHA du lot|
|UI-095|PARTIAL|Tuiles bornées par famille ; noms extrêmes et grands catalogues visuels non certifiés.|Test ciblé React puis navigateur au SHA du lot|
|UI-096|PARTIAL|Retour à la ligne autorisé ; pas de preuve navigateur150 avec libellés longs.|Test ciblé React puis navigateur au SHA du lot|
|UI-097|PARTIAL|Suggestions propriétaires réutilisées ; aucun nouvel ordonnancement historique inventé, couverture de pertinence non certifiée.|Test ciblé React puis navigateur au SHA du lot|
|UI-100|PARTIAL|Rafale d’ajouts garde le rail ; hauteurs par nature diffèrent légèrement et petit viewport requiert document de secours.|Test ciblé React puis navigateur au SHA du lot|
|UI-101|PARTIAL|Faux reports supprimés ; le mode other admissible reste visible sans description libre complète.|Test ciblé React puis navigateur au SHA du lot|
|UI-119|PARTIAL|Réutilisation limitée aux assets admissibles Bar/club/house_party ; pas d’import arbitraire de tout le catalogue Restaurant.|Test ciblé React puis navigateur au SHA du lot|
|UI-124|PARTIAL|Même limite owner que UI119 ; aucun second scénario ni demande date/lieu/personnes lors d’ajout compatible.|Test ciblé React puis navigateur au SHA du lot|
|UI-129|BLOCKED_OWNER|ComponentSelectionV1 ne conserve pas les parts par payeur/remboursements ; aucune UI de partage financier fictive.|Décision de contrat distincte, pas de faux PASS|
|UI-130|BLOCKED_OWNER|Pas de dock de répartition financière sans contrat de parts du poste ; présence reste indépendante.|Décision de contrat distincte, pas de faux PASS|
|UI-133|PARTIAL|Le coût ouvre sa portée sûre existante, mais pas un popover ancré à la valeur. Aucun agrégat Compiler écrasable.|Test ciblé React puis navigateur au SHA du lot|
|UI-141|PARTIAL|Quantité/prix/unité/funding accessibles ; répartition financière bloquée par absence de parts propriétaire.|Test ciblé React puis navigateur au SHA du lot|
|UI-142|BLOCKED_OWNER|Partage financier non activé : ne pas confondre contacts de présence et payeurs.|Décision de contrat distincte, pas de faux PASS|
|UI-148|PARTIAL|Compteur et prix courts livrés ; avatars de partage non activés faute de contrat financier.|Test ciblé React puis navigateur au SHA du lot|
|UI-156|PARTIAL|Clay voiture/train/bus/marche réutilisé ; Taxi reste un fallback iconographique, harmonisation complète non certifiée.|Test ciblé React puis navigateur au SHA du lot|
|UI-160|BLOCKED_OWNER|Mode other existant mais description libre nommée absente du contrat ; pas de champ éphémère trompeur.|Décision de contrat distincte, pas de faux PASS|
|UI-166|IMPLEMENTED_NOT_BROWSER_PROVEN|Asset walking Clay référencé ; lisibilité petite taille pas certifiée séparément.|Test ciblé React puis navigateur au SHA du lot|
|UI-186|PARTIAL|Clay existant prioritaire ; certains produits/modes restent des icônes, pas de nouvelle image inventée.|Test ciblé React puis navigateur au SHA du lot|
|UI-187|PARTIAL|Images existantes utilisées ; fallback générique encore visible pour certains produits, notamment Cocktail.|Test ciblé React puis navigateur au SHA du lot|
|UI-198|PARTIAL|Recadrage dock corrigé ; miniatures sur objets admis restent petites, visibles sur capture finale. Pas de PASS de lisibilité globale.|Test ciblé React puis navigateur au SHA du lot|
|UI-203|PARTIAL|Découpe parent130px corrigée ; à1152 le dock résumé nécessite le document de secours, zoom125 non vérifiable.|Test ciblé React puis navigateur au SHA du lot|
|UI-204|PARTIAL|Ancrage et réserve vide corrigés localement ; visibilité garantie sur tous états denses et125% non certifiée.|Test ciblé React puis navigateur au SHA du lot|

Owners et proposition groupée :closure27-owner-decision.md. Les78A restent acquises à leur niveau, seules les dépendances modifiées et régressions intégrées seront rejouées. Auth Draft et zoom restent des gates distincts, aucune migration. L1 éditeur/coût ;L2 lieux/catalogues/modes ;Preview1 ;L3 dock/images ;Preview2 finale.
