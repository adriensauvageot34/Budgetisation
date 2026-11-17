create table public.merchant_activities (
  activity_key text primary key check (activity_key ~ '^[A-Z][A-Z0-9_]*$'),
  sector text not null check (length(btrim(sector)) > 0),
  label text not null check (length(btrim(label)) > 0),
  badge_category text check (
    badge_category in (
      'ACTIVITY', 'ASSOCIATION', 'AUTOMOTIVE', 'BAKERY', 'BANK', 'BAR', 'BEAUTY',
      'BUTCHER', 'CAFE', 'CAR_RENTAL', 'CHEESE', 'CLOTHING', 'DIGITAL', 'FLORIST',
      'GARDEN', 'GAS_STATION', 'GROCERIES', 'HAIRDRESSER', 'HEALTH', 'HOME', 'HOTEL',
      'ICE_CREAM', 'INDIAN_RESTAURANT', 'INSURANCE', 'PARKING', 'PAYMENT', 'PHARMACY', 'PHOTO',
      'PROFESSIONAL_SERVICES', 'PUBLIC_SERVICES', 'REAL_ESTATE', 'RESTAURANT', 'SHOP', 'SKI_RENTAL', 'SPORT',
      'TELECOM', 'TICKETS', 'TOBACCO', 'TOURISM', 'TRAINING', 'TRANSPORT', 'UTILITIES',
      'VAPE'
    )
  )
);

alter table public.merchant_activities enable row level security;
revoke all on public.merchant_activities from public, anon, authenticated;
grant select on public.merchant_activities to service_role;

