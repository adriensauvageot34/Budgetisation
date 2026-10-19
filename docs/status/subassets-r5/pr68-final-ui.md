# PR68 — clôture opérationnelle UI (gates externes reportés)

Base contrôlée sur GitHub :34994a6, branche codex/bar-subassets-r5, PR68 ouverte/Draft, main5f98040. Travail historique et78A conservés ; outputs non suivi préservé. Déploiement main→Production automatique, aucune double commande de publication prévue.

Le diff applicatif hérité contient des composants UI et le host de recette protégé. Le serveur de recette ne lit que des faits synthétiques et refuse Apply ; l’ajout est un lieu fictif en mémoire. Les mutations existantes de favoris personnels ne changent pas ; seules leurs suggestions/affichages sont raccordés. Aucun fichier de migration, contrat/domain financier ou writer Draft/Plan/Google/Canonical/Mobility changé par la PR. Pas d’excuse Auth différée pour un writer nouveau.

## Table ciblée G0

| ID | Défaut / preuve manquante | Composant owner | Action / oracle attendu | Statut initial |
|---|---|---|---|---|
| UI093 | Effacement filtre150 sans remesure | ContextPalette | Mesurer les options effectivement rendues, clic/effacement/clavier et fin de rail25/120/150 | FAIL_BROWSER reproduit |
| UI097 | Ordre pertinent, pas de corpus réel | Bar/editor/catalogue | Fixtures lieux connus/sans historique, Before/Au bar, familles ; aucune admission implicite | LOCAL |
| UI100 | Rafale et focus non observés | Dock/editor | Cinq ajouts puis familles, hauteur/rail/focus mesurés | LOCAL |
| UI046 | Résultats tardifs, erreurs, photo | BarPlaceSearch | Mocks loading/error/stale, nom long ; photo non publiée signalée | PARTIAL |
| UI141/148 | Mini-édition supportée vs parts absentes | BarLivingEditor | Quantité/prix/unité/IDs, RAW/Undo ; parts différées | PARTIAL |
| UI203/204/222 | Dock sous viewport1152 | Dock/host/document | Dernière action atteignable par défilement externe et clavier, zéro scroll interne | PARTIAL |
| UI220 | Dernier Redo désactive le bouton focalisé | ComposerShell | Destination d’historique toujours montée ; fermeture coût vers sa propre ancre | PARTIAL |
| UI035/live046 | Fournisseur réel | Capacité existante | Aucun appel live dans ce lot | DEFERRED_EXTERNAL_GOOGLE_REAL |
| Save/Reload réel | Tables isolées absentes | Gate externe | Aucun schéma ou compte ajouté | DEFERRED_AUTH_SAVE_RELOAD |
| UI215/zoom203204 | Zoom natif indisponible | Gate externe | Pas de simulation DPR | DEFERRED_NATIVE_ZOOM_125 |
| UI129/130/142/160 | Parts / OTHER nommé | Contrats propriétaires | Report utilisateur conservé, pas d’extension | DEFERRED_OWNER_APPROVED |

Plan limité : patch overflow et focus, tests ciblés/mocks/parité, une Preview regroupée et réception desktop ; retest uniquement sur défaut observé. Décision de livraison fondée sur ces gates UI. Les55C et la compaction générale ne sont pas développées.

## Reports de certification

Voir [deferred-reception.md](deferred-reception.md). Aucun de ces reports ne devient PASS, ni une condition automatique empêchant une livraison UI sûre.
