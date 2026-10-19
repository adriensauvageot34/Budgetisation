# Décision propriétaire groupée — proposition, non implémentée

Périmètre :UI129/130/142 et UI160. Contrats relus au départ9b69e89 :ComponentSelectionV1, FundingAllocation, mobility-contract, validation EDIT_NIGHT_OUT. Aucun champ de parts/payeurs/remboursements ni libellé libre de mode OTHER publié. FundingAllocation représente une source et un montant, pas une personne ni une créance. SHARED est une unité économique.

## A. Parts financières du poste (UI129/130/142, sous-capacité de141/148)

Représentation candidate à faire approuver par l'owner :objet optionnel versionné component-cost-participation@v1 sur un COMPONENT identifié par selectionId, contenant des parts explicites {partyRef:ProspectivePersonRef, amount:decimal}, avec un payeur déclaré distinct et, seulement si un vrai contrat de créance est approuvé, des remboursements explicitement identifiés. Aucun partage égal implicite, aucune présence transformée en dette. Le traitement du coût du foyer et d'un remboursement doit être décidé par l'owner financier avant de figer le DTO ; cette proposition ne décide pas que le coût total se divise.

Writer/admission :étendre l'admission propriétaire du COMPONENT et EDIT_NIGHT_OUT, vérifier parties admissibles, unicité/identité, montants et invariants de couverture. Dock d'avatars limité au selectionId ciblé, participants proposés d'abord sans présélection. Nouveau contact :association explicite seulement si requise, jamais paiement d'autres postes.

Lecture/Compiler :étendre le même Compiler/Finance V2 pour la projection financière adoptée, préserver total de l'objet, financement, coût du foyer et créances comme notions distinctes. Aucun calcul de parts en React. UNKNOWN si coût non calculable, pas zéro ni répartition inventée.

Persistance/sécurité :round-trip du JSON versionné complet dans Draft/PlanRevision ; compatibilité des anciens JSON sans champ. RLS d'auteur/foyer existante inchangée. Vérifier C0/validateur SQL avant toute évolution ; une migration éventuelle nécessite une revue distincte, aucune exécutée ici.

Validation à prévoir :contrat/admission négatifs, références invalides, total/parts et financement, substitution/addition, deux homonymes, Undo, CAS/réponses perdues, Draft/PlanRevision, Apply/Reload isolés, régressions198 et nouveaux oracles financiers. C'est un lot métier distinct, pas une retouche d'avatars.

Alternative sûre actuelle :quantité/prix/unité/funding du poste entier accessibles ; SHARED reste le coût du lot ; présence indépendante ; aucun bouton de fausse répartition. Statut des trois IDs :BLOCKED_OWNER tant que contrat et preuve manquent.

## B. Mode OTHER nommé (UI160)

Proposition minimale :champ optionnel transportLabel sous une version admissible du MOBILITY_INTENT, uniquement optionKey=other, texte explicite borné120 caractères, sans valeur déduite. DTO, parseur/admission, projections de lecture et sérialisation doivent le conserver ; Compiler traite toujours OTHER, aucun carburant/itinéraire/prix inféré du texte. Undo/CAS/retour autonome et anciennes révisions doivent rester lisibles. Vérifier C0 avant migration éventuelle séparée. Pas de nouvelle table/RLS ni writer observé.

Validation :création/réédition, texte absent/invalide, changement de mode sans coûts hérités, relecture Draft/PlanRevision, Undo, indépendance Aller/Retour. Alternative actuelle :modes publiés utiles, OTHER générique retiré du catalogue principal car il ne satisfait pas la promesse d'un mode nommé ; aucun champ non persisté. Un OTHER déjà enregistré reste lisible dans son trajet et ses coûts restent conservés.

## Accord demandé (un seul arbitrage)

Conserver ces quatre capacités différées pour la réception du lot UI, ou autoriser un lot propriétaire distinct couvrant les contrats/admission/lecture ci-dessus, puis revue séparée de tout SQL nécessaire. Cette mission n'autorise aucune de ces évolutions métier. Les travaux UI indépendants continuent dans les deux cas.
