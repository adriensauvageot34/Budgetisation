import { fixture as contextFixture, state, uuid, householdId, selections, component, mobility, context, activity, night, stay, child } from './planner-contexts.mjs';
import { require } from '../lib/phase2-ts-loader.mjs';
export { state, uuid, householdId, selections, component, mobility, context, activity, night, stay, child };
const { mobilityIntentId } = require('@/domain/phase2/planner/identity');
export const intentId = (n, slot = 'transport') => mobilityIntentId(uuid(n), slot);
export const home = { kind: 'KNOWN', placeId: uuid(9100) }, destination = { kind: 'KNOWN', placeId: uuid(9101) }, shop = { kind: 'KNOWN', placeId: uuid(9102) };
export const journey = (relation, n, options = {}) => ({ relation, certainty: 'CERTAIN', targetIntentId: intentId(n), ...options });
export const car = (options = {}) => mobility('car', 'car', { origin: home, destination, ...options });
export const visit = (n = 100, options = {}, fields = {}, key = 'family-visit') => context(n, key, { transport: selections(car(options)) }, fields);
export function fixture() {
  const world = contextFixture();
  world.mobilityFacts = { places: [home, destination, shop].map((ref, i) => ({ placeId: ref.placeId, name: `Synthetic place ${i}`, commune: null,
    nature: i === 0 ? 'Domicile privé' : 'Loisir', usage: i === 0 ? 'Domicile' : 'Activité', subtype: i === 0 ? 'Domicile principal' : 'Activité',
    privatePlace: i === 0, relationships: [], coordinates: { latitude: 43.6 + i / 100, longitude: 3.89, source: 'CANONICAL' } })),
    vehicle: { vehicleId: uuid(9150), fuelType: 'SP95', label: 'Peugeot 207', consumptionL100Km: '8', fuelPricePerLiter: '1.99',
      fuelPriceSource: 'Synthetic canonical fuel', fuelPriceObservedAt: '2026-10-01T10:00:00Z' }, history: [], evidenceRefs: ['synthetic:canonical-mobility'],
    personalAuthority: { methodVersion: 'global_m7_personal_mobility@v1', costMetricId: 'mobility_usage_estimated_fuel_cost', summaries: [],
      outputHash: 'synthetic-personal-authority', inputHash: 'synthetic-personal-input', liveWrites: 'NONE' } };
  return world;
}
export function providers() {
  const calls = { routes: [], fuel: 0, toll: 0 }, settings = { price: '2.00', missingPrice: false, missingToll: false, routeUnavailable: false };
  return { calls, settings, value: {
    route: { geocode: async () => { throw new Error('UNEXPECTED_GEOCODE'); }, estimateCarRoute: async input => {
      calls.routes.push(structuredClone(input)); if (settings.routeUnavailable) throw new Error('SYNTHETIC_ROUTE_UNAVAILABLE');
      const count = input.coordinates.length - 1;
      return { provider: 'TOMTOM', distanceKm: String(count * 10), liters: String(count), durationSeconds: count * 1000,
        geometry: [{ encodedPolyline: 'synthetic', precision: 5 }], geometryHash: 'same-geometry-for-identity-test', hasToll: false,
        segments: Array.from({ length: count }, () => ({ distanceKm: '10', liters: '1' })), timeBasis: 'PLANNED_DEPARTURE',
        sampleTimes: [input.plannedDate ?? '2026-11-12'], routeMethodRef: 'synthetic-TomTom@v1', consumptionModelRef: 'existing-Peugeot-model@v1' };
    } },
    fuel: { getReference: async () => { calls.fuel++; return settings.missingPrice ? null : { pricePerLiter: settings.price,
      source: 'FR_GOV_FUEL_INSTANT_V2', methodRef: 'synthetic-official-fuel@v1', observedAt: '2026-10-01T12:00:00Z',
      calculatedAt: new Date().toISOString(), quality: 'FRESH', sampleCount: 3, radiusKm: 15, minimum: settings.price, maximum: settings.price }; } },
    toll: { estimateTolls: async route => { calls.toll++; return { status: settings.missingToll ? 'UNAVAILABLE' : 'NONE', amount: settings.missingToll ? null : '0.00',
      currency: 'EUR', provider: 'HERE', methodRef: 'synthetic-HERE@v1', routeImportedFrom: 'TOMTOM', geometryHash: route.geometryHash, components: [] }; } }
  } };
}