insert into public.merchant_activities (activity_key, sector, label, badge_category) values
  ('PUBLIC_ADMIN', 'Administration et services publics', 'Collectivité / organisme public', 'PUBLIC_SERVICES'),
  ('TAX', 'Administration et services publics', 'Impôts / finances publiques', 'PUBLIC_SERVICES'),
  ('POSTAL', 'Administration et services publics', 'Services postaux', 'PUBLIC_SERVICES'),
  ('BUTCHER', 'Alimentation et commerces de bouche', 'Boucherie / viande', 'BUTCHER'),
  ('BAKERY', 'Alimentation et commerces de bouche', 'Boulangerie / pâtisserie', 'BAKERY'),
  ('COFFEE', 'Alimentation et commerces de bouche', 'Café, torréfaction et caféterie', 'CAFE'),
  ('SWEETS', 'Alimentation et commerces de bouche', 'Confiserie', 'SHOP'),
  ('CHEESE', 'Alimentation et commerces de bouche', 'Fromagerie', 'CHEESE'),
  ('ICECREAM', 'Alimentation et commerces de bouche', 'Glacier', 'ICE_CREAM'),
  ('FOOD_HALL', 'Alimentation et commerces de bouche', 'Halles / marché alimentaire', 'GROCERIES'),
  ('FRESH_FOOD', 'Alimentation et commerces de bouche', 'Produits frais / commerce alimentaire spécialisé', 'GROCERIES'),
  ('SUPERMARKET', 'Alimentation et commerces de bouche', 'Supermarché / hypermarché', 'GROCERIES'),
  ('GROCERY', 'Alimentation et commerces de bouche', 'Épicerie / supérette', 'GROCERIES'),
  ('INSURANCE', 'Banque, assurance et paiements', 'Assurance / courtage', 'INSURANCE'),
  ('EMPLOYEE_BENEFITS', 'Banque, assurance et paiements', 'Avantages salariés / titres-restaurant', 'PAYMENT'),
  ('BANK', 'Banque, assurance et paiements', 'Banque', 'BANK'),
  ('HEALTH_INSURANCE', 'Banque, assurance et paiements', 'Complémentaire santé / gestion santé', 'INSURANCE'),
  ('FINANCE', 'Banque, assurance et paiements', 'Crédit / financement', 'BANK'),
  ('PAYMENTS', 'Banque, assurance et paiements', 'Solution de paiement / titres-restaurant', 'PAYMENT'),
  ('FLORIST', 'Commerces de proximité', 'Fleuriste', 'FLORIST'),
  ('TOBACCO', 'Commerces de proximité', 'Tabac / presse', 'TOBACCO'),
  ('VAPE', 'Commerces de proximité', 'Vape / cigarette électronique', 'VAPE'),
  ('PARTY_SUPPLIES', 'Commerces et achats', 'Articles de fête', 'SHOP'),
  ('WATCHES', 'Commerces et achats', 'Horlogerie', 'SHOP'),
  ('GENERAL_RETAIL', 'Commerces et achats', 'Magasin / bazar multi-produits', 'SHOP'),
  ('DEALS', 'Commerces et achats', 'Offres et réductions en ligne', 'SHOP'),
  ('STATIONERY', 'Commerces et achats', 'Papeterie / fournitures de bureau', 'SHOP'),
  ('MARKETPLACE', 'Commerces et achats', 'Plateforme e-commerce / marketplace', 'SHOP'),
  ('ELECTRONICS', 'Commerces et achats', 'Électronique / culture / médias physiques', 'SHOP'),
  ('WATER', 'Habitat et services essentiels', 'Distribution d''eau', 'UTILITIES'),
  ('REAL_ESTATE', 'Habitat et services essentiels', 'Immobilier / gestion immobilière', 'REAL_ESTATE'),
  ('ENERGY', 'Habitat et services essentiels', 'Énergie / fournisseur d''énergie', 'UTILITIES'),
  ('PERSONAL_DESCRIPTOR', 'Hors activité commerciale', 'Description personnelle non commerciale', null),
  ('PERSONAL_LABEL', 'Hors activité commerciale', 'Libellé personnel / contrepartie', null),
  ('PERSON', 'Hors activité commerciale', 'Personne privée', null),
  ('FURNITURE', 'Maison, bricolage et jardin', 'Ameublement / équipement maison', 'HOME'),
  ('DIY', 'Maison, bricolage et jardin', 'Bricolage / outillage', 'HOME'),
  ('GARDEN', 'Maison, bricolage et jardin', 'Jardinerie', 'GARDEN'),
  ('JEWELRY', 'Mode, beauté et soins', 'Bijouterie / accessoires', 'CLOTHING'),
  ('HAIRDRESSER', 'Mode, beauté et soins', 'Coiffure / barbier', 'HAIRDRESSER'),
  ('CHILDREN_RETAIL', 'Mode, beauté et soins', 'Mode et articles pour enfants', 'CLOTHING'),
  ('COSMETICS', 'Mode, beauté et soins', 'Parfumerie / cosmétiques', 'BEAUTY'),
  ('TATTOO', 'Mode, beauté et soins', 'Tatouage', 'BEAUTY'),
  ('FASHION', 'Mode, beauté et soins', 'Vêtements / mode', 'CLOTHING'),
  ('DIGITAL', 'Numérique et abonnements', 'Application / logiciel / service numérique', 'DIGITAL'),
  ('AI_SOFTWARE', 'Numérique et abonnements', 'Application et logiciel d''IA', 'DIGITAL'),
  ('GAMING', 'Numérique et abonnements', 'Jeux vidéo / plateforme de jeux', 'DIGITAL'),
  ('MUSIC_STREAM', 'Numérique et abonnements', 'Musique / streaming / abonnement audio', 'DIGITAL'),
  ('SOCIAL', 'Numérique et abonnements', 'Réseau social / application', 'DIGITAL'),
  ('DIGITAL_STORAGE', 'Numérique et abonnements', 'Stockage / abonnement cloud', 'DIGITAL'),
  ('TELECOM', 'Numérique et abonnements', 'Télécommunications / internet', 'TELECOM'),
  ('VIDEO_STREAM', 'Numérique et abonnements', 'Vidéo / streaming / abonnement vidéo', 'DIGITAL'),
  ('BAR', 'Restauration et boissons', 'Bar / café-bar', 'BAR'),
  ('BRASSERIE', 'Restauration et boissons', 'Brasserie / pub', 'BAR'),
  ('CAFE', 'Restauration et boissons', 'Café / salon de thé', 'CAFE'),
  ('NIGHTLIFE', 'Restauration et boissons', 'Club / établissement de nuit', 'BAR'),
  ('DELIVERY', 'Restauration et boissons', 'Livraison de repas', 'RESTAURANT'),
  ('PIZZA', 'Restauration et boissons', 'Pizzeria', 'RESTAURANT'),
  ('RESTAURANT', 'Restauration et boissons', 'Restaurant', 'RESTAURANT'),
  ('ASIAN', 'Restauration et boissons', 'Restaurant asiatique / sushi', 'RESTAURANT'),
  ('INDIAN', 'Restauration et boissons', 'Restaurant indien', 'RESTAURANT'),
  ('FASTFOOD', 'Restauration et boissons', 'Restauration rapide', 'RESTAURANT'),
  ('CATERING', 'Restauration et boissons', 'Traiteur / restauration événementielle', 'RESTAURANT'),
  ('MEDICAL', 'Santé et soins', 'Médecin / soins médicaux', 'HEALTH'),
  ('HEALTH_PUBLIC', 'Santé et soins', 'Organisme public de santé', 'PUBLIC_SERVICES'),
  ('PHARMACY', 'Santé et soins', 'Pharmacie', 'PHARMACY'),
  ('HEALTH_PLATFORM', 'Santé et soins', 'Service numérique de santé', 'HEALTH'),
  ('DENTAL', 'Santé et soins', 'Soins dentaires', 'HEALTH'),
  ('PAYMENT_LABEL', 'Services et finance', 'Libellé ou instrument de paiement', 'PAYMENT'),
  ('ASSOCIATION', 'Services, études et associations', 'Association / organisation', 'ASSOCIATION'),
  ('EDUCATION_EVENT', 'Services, études et associations', 'Formation / événement pédagogique', 'TICKETS'),
  ('TRAINING', 'Services, études et associations', 'Formation professionnelle', 'TRAINING'),
  ('PHOTO', 'Services, études et associations', 'Photomaton / photographie', 'PHOTO'),
  ('REPROGRAPHY', 'Services, études et associations', 'Reprographie / impression', 'PHOTO'),
  ('BUSINESS_SERVICES', 'Services, études et associations', 'Service professionnel / prestation', 'PROFESSIONAL_SERVICES'),
  ('SPORT_STORE', 'Sport, loisirs et culture', 'Articles de sport', 'SPORT'),
  ('TICKETING', 'Sport, loisirs et culture', 'Billetterie / événement / festival', 'TICKETS'),
  ('BOWLING', 'Sport, loisirs et culture', 'Bowling', 'ACTIVITY'),
  ('KAYAK', 'Sport, loisirs et culture', 'Canoë / kayak', 'ACTIVITY'),
  ('AXE_THROWING', 'Sport, loisirs et culture', 'Lancer de haches', 'ACTIVITY'),
  ('SKI_RENTAL', 'Sport, loisirs et culture', 'Location de ski / équipement', 'SKI_RENTAL'),
  ('LEISURE', 'Sport, loisirs et culture', 'Loisirs et activités', 'ACTIVITY'),
  ('MUSEUM', 'Sport, loisirs et culture', 'Musée / lieu de visite', 'ACTIVITY'),
  ('FITNESS', 'Sport, loisirs et culture', 'Salle de sport / fitness', 'SPORT'),
  ('SKI_RESORT', 'Sport, loisirs et culture', 'Station de ski / remontées mécaniques', 'SPORT'),
  ('SPORT_EVENT', 'Sport, loisirs et culture', 'Événement / compétition sportive', 'TICKETS'),
  ('EVENTS', 'Sport, loisirs et culture', 'Événement / organisation culturelle', 'TICKETS'),
  ('TOLLS', 'Transports et automobile', 'Autoroute / péage', 'TRANSPORT'),
  ('AIRLINE', 'Transports et automobile', 'Compagnie aérienne', 'TRANSPORT'),
  ('AUTO_INSPECTION', 'Transports et automobile', 'Contrôle technique automobile', 'AUTOMOTIVE'),
  ('CAR_RENTAL', 'Transports et automobile', 'Location de voiture', 'CAR_RENTAL'),
  ('PARKING', 'Transports et automobile', 'Parking / stationnement', 'PARKING'),
  ('CAR_PARTS', 'Transports et automobile', 'Pièces et équipements auto', 'AUTOMOTIVE'),
  ('CAR_SERVICE', 'Transports et automobile', 'Service automobile / garage', 'AUTOMOTIVE'),
  ('FUEL', 'Transports et automobile', 'Station-service / carburant', 'GAS_STATION'),
  ('TRAIN', 'Transports et automobile', 'Train / transport ferroviaire', 'TRANSPORT'),
  ('TRANSIT', 'Transports et automobile', 'Transport public local', 'TRANSPORT'),
  ('VTC', 'Transports et automobile', 'VTC / transport à la demande', 'TRANSPORT'),
  ('TRAVEL_RETAIL', 'Voyage et hébergement', 'Commerce aéroportuaire / de voyage', 'SHOP'),
  ('HOTEL', 'Voyage et hébergement', 'Hébergement / hôtel', 'HOTEL'),
  ('AIRPORT_CATERING', 'Voyage et hébergement', 'Restauration aéroportuaire / concessions', 'RESTAURANT'),
  ('TOURISM', 'Voyage et hébergement', 'Tourisme / activités et réservations', 'TOURISM'),
  ('UNKNOWN', 'À déterminer', 'Activité non identifiée', null),
  ('RECORDED_SHOW', 'Sport, loisirs et culture', 'Production / diffusion de spectacles filmés (location vidéo)', 'ACTIVITY'),
  ('FINE_GROCERY', 'Alimentation et commerces de bouche', 'Épicerie fine / chocolaterie', 'GROCERIES'),
  ('CAFETERIA', 'Restauration et boissons', 'Cafétéria / boutique hospitalière', 'CAFE'),
  ('VENDING_COFFEE', 'Restauration et boissons', 'Distribution automatique de café / boissons chaudes', 'CAFE');

