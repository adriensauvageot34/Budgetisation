# Réception desktop ciblée — 661bd754699d490dfe3fa9fb9723f807cee3725e

Base 8998ba8f82a3ab72e7d60619bc8c0c81174ce15a. PR #67 Draft dépendante de #66 ; aucun main, migration, Production ou Apply.

## Code corrigé
- shell : Undo d'un Bar retiré restaure une destination de focus et sa page, y compris la recomposition Preview.
- Board : dragenter annule le comportement natif et admet la cible seulement si non busy et non protégée. Le défaut reproduit était un dragenter suivi d'une relâche sans dragover ; auparavant aucun drop. Les mêmes coordonnées produisent désormais un drop natif TRASH, un retrait, puis Undo avec contenu riche et FRESH/SAVED synthétiques. Les protections métier restent dans le résolveur existant.
- carousel : si une recomposition détache le contrôle et laisse BODY, l'éditeur Bar est une destination stable ; un input survivant ou un dialogue ouvert n'est pas remplacé.
- CSS : aides ciblées Bar à12px/#595363, pas un agrandissement général. Contrastes calculés sur les fonds réellement employés : 6.16:1, 7.27:1, 7.1:1, 6.6:1, 6.48:1 ; petits textes des trajets et tuiles vérifiés rendus. UNKNOWN et fraîcheur restent distincts.
- Sonde opt-in barProbe=1 uniquement : événements trusted, Event Timing et ressources autorisées, bornés, sans valeurs ni identités ni requêtes supplémentaires. Les triggers détachés sont corrélés à leur événement déjà capturé, pas à une interaction étrangère.

## Navigateur physique local
Bundle React minifié NODE_ENV=production, backend financier synthétique interdisant fetch externe. Pas un full Next ni une preuve Supabase authentifiée. Neuf scènes exactes summary/drinks/date, 1152×720,1440×900,1920×1080 :0collision, aucune scrollbar interne carte/dock, pagination et scroll externe du Board permis. geometry.json et captures complètes. Les mesures géométriques ont précédé l'ultime changement de sonde (corrélation du trigger détaché) ; mêmes octets CSS/editor/Board/carousel/shell que 661bd754699d490dfe3fa9fb9723f807cee3725e, aucune différence produit géométrique.

Clavier réel : retrait fermé,Ctrl+Z,FRESH puis SAVED, focus sur titre Bar ; RAW8, Escape,Continuer, valeur et focus de prix conservés, Apply indisponible, abandon explicite au clavier. Resize avec récupération vers éditeur/dock, sans voler un input survivant. Les scènes non modifiées réutilisent la réception97/60 existante, aucune déclaration de112/350 parcours physiques.

Drag : traces échouées conservées drag-first-attempts/drag-enter-without-over ; correction puis drag-final.json (événements natifs trusted,drop TRASH, retrait réel, Undo,15 boissons dont homonymes8/9, Before9, date/personnes, voiture UNKNOWN et taxi12 conservés). Annulation sur zone vide sans retrait et disparition corbeille dans drag-cancel-final.json. Aucune injection JS de drag.

Zoom : raccourci natif ctrl+plus essayé, innerWidth/innerHeight/DPR/scale inchangés ; aucune API de zoom ni autre navigateur desktop connecté. NOT_VERIFIABLE125%, aucun DPR ou viewport réduit compté comme zoom. Tactile/mobile OUT_OF_SCOPE_USER_APPROVED, pas PASS.

## Mesures
Event Timing natif jusqu'à la prochaine mise à jour de rendu, arrondi8ms, seuil16ms ; pas une mesure photonique, pas un premier rAF. Pas de durée d'outil Codex. Prix :40 frappes natives, 40/40 observées, P5024ms/P95 descriptif48ms/max48ms ; 0 requête financière pendant RAW. Le relevé initial saturé price-native-40 est conservé mais EXCLU des statistiques.

Retrait par menu, même fixture riche/1440×900/sonde identique :6cycles avant8998 et6après661bd754699d490dfe3fa9fb9723f807cee3725e; séries séquentielles, pas crossover randomisé ni certification P95 robuste. Feedback Event Timing médian48→48ms (plages32–216→40–56). DOM absent/FRESH médian142,3→159,4ms ; sauvegarde synthétique médiane1160,3→1181,8ms. Aucun gain de vitesse démontré. Event Timing, mutation DOM, retour Preview, requêtes réseau et SAVED distincts dans metrics.json. La sauvegarde inclut le debounce ; le temps de requête n'est pas du SQL isolé. R314 reste PARTIAL pour la corrélation authentifiée serveur/World/durable.

## Gates et limites
P1,P2,P3,P4,waves,C8,TypeScript PASS ; parité22×9=198/198, goldens inchangés sur 661bd754699d490dfe3fa9fb9723f807cee3725e. Les RPC et Apply/CAS n'ont pas changé : preuves antérieures pertinentes conservées, non réétiquetées comme nouveaux tests Auth.
Preview exacte ma10l6rq1, dpl_4YS7ubjuSZ7cdZbNCjTrXnE19Zi2 READY : npm run build, Next16.2.6, compilation31,2s, TypeScript31,8s, statiques8/8, Build Completed puis Deployment completed. Page connexion réellement accessible, aucune UI Vercel fonctionnelle déclarée PASS.

H1 : préflight lecture seule déjà réalisé ; publication Global absente,0période certifiée admissible, scope Canonical !=H1. L'accord H1 reçu ne permet pas d'inventer ces préconditions. Aucun compte réactivé, aucune nouvelle publication ou écriture distante. HTTP JWT R337 antérieur intact ; UI riche/FRESH et Google réel non exécutés. Incident personnel ancien non expliqué et non attribué à Global H1. owners.md formalise les seules demandes restantes.

### Comparaison de contraste rendue
Témoin8998 réellement relu : en-tête rgb104,98,118/11px, aides Mobility rgb115,107,96/10px, légendes tuiles rgb115,102,85/10px. Candidat : aides ciblées rgb89,83,99/12px. La légende tarif taxi était plus sombre rgb48,52,70/10px ; elle reste à6,60:1 après harmonisation12px. Tous les contrastes ne sont donc pas annoncés comme augmentés ; les aides gris/beige le sont, et aucune aide ciblée ne descend sous4,5:1. Voir contrast-baseline-rendered.json et geometry.json.
