import bindings from './clay-v22-bindings.json';

const root = '/planned-visuals/builder/clay/v22';
type Role = 'primary' | 'compact' | 'wide' | 'specialized';
type ArtworkDefinition = { ratio: string; roles: Partial<Record<Role, number[]>> };
const artworkById: Readonly<Record<string, ArtworkDefinition>> = bindings.artworks;
const assets: Readonly<Record<string, string>> = bindings.assets;
const builders: Readonly<Record<string, string>> = bindings.builders;

/** Presentation metadata only. Never admits an asset or changes its business identity. */
export function clayV22Artwork(visualConceptId: string | undefined, usage: 'compact' | 'builder' | 'header' = 'compact') {
  const definition = visualConceptId ? artworkById[visualConceptId] : undefined;
  if (!definition || !visualConceptId) return undefined;
  const preferred: Role = usage === 'header' ? 'specialized' : usage === 'builder' ? 'wide' : 'compact';
  const role: Role = definition.roles[preferred] ? preferred : 'primary';
  const dimensions = definition.roles[role];
  if (!dimensions) return undefined;
  return { visualConceptId, role, src: `${root}/${role}/${visualConceptId.replaceAll(':', '-')}.webp`,
    width: dimensions[0], height: dimensions[1], fit: usage === 'builder' && role === 'wide' ? 'cover' as const : 'contain' as const };
}

export function clayAssetArtwork(assetKey: string | undefined) {
  const exact = clayV22Artwork(assetKey ? assets[assetKey] : undefined);
  if (exact || !assetKey) return exact;
  // Canonical option keys already published by context-registry; no admission is inferred here.
  const mode = assetKey.match(/^option:[a-z-]+:(?:transport|outbound|return):(car|taxi|train|bus|free)$/)?.[1];
  const modeArt: Readonly<Record<string, string>> = { car: 'car-mode', taxi: 'taxi-vtc-mode', train: 'train-mode', bus: 'bus-mode', free: 'walking-mode' };
  if (mode) return clayV22Artwork(`v22-art:extra:${modeArt[mode]}`);
  const meal = assetKey.match(/^option:[a-z-]+:(?:meal|food|restaurants):(restaurant|fast-food|delivery)$/)?.[1];
  return meal ? clayContextArtwork(meal) : undefined;
}
export function clayBuilderArtwork(semanticKey: string) {
  return clayV22Artwork(builders[semanticKey], 'builder');
}

const contextArt: Readonly<Record<string, string>> = {
  restaurant: 'restaurant-intent', 'fast-food': 'fastfood-intent', delivery: 'delivery-meal-intent',
  activity: 'activity-intent', purchase: 'purchase-intent', 'night-out': 'party-intent',
  'short-stay': 'travel-intent', 'family-visit': 'family-visit', 'friend-visit': 'visit-intent', gift: 'gift-intent',
};
export function clayContextArtwork(templateKey: string | undefined) {
  return clayV22Artwork(templateKey && contextArt[templateKey] ? `v22-art:extra:${contextArt[templateKey]}` : undefined);
}

/** These modes are explicitly published by context-registry.mobility; tickets remain separate. */
export function clayBarArtwork(assetKey: string | undefined) {
  const exact = clayAssetArtwork(assetKey);
  if (exact) return exact;
  if (assetKey === 'shared') return clayV22Artwork('v22-art:extra:bottle-general');
  return undefined;
}