alter table public.merchants
  add column activity_key text not null default 'UNKNOWN' references public.merchant_activities (activity_key),
  add column activity_review_required boolean not null default false;

comment on column public.merchants.activity_key is
  'Merchant activity, independent of financial classification, identity kind and badge policy.';
comment on column public.merchants.activity_review_required is
  'An uncertain activity is shown in the catalog but does not supply an automatic badge fallback.';

alter table public.merchants
  drop constraint merchants_generic_badge_category_check,
  add constraint merchants_generic_badge_category_check check (
    generic_badge_category in (
      'ACTIVITY', 'ASSOCIATION', 'AUTOMOTIVE', 'BAKERY', 'BANK', 'BAR', 'BEAUTY',
      'BUTCHER', 'CAFE', 'CAR_RENTAL', 'CHEESE', 'CLOTHING', 'DIGITAL', 'FLORIST',
      'GARDEN', 'GAS_STATION', 'GROCERIES', 'HAIRDRESSER', 'HEALTH', 'HOME', 'HOTEL',
      'ICE_CREAM', 'INDIAN_RESTAURANT', 'INSURANCE', 'PARKING', 'PAYMENT', 'PHARMACY', 'PHOTO',
      'PROFESSIONAL_SERVICES', 'PUBLIC_SERVICES', 'REAL_ESTATE', 'RESTAURANT', 'SHOP', 'SKI_RENTAL', 'SPORT',
      'TELECOM', 'TICKETS', 'TOBACCO', 'TOURISM', 'TRAINING', 'TRANSPORT', 'UTILITIES',
      'VAPE'
    )
  );

