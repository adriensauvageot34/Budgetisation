import type { ComposerContextCardView, ContextSocketView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel, ComposerSocketPresentation } from "@/domain/phase2/planner/composer-ui-contract";

export type EquipmentGroup = Readonly<{ key: string; title: string; entries: readonly Readonly<{
  socket: ContextSocketView; option: ComposerSocketPresentation["options"][number];
}>[] }>;

const groupConfig: Readonly<Record<string, readonly Readonly<{ key: string; title: string; slots: readonly string[] }>[]>> = {
  "night-out": [
    { key: "before", title: "Avant", slots: ["before"] },
    { key: "moment", title: "Moment", slots: ["main"] },
    { key: "meal", title: "Repas", slots: ["food"] },
    { key: "travel", title: "Aller / retour", slots: ["outbound", "return"] },
    { key: "extras", title: "Compléments", slots: ["extras"] },
  ],
  "short-stay": [
    { key: "lodging", title: "Hébergement", slots: ["lodging"] },
    { key: "groceries", title: "Courses", slots: ["groceries"] },
    { key: "meals", title: "Repas", slots: ["restaurants"] },
    { key: "activities", title: "Activités", slots: ["activities"] },
    { key: "purchases", title: "Achats", slots: ["purchases"] },
    { key: "travel", title: "Transport", slots: ["transport"] },
  ],
};

/** Groups published options by stable slot keys without merging distinct assets. */
export function equipmentGroups(card: ComposerContextCardView, model: ComposerUiModel): readonly EquipmentGroup[] {
  const configured = groupConfig[card.templateKey] ?? card.sockets.map(socket => ({ key: socket.slotKey,
    title: socket.label ?? socket.slotKey, slots: [socket.slotKey] }));
  const covered = new Set(configured.flatMap(group => group.slots));
  const groups = [...configured, ...card.sockets.filter(socket => !covered.has(socket.slotKey)).map(socket => ({
    key: socket.slotKey, title: socket.label ?? socket.slotKey, slots: [socket.slotKey],
  }))];
  return groups.map(group => ({ key: group.key, title: group.title, entries: group.slots.flatMap(slotKey => {
    const socket = card.sockets.find(candidate => candidate.slotKey === slotKey);
    if (!socket) return [];
    const view = model.presentation.sockets[`${card.contextOccurrenceId}:${slotKey}`];
    return (view?.options ?? []).map(option => ({ socket, option }));
  }) })).filter(group => group.entries.length > 0);
}

export type EquipmentRoute = EquipmentGroup["entries"][number];
export type EquipmentTile = Readonly<{ visualKey: string; routes: readonly EquipmentRoute[] }>;
export type DisplayEquipmentGroup = Readonly<{ key: string; title: string; tiles: readonly EquipmentTile[] }>;

/** Only these published identities share one visual object in a given group. */
function visualEquipmentKey(group: string, assetKey: string): string {
  if (group === "meal") {
    const meal = /^(?:template:|option:night-out:food:)(restaurant|fast-food|delivery)$/.exec(assetKey);
    if (meal) return `meal:${meal[1]}`;
  }
  if (group === "travel") {
    const journey = /^option:night-out:(?:outbound|return):(.+)$/.exec(assetKey);
    if (journey) return `travel:${journey[1]}`;
  }
  return assetKey;
}

/** Presentation-only projection: every published option remains a route. */
export function displayEquipmentGroups(card: ComposerContextCardView, model: ComposerUiModel): readonly DisplayEquipmentGroup[] {
  return equipmentGroups(card, model).map(group => {
    const tiles = new Map<string, EquipmentRoute[]>();
    for (const route of group.entries) {
      const key = visualEquipmentKey(group.key, route.option.assetKey);
      const routes = tiles.get(key) ?? [];
      routes.push(route);
      tiles.set(key, routes);
    }
    return { key: group.key, title: group.title, tiles: [...tiles].map(([visualKey, routes]) => ({ visualKey, routes })) };
  });
}
