# Badges génériques des cartes Composer

Les 103 illustrations génériques du catalogue peuvent être sélectionnées depuis une carte compatible. Le sélecteur propose d’abord les illustrations prévues pour son modèle, selon le tableau de correspondances validé. Les 70 modèles d’intentions possèdent un profil explicite ; les visites privées restent sans badge marchand. Les projets composés conservent les choix propres à chacune de leurs intentions.

La carte mensuelle Courses dispose du même sélecteur, avec sept propositions adaptées. Le filtre « Tous les badges génériques » permet un autre choix volontaire.

Après sélection, le nom de l’entreprise est obligatoire et saisi librement. Le badge et le nom sont enregistrés atomiquement dans la préférence privée de la carte, avec contrôle de version. Aucune fiche marchand n’est créée et aucun rattachement financier n’est modifié. La carte fermée affiche seulement le visuel avec le nom au survol et dans son libellé accessible ; la carte ouverte affiche aussi le nom.

La migration additive `20261117144355_composer_contextual_generic_badges` étend `composer_badge_bindings` avec le visuel générique et le nom libre. Les règles de propriété, les exclusions visuelles et les protections des contreparties privées restent applicables. Les badges spécifiques et les liens de marque du référentiel sont conservés ; un choix générique explicite sur une carte constitue une préférence visuelle locale à celle-ci.

Validation : contrôles ciblés du catalogue et des profils, RLS de deux comptes, sauvegarde/relecture, conflits de version, refus des noms vides et des visuels non génériques, compilation Next.js et parcours navigateur avec rechargement et affichages ouvert/fermé.