alter table public.composer_badge_visuals
  drop constraint composer_badge_visuals_category_check,
  add constraint composer_badge_visuals_category_check check (
    category in (
      'ACTIVITY', 'ASSOCIATION', 'AUTOMOTIVE', 'BAKERY', 'BANK', 'BAR', 'BEAUTY',
      'BUTCHER', 'CAFE', 'CAR_RENTAL', 'CHEESE', 'CLOTHING', 'DIGITAL', 'FLORIST',
      'GARDEN', 'GAS_STATION', 'GROCERIES', 'HAIRDRESSER', 'HEALTH', 'HOME', 'HOTEL',
      'ICE_CREAM', 'INDIAN_RESTAURANT', 'INSURANCE', 'PARKING', 'PAYMENT', 'PHARMACY', 'PHOTO',
      'PROFESSIONAL_SERVICES', 'PUBLIC_SERVICES', 'REAL_ESTATE', 'RESTAURANT', 'SHOP', 'SKI_RENTAL', 'SPORT',
      'TELECOM', 'TICKETS', 'TOBACCO', 'TOURISM', 'TRAINING', 'TRANSPORT', 'UTILITIES',
      'VAPE'
    )
  );

alter table public.composer_badge_bindings
  drop constraint composer_badge_bindings_category_check,
  add constraint composer_badge_bindings_category_check check (
    category in (
      'ACTIVITY', 'ASSOCIATION', 'AUTOMOTIVE', 'BAKERY', 'BANK', 'BAR', 'BEAUTY',
      'BUTCHER', 'CAFE', 'CAR_RENTAL', 'CHEESE', 'CLOTHING', 'DIGITAL', 'FLORIST',
      'GARDEN', 'GAS_STATION', 'GROCERIES', 'HAIRDRESSER', 'HEALTH', 'HOME', 'HOTEL',
      'ICE_CREAM', 'INDIAN_RESTAURANT', 'INSURANCE', 'PARKING', 'PAYMENT', 'PHARMACY', 'PHOTO',
      'PROFESSIONAL_SERVICES', 'PUBLIC_SERVICES', 'REAL_ESTATE', 'RESTAURANT', 'SHOP', 'SKI_RENTAL', 'SPORT',
      'TELECOM', 'TICKETS', 'TOBACCO', 'TOURISM', 'TRAINING', 'TRANSPORT', 'UTILITIES',
      'VAPE'
    )
  );

notify pgrst, 'reload schema';
