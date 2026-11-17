alter table public.merchants
  drop constraint merchants_identity_kind_check,
  add constraint merchants_identity_kind_check check (
    identity_kind in ('commercial', 'private_person', 'personal_transfer_label', 'payment_instrument', 'unknown')
  );

insert into public.merchant_activities (activity_key, sector, label, badge_category) values
  ('CAR_RENTAL_DEPOSIT_REFUND', 'Transports et automobile', 'Location de voiture / restitution de caution', null),
  ('FIREFIGHTER_ASSOCIATION', 'Services, études et associations', 'Association de sapeurs-pompiers', 'ASSOCIATION'),
  ('DUTY_FREE', 'Voyage et hébergement', 'Commerce aéroportuaire / duty-free', 'SHOP'),
  ('GAME_BAR', 'Restauration et boissons', 'Bar à jeux / jeux de société', 'BAR'),
  ('BAR_RESTAURANT', 'Restauration et boissons', 'Bar / restaurant', 'BAR'),
  ('PORTUGUESE_RESTAURANT', 'Restauration et boissons', 'Restaurant portugais / grillades', 'RESTAURANT'),
  ('RAIL_CATERING', 'Voyage et hébergement', 'Restauration en gare', 'RESTAURANT'),
  ('CAR_RENTAL_BOOKING', 'Transports et automobile', 'Plateforme de réservation de voitures de location', 'CAR_RENTAL'),
  ('URBAN_SPORTS_EVENTS', 'Sport, loisirs et culture', 'Organisation d’événements sportifs / sports urbains', 'TICKETS'),
  ('WATCHES_JEWELRY', 'Commerces et achats', 'Horlogerie et bijouterie', 'SHOP'),
  ('CAFE_BRASSERIE', 'Restauration et boissons', 'Bar / café-brasserie', 'BAR'),
  ('TAPAS_BAR', 'Restauration et boissons', 'Bar-restaurant / tapas', 'BAR'),
  ('TRANSPORT_DIGITAL_TICKETING', 'Transports et automobile', 'Transport / billetterie numérique', 'TRANSPORT'),
  ('INSURANCE_ADMIN', 'Banque, assurance et paiements', 'Gestion déléguée d’assurance santé et prévoyance', 'INSURANCE'),
  ('FOOD_TRUCK_ASIAN', 'Restauration et boissons', 'Food truck / restauration asiatique', 'RESTAURANT'),
  ('HYPERMARKET', 'Alimentation et commerces de bouche', 'Hypermarché', 'GROCERIES');

notify pgrst, 'reload schema';
